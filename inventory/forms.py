from decimal import Decimal

from django import forms

from .models import GoodsReceipt, InventoryRequest, Issuance, Product, PurchaseOrder, Supplier


class DateInput(forms.DateInput):
    input_type = "date"


class BasePortalForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            existing_class = field.widget.attrs.get("class", "")
            field.widget.attrs["class"] = f"{existing_class} portal-input".strip()


class ProductForm(BasePortalForm):
    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "product_type",
            "unit",
            "default_location",
            "reorder_level",
            "notes",
        ]


class SupplierForm(BasePortalForm):
    class Meta:
        model = Supplier
        fields = ["name", "contact_person", "phone", "email", "address", "notes"]


class PurchaseOrderForm(BasePortalForm):
    class Meta:
        model = PurchaseOrder
        fields = [
            "issue_date",
            "supplier",
            "product",
            "specifications",
            "quantity_ordered",
            "unit_price",
            "status",
            "arrived_by",
            "location",
            "notes",
        ]
        widgets = {"issue_date": DateInput()}

    def clean(self):
        cleaned_data = super().clean()
        quantity = cleaned_data.get("quantity_ordered") or Decimal("0")
        price = cleaned_data.get("unit_price") or Decimal("0")
        if quantity <= 0:
            self.add_error("quantity_ordered", "Quantity ordered must be greater than zero.")
        if price < 0:
            self.add_error("unit_price", "Unit price cannot be negative.")
        return cleaned_data


class GoodsReceiptForm(BasePortalForm):
    class Meta:
        model = GoodsReceipt
        fields = [
            "purchase_order",
            "product",
            "quantity_received",
            "grn_date",
            "received_by",
            "location",
            "notes",
        ]
        widgets = {"grn_date": DateInput()}

    def clean_quantity_received(self):
        quantity = self.cleaned_data["quantity_received"]
        if quantity <= 0:
            raise forms.ValidationError("Received quantity must be greater than zero.")
        return quantity

    def clean(self):
        cleaned_data = super().clean()
        purchase_order = cleaned_data.get("purchase_order")
        product = cleaned_data.get("product")
        if not product and not (purchase_order and purchase_order.product):
            self.add_error("product", "Select a product or choose a purchase order that already has a product.")
        return cleaned_data


class InventoryRequestForm(BasePortalForm):
    class Meta:
        model = InventoryRequest
        fields = [
            "request_date",
            "requested_by",
            "department",
            "location",
            "product",
            "quantity_requested",
            "manager_email",
            "notes",
        ]
        widgets = {"request_date": DateInput()}

    def clean_quantity_requested(self):
        quantity = self.cleaned_data["quantity_requested"]
        if quantity <= 0:
            raise forms.ValidationError("Requested quantity must be greater than zero.")
        return quantity


class IssuanceForm(BasePortalForm):
    class Meta:
        model = Issuance
        fields = [
            "inventory_request",
            "product",
            "quantity_issued",
            "issue_date",
            "issued_to",
            "issued_by",
            "location",
            "notes",
        ]
        widgets = {"issue_date": DateInput()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["inventory_request"].queryset = InventoryRequest.objects.exclude(
            approval_status=InventoryRequest.STATUS_REJECTED
        ).exclude(
            fulfillment_status=InventoryRequest.FULFILLMENT_ISSUED
        )

    def clean(self):
        cleaned_data = super().clean()
        inventory_request = cleaned_data.get("inventory_request")
        product = cleaned_data.get("product")
        quantity = cleaned_data.get("quantity_issued") or Decimal("0")

        if quantity <= 0:
            self.add_error("quantity_issued", "Issued quantity must be greater than zero.")

        if not product and not (inventory_request and inventory_request.product):
            self.add_error("product", "Select a product or choose a request that already has a product.")

        if inventory_request:
            if inventory_request.product and product and inventory_request.product_id != product.id:
                self.add_error("product", "Product must match the selected request.")
            if quantity > inventory_request.remaining_quantity:
                self.add_error("quantity_issued", "Issued quantity exceeds the remaining request balance.")

        return cleaned_data
