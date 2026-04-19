import re
from decimal import Decimal

from django.db.models import Sum, Value
from django.db.models.functions import Coalesce

from .models import GoodsReceipt, InventoryRequest, Issuance, Product, PurchaseOrder, StockTransaction, Supplier


def generate_document_number(model, field_name: str, prefix: str, padding: int = 3) -> str:
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    highest = 0
    for value in model.objects.values_list(field_name, flat=True):
        if not value:
            continue
        match = pattern.match(value)
        if match:
            highest = max(highest, int(match.group(1)))
    return f"{prefix}-{highest + 1:0{padding}d}"


def current_stock_for_product(product: Product, location: str | None = None) -> Decimal:
    transactions = product.stock_transactions.all()
    if location:
        transactions = transactions.filter(location=location)
    total = transactions.aggregate(total=Coalesce(Sum("quantity"), Value(Decimal("0.00"))))["total"]
    return Decimal(total)


def request_location_stock(inventory_request: InventoryRequest) -> Decimal:
    if not inventory_request.product:
        return Decimal("0.00")
    return current_stock_for_product(inventory_request.product, inventory_request.location)


def inventory_rows():
    products = Product.objects.annotate(
        stock_total=Coalesce(Sum("stock_transactions__quantity"), Value(Decimal("0.00")))
    ).order_by("sku")
    rows = []
    for product in products:
        stock_total = Decimal(product.stock_total)
        rows.append(
            {
                "product": product,
                "stock_total": stock_total,
                "is_low": stock_total <= product.reorder_level,
            }
        )
    return rows


def post_stock_transaction(
    *,
    product: Product,
    quantity: Decimal,
    transaction_type: str,
    reference_type: str,
    reference_number: str,
    location: str,
    transaction_date,
    notes: str = "",
) -> StockTransaction:
    return StockTransaction.objects.create(
        product=product,
        quantity=quantity,
        transaction_type=transaction_type,
        reference_type=reference_type,
        reference_number=reference_number,
        location=location,
        transaction_date=transaction_date,
        notes=notes,
    )


def sync_inventory_request(inventory_request: InventoryRequest) -> InventoryRequest:
    remaining = inventory_request.remaining_quantity
    inventory_request.short_quantity = remaining

    if inventory_request.quantity_issued >= inventory_request.quantity_requested:
        inventory_request.fulfillment_status = InventoryRequest.FULFILLMENT_ISSUED
        inventory_request.approval_status = InventoryRequest.STATUS_ISSUED
    elif inventory_request.quantity_issued > 0:
        inventory_request.fulfillment_status = InventoryRequest.FULFILLMENT_PARTIAL
        inventory_request.approval_status = InventoryRequest.STATUS_PARTIAL
    elif remaining > 0 and inventory_request.purchase_orders.filter(system_generated=True).exists():
        inventory_request.fulfillment_status = InventoryRequest.FULFILLMENT_WAITING_PO
        inventory_request.approval_status = InventoryRequest.STATUS_APPROVED
    else:
        inventory_request.fulfillment_status = InventoryRequest.FULFILLMENT_PENDING
        inventory_request.approval_status = InventoryRequest.STATUS_PENDING

    inventory_request.save(
        update_fields=["short_quantity", "fulfillment_status", "approval_status", "updated_at"]
    )
    return inventory_request


def create_system_purchase_order(
    inventory_request: InventoryRequest,
    shortage_quantity: Decimal,
) -> PurchaseOrder:
    open_po = inventory_request.purchase_orders.filter(
        system_generated=True,
        status__in=[
            PurchaseOrder.STATUS_DRAFT,
            PurchaseOrder.STATUS_PENDING,
            PurchaseOrder.STATUS_PARTIAL,
        ],
    ).first()
    if open_po:
        open_po.shortage_quantity = shortage_quantity
        open_po.quantity_ordered = max(open_po.quantity_ordered, shortage_quantity)
        open_po.save(update_fields=["shortage_quantity", "quantity_ordered", "updated_at"])
        return open_po

    po = PurchaseOrder.objects.create(
        po_number=generate_document_number(PurchaseOrder, "po_number", "PO"),
        issue_date=inventory_request.request_date,
        source_request=inventory_request,
        supplier=None,
        product=inventory_request.product,
        specifications=f"Auto-generated shortage PO for request {inventory_request.request_number}",
        quantity_ordered=shortage_quantity,
        shortage_quantity=shortage_quantity,
        unit_price=Decimal("0.00"),
        po_amount=Decimal("0.00"),
        status=PurchaseOrder.STATUS_DRAFT,
        system_generated=True,
        location=inventory_request.location,
        notes=f"System-generated from request {inventory_request.request_number}",
    )
    return po


def create_issuance_for_request(
    inventory_request: InventoryRequest,
    quantity: Decimal,
    *,
    issue_date,
    location: str,
    issued_by: str,
    notes: str,
    system_generated: bool = True,
) -> Issuance:
    issuance = Issuance.objects.create(
        issue_number=generate_document_number(Issuance, "issue_number", "ISS"),
        inventory_request=inventory_request,
        product=inventory_request.product,
        quantity_issued=quantity,
        issue_date=issue_date,
        issued_to=inventory_request.requested_by,
        issued_by=issued_by,
        location=location,
        notes=notes,
        system_generated=system_generated,
    )
    post_issuance(issuance)
    return issuance


def auto_issue_request_balance(
    inventory_request: InventoryRequest,
    *,
    issue_date,
    location: str | None = None,
    issued_by: str = "System Auto-Issue",
    notes: str = "",
) -> Issuance | None:
    if not inventory_request.product or inventory_request.remaining_quantity <= Decimal("0.00"):
        return None

    issue_location = location or inventory_request.location
    available = current_stock_for_product(inventory_request.product, issue_location)
    quantity_to_issue = min(inventory_request.remaining_quantity, available)
    if quantity_to_issue <= Decimal("0.00"):
        return None

    return create_issuance_for_request(
        inventory_request,
        quantity_to_issue,
        issue_date=issue_date,
        location=issue_location,
        issued_by=issued_by,
        notes=notes or f"System-issued for request {inventory_request.request_number}",
        system_generated=True,
    )


def process_inventory_request(inventory_request: InventoryRequest) -> dict:
    if not inventory_request.product:
        inventory_request.available_quantity = Decimal("0.00")
        inventory_request.short_quantity = inventory_request.quantity_requested
        inventory_request.fulfillment_status = InventoryRequest.FULFILLMENT_PENDING
        inventory_request.save(
            update_fields=["available_quantity", "short_quantity", "fulfillment_status", "updated_at"]
        )
        return {"issued_quantity": Decimal("0.00"), "short_quantity": inventory_request.short_quantity, "purchase_order": None}

    available_stock = request_location_stock(inventory_request)
    inventory_request.available_quantity = available_stock
    inventory_request.approval_status = InventoryRequest.STATUS_APPROVED
    inventory_request.save(update_fields=["available_quantity", "approval_status", "updated_at"])

    issuance = auto_issue_request_balance(
        inventory_request,
        issue_date=inventory_request.request_date,
        location=inventory_request.location,
        notes=f"Auto-issued on request submission {inventory_request.request_number}",
    )
    inventory_request.refresh_from_db()

    shortage_quantity = inventory_request.remaining_quantity
    purchase_order = None
    if shortage_quantity > Decimal("0.00"):
        purchase_order = create_system_purchase_order(inventory_request, shortage_quantity)

    sync_inventory_request(inventory_request)

    return {
        "issued_quantity": issuance.quantity_issued if issuance else Decimal("0.00"),
        "short_quantity": inventory_request.short_quantity,
        "purchase_order": purchase_order,
        "inventory_request": inventory_request,
    }


def post_goods_receipt(receipt: GoodsReceipt) -> dict:
    result = {"stock_posted": False, "auto_issuance": None}
    if receipt.posted or not receipt.product:
        return result

    post_stock_transaction(
        product=receipt.product,
        quantity=receipt.quantity_received,
        transaction_type=StockTransaction.TYPE_RECEIPT,
        reference_type="GRN",
        reference_number=receipt.grn_number,
        location=receipt.location,
        transaction_date=receipt.grn_date,
        notes=receipt.notes,
    )

    receipt.posted = True
    result["stock_posted"] = True

    if receipt.purchase_order:
        po = receipt.purchase_order
        po.quantity_received = (po.quantity_received or Decimal("0.00")) + receipt.quantity_received
        if po.quantity_received >= po.quantity_ordered:
            po.status = PurchaseOrder.STATUS_RECEIVED
        elif po.quantity_received > 0:
            po.status = PurchaseOrder.STATUS_PARTIAL
        po.save(update_fields=["quantity_received", "status", "updated_at"])

        if po.source_request and po.source_request.remaining_quantity > Decimal("0.00"):
            auto_issuance = auto_issue_request_balance(
                po.source_request,
                issue_date=receipt.grn_date,
                location=receipt.location or po.source_request.location,
                notes=f"Auto-issued from GRN {receipt.grn_number}",
            )
            if auto_issuance:
                result["auto_issuance"] = auto_issuance
                receipt.auto_issued_quantity = auto_issuance.quantity_issued
                po.source_request.refresh_from_db()
                sync_inventory_request(po.source_request)

    receipt.save(update_fields=["posted", "auto_issued_quantity", "updated_at"])
    return result


def post_issuance(issuance: Issuance) -> None:
    if issuance.posted or not issuance.product:
        return

    available = current_stock_for_product(issuance.product, issuance.location)
    if available < issuance.quantity_issued:
        raise ValueError("Not enough stock available at the selected location.")

    post_stock_transaction(
        product=issuance.product,
        quantity=issuance.quantity_issued * Decimal("-1"),
        transaction_type=StockTransaction.TYPE_ISSUE,
        reference_type="Issue",
        reference_number=issuance.issue_number,
        location=issuance.location,
        transaction_date=issuance.issue_date,
        notes=issuance.notes,
    )

    issuance.posted = True
    issuance.save(update_fields=["posted", "updated_at"])

    if issuance.inventory_request:
        inventory_request = issuance.inventory_request
        inventory_request.quantity_issued = (
            inventory_request.quantity_issued or Decimal("0.00")
        ) + issuance.quantity_issued
        if inventory_request.quantity_issued >= inventory_request.quantity_requested:
            inventory_request.approval_status = InventoryRequest.STATUS_ISSUED
        else:
            inventory_request.approval_status = InventoryRequest.STATUS_PARTIAL
        inventory_request.save(update_fields=["quantity_issued", "approval_status", "updated_at"])
        sync_inventory_request(inventory_request)


def dashboard_metrics():
    open_requests = InventoryRequest.objects.filter(
        fulfillment_status__in=[
            InventoryRequest.FULFILLMENT_PENDING,
            InventoryRequest.FULFILLMENT_PARTIAL,
            InventoryRequest.FULFILLMENT_WAITING_PO,
            InventoryRequest.FULFILLMENT_READY_FROM_GRN,
        ]
    ).count()
    low_stock_count = sum(1 for row in inventory_rows() if row["is_low"])
    return {
        "product_count": Product.objects.count(),
        "supplier_count": Supplier.objects.count(),
        "open_requests": open_requests,
        "low_stock_count": low_stock_count,
        "pending_shortages": InventoryRequest.objects.filter(short_quantity__gt=Decimal("0.00")).exclude(
            fulfillment_status=InventoryRequest.FULFILLMENT_ISSUED
        ).count(),
        "auto_draft_pos": PurchaseOrder.objects.filter(
            system_generated=True,
            status=PurchaseOrder.STATUS_DRAFT,
        ).count(),
        "auto_fulfilled_requests": InventoryRequest.objects.filter(
            fulfillment_status=InventoryRequest.FULFILLMENT_ISSUED,
            issuances__system_generated=True,
        ).distinct().count(),
        "recent_purchase_orders": PurchaseOrder.objects.select_related("supplier", "product")[:5],
        "recent_requests": InventoryRequest.objects.select_related("product")[:5],
        "recent_movements": StockTransaction.objects.select_related("product")[:8],
    }
