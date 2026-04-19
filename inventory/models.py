from decimal import Decimal

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Product(TimeStampedModel):
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    product_type = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=50, default="Units")
    default_location = models.CharField(max_length=100, blank=True)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("10.00"))
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sku"]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class Supplier(TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class PurchaseOrder(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending"
    STATUS_PARTIAL = "partial"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending"),
        (STATUS_PARTIAL, "Partially Received"),
        (STATUS_RECEIVED, "Received"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    po_number = models.CharField(max_length=30, unique=True)
    issue_date = models.DateField()
    source_request = models.ForeignKey(
        "InventoryRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    specifications = models.TextField(blank=True)
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    shortage_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    po_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    system_generated = models.BooleanField(default=False)
    arrived_by = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100, blank=True)
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]

    def __str__(self) -> str:
        return self.po_number

    @property
    def remaining_quantity(self) -> Decimal:
        return max(Decimal("0.00"), self.quantity_ordered - self.quantity_received)


class GoodsReceipt(TimeStampedModel):
    grn_number = models.CharField(max_length=30, unique=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2)
    grn_date = models.DateField()
    received_by = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100)
    notes = models.TextField(blank=True)
    auto_issued_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    posted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-grn_date", "-created_at"]

    def __str__(self) -> str:
        return self.grn_number


class InventoryRequest(TimeStampedModel):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PARTIAL = "partial"
    STATUS_ISSUED = "issued"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PARTIAL, "Partially Issued"),
        (STATUS_ISSUED, "Issued"),
    ]
    FULFILLMENT_PENDING = "pending"
    FULFILLMENT_PARTIAL = "partial_issued"
    FULFILLMENT_WAITING_PO = "waiting_po"
    FULFILLMENT_READY_FROM_GRN = "ready_from_grn"
    FULFILLMENT_ISSUED = "issued"
    FULFILLMENT_CHOICES = [
        (FULFILLMENT_PENDING, "Pending"),
        (FULFILLMENT_PARTIAL, "Partially Issued"),
        (FULFILLMENT_WAITING_PO, "Waiting For PO"),
        (FULFILLMENT_READY_FROM_GRN, "Ready From GRN"),
        (FULFILLMENT_ISSUED, "Issued"),
    ]

    request_number = models.CharField(max_length=30, unique=True)
    request_date = models.DateField()
    requested_by = models.CharField(max_length=100)
    department = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    available_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    quantity_requested = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_issued = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    short_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    manager_email = models.EmailField(blank=True)
    approval_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    fulfillment_status = models.CharField(
        max_length=20,
        choices=FULFILLMENT_CHOICES,
        default=FULFILLMENT_PENDING,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-request_date", "-created_at"]

    def __str__(self) -> str:
        return self.request_number

    @property
    def remaining_quantity(self) -> Decimal:
        return max(Decimal("0.00"), self.quantity_requested - self.quantity_issued)


class Issuance(TimeStampedModel):
    issue_number = models.CharField(max_length=30, unique=True)
    inventory_request = models.ForeignKey(
        InventoryRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issuances",
    )
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    quantity_issued = models.DecimalField(max_digits=12, decimal_places=2)
    issue_date = models.DateField()
    issued_to = models.CharField(max_length=100, blank=True)
    issued_by = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100)
    notes = models.TextField(blank=True)
    system_generated = models.BooleanField(default=False)
    posted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-issue_date", "-created_at"]

    def __str__(self) -> str:
        return self.issue_number


class StockTransaction(TimeStampedModel):
    TYPE_RECEIPT = "receipt"
    TYPE_ISSUE = "issue"
    TYPE_ADJUSTMENT = "adjustment"
    TYPE_CHOICES = [
        (TYPE_RECEIPT, "Receipt"),
        (TYPE_ISSUE, "Issue"),
        (TYPE_ADJUSTMENT, "Adjustment"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_transactions")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    reference_type = models.CharField(max_length=50)
    reference_number = models.CharField(max_length=50)
    location = models.CharField(max_length=100, blank=True)
    transaction_date = models.DateField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-transaction_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.reference_number} ({self.quantity})"
