import { Router } from "express";
import { Op } from "sequelize";
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
import {
  dashboardMetrics,
  generateDocumentNumber,
  inventoryRows,
  postGoodsReceipt,
  postIssuance,
  processInventoryRequest
} from "../services/workflowService.js";

const router = Router();

const parseAmount = (value) => (value === undefined || value === null || value === "" ? 0 : Number.parseFloat(value));

router.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json(await dashboardMetrics());
  } catch (error) {
    next(error);
  }
});

router.get("/products", async (_req, res, next) => {
  try {
    res.json(await inventoryRows());
  } catch (error) {
    next(error);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const product = await Product.create({
      sku: req.body.sku,
      name: req.body.name,
      category: req.body.category,
      productType: req.body.productType,
      unit: req.body.unit || "Units",
      defaultLocation: req.body.defaultLocation,
      reorderLevel: parseAmount(req.body.reorderLevel || 10),
      notes: req.body.notes
    });
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.get("/suppliers", async (_req, res, next) => {
  try {
    res.json(await Supplier.findAll({ order: [["name", "ASC"]] }));
  } catch (error) {
    next(error);
  }
});

router.post("/suppliers", async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
});

router.get("/purchase-orders", async (req, res, next) => {
  try {
    const { q = "", status = "", source = "" } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }
    if (source === "auto") {
      where.systemGenerated = true;
    }
    if (source === "manual") {
      where.systemGenerated = false;
    }

    const purchaseOrders = await PurchaseOrder.findAll({
      where,
      include: [
        { model: Supplier, as: "supplier" },
        { model: Product, as: "product" },
        { model: InventoryRequest, as: "sourceRequest" }
      ],
      order: [["issueDate", "DESC"], ["createdAt", "DESC"]]
    });

    const search = String(q).trim().toLowerCase();
    const filtered = search
      ? purchaseOrders.filter((po) =>
          [
            po.poNumber,
            po.specifications,
            po.supplier?.name,
            po.product?.sku,
            po.product?.name,
            po.sourceRequest?.requestNumber
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search))
        )
      : purchaseOrders;

    res.json(filtered);
  } catch (error) {
    next(error);
  }
});

router.post("/purchase-orders", async (req, res, next) => {
  try {
    const purchaseOrder = await PurchaseOrder.create({
      poNumber: await generateDocumentNumber(PurchaseOrder, "poNumber", "PO"),
      issueDate: req.body.issueDate,
      supplierId: req.body.supplierId || null,
      productId: req.body.productId || null,
      specifications: req.body.specifications || "",
      quantityOrdered: parseAmount(req.body.quantityOrdered),
      shortageQuantity: parseAmount(req.body.shortageQuantity || 0),
      unitPrice: parseAmount(req.body.unitPrice || 0),
      poAmount: parseAmount(req.body.quantityOrdered) * parseAmount(req.body.unitPrice || 0),
      status: req.body.status || "pending",
      arrivedBy: req.body.arrivedBy || "",
      location: req.body.location || "",
      notes: req.body.notes || "",
      systemGenerated: false
    });
    res.status(201).json(purchaseOrder);
  } catch (error) {
    next(error);
  }
});

router.get("/receipts", async (_req, res, next) => {
  try {
    res.json(
      await GoodsReceipt.findAll({
        include: [
          {
            model: PurchaseOrder,
            as: "purchaseOrder",
            include: [{ model: InventoryRequest, as: "sourceRequest" }]
          },
          { model: Product, as: "product" }
        ],
        order: [["grnDate", "DESC"], ["createdAt", "DESC"]]
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/receipts", async (req, res, next) => {
  try {
    let productId = req.body.productId || null;
    if (!productId && req.body.purchaseOrderId) {
      const purchaseOrder = await PurchaseOrder.findByPk(req.body.purchaseOrderId);
      productId = purchaseOrder?.productId || null;
    }

    const receipt = await GoodsReceipt.create({
      grnNumber: await generateDocumentNumber(GoodsReceipt, "grnNumber", "GRN"),
      purchaseOrderId: req.body.purchaseOrderId || null,
      productId,
      quantityReceived: parseAmount(req.body.quantityReceived),
      grnDate: req.body.grnDate,
      receivedBy: req.body.receivedBy || "",
      location: req.body.location,
      notes: req.body.notes || ""
    });
    const result = await postGoodsReceipt(receipt.id);
    res.status(201).json({ receipt: await GoodsReceipt.findByPk(receipt.id), ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/requests", async (_req, res, next) => {
  try {
    res.json(
      await InventoryRequest.findAll({
        include: [
          { model: Product, as: "product" },
          { model: PurchaseOrder, as: "purchaseOrders" }
        ],
        order: [["requestDate", "DESC"], ["createdAt", "DESC"]]
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/requests", async (req, res, next) => {
  try {
    const inventoryRequest = await InventoryRequest.create({
      requestNumber: await generateDocumentNumber(InventoryRequest, "requestNumber", "REQ"),
      requestDate: req.body.requestDate,
      requestedBy: req.body.requestedBy,
      department: req.body.department || "",
      location: req.body.location,
      productId: req.body.productId || null,
      quantityRequested: parseAmount(req.body.quantityRequested),
      managerEmail: req.body.managerEmail || "",
      approvalStatus: "approved",
      notes: req.body.notes || ""
    });
    const result = await processInventoryRequest(inventoryRequest.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/issuances", async (_req, res, next) => {
  try {
    res.json(
      await Issuance.findAll({
        include: [
          { model: InventoryRequest, as: "inventoryRequest" },
          { model: Product, as: "product" }
        ],
        order: [["issueDate", "DESC"], ["createdAt", "DESC"]]
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/issuances", async (req, res, next) => {
  try {
    const issuance = await Issuance.create({
      issueNumber: await generateDocumentNumber(Issuance, "issueNumber", "ISS"),
      inventoryRequestId: req.body.inventoryRequestId || null,
      productId: req.body.productId || null,
      quantityIssued: parseAmount(req.body.quantityIssued),
      issueDate: req.body.issueDate,
      issuedTo: req.body.issuedTo || "",
      issuedBy: req.body.issuedBy || "",
      location: req.body.location,
      notes: req.body.notes || "",
      systemGenerated: false
    });
    await postIssuance(issuance.id);
    res.status(201).json(await Issuance.findByPk(issuance.id));
  } catch (error) {
    next(error);
  }
});

router.get("/movements", async (_req, res, next) => {
  try {
    const [movements, locationSummary] = await Promise.all([
      StockTransaction.findAll({
        include: [{ model: Product, as: "product" }],
        order: [["transactionDate", "DESC"], ["createdAt", "DESC"]]
      }),
      StockTransaction.findAll({
        attributes: [
          "location",
          [db.sequelize.fn("COALESCE", db.sequelize.fn("SUM", db.sequelize.col("quantity")), 0), "netQuantity"]
        ],
        group: ["location"],
        order: [["location", "ASC"]],
        raw: true
      })
    ]);

    res.json({ movements, locationSummary });
  } catch (error) {
    next(error);
  }
});

export default router;
