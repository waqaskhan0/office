import dotenv from "dotenv";
import { connectDatabase, sequelize } from "../config/database.js";
import {
  Product,
  Supplier,
  InventoryRequest,
  PurchaseOrder,
  GoodsReceipt,
  Issuance,
  StockTransaction
} from "../models/index.js";

dotenv.config();

async function seed() {
  await connectDatabase();

  const existingProducts = await Product.count();
  if (existingProducts > 0) {
    console.log("Seed skipped: database already has products.");
    await sequelize.close();
    return;
  }

  const [supplierA, supplierB] = await Promise.all([
    Supplier.create({
      name: "Al Madina Traders",
      contactPerson: "Usman Ali",
      phone: "0300-1111111",
      email: "sales@almadina.example",
      address: "I-9 Industrial Area, Islamabad",
      notes: "Stationery and office supplies"
    }),
    Supplier.create({
      name: "Pak Steel Works",
      contactPerson: "Hamza Khan",
      phone: "0300-2222222",
      email: "sales@paksteel.example",
      address: "Rawalpindi Road, Islamabad",
      notes: "Steel and hardware supplier"
    })
  ]);

  const [productA, productB, productC] = await Promise.all([
    Product.create({
      sku: "FC-BUL",
      name: "File Cover / Folders (Blue)",
      category: "Stationery",
      productType: "Large",
      unit: "Pieces",
      defaultLocation: "Secretariat",
      reorderLevel: 10
    }),
    Product.create({
      sku: "ITM-CAL",
      name: "Calculator",
      category: "Stationery",
      productType: "NA",
      unit: "Pieces",
      defaultLocation: "Secretariat",
      reorderLevel: 5
    }),
    Product.create({
      sku: "WTS-100",
      name: "Water Tank (Stainless Steel)",
      category: "RWHU",
      productType: "1000 liters",
      unit: "Units",
      defaultLocation: "I9 Warehouse",
      reorderLevel: 2
    })
  ]);

  await Promise.all([
    StockTransaction.create({
      productId: productA.id,
      quantity: 25,
      transactionType: "receipt",
      referenceType: "Opening Stock",
      referenceNumber: "OPEN-001",
      location: "Secretariat",
      transactionDate: "2026-04-20",
      notes: "Seed opening stock"
    }),
    StockTransaction.create({
      productId: productB.id,
      quantity: 8,
      transactionType: "receipt",
      referenceType: "Opening Stock",
      referenceNumber: "OPEN-002",
      location: "Secretariat",
      transactionDate: "2026-04-20",
      notes: "Seed opening stock"
    }),
    StockTransaction.create({
      productId: productC.id,
      quantity: 1,
      transactionType: "receipt",
      referenceType: "Opening Stock",
      referenceNumber: "OPEN-003",
      location: "I9 Warehouse",
      transactionDate: "2026-04-20",
      notes: "Seed opening stock"
    })
  ]);

  const request = await InventoryRequest.create({
    requestNumber: "REQ-001",
    requestDate: "2026-04-20",
    requestedBy: "Mohammad Waqas",
    department: "Operations",
    location: "Secretariat",
    productId: productA.id,
    availableQuantity: 25,
    quantityRequested: 12,
    quantityIssued: 12,
    shortQuantity: 0,
    managerEmail: "mwaqaskhan921@gmail.com",
    approvalStatus: "issued",
    fulfillmentStatus: "issued",
    notes: "Seed auto-issued request"
  });

  await Issuance.create({
    issueNumber: "ISS-001",
    inventoryRequestId: request.id,
    productId: productA.id,
    quantityIssued: 12,
    issueDate: "2026-04-20",
    issuedTo: "Mohammad Waqas",
    issuedBy: "System Auto-Issue",
    location: "Secretariat",
    notes: "Seed issuance",
    systemGenerated: true,
    posted: true
  });

  await StockTransaction.create({
    productId: productA.id,
    quantity: -12,
    transactionType: "issue",
    referenceType: "Issue",
    referenceNumber: "ISS-001",
    location: "Secretariat",
    transactionDate: "2026-04-20",
    notes: "Seed stock issue"
  });

  const po = await PurchaseOrder.create({
    poNumber: "PO-001",
    issueDate: "2026-04-20",
    sourceRequestId: request.id,
    supplierId: supplierA.id,
    productId: productB.id,
    specifications: "Auto-generated shortage PO seed",
    quantityOrdered: 20,
    shortageQuantity: 20,
    unitPrice: 2500,
    poAmount: 50000,
    status: "draft",
    systemGenerated: true,
    location: "Secretariat",
    notes: "Seed draft shortage PO"
  });

  await GoodsReceipt.create({
    grnNumber: "GRN-001",
    purchaseOrderId: po.id,
    productId: productB.id,
    quantityReceived: 5,
    grnDate: "2026-04-21",
    receivedBy: "Store Officer",
    location: "Secretariat",
    notes: "Seed GRN",
    autoIssuedQuantity: 0,
    posted: false
  });

  console.log("Seed completed successfully.");
  console.log(`Suppliers: ${supplierA.name}, ${supplierB.name}`);
  console.log(`Products: ${productA.sku}, ${productB.sku}, ${productC.sku}`);

  await sequelize.close();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
