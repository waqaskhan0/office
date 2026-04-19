from django.contrib import admin

from .models import GoodsReceipt, InventoryRequest, Issuance, Product, PurchaseOrder, StockTransaction, Supplier


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "product_type", "default_location", "reorder_level", "is_active")
    search_fields = ("sku", "name", "category")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "phone", "email")
    search_fields = ("name", "contact_person", "email")


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "issue_date", "supplier", "product", "quantity_ordered", "quantity_received", "status")
    list_filter = ("status", "issue_date")
    search_fields = ("po_number", "supplier__name", "product__sku", "product__name")


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ("grn_number", "grn_date", "product", "quantity_received", "location", "posted")
    list_filter = ("posted", "grn_date", "location")
    search_fields = ("grn_number", "product__sku", "product__name")


@admin.register(InventoryRequest)
class InventoryRequestAdmin(admin.ModelAdmin):
    list_display = ("request_number", "request_date", "requested_by", "product", "quantity_requested", "quantity_issued", "approval_status")
    list_filter = ("approval_status", "request_date", "department")
    search_fields = ("request_number", "requested_by", "department", "product__sku", "product__name")


@admin.register(Issuance)
class IssuanceAdmin(admin.ModelAdmin):
    list_display = ("issue_number", "issue_date", "product", "quantity_issued", "issued_to", "location", "posted")
    list_filter = ("posted", "issue_date", "location")
    search_fields = ("issue_number", "product__sku", "product__name", "issued_to")


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ("transaction_date", "product", "transaction_type", "quantity", "location", "reference_number")
    list_filter = ("transaction_type", "transaction_date", "location")
    search_fields = ("reference_number", "product__sku", "product__name")
