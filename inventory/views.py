from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import GoodsReceiptForm, InventoryRequestForm, IssuanceForm, ProductForm, PurchaseOrderForm, SupplierForm
from .models import GoodsReceipt, InventoryRequest, Issuance, PurchaseOrder, StockTransaction, Supplier
from .services import (
    dashboard_metrics,
    generate_document_number,
    inventory_rows,
    post_goods_receipt,
    post_issuance,
    process_inventory_request,
)


def home(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("dashboard")
    return redirect("login")


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    context = dashboard_metrics()
    context["inventory_preview"] = inventory_rows()[:8]
    return render(request, "inventory/dashboard.html", context)


@login_required
def products_page(request: HttpRequest) -> HttpResponse:
    form = ProductForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Product saved successfully.")
        return redirect("products")
    return render(
        request,
        "inventory/products.html",
        {
            "form": form,
            "rows": inventory_rows(),
        },
    )


@login_required
def suppliers_page(request: HttpRequest) -> HttpResponse:
    form = SupplierForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Supplier saved successfully.")
        return redirect("suppliers")
    return render(
        request,
        "inventory/suppliers.html",
        {
            "form": form,
            "suppliers": Supplier.objects.all(),
        },
    )


@login_required
def purchase_orders_page(request: HttpRequest) -> HttpResponse:
    form = PurchaseOrderForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        purchase_order = form.save(commit=False)
        purchase_order.po_number = generate_document_number(PurchaseOrder, "po_number", "PO")
        purchase_order.po_amount = purchase_order.quantity_ordered * purchase_order.unit_price
        purchase_order.save()
        messages.success(request, f"Purchase order {purchase_order.po_number} created.")
        return redirect("purchase_orders")

    search_query = request.GET.get("q", "").strip()
    status_filter = request.GET.get("status", "").strip()
    source_filter = request.GET.get("source", "").strip()

    purchase_orders = PurchaseOrder.objects.select_related("supplier", "product", "source_request")

    if search_query:
        purchase_orders = purchase_orders.filter(
            Q(po_number__icontains=search_query)
            | Q(supplier__name__icontains=search_query)
            | Q(product__sku__icontains=search_query)
            | Q(product__name__icontains=search_query)
            | Q(specifications__icontains=search_query)
            | Q(source_request__request_number__icontains=search_query)
        )

    if status_filter:
        purchase_orders = purchase_orders.filter(status=status_filter)

    if source_filter == "auto":
        purchase_orders = purchase_orders.filter(system_generated=True)
    elif source_filter == "manual":
        purchase_orders = purchase_orders.filter(system_generated=False)

    return render(
        request,
        "inventory/purchase_orders.html",
        {
            "form": form,
            "purchase_orders": purchase_orders,
            "search_query": search_query,
            "status_filter": status_filter,
            "source_filter": source_filter,
            "status_choices": PurchaseOrder.STATUS_CHOICES,
        },
    )


@login_required
def receipts_page(request: HttpRequest) -> HttpResponse:
    form = GoodsReceiptForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        receipt = form.save(commit=False)
        receipt.grn_number = generate_document_number(GoodsReceipt, "grn_number", "GRN")
        if not receipt.product and receipt.purchase_order and receipt.purchase_order.product:
            receipt.product = receipt.purchase_order.product
        receipt.save()
        result = post_goods_receipt(receipt)
        if receipt.posted:
            if result["auto_issuance"]:
                messages.success(
                    request,
                    (
                        f"Goods receipt {receipt.grn_number} posted to stock and automatically issued "
                        f"{result['auto_issuance'].quantity_issued} units for request "
                        f"{result['auto_issuance'].inventory_request.request_number}."
                    ),
                )
            else:
                messages.success(request, f"Goods receipt {receipt.grn_number} posted to stock.")
        else:
            messages.warning(request, f"Goods receipt {receipt.grn_number} was saved, but no stock was posted.")
        return redirect("receipts")
    return render(
        request,
        "inventory/receipts.html",
        {
            "form": form,
            "receipts": GoodsReceipt.objects.select_related("purchase_order", "purchase_order__source_request", "product"),
        },
    )


@login_required
def requests_page(request: HttpRequest) -> HttpResponse:
    form = InventoryRequestForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        inventory_request = form.save(commit=False)
        inventory_request.request_number = generate_document_number(InventoryRequest, "request_number", "REQ")
        inventory_request.approval_status = InventoryRequest.STATUS_APPROVED
        inventory_request.save()
        result = process_inventory_request(inventory_request)
        if result["purchase_order"] and result["issued_quantity"] > 0:
            messages.success(
                request,
                (
                    f"Request {inventory_request.request_number} partially issued with "
                    f"{result['issued_quantity']} units. Draft PO {result['purchase_order'].po_number} "
                    f"was created for the remaining {result['short_quantity']} units."
                ),
            )
        elif result["purchase_order"]:
            messages.warning(
                request,
                (
                    f"Request {inventory_request.request_number} could not be issued from stock. "
                    f"Draft PO {result['purchase_order'].po_number} was created for {result['short_quantity']} units."
                ),
            )
        else:
            messages.success(
                request,
                f"Request {inventory_request.request_number} was fully issued from available stock.",
            )
        return redirect("requests")
    return render(
        request,
        "inventory/requests.html",
        {
            "form": form,
            "requests": InventoryRequest.objects.select_related("product").prefetch_related("purchase_orders"),
        },
    )


@login_required
@require_POST
def request_status(request: HttpRequest, pk: int, status: str) -> HttpResponse:
    inventory_request = get_object_or_404(InventoryRequest, pk=pk)
    if status not in {
        InventoryRequest.STATUS_APPROVED,
        InventoryRequest.STATUS_REJECTED,
    }:
        messages.error(request, "Unsupported request action.")
        return redirect("requests")
    inventory_request.approval_status = status
    inventory_request.save(update_fields=["approval_status", "updated_at"])
    messages.success(request, f"Request {inventory_request.request_number} marked as {status}.")
    return redirect("requests")


@login_required
def issuance_page(request: HttpRequest) -> HttpResponse:
    form = IssuanceForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        issuance = form.save(commit=False)
        issuance.issue_number = generate_document_number(Issuance, "issue_number", "ISS")
        if issuance.inventory_request and not issuance.product:
            issuance.product = issuance.inventory_request.product
        issuance.save()
        try:
            post_issuance(issuance)
        except ValueError as exc:
            issuance.delete()
            messages.error(request, str(exc))
        else:
            if issuance.posted:
                messages.success(request, f"Issuance {issuance.issue_number} posted successfully.")
            else:
                messages.warning(request, f"Issuance {issuance.issue_number} was saved, but no stock was posted.")
            return redirect("issuance")
    return render(
        request,
        "inventory/issuance.html",
        {
            "form": form,
            "issuances": Issuance.objects.select_related("inventory_request", "product"),
        },
    )


@login_required
def movements_page(request: HttpRequest) -> HttpResponse:
    location_summary = (
        StockTransaction.objects.values("location")
        .annotate(net_quantity=Coalesce(Sum("quantity"), Value(Decimal("0.00"))))
        .order_by("location")
    )
    return render(
        request,
        "inventory/movements.html",
        {
            "movements": StockTransaction.objects.select_related("product"),
            "location_summary": location_summary,
        },
    )
