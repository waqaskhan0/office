import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Product = sequelize.define(
  "Product",
  {
    sku: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: true },
    productType: { type: DataTypes.STRING(100), allowNull: true },
    unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "Units" },
    defaultLocation: { type: DataTypes.STRING(100), allowNull: true },
    reorderLevel: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 10 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { tableName: "products" }
);

export const Supplier = sequelize.define(
  "Supplier",
  {
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    contactPerson: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }
  },
  { tableName: "suppliers" }
);

export const InventoryRequest = sequelize.define(
  "InventoryRequest",
  {
    requestNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    requestDate: { type: DataTypes.DATEONLY, allowNull: false },
    requestedBy: { type: DataTypes.STRING(100), allowNull: false },
    department: { type: DataTypes.STRING(100), allowNull: true },
    location: { type: DataTypes.STRING(100), allowNull: false },
    availableQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    quantityRequested: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantityIssued: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    shortQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    managerEmail: { type: DataTypes.STRING(255), allowNull: true },
    approvalStatus: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "partial", "issued"),
      allowNull: false,
      defaultValue: "pending"
    },
    fulfillmentStatus: {
      type: DataTypes.ENUM("pending", "partial_issued", "waiting_po", "ready_from_grn", "issued"),
      allowNull: false,
      defaultValue: "pending"
    },
    notes: { type: DataTypes.TEXT, allowNull: true }
  },
  { tableName: "inventory_requests" }
);

export const PurchaseOrder = sequelize.define(
  "PurchaseOrder",
  {
    poNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    issueDate: { type: DataTypes.DATEONLY, allowNull: false },
    specifications: { type: DataTypes.TEXT, allowNull: true },
    quantityOrdered: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    shortageQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    poAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM("draft", "pending", "partial", "received", "cancelled"),
      allowNull: false,
      defaultValue: "pending"
    },
    systemGenerated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    arrivedBy: { type: DataTypes.STRING(100), allowNull: true },
    location: { type: DataTypes.STRING(100), allowNull: true },
    quantityReceived: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true }
  },
  { tableName: "purchase_orders" }
);

export const GoodsReceipt = sequelize.define(
  "GoodsReceipt",
  {
    grnNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    quantityReceived: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    grnDate: { type: DataTypes.DATEONLY, allowNull: false },
    receivedBy: { type: DataTypes.STRING(100), allowNull: true },
    location: { type: DataTypes.STRING(100), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    autoIssuedQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    posted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { tableName: "goods_receipts" }
);

export const Issuance = sequelize.define(
  "Issuance",
  {
    issueNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    quantityIssued: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    issueDate: { type: DataTypes.DATEONLY, allowNull: false },
    issuedTo: { type: DataTypes.STRING(100), allowNull: true },
    issuedBy: { type: DataTypes.STRING(100), allowNull: true },
    location: { type: DataTypes.STRING(100), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    systemGenerated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    posted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { tableName: "issuances" }
);

export const StockTransaction = sequelize.define(
  "StockTransaction",
  {
    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    transactionType: {
      type: DataTypes.ENUM("receipt", "issue", "adjustment"),
      allowNull: false
    },
    referenceType: { type: DataTypes.STRING(50), allowNull: false },
    referenceNumber: { type: DataTypes.STRING(50), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: true },
    transactionDate: { type: DataTypes.DATEONLY, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true }
  },
  { tableName: "stock_transactions" }
);

Product.hasMany(PurchaseOrder, { foreignKey: "productId", as: "purchaseOrders" });
PurchaseOrder.belongsTo(Product, { foreignKey: "productId", as: "product" });

Supplier.hasMany(PurchaseOrder, { foreignKey: "supplierId", as: "purchaseOrders" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplierId", as: "supplier" });

Product.hasMany(InventoryRequest, { foreignKey: "productId", as: "requests" });
InventoryRequest.belongsTo(Product, { foreignKey: "productId", as: "product" });

InventoryRequest.hasMany(PurchaseOrder, { foreignKey: "sourceRequestId", as: "purchaseOrders" });
PurchaseOrder.belongsTo(InventoryRequest, { foreignKey: "sourceRequestId", as: "sourceRequest" });

PurchaseOrder.hasMany(GoodsReceipt, { foreignKey: "purchaseOrderId", as: "receipts" });
GoodsReceipt.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId", as: "purchaseOrder" });

Product.hasMany(GoodsReceipt, { foreignKey: "productId", as: "receipts" });
GoodsReceipt.belongsTo(Product, { foreignKey: "productId", as: "product" });

InventoryRequest.hasMany(Issuance, { foreignKey: "inventoryRequestId", as: "issuances" });
Issuance.belongsTo(InventoryRequest, { foreignKey: "inventoryRequestId", as: "inventoryRequest" });

Product.hasMany(Issuance, { foreignKey: "productId", as: "issuances" });
Issuance.belongsTo(Product, { foreignKey: "productId", as: "product" });

Product.hasMany(StockTransaction, { foreignKey: "productId", as: "stockTransactions" });
StockTransaction.belongsTo(Product, { foreignKey: "productId", as: "product" });

export const db = {
  sequelize,
  Product,
  Supplier,
  InventoryRequest,
  PurchaseOrder,
  GoodsReceipt,
  Issuance,
  StockTransaction
};
