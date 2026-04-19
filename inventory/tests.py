from decimal import Decimal

from django.test import TestCase

from .models import GoodsReceipt, InventoryRequest, Product, PurchaseOrder, StockTransaction
from .services import process_inventory_request, post_goods_receipt


class RequestToIssueWorkflowTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            sku="TEST-001",
            name="Test Product",
            category="Testing",
            product_type="Unit",
            default_location="Main Store",
            reorder_level=Decimal("2.00"),
        )

    def create_stock(self, quantity: str, location: str = "Main Store"):
        StockTransaction.objects.create(
            product=self.product,
            quantity=Decimal(quantity),
            transaction_type=StockTransaction.TYPE_RECEIPT,
            reference_type="Opening Stock",
            reference_number=f"OPEN-{quantity}-{location}",
            location=location,
            transaction_date="2026-04-19",
            notes="Test opening stock",
        )

    def create_request(self, quantity: str) -> InventoryRequest:
        request = InventoryRequest.objects.create(
            request_number=f"REQ-{InventoryRequest.objects.count() + 1:03d}",
            request_date="2026-04-19",
            requested_by="Requester",
            department="Operations",
            location="Main Store",
            product=self.product,
            quantity_requested=Decimal(quantity),
            manager_email="requester@example.com",
            approval_status=InventoryRequest.STATUS_APPROVED,
        )
        return request

    def test_full_stock_request_auto_issues_without_po(self):
        self.create_stock("10.00")
        inventory_request = self.create_request("4.00")

        result = process_inventory_request(inventory_request)
        inventory_request.refresh_from_db()

        self.assertEqual(result["short_quantity"], Decimal("0.00"))
        self.assertIsNone(result["purchase_order"])
        self.assertEqual(inventory_request.quantity_issued, Decimal("4.00"))
        self.assertEqual(inventory_request.fulfillment_status, InventoryRequest.FULFILLMENT_ISSUED)
        self.assertEqual(inventory_request.issuances.count(), 1)
        self.assertEqual(
            StockTransaction.objects.filter(transaction_type=StockTransaction.TYPE_ISSUE).count(),
            1,
        )

    def test_zero_stock_request_creates_draft_po_and_auto_issues_after_grn(self):
        inventory_request = self.create_request("6.00")

        result = process_inventory_request(inventory_request)
        inventory_request.refresh_from_db()
        purchase_order = result["purchase_order"]

        self.assertEqual(inventory_request.quantity_issued, Decimal("0.00"))
        self.assertEqual(inventory_request.short_quantity, Decimal("6.00"))
        self.assertEqual(inventory_request.fulfillment_status, InventoryRequest.FULFILLMENT_WAITING_PO)
        self.assertIsNotNone(purchase_order)
        self.assertTrue(purchase_order.system_generated)
        self.assertEqual(purchase_order.status, PurchaseOrder.STATUS_DRAFT)

        receipt = GoodsReceipt.objects.create(
            grn_number="GRN-001",
            purchase_order=purchase_order,
            product=self.product,
            quantity_received=Decimal("6.00"),
            grn_date="2026-04-20",
            received_by="Storekeeper",
            location="Main Store",
        )
        result = post_goods_receipt(receipt)
        inventory_request.refresh_from_db()
        receipt.refresh_from_db()

        self.assertIsNotNone(result["auto_issuance"])
        self.assertEqual(receipt.auto_issued_quantity, Decimal("6.00"))
        self.assertEqual(inventory_request.quantity_issued, Decimal("6.00"))
        self.assertEqual(inventory_request.short_quantity, Decimal("0.00"))
        self.assertEqual(inventory_request.fulfillment_status, InventoryRequest.FULFILLMENT_ISSUED)

    def test_partial_stock_request_issues_partial_and_po_remainder(self):
        self.create_stock("3.00")
        inventory_request = self.create_request("8.00")

        result = process_inventory_request(inventory_request)
        inventory_request.refresh_from_db()
        purchase_order = result["purchase_order"]

        self.assertEqual(result["issued_quantity"], Decimal("3.00"))
        self.assertEqual(result["short_quantity"], Decimal("5.00"))
        self.assertEqual(inventory_request.quantity_issued, Decimal("3.00"))
        self.assertEqual(inventory_request.short_quantity, Decimal("5.00"))
        self.assertEqual(inventory_request.fulfillment_status, InventoryRequest.FULFILLMENT_PARTIAL)
        self.assertEqual(purchase_order.shortage_quantity, Decimal("5.00"))

    def test_multiple_grns_only_issue_remaining_balance(self):
        inventory_request = self.create_request("10.00")
        purchase_order = process_inventory_request(inventory_request)["purchase_order"]

        first_receipt = GoodsReceipt.objects.create(
            grn_number="GRN-010",
            purchase_order=purchase_order,
            product=self.product,
            quantity_received=Decimal("4.00"),
            grn_date="2026-04-20",
            received_by="Storekeeper",
            location="Main Store",
        )
        second_receipt = GoodsReceipt.objects.create(
            grn_number="GRN-011",
            purchase_order=purchase_order,
            product=self.product,
            quantity_received=Decimal("8.00"),
            grn_date="2026-04-21",
            received_by="Storekeeper",
            location="Main Store",
        )

        post_goods_receipt(first_receipt)
        inventory_request.refresh_from_db()
        self.assertEqual(inventory_request.quantity_issued, Decimal("4.00"))
        self.assertEqual(inventory_request.short_quantity, Decimal("6.00"))

        post_goods_receipt(second_receipt)
        inventory_request.refresh_from_db()
        self.assertEqual(inventory_request.quantity_issued, Decimal("10.00"))
        self.assertEqual(inventory_request.short_quantity, Decimal("0.00"))
        self.assertEqual(inventory_request.issuances.count(), 2)

    def test_unrelated_grn_only_increases_stock(self):
        purchase_order = PurchaseOrder.objects.create(
            po_number="PO-900",
            issue_date="2026-04-19",
            product=self.product,
            quantity_ordered=Decimal("5.00"),
            shortage_quantity=Decimal("0.00"),
            status=PurchaseOrder.STATUS_PENDING,
            location="Main Store",
        )
        receipt = GoodsReceipt.objects.create(
            grn_number="GRN-900",
            purchase_order=purchase_order,
            product=self.product,
            quantity_received=Decimal("5.00"),
            grn_date="2026-04-20",
            received_by="Storekeeper",
            location="Main Store",
        )

        result = post_goods_receipt(receipt)

        self.assertIsNone(result["auto_issuance"])
        self.assertEqual(receipt.auto_issued_quantity, Decimal("0.00"))
        self.assertEqual(
            StockTransaction.objects.filter(transaction_type=StockTransaction.TYPE_RECEIPT).count(),
            1,
        )

    def test_reposting_grn_does_not_duplicate_stock_or_issue(self):
        inventory_request = self.create_request("2.00")
        purchase_order = process_inventory_request(inventory_request)["purchase_order"]
        receipt = GoodsReceipt.objects.create(
            grn_number="GRN-777",
            purchase_order=purchase_order,
            product=self.product,
            quantity_received=Decimal("2.00"),
            grn_date="2026-04-20",
            received_by="Storekeeper",
            location="Main Store",
        )

        post_goods_receipt(receipt)
        transaction_count = StockTransaction.objects.count()
        issue_count = inventory_request.issuances.count()

        post_goods_receipt(receipt)
        inventory_request.refresh_from_db()

        self.assertEqual(StockTransaction.objects.count(), transaction_count)
        self.assertEqual(inventory_request.issuances.count(), issue_count)
        self.assertEqual(inventory_request.quantity_issued, Decimal("2.00"))
