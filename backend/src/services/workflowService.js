import { Op, fn, col } from "sequelize";
import {
  db,
  GoodsReceipt,
  InventoryRequest,
  Issuance,
  Product,
  PurchaseOrder,
  StockTransaction,
  Supplier
} from "../models/index.js";

const decimal = (value) => Number.parseFloat(value || 0);
const toFixed = (value) => Number(decimal(value).toFixed(2));

export async function generateDocumentNumber(model, fieldName, prefix) {
  const rows = await model.findAll({
    attributes: [fieldName],
    where: {
      [fieldName]: { [Op.like]: `${prefix}-%` }
    }
  });

  const highest = rows.reduce((max, row) => {
    const value = row.get(fieldName);
    const parts = String(value).split("-");
    const numericPart = Number.parseInt(parts[1] || "0", 10);
    return Number.isNaN(numericPart) ? max : Math.max(max, numericPart);
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

export async function currentStockForProduct(productId, location = null) {
  const where = { productId };
  if (location) {
    where.location = location;
  }

  const result = await StockTransaction.findOne({
    attributes: [[fn("COALESCE", fn("SUM", col("quantity")), 0), "total"]],
    where,
    raw: true
  });

  return toFixed(result?.total ?? 0);
}

export async function inventoryRows() {
  const products = await Product.findAll({
    include: [{ model: StockTransaction, as: "stockTransactions", attributes: [] }],
    attributes: {
      include: [[fn("COALESCE", fn("SUM", col("stockTransactions.quantity")), 0), "stockTotal"]]
    },
    group: ["Product.id"],
    order: [["sku", "ASC"]],
    raw: true,
    nest: true
  });

  return products.map((product) => ({
    product,
    stockTotal: toFixed(product.stockTotal),
    isLow: toFixed(product.stockTotal) <= decimal(product.reorderLevel)
  }));
}

export async function postStockTransaction({
  productId,
  quantity,
  transactionType,
  referenceType,
  referenceNumber,
  location,
  transactionDate,
  notes = ""
}) {
  return StockTransaction.create({
    productId,
    quantity: toFixed(quantity),
    transactionType,
    referenceType,
    referenceNumber,
    location,
    transactionDate,
    notes
  });
}

export async function syncInventoryRequest(inventoryRequestId) {
  const inventoryRequest = await InventoryRequest.findByPk(inventoryRequestId, {
    include: [{ model: PurchaseOrder, as: "purchaseOrders", where: { systemGenerated: true }, required: false }]
  });
  if (!inventoryRequest) {
    return null;
  }

  const remaining = Math.max(0, decimal(inventoryRequest.quantityRequested) - decimal(inventoryRequest.quantityIssued));
  let fulfillmentStatus = "pending";
  let approvalStatus = "pending";

  if (remaining <= 0) {
    fulfillmentStatus = "issued";
    approvalStatus = "issued";
  } else if (decimal(inventoryRequest.quantityIssued) > 0) {
    fulfillmentStatus = "partial_issued";
    approvalStatus = "partial";
  } else if (inventoryRequest.purchaseOrders.length > 0) {
    fulfillmentStatus = "waiting_po";
    approvalStatus = "approved";
  }

  await inventoryRequest.update({
    shortQuantity: toFixed(remaining),
    fulfillmentStatus,
    approvalStatus
  });

  return inventoryRequest;
}

export async function createSystemPurchaseOrder(inventoryRequest, shortageQuantity) {
  const openPo = await PurchaseOrder.findOne({
    where: {
      sourceRequestId: inventoryRequest.id,
      systemGenerated: true,
      status: { [Op.in]: ["draft", "pending", "partial"] }
    }
  });

  if (openPo) {
    await openPo.update({
      shortageQuantity: toFixed(shortageQuantity),
      quantityOrdered: Math.max(decimal(openPo.quantityOrdered), decimal(shortageQuantity))
    });
    return openPo;
  }

  return PurchaseOrder.create({
    poNumber: await generateDocumentNumber(PurchaseOrder, "poNumber", "PO"),
    issueDate: inventoryRequest.requestDate,
    sourceRequestId: inventoryRequest.id,
    productId: inventoryRequest.productId,
    specifications: `Auto-generated shortage PO for request ${inventoryRequest.requestNumber}`,
    quantityOrdered: toFixed(shortageQuantity),
    shortageQuantity: toFixed(shortageQuantity),
    unitPrice: 0,
    poAmount: 0,
    status: "draft",
    systemGenerated: true,
    location: inventoryRequest.location,
    notes: `System-generated from request ${inventoryRequest.requestNumber}`
  });
}

export async function postIssuance(issuanceId) {
  const issuance = await Issuance.findByPk(issuanceId);
  if (!issuance || issuance.posted || !issuance.productId) {
    return issuance;
  }

  const available = await currentStockForProduct(issuance.productId, issuance.location);
  if (available < decimal(issuance.quantityIssued)) {
    throw new Error("Not enough stock available at the selected location.");
  }

  await postStockTransaction({
    productId: issuance.productId,
    quantity: toFixed(decimal(issuance.quantityIssued) * -1),
    transactionType: "issue",
    referenceType: "Issue",
    referenceNumber: issuance.issueNumber,
    location: issuance.location,
    transactionDate: issuance.issueDate,
    notes: issuance.notes || ""
  });

  await issuance.update({ posted: true });

  if (issuance.inventoryRequestId) {
    const inventoryRequest = await InventoryRequest.findByPk(issuance.inventoryRequestId);
    await inventoryRequest.update({
      quantityIssued: toFixed(decimal(inventoryRequest.quantityIssued) + decimal(issuance.quantityIssued))
    });
    await syncInventoryRequest(inventoryRequest.id);
  }

  return issuance;
}

export async function createIssuanceForRequest(inventoryRequest, quantity, options = {}) {
  const issuance = await Issuance.create({
    issueNumber: await generateDocumentNumber(Issuance, "issueNumber", "ISS"),
    inventoryRequestId: inventoryRequest.id,
    productId: inventoryRequest.productId,
    quantityIssued: toFixed(quantity),
    issueDate: options.issueDate || inventoryRequest.requestDate,
    issuedTo: inventoryRequest.requestedBy,
    issuedBy: options.issuedBy || "System Auto-Issue",
    location: options.location || inventoryRequest.location,
    notes: options.notes || `System-issued for request ${inventoryRequest.requestNumber}`,
    systemGenerated: options.systemGenerated ?? true
  });

  await postIssuance(issuance.id);
  return Issuance.findByPk(issuance.id, {
    include: [{ model: InventoryRequest, as: "inventoryRequest" }, { model: Product, as: "product" }]
  });
}

export async function autoIssueRequestBalance(inventoryRequest, options = {}) {
  if (!inventoryRequest.productId) {
    return null;
  }

  const remaining = Math.max(0, decimal(inventoryRequest.quantityRequested) - decimal(inventoryRequest.quantityIssued));
  if (remaining <= 0) {
    return null;
  }

  const issueLocation = options.location || inventoryRequest.location;
  const available = await currentStockForProduct(inventoryRequest.productId, issueLocation);
  const quantityToIssue = Math.min(remaining, available);
  if (quantityToIssue <= 0) {
    return null;
  }

  return createIssuanceForRequest(inventoryRequest, quantityToIssue, {
    issueDate: options.issueDate,
    location: issueLocation,
    issuedBy: options.issuedBy,
    notes: options.notes,
    systemGenerated: true
  });
}

export async function processInventoryRequest(inventoryRequestId) {
  const inventoryRequest = await InventoryRequest.findByPk(inventoryRequestId);
  if (!inventoryRequest) {
    throw new Error("Inventory request not found.");
  }

  if (!inventoryRequest.productId) {
    await inventoryRequest.update({
      availableQuantity: 0,
      shortQuantity: toFixed(inventoryRequest.quantityRequested),
      fulfillmentStatus: "pending"
    });
    return { issuedQuantity: 0, shortQuantity: decimal(inventoryRequest.quantityRequested), purchaseOrder: null };
  }

  const availableStock = await currentStockForProduct(inventoryRequest.productId, inventoryRequest.location);
  await inventoryRequest.update({
    availableQuantity: toFixed(availableStock),
    approvalStatus: "approved"
  });

  const reloaded = await InventoryRequest.findByPk(inventoryRequest.id);
  const issuance = await autoIssueRequestBalance(reloaded, {
    issueDate: reloaded.requestDate,
    location: reloaded.location,
    notes: `Auto-issued on request submission ${reloaded.requestNumber}`
  });

  const refreshed = await InventoryRequest.findByPk(inventoryRequest.id);
  const shortageQuantity = Math.max(0, decimal(refreshed.quantityRequested) - decimal(refreshed.quantityIssued));
  let purchaseOrder = null;
  if (shortageQuantity > 0) {
    purchaseOrder = await createSystemPurchaseOrder(refreshed, shortageQuantity);
  }

  await syncInventoryRequest(inventoryRequest.id);
  const finalRequest = await InventoryRequest.findByPk(inventoryRequest.id);

  return {
    issuedQuantity: issuance ? decimal(issuance.quantityIssued) : 0,
    shortQuantity: decimal(finalRequest.shortQuantity),
    purchaseOrder,
    inventoryRequest: finalRequest
  };
}

export async function postGoodsReceipt(receiptId) {
  const receipt = await GoodsReceipt.findByPk(receiptId, {
    include: [{ model: PurchaseOrder, as: "purchaseOrder" }]
  });
  const result = { stockPosted: false, autoIssuance: null };
  if (!receipt || receipt.posted || !receipt.productId) {
    return result;
  }

  await postStockTransaction({
    productId: receipt.productId,
    quantity: receipt.quantityReceived,
    transactionType: "receipt",
    referenceType: "GRN",
    referenceNumber: receipt.grnNumber,
    location: receipt.location,
    transactionDate: receipt.grnDate,
    notes: receipt.notes || ""
  });

  receipt.posted = true;
  result.stockPosted = true;

  if (receipt.purchaseOrder) {
    const po = receipt.purchaseOrder;
    const updatedReceived = decimal(po.quantityReceived) + decimal(receipt.quantityReceived);
    let status = po.status;
    if (updatedReceived >= decimal(po.quantityOrdered)) {
      status = "received";
    } else if (updatedReceived > 0) {
      status = "partial";
    }

    await po.update({
      quantityReceived: toFixed(updatedReceived),
      status
    });

    if (po.sourceRequestId) {
      const sourceRequest = await InventoryRequest.findByPk(po.sourceRequestId);
      if (sourceRequest) {
        const autoIssuance = await autoIssueRequestBalance(sourceRequest, {
          issueDate: receipt.grnDate,
          location: receipt.location || sourceRequest.location,
          notes: `Auto-issued from GRN ${receipt.grnNumber}`
        });
        if (autoIssuance) {
          result.autoIssuance = autoIssuance;
          receipt.autoIssuedQuantity = autoIssuance.quantityIssued;
          await syncInventoryRequest(sourceRequest.id);
        }
      }
    }
  }

  await receipt.save();
  return result;
}

export async function dashboardMetrics() {
  const [productCount, supplierCount, openRequests, purchaseOrders, recentRequests, recentMovements] = await Promise.all([
    Product.count(),
    Supplier.count(),
    InventoryRequest.count({
      where: { fulfillmentStatus: { [Op.in]: ["pending", "partial_issued", "waiting_po", "ready_from_grn"] } }
    }),
    PurchaseOrder.findAll({
      include: [{ model: Supplier, as: "supplier" }, { model: Product, as: "product" }, { model: InventoryRequest, as: "sourceRequest" }],
      limit: 5,
      order: [["issueDate", "DESC"], ["createdAt", "DESC"]]
    }),
    InventoryRequest.findAll({
      include: [{ model: Product, as: "product" }],
      limit: 5,
      order: [["requestDate", "DESC"], ["createdAt", "DESC"]]
    }),
    StockTransaction.findAll({
      include: [{ model: Product, as: "product" }],
      limit: 8,
      order: [["transactionDate", "DESC"], ["createdAt", "DESC"]]
    })
  ]);

  const rows = await inventoryRows();
  return {
    productCount,
    supplierCount,
    openRequests,
    lowStockCount: rows.filter((row) => row.isLow).length,
    pendingShortages: await InventoryRequest.count({
      where: {
        shortQuantity: { [Op.gt]: 0 },
        fulfillmentStatus: { [Op.ne]: "issued" }
      }
    }),
    autoDraftPos: await PurchaseOrder.count({
      where: { systemGenerated: true, status: "draft" }
    }),
    autoFulfilledRequests: await InventoryRequest.count({
      distinct: true,
      include: [{ model: Issuance, as: "issuances", where: { systemGenerated: true } }],
      where: { fulfillmentStatus: "issued" }
    }),
    recentPurchaseOrders: purchaseOrders,
    recentRequests,
    recentMovements,
    inventoryPreview: rows.slice(0, 8)
  };
}
