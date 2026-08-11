/**
 * Procurement services — PO / Receipt Note / Purchase Return.
 * Inventory posts on RN verify (accepted qty) and PR markReturned.
 */

const { PurchaseOrder, PurchaseOrderLine, DELIVERY_METHODS } = require('../models/PurchaseOrder');
const { ReceiptNote, ReceiptNoteLine } = require('../models/ReceiptNote');
const { PurchaseReturn, PurchaseReturnLine, PR_RETURN_TYPES } = require('../models/PurchaseReturn');
const {
  PO_STATUSES,
  PO_RECEIVABLE_STATUSES,
  RN_STATUSES,
  PR_STATUSES,
  PR_SOURCE_RN_STATUSES
} = require('../constants/procurementLifecycle');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { assertActiveLocation } = require('./inventoryLocationService');
const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const Organization = require('../models/Organization');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function isVendorOrganization(vendor) {
  if (!vendor) return false;
  const types = Array.isArray(vendor.types)
    ? vendor.types.map((t) => String(t || '').toLowerCase())
    : [];
  if (types.includes('vendor')) return true;
  const invRole = vendor.participations?.INVENTORY?.role;
  return String(invRole || '').toLowerCase() === 'vendor';
}

async function assertVendorForPo(organizationId, vendorId) {
  if (!vendorId) throw validationError('Vendor is required');
  const vendor = await Organization.findOne({
    _id: vendorId,
    deletedAt: null,
    isTenant: { $ne: true }
  })
    .select('_id types participations name')
    .lean();
  if (!vendor) throw validationError('Vendor organization not found', 'NOT_FOUND');
  if (!isVendorOrganization(vendor)) {
    throw validationError('Organization must have Vendor participation type');
  }
  return vendor;
}

function normalizeDeliveryMethod(raw) {
  if (raw == null || raw === '') return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (DELIVERY_METHODS.includes(key)) return key;
  const aliases = {
    supplierdelivery: 'supplier_delivery',
    'supplier_delivery': 'supplier_delivery',
    courier: 'courier',
    transport: 'transport',
    pickup: 'pickup'
  };
  return aliases[key.replace(/_/g, '')] || aliases[key] || null;
}

function overallDiscountAmount(subtotal, type, value) {
  const gross = Math.max(0, Number(subtotal) || 0);
  const dv = Number(value) || 0;
  const t = String(type || '').toLowerCase();
  if (!t || !(dv > 0)) return 0;
  if (t === 'percent' || t === 'percentage') return Math.min((gross * dv) / 100, gross);
  if (t === 'amount' || t === 'fixed') return Math.min(dv, gross);
  return 0;
}

function applyHeaderMoney(po, lineSubtotalSum, lineTaxSum) {
  const subtotal = Number(lineSubtotalSum) || 0;
  const taxTotal = Number(lineTaxSum) || 0;
  const chargesTotal = Number(po.chargesTotal) || 0;
  const discountTotal = overallDiscountAmount(
    subtotal,
    po.overallDiscountType,
    po.overallDiscountValue
  );
  const preTaxTotal = Math.max(0, subtotal - discountTotal + chargesTotal);
  const adjustmentTotal = Number(po.adjustmentTotal) || 0;
  po.subtotal = subtotal;
  po.taxTotal = taxTotal;
  po.overallDiscountTotal = discountTotal;
  po.preTaxTotal = preTaxTotal;
  po.grandTotal = Math.max(0, preTaxTotal + taxTotal + adjustmentTotal);
}

/**
 * Full document money recompute: line taxes + overall discount + charges + txn taxes + adjustment.
 */
async function recalculatePurchaseOrderTotals({ organizationId, purchaseOrderId, userId }) {
  const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');

  const lineDocs = await PurchaseOrderLine.find({ organizationId, purchaseOrderId }).sort({ lineOrder: 1 });
  const lineLean = lineDocs.map((l) => l.toObject());

  try {
    const {
      recalculateDocumentMoney,
      taxesFromSnapshot
    } = require('./commercialTaxApplicationService');

    const engineLines = lineLean.map((l) => ({
      ...l,
      quantity: Number(l.quantityOrdered) || 0,
      unitPriceSnapshot: Number(l.unitPrice) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      taxSide: 'PURCHASE'
    }));

    let txnTaxes = taxesFromSnapshot(po.transactionTaxSnapshot);
    if (!txnTaxes.length) {
      txnTaxes = taxesFromSnapshot(po.taxDocumentSnapshot);
    }

    const money = recalculateDocumentMoney({
      lines: engineLines,
      transactionTaxes: txnTaxes,
      chargesTotal: Number(po.chargesTotal) || 0,
      globalDiscountType: po.overallDiscountType,
      globalDiscountValue: po.overallDiscountValue,
      adjustmentTotal: Number(po.adjustmentTotal) || 0
    });

    for (const ul of money.lines) {
      const id = ul._id;
      if (!id) continue;
      await PurchaseOrderLine.updateOne(
        { _id: id, organizationId, purchaseOrderId },
        {
          $set: {
            lineSubtotal: ul.lineSubtotal,
            lineTaxTotal: ul.lineTaxTotal,
            lineTotal: ul.lineTotal,
            taxSnapshot: ul.taxSnapshot
          }
        }
      );
    }

    po.subtotal = money.totals.subtotal;
    po.overallDiscountTotal = money.totals.globalDiscountTotal;
    po.taxTotal = money.totals.taxTotal;
    po.chargesTotal = money.totals.chargesTotal;
    po.preTaxTotal = Math.max(
      0,
      money.totals.subtotal - money.totals.globalDiscountTotal + money.totals.chargesTotal
    );
    po.grandTotal = money.totals.grandTotal;
    po.taxDocumentSnapshot = money.taxDocumentSnapshot;
    if (Array.isArray(money.totals.transactionTaxes)) {
      po.transactionTaxSnapshot = { taxes: money.totals.transactionTaxes };
    }
    if (userId) po.modifiedBy = userId;
    await po.save();

    const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId })
      .sort({ lineOrder: 1 })
      .lean();
    return { purchaseOrder: po.toObject(), lines, totals: money.totals };
  } catch (err) {
    console.warn('[procurementService] tax engine recompute fallback', err?.message);
    const subtotal = lineLean.reduce((sum, line) => sum + (Number(line.lineSubtotal) || 0), 0);
    const taxTotal = lineLean.reduce((sum, line) => sum + (Number(line.lineTaxTotal) || 0), 0);
    applyHeaderMoney(po, subtotal, taxTotal);
    if (userId) po.modifiedBy = userId;
    await po.save();
    return { purchaseOrder: po.toObject(), lines: lineLean };
  }
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const { allocateDocumentNumber } = require('./moduleNumberingService');
  return allocateDocumentNumber(organizationId, moduleKey, prefix, 4);
}

async function hydrateVariant(organizationId, variantId) {
  const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).lean();
  if (!variant) throw validationError('Variant not found', 'NOT_FOUND');
  const item = await Item.findOne({ _id: variant.itemId, organizationId, deletedAt: null })
    .select('item_name description unit_of_measure')
    .lean();
  return { variant, item };
}

function lineMoney({ quantity, unitPrice, discountType, discountValue }) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  let gross = qty * price;
  let discount = 0;
  const t = String(discountType || '').toLowerCase();
  const dv = Number(discountValue) || 0;
  if (t === 'percent' || t === 'percentage') discount = Math.min((gross * dv) / 100, gross);
  else if (t === 'amount' || t === 'fixed') discount = Math.min(dv, gross);
  const lineSubtotal = Math.max(0, gross - discount);
  return { lineSubtotal, lineTaxTotal: 0, lineTotal: lineSubtotal };
}

async function buildPurchaseOrderLineDoc({ organizationId, row, lineOrder, vendorId = null }) {
  if (!row?.variantId) throw validationError('Line variantId is required');
  const qty = Number(row.quantityOrdered ?? row.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityOrdered must be > 0');
  const { variant, item } = await hydrateVariant(organizationId, row.variantId);
  let catalogPrice = null;
  let vendorItemCode = row.vendorItemCode != null ? String(row.vendorItemCode).trim() || null : null;
  let vendorItemName = row.vendorItemName != null ? String(row.vendorItemName).trim() || null : null;
  let minOrderQty =
    row.minOrderQty != null && Number.isFinite(Number(row.minOrderQty))
      ? Number(row.minOrderQty)
      : null;

  if (vendorId) {
    try {
      const vendorCatalogService = require('./vendorCatalogService');
      const entry = await vendorCatalogService.getEntryByVariant({
        organizationId,
        vendorId,
        variantId: row.variantId,
        activeOnly: true
      });
      if (entry) {
        if (entry.purchasePrice != null) {
          catalogPrice = Number(entry.purchasePrice);
        }
        if (vendorItemCode == null && entry.vendorItemCode) {
          vendorItemCode = entry.vendorItemCode;
        }
        if (vendorItemName == null && entry.vendorItemName) {
          vendorItemName = entry.vendorItemName;
        }
        if (minOrderQty == null && entry.minOrderQty != null) {
          minOrderQty = Number(entry.minOrderQty);
        }
      }
    } catch {
      /* catalog optional */
    }
  }

  if (minOrderQty != null && minOrderQty > 0 && qty < minOrderQty) {
    throw validationError(
      `Quantity ${qty} is below vendor minimum order quantity (${minOrderQty})`
    );
  }

  const unitPrice =
    Number(
      row.unitPrice ??
        (Number.isFinite(catalogPrice) ? catalogPrice : null) ??
        variant.purchase_price ??
        variant.cost_price ??
        0
    ) || 0;

  let taxSnapshot = row.taxSnapshot || { taxes: [] };
  let lineSubtotal = 0;
  let lineTaxTotal = 0;
  let lineTotal = 0;
  try {
    const {
      hydrateTaxIds,
      resolveLineDefaultTaxes,
      applyTaxesToLine
    } = require('./commercialTaxApplicationService');
    let itemTaxes = null;
    if (Array.isArray(row.taxIds) && row.taxIds.length) {
      itemTaxes = await hydrateTaxIds(organizationId, row.taxIds);
    } else if (row.taxSnapshot?.taxes?.length) {
      itemTaxes = null; // use snapshot
    } else {
      itemTaxes = await resolveLineDefaultTaxes(organizationId, {
        side: 'PURCHASE',
        lineKind: 'ITEM'
      });
    }
    const applied = applyTaxesToLine(
      {
        quantity: qty,
        unitPriceSnapshot: unitPrice,
        unitPrice,
        discountType: row.discountType,
        discountValue: row.discountValue,
        taxSnapshot: row.taxSnapshot,
        taxSide: 'PURCHASE'
      },
      itemTaxes
    );
    lineSubtotal = applied.lineSubtotal;
    lineTaxTotal = applied.lineTaxTotal;
    lineTotal = applied.lineTotal;
    taxSnapshot = applied.taxSnapshot;
  } catch {
    const money = lineMoney({
      quantity: qty,
      unitPrice,
      discountType: row.discountType,
      discountValue: row.discountValue
    });
    lineSubtotal = money.lineSubtotal;
    lineTaxTotal = money.lineTaxTotal;
    lineTotal = money.lineTotal;
  }

  return {
    organizationId,
    lineOrder,
    variantId: variant._id,
    skuSnapshot: variant.variant_code || variant.barcode || String(variant._id),
    itemNameSnapshot: item?.item_name || null,
    descriptionSnapshot: row.description || item?.description || null,
    vendorItemCode,
    vendorItemName,
    minOrderQty,
    quantityOrdered: qty,
    quantityReceived: 0,
    quantityPending: qty,
    unitOfMeasure: row.unitOfMeasure || variant.unit_of_measure || item?.unit_of_measure || null,
    unitPrice,
    discountType: row.discountType || null,
    discountValue: Number(row.discountValue) || 0,
    taxSnapshot: taxSnapshot || { taxes: [] },
    chargeSnapshot: row.chargeSnapshot || { charges: [] },
    lineSubtotal,
    lineTaxTotal,
    lineTotal,
    expectedDeliveryDate: row.expectedDeliveryDate || null
  };
}

async function createPurchaseOrder({ organizationId, userId, payload }) {
  const vendorId = payload.vendorId;
  const vendor = await assertVendorForPo(organizationId, vendorId);
  let subject = String(payload.subject || payload.poSubject || '').trim();
  if (!subject) {
    subject = `Purchase — ${vendor.name || 'Vendor'}`;
  }

  const linesInput = Array.isArray(payload.lines) ? payload.lines : [];

  const poNumber = await nextDocNumber(organizationId, 'purchase_orders', 'PO');
  let subtotal = 0;
  let taxTotal = 0;
  const lineDocs = [];

  for (let i = 0; i < linesInput.length; i++) {
    const ld = await buildPurchaseOrderLineDoc({
      organizationId,
      row: linesInput[i],
      lineOrder: i + 1,
      vendorId
    });
    subtotal += ld.lineSubtotal;
    taxTotal += ld.lineTaxTotal || 0;
    lineDocs.push(ld);
  }

  const draft = {
    organizationId,
    poNumber,
    subject,
    poDate: payload.poDate || new Date(),
    vendorId,
    vendorContactId: payload.vendorContactId || null,
    vendorReferenceNumber: payload.vendorReferenceNumber || null,
    currency: payload.currency || 'USD',
    exchangeRate: Number(payload.exchangeRate) || 1,
    paymentTerms: payload.paymentTerms || null,
    expectedDeliveryDate: payload.expectedDeliveryDate || null,
    buyerId: payload.buyerId || userId,
    status: PO_STATUSES.DRAFT,
    notes: payload.notes || payload.vendorNotes || null,
    internalNotes: payload.internalNotes || null,
    termsAndConditions: payload.termsAndConditions || null,
    deliveryWarehouseId: payload.deliveryWarehouseId || null,
    deliveryMethod: normalizeDeliveryMethod(payload.deliveryMethod),
    shippingTerms: payload.shippingTerms || null,
    deliveryInstructions: payload.deliveryInstructions || null,
    chargesTotal: Number(payload.chargesTotal) || 0,
    overallDiscountType: payload.overallDiscountType || null,
    overallDiscountValue: Number(payload.overallDiscountValue) || 0,
    adjustmentTotal: Number(payload.adjustmentTotal) || 0,
    taxTotal: Number(payload.taxTotal) || taxTotal,
    createdBy: userId,
    modifiedBy: userId
  };
  applyHeaderMoney(draft, subtotal, draft.taxTotal);

  const po = await PurchaseOrder.create(draft);

  for (const ld of lineDocs) {
    ld.purchaseOrderId = po._id;
  }
  if (lineDocs.length) {
    await PurchaseOrderLine.insertMany(lineDocs);
  }
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId: po._id }).lean();
  return { purchaseOrder: po.toObject(), lines };
}

async function listPurchaseOrders({
  organizationId,
  status = null,
  page = 1,
  limit = 50,
  sortBy = 'updatedAt',
  sortOrder = 'desc',
  search = null
}) {
  const q = { organizationId, deletedAt: null };
  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : String(status).split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) q.status = statuses[0];
    else if (statuses.length > 1) q.status = { $in: statuses };
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      q.$or = [
        { poNumber: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
        { vendorReferenceNumber: { $regex: term, $options: 'i' } }
      ];
    }
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const allowedSort = new Set([
    'updatedAt',
    'createdAt',
    'poDate',
    'poNumber',
    'subject',
    'status',
    'grandTotal',
    'expectedDeliveryDate'
  ]);
  const sortField = allowedSort.has(String(sortBy)) ? String(sortBy) : 'updatedAt';
  const sortDir = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;

  const [totalRecords, data] = await Promise.all([
    PurchaseOrder.countDocuments(q),
    PurchaseOrder.find(q)
      .sort({ [sortField]: sortDir })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));
  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalRecords,
      totalPages,
      hasMore: pageNum < totalPages
    }
  };
}

async function getPurchaseOrder({ organizationId, id }) {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null })
    .populate({ path: 'vendorId', select: 'name' })
    .populate({ path: 'vendorContactId', select: 'first_name last_name email name' })
    .populate({ path: 'buyerId', select: 'firstName lastName email name' })
    .lean();
  if (!purchaseOrder) throw validationError('Purchase order not found', 'NOT_FOUND');
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId: id }).sort({ lineOrder: 1 }).lean();
  return { purchaseOrder, lines };
}

const PO_HEADER_EDITABLE = new Set([
  'subject',
  'vendorId',
  'vendorContactId',
  'vendorReferenceNumber',
  'poDate',
  'currency',
  'exchangeRate',
  'paymentTerms',
  'expectedDeliveryDate',
  'buyerId',
  'notes',
  'internalNotes',
  'termsAndConditions',
  'deliveryWarehouseId',
  'deliveryMethod',
  'shippingTerms',
  'deliveryInstructions',
  'chargesTotal',
  'overallDiscountType',
  'overallDiscountValue',
  'adjustmentTotal',
  'taxTotal'
]);

async function updatePurchaseOrder({ organizationId, id, userId, payload }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) {
    throw validationError('Only draft purchase orders can be edited');
  }
  const body = payload || {};
  if (Object.prototype.hasOwnProperty.call(body, 'vendorId') && body.vendorId) {
    await assertVendorForPo(organizationId, body.vendorId);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'subject')) {
    const subject = String(body.subject || '').trim();
    if (!subject) throw validationError('Purchase Order Subject is required');
    po.subject = subject;
  }
  for (const key of PO_HEADER_EDITABLE) {
    if (key === 'subject') continue;
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (key === 'deliveryMethod') {
      po.deliveryMethod = normalizeDeliveryMethod(body.deliveryMethod);
      continue;
    }
    if (key === 'notes' || key === 'vendorNotes') {
      po.notes = body.notes ?? body.vendorNotes ?? po.notes;
      continue;
    }
    po[key] = body[key];
  }
  if (Object.prototype.hasOwnProperty.call(body, 'vendorNotes') && !Object.prototype.hasOwnProperty.call(body, 'notes')) {
    po.notes = body.vendorNotes;
  }
  // Accept quote-style global discount aliases
  if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountType')) {
    po.overallDiscountType = body.globalDiscountType || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'globalDiscountValue')) {
    po.overallDiscountValue = Number(body.globalDiscountValue) || 0;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'adjustmentTotal')) {
    po.adjustmentTotal = Number(body.adjustmentTotal) || 0;
  }
  po.modifiedBy = userId;
  await po.save();
  return recalculatePurchaseOrderTotals({ organizationId, purchaseOrderId: id, userId });
}

async function patchPurchaseOrderTaxesCharges({ organizationId, id, userId, body = {} }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) {
    throw validationError('Only draft purchase orders can be edited');
  }
  const { applyDocumentTaxesChargesSnapshots } = require('../utils/applyDocumentTaxesCharges');
  await applyDocumentTaxesChargesSnapshots(po, body, {
    organizationId,
    LineModel: PurchaseOrderLine,
    parentIdField: 'purchaseOrderId'
  });
  if (body.adjustmentTotal !== undefined) {
    po.adjustmentTotal = Number(body.adjustmentTotal) || 0;
  }
  po.modifiedBy = userId;
  await po.save();
  const result = await recalculatePurchaseOrderTotals({
    organizationId,
    purchaseOrderId: id,
    userId
  });
  return {
    ...result,
    purchaseOrder: result.purchaseOrder,
    quote: {
      ...result.purchaseOrder,
      transactionTaxSnapshot: result.purchaseOrder.transactionTaxSnapshot,
      chargeDocumentSnapshot: result.purchaseOrder.chargeDocumentSnapshot,
      globalDiscountType: result.purchaseOrder.overallDiscountType,
      globalDiscountValue: result.purchaseOrder.overallDiscountValue,
      globalDiscountTotal: result.purchaseOrder.overallDiscountTotal
    },
    totals: result.totals || {
      subtotal: result.purchaseOrder.subtotal,
      taxTotal: result.purchaseOrder.taxTotal,
      chargesTotal: result.purchaseOrder.chargesTotal,
      grandTotal: result.purchaseOrder.grandTotal,
      adjustmentTotal: result.purchaseOrder.adjustmentTotal
    }
  };
}

async function addPurchaseOrderLine({ organizationId, id, userId, payload }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) {
    throw validationError('Lines can only be added to draft purchase orders');
  }
  const last = await PurchaseOrderLine.findOne({ organizationId, purchaseOrderId: id })
    .sort({ lineOrder: -1 })
    .select('lineOrder')
    .lean();
  const lineOrder = (Number(last?.lineOrder) || 0) + 1;
  const row = payload || {};
  const ld = await buildPurchaseOrderLineDoc({
    organizationId,
    row,
    lineOrder,
    vendorId: po.vendorId
  });
  if (row.linkToVendorCatalog === true && po.vendorId) {
    try {
      const vendorCatalogService = require('./vendorCatalogService');
      await vendorCatalogService.upsertEntry({
        organizationId,
        vendorId: po.vendorId,
        payload: {
          variantId: row.variantId,
          purchasePrice: ld.unitPrice,
          status: 'Active'
        },
        userId
      });
    } catch {
      /* non-blocking: PO line still succeeds */
    }
  }
  ld.purchaseOrderId = po._id;
  const created = await PurchaseOrderLine.create(ld);
  const result = await recalculatePurchaseOrderTotals({ organizationId, purchaseOrderId: id, userId });
  return { ...result, line: created.toObject() };
}

async function updatePurchaseOrderLine({ organizationId, id, lineId, userId, payload }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) {
    throw validationError('Lines can only be edited on draft purchase orders');
  }
  const line = await PurchaseOrderLine.findOne({ _id: lineId, organizationId, purchaseOrderId: id });
  if (!line) throw validationError('Purchase order line not found', 'NOT_FOUND');

  const body = payload || {};
  const qty = body.quantityOrdered ?? body.quantity;
  if (qty !== undefined) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) throw validationError('quantityOrdered must be > 0');
    const moq = Number(line.minOrderQty);
    if (Number.isFinite(moq) && moq > 0 && n < moq) {
      throw validationError(
        `Quantity ${n} is below vendor minimum order quantity (${moq})`
      );
    }
    line.quantityOrdered = n;
    line.quantityPending = Math.max(0, n - (Number(line.quantityReceived) || 0));
  }
  if (body.unitPrice !== undefined) line.unitPrice = Number(body.unitPrice) || 0;
  if (body.discountType !== undefined) line.discountType = body.discountType || null;
  if (body.discountValue !== undefined) line.discountValue = Number(body.discountValue) || 0;
  if (body.description !== undefined) line.descriptionSnapshot = body.description;
  if (body.unitOfMeasure !== undefined) line.unitOfMeasure = body.unitOfMeasure;
  if (body.expectedDeliveryDate !== undefined) line.expectedDeliveryDate = body.expectedDeliveryDate;

  try {
    const {
      hydrateTaxIds,
      applyTaxesToLine,
      taxesFromSnapshot
    } = require('./commercialTaxApplicationService');
    let itemTaxes = null;
    if (Array.isArray(body.taxIds)) {
      itemTaxes = await hydrateTaxIds(organizationId, body.taxIds);
    } else {
      itemTaxes = taxesFromSnapshot(line.taxSnapshot);
    }
    const applied = applyTaxesToLine(
      {
        quantity: line.quantityOrdered,
        unitPriceSnapshot: line.unitPrice,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxSnapshot: line.taxSnapshot,
        taxSide: 'PURCHASE'
      },
      itemTaxes
    );
    line.lineSubtotal = applied.lineSubtotal;
    line.lineTaxTotal = applied.lineTaxTotal;
    line.lineTotal = applied.lineTotal;
    line.taxSnapshot = applied.taxSnapshot;
  } catch {
    const money = lineMoney({
      quantity: line.quantityOrdered,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue
    });
    line.lineSubtotal = money.lineSubtotal;
    line.lineTaxTotal = money.lineTaxTotal;
    line.lineTotal = money.lineTotal;
  }
  await line.save();

  const result = await recalculatePurchaseOrderTotals({ organizationId, purchaseOrderId: id, userId });
  const refreshed = await PurchaseOrderLine.findOne({
    _id: lineId,
    organizationId,
    purchaseOrderId: id
  }).lean();
  return { ...result, line: refreshed || line.toObject() };
}

async function deletePurchaseOrderLine({ organizationId, id, lineId, userId }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) {
    throw validationError('Lines can only be removed from draft purchase orders');
  }
  const deleted = await PurchaseOrderLine.findOneAndDelete({
    _id: lineId,
    organizationId,
    purchaseOrderId: id
  });
  if (!deleted) throw validationError('Purchase order line not found', 'NOT_FOUND');
  return recalculatePurchaseOrderTotals({ organizationId, purchaseOrderId: id, userId });
}

async function submitPurchaseOrder({ organizationId, id, userId }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.DRAFT) throw validationError('Only draft POs can be submitted');
  po.status = PO_STATUSES.PENDING_APPROVAL;
  po.modifiedBy = userId;
  await po.save();
  return po.toObject();
}

async function approvePurchaseOrder({ organizationId, id, userId }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (![PO_STATUSES.DRAFT, PO_STATUSES.PENDING_APPROVAL].includes(po.status)) {
    throw validationError('PO cannot be approved from current status');
  }
  po.status = PO_STATUSES.APPROVED;
  po.modifiedBy = userId;
  await po.save();
  return po.toObject();
}

/** Mark approved PO as issued to vendor (Ordered). */
async function markPurchaseOrderOrdered({ organizationId, id, userId }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if (po.status !== PO_STATUSES.APPROVED) {
    throw validationError('Only approved purchase orders can be marked ordered');
  }
  po.status = PO_STATUSES.ORDERED;
  po.modifiedBy = userId;
  await po.save();
  return po.toObject();
}

async function cancelPurchaseOrder({ organizationId, id, userId }) {
  const po = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null });
  if (!po) throw validationError('Purchase order not found', 'NOT_FOUND');
  if ([PO_STATUSES.FULLY_RECEIVED, PO_STATUSES.CLOSED, PO_STATUSES.CANCELLED].includes(po.status)) {
    throw validationError('PO cannot be cancelled');
  }
  po.status = PO_STATUSES.CANCELLED;
  po.modifiedBy = userId;
  await po.save();
  return po.toObject();
}

/** Clone draft PO + lines for duplicate action. */
async function duplicatePurchaseOrder({ organizationId, id, userId }) {
  const { purchaseOrder: src, lines } = await getPurchaseOrder({ organizationId, id });
  const vendorId = src.vendorId?._id || src.vendorId;
  const subjectBase = String(src.subject || src.poNumber || 'Purchase order').trim();
  return createPurchaseOrder({
    organizationId,
    userId,
    payload: {
      subject: `Copy of ${subjectBase}`,
      vendorId,
      vendorContactId: src.vendorContactId?._id || src.vendorContactId || null,
      vendorReferenceNumber: src.vendorReferenceNumber || null,
      currency: src.currency,
      exchangeRate: src.exchangeRate,
      paymentTerms: src.paymentTerms,
      expectedDeliveryDate: src.expectedDeliveryDate,
      buyerId: userId,
      notes: src.notes,
      internalNotes: src.internalNotes,
      termsAndConditions: src.termsAndConditions,
      deliveryWarehouseId: src.deliveryWarehouseId,
      deliveryMethod: src.deliveryMethod,
      shippingTerms: src.shippingTerms,
      deliveryInstructions: src.deliveryInstructions,
      chargesTotal: src.chargesTotal,
      overallDiscountType: src.overallDiscountType,
      overallDiscountValue: src.overallDiscountValue,
      adjustmentTotal: src.adjustmentTotal,
      taxTotal: src.taxTotal,
      lines: (lines || []).map((line) => ({
        variantId: line.variantId,
        quantityOrdered: line.quantityOrdered,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        vendorItemCode: line.vendorItemCode,
        vendorItemName: line.vendorItemName,
        minOrderQty: line.minOrderQty,
        unitOfMeasure: line.unitOfMeasure,
        description: line.descriptionSnapshot,
        expectedDeliveryDate: line.expectedDeliveryDate
      }))
    }
  });
}

async function refreshPoReceiveStatus(organizationId, purchaseOrderId) {
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId });
  let anyReceived = false;
  let allReceived = lines.length > 0;
  for (const line of lines) {
    const pending = Math.max(0, Number(line.quantityOrdered) - Number(line.quantityReceived));
    line.quantityPending = pending;
    await line.save();
    if (line.quantityReceived > 0) anyReceived = true;
    if (pending > 0) allReceived = false;
  }
  const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, organizationId });
  if (!po || po.status === PO_STATUSES.CANCELLED || po.status === PO_STATUSES.CLOSED) return po;
  if (allReceived) po.status = PO_STATUSES.FULLY_RECEIVED;
  else if (anyReceived) po.status = PO_STATUSES.PARTIALLY_RECEIVED;
  else if (po.status === PO_STATUSES.PARTIALLY_RECEIVED || po.status === PO_STATUSES.FULLY_RECEIVED) {
    // Revert toward ordered when fully unloaded
    po.status = PO_STATUSES.ORDERED;
  }
  await po.save();
  return po;
}

async function createReceiptNote({ organizationId, userId, payload }) {
  const purchaseOrderId = payload.purchaseOrderId;
  if (!purchaseOrderId) throw validationError('purchaseOrderId is required');
  const { purchaseOrder, lines: poLines } = await getPurchaseOrder({ organizationId, id: purchaseOrderId });
  if (!PO_RECEIVABLE_STATUSES.includes(purchaseOrder.status)) {
    throw validationError('Receipt notes require an ordered or receivable purchase order');
  }
  // Accept public UUID or Mongo _id; procurement docs store ObjectId refs
  const receiptLocationRef =
    payload.receiptLocationId || purchaseOrder.deliveryWarehouseId || null;
  if (!receiptLocationRef) throw validationError('receiptLocationId is required');
  const location = await assertActiveLocation({
    organizationId,
    inventoryLocationId: receiptLocationRef
  });
  const receiptLocationId = location._id;

  const receiptNoteNumber = await nextDocNumber(organizationId, 'receipt_notes', 'RN');
  const rn = await ReceiptNote.create({
    organizationId,
    receiptNoteNumber,
    receiptDate: payload.receiptDate || new Date(),
    vendorId: purchaseOrder.vendorId,
    purchaseOrderId,
    receiptLocationId,
    receivedBy: payload.receivedBy || userId,
    vendorDeliveryChallanNo: payload.vendorDeliveryChallanNo || null,
    transportDetails: payload.transportDetails || null,
    status: RN_STATUSES.DRAFT,
    notes: payload.notes || null,
    createdBy: userId,
    modifiedBy: userId
  });

  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  const lineDocs = [];
  for (const poLine of poLines) {
    const override = inputLines.find(
      (l) => String(l.purchaseOrderLineId || l.variantId) === String(poLine._id)
        || String(l.variantId) === String(poLine.variantId)
    );
    const pending = Number(poLine.quantityPending);
    if (pending <= 0) continue;
    const received = Number(override?.quantityReceived ?? pending);
    if (received <= 0) continue;
    if (received > pending) throw validationError('Cannot receive more than pending quantity');
    const accepted = Number(override?.quantityAccepted ?? received);
    const rejected = Number(override?.quantityRejected ?? Math.max(0, received - accepted));
    if (accepted + rejected > received) throw validationError('Accepted + rejected cannot exceed received');

    lineDocs.push({
      organizationId,
      receiptNoteId: rn._id,
      purchaseOrderLineId: poLine._id,
      variantId: poLine.variantId,
      skuSnapshot: poLine.skuSnapshot,
      itemNameSnapshot: poLine.itemNameSnapshot,
      quantityOrdered: poLine.quantityOrdered,
      quantityPreviouslyReceived: poLine.quantityReceived,
      quantityPending: pending,
      quantityReceived: received,
      quantityAccepted: accepted,
      quantityRejected: rejected,
      quantityReturned: 0,
      unitOfMeasure: poLine.unitOfMeasure,
      unitPrice: poLine.unitPrice,
      taxSnapshot: poLine.taxSnapshot,
      chargeSnapshot: poLine.chargeSnapshot,
      inventoryLocationId: override?.inventoryLocationId || receiptLocationId,
      remarks: override?.remarks || null
    });
  }
  if (!lineDocs.length) throw validationError('No receivable lines');
  await ReceiptNoteLine.insertMany(lineDocs);
  const lines = await ReceiptNoteLine.find({ organizationId, receiptNoteId: rn._id }).lean();
  return { receiptNote: rn.toObject(), lines };
}

async function verifyReceiptNote({ organizationId, id, userId }) {
  const rn = await ReceiptNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!rn) throw validationError('Receipt note not found', 'NOT_FOUND');
  if (![RN_STATUSES.DRAFT, RN_STATUSES.PENDING_VERIFICATION].includes(rn.status)) {
    throw validationError('Receipt note cannot be verified');
  }
  const lines = await ReceiptNoteLine.find({ organizationId, receiptNoteId: id });
  const inventoryLines = [];
  for (const line of lines) {
    const accepted = Number(line.quantityAccepted);
    if (accepted <= 0) continue;
    inventoryLines.push({
      variantId: line.variantId,
      quantityDelta: accepted,
      entryType: 'receipt',
      unitCostSnapshot: line.unitPrice,
      lineId: String(line._id),
      sourceRef: {
        moduleKey: 'receipt_notes',
        recordId: String(rn._id),
        lineId: String(line._id)
      }
    });
  }

  if (inventoryLines.length) {
    const { resolveInventoryLocationUuid } = require('./inventoryLocationService');
    const locUuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: rn.receiptLocationId
    });
    await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'adjustment',
      inventoryLocationId: locUuid,
      lines: inventoryLines,
      sourceContext: 'purchase_receipt',
      sourceRef: {
        moduleKey: 'receipt_notes',
        recordId: String(rn._id),
        lineId: null
      },
      idempotent: true
    });
  }

  for (const line of lines) {
    const poLine = await PurchaseOrderLine.findOne({
      _id: line.purchaseOrderLineId,
      organizationId
    });
    if (poLine) {
      poLine.quantityReceived = Number(poLine.quantityReceived) + Number(line.quantityAccepted);
      poLine.quantityPending = Math.max(0, Number(poLine.quantityOrdered) - Number(poLine.quantityReceived));
      await poLine.save();
    }
  }

  rn.status = RN_STATUSES.INVENTORY_UPDATED;
  rn.modifiedBy = userId;
  await rn.save();
  await refreshPoReceiveStatus(organizationId, rn.purchaseOrderId);

  try {
    const vendorCatalogService = require('./vendorCatalogService');
    await vendorCatalogService.recordPurchasesFromReceipt({
      organizationId,
      vendorId: rn.vendorId,
      lines: lines.map((l) => l.toObject ? l.toObject() : l),
      purchaseDate: rn.receiptDate || new Date(),
      userId
    });
  } catch (catalogErr) {
    console.warn(
      '[procurementService] vendor catalog last-purchase update failed',
      catalogErr?.message
    );
  }

  return getReceiptNote({ organizationId, id });
}

async function listReceiptNotes({
  organizationId,
  purchaseOrderId = null,
  limit = 50,
  page = 1,
  status = null,
  search = null,
  sortBy = 'updatedAt',
  sortOrder = 'desc'
}) {
  const q = { organizationId, deletedAt: null };
  if (purchaseOrderId) q.purchaseOrderId = purchaseOrderId;
  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : String(status)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    if (statuses.length === 1) q.status = statuses[0];
    else if (statuses.length > 1) q.status = { $in: statuses };
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      q.$or = [
        { receiptNoteNumber: new RegExp(term, 'i') },
        { vendorDeliveryChallanNo: new RegExp(term, 'i') }
      ];
    }
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const allowedSort = new Set([
    'updatedAt',
    'createdAt',
    'receiptDate',
    'receiptNoteNumber',
    'status'
  ]);
  const sortField = allowedSort.has(String(sortBy)) ? String(sortBy) : 'updatedAt';
  const sort = { [sortField]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };
  const [data, total] = await Promise.all([
    ReceiptNote.find(q)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    ReceiptNote.countDocuments(q)
  ]);
  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum))
    }
  };
}

async function getReceiptNote({ organizationId, id }) {
  const receiptNote = await ReceiptNote.findOne({ _id: id, organizationId, deletedAt: null })
    .populate({ path: 'vendorId', select: 'name' })
    .populate({ path: 'purchaseOrderId', select: 'poNumber subject status' })
    .populate({ path: 'receiptLocationId', select: 'name locationCode inventoryLocationId' })
    .populate({ path: 'receivedBy', select: 'name firstName lastName email' })
    .populate({ path: 'createdBy', select: 'name firstName lastName email' })
    .populate({ path: 'modifiedBy', select: 'name firstName lastName email' })
    .lean();
  if (!receiptNote) throw validationError('Receipt note not found', 'NOT_FOUND');
  const lines = await ReceiptNoteLine.find({ organizationId, receiptNoteId: id }).lean();
  return { receiptNote, lines };
}

function returnableQtyFromRnLine(rnLine) {
  return Math.max(0, Number(rnLine.quantityAccepted || 0) - Number(rnLine.quantityReturned || 0));
}

function normalizeReturnType(raw) {
  if (raw == null || raw === '') return 'goods_return';
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (PR_RETURN_TYPES.includes(key)) return key;
  return 'goods_return';
}

/**
 * Returnable receipt lines for a vendor (optional filters: RN/PO ids).
 */
async function listEligibleReturnSources({
  organizationId,
  vendorId,
  receiptNoteIds = null,
  purchaseOrderIds = null
}) {
  if (!vendorId) throw validationError('vendorId is required');
  await assertVendorForPo(organizationId, vendorId);

  const rnQuery = {
    organizationId,
    deletedAt: null,
    vendorId,
    status: { $in: [...PR_SOURCE_RN_STATUSES] }
  };
  if (Array.isArray(receiptNoteIds) && receiptNoteIds.length) {
    rnQuery._id = { $in: receiptNoteIds };
  }
  if (Array.isArray(purchaseOrderIds) && purchaseOrderIds.length) {
    rnQuery.purchaseOrderId = { $in: purchaseOrderIds };
  }

  const receiptNotes = await ReceiptNote.find(rnQuery).sort({ receiptDate: -1 }).lean();
  if (!receiptNotes.length) {
    return { receiptNotes: [], purchaseOrders: [], lines: [] };
  }

  const rnIds = receiptNotes.map((r) => r._id);
  const rnLines = await ReceiptNoteLine.find({
    organizationId,
    receiptNoteId: { $in: rnIds }
  }).lean();

  const eligibleLines = [];
  for (const line of rnLines) {
    const returnable = returnableQtyFromRnLine(line);
    if (returnable <= 0) continue;
    const rn = receiptNotes.find((r) => String(r._id) === String(line.receiptNoteId));
    eligibleLines.push({
      ...line,
      quantityReturnable: returnable,
      receiptNoteNumber: rn?.receiptNoteNumber || null,
      purchaseOrderId: rn?.purchaseOrderId || line.purchaseOrderId || null,
      vendorId: rn?.vendorId || vendorId
    });
  }

  const poIds = [
    ...new Set(
      receiptNotes
        .map((r) => (r.purchaseOrderId ? String(r.purchaseOrderId) : null))
        .filter(Boolean)
    )
  ];
  const purchaseOrders = poIds.length
    ? await PurchaseOrder.find({
      organizationId,
      deletedAt: null,
      _id: { $in: poIds }
    })
      .select('_id poNumber subject status vendorId grandTotal poDate')
      .lean()
    : [];

  const notesOut = receiptNotes
    .map((rn) => {
      const lines = eligibleLines.filter((l) => String(l.receiptNoteId) === String(rn._id));
      if (!lines.length) return null;
      return {
        ...rn,
        returnableLineCount: lines.length,
        returnableQuantityTotal: lines.reduce((s, l) => s + Number(l.quantityReturnable || 0), 0)
      };
    })
    .filter(Boolean);

  const posOut = purchaseOrders
    .map((po) => {
      const lines = eligibleLines.filter((l) => String(l.purchaseOrderId) === String(po._id));
      if (!lines.length) return null;
      return {
        ...po,
        returnableLineCount: lines.length,
        returnableQuantityTotal: lines.reduce((s, l) => s + Number(l.quantityReturnable || 0), 0)
      };
    })
    .filter(Boolean);

  return { receiptNotes: notesOut, purchaseOrders: posOut, lines: eligibleLines };
}

async function resolveReturnLineInputs({ organizationId, vendorId, payload }) {
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  const receiptNoteIds = [
    ...(payload.receiptNoteId ? [payload.receiptNoteId] : []),
    ...(Array.isArray(payload.receiptNoteIds) ? payload.receiptNoteIds : [])
  ].filter(Boolean);
  const purchaseOrderIds = [
    ...(payload.purchaseOrderId ? [payload.purchaseOrderId] : []),
    ...(Array.isArray(payload.purchaseOrderIds) ? payload.purchaseOrderIds : [])
  ].filter(Boolean);

  if (!inputLines.length && !receiptNoteIds.length && !purchaseOrderIds.length) {
    throw validationError(
      'Provide return lines, receiptNoteId(s), or purchaseOrderId(s) with returnable stock'
    );
  }

  const { lines: eligible } = await listEligibleReturnSources({
    organizationId,
    vendorId,
    receiptNoteIds: receiptNoteIds.length ? receiptNoteIds : null,
    purchaseOrderIds: purchaseOrderIds.length ? purchaseOrderIds : null
  });
  const byRnLineId = new Map(eligible.map((l) => [String(l._id), l]));

  if (inputLines.length) {
    return inputLines.map((row) => {
      const rnLineId = row.receiptNoteLineId || row._id;
      const rnLine = byRnLineId.get(String(rnLineId));
      if (!rnLine) {
        throw validationError('Invalid or non-returnable receiptNoteLineId');
      }
      const qty =
        row.quantityReturned != null
          ? Number(row.quantityReturned)
          : Number(rnLine.quantityReturnable);
      return {
        rnLine,
        quantityReturned: qty,
        returnReason: row.returnReason || payload.returnReason || 'Return',
        inventoryLocationId: row.inventoryLocationId || null
      };
    });
  }

  // Expand all eligible lines at full returnable qty
  return eligible.map((rnLine) => ({
    rnLine,
    quantityReturned: Number(rnLine.quantityReturnable),
    returnReason: payload.returnReason || 'Return',
    inventoryLocationId: null
  }));
}

async function buildPrLineDocs({ organizationId, resolved, headerReturnWarehouseId }) {
  let subtotal = 0;
  const lineDocs = [];
  let order = 1;
  for (const row of resolved) {
    const rnLine = row.rnLine;
    const returnable = returnableQtyFromRnLine(rnLine);
    const qty = Number(row.quantityReturned);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityReturned must be > 0');
    if (qty > returnable) {
      throw validationError(
        `Cannot return more than available received quantity for line (${qty} > ${returnable})`
      );
    }
    if (!row.returnReason) throw validationError('Line returnReason is required');
    const unitPrice = Number(rnLine.unitPrice) || 0;
    const lineSubtotal = qty * unitPrice;
    subtotal += lineSubtotal;
    const locationId =
      row.inventoryLocationId || rnLine.inventoryLocationId || headerReturnWarehouseId;
    if (!locationId) throw validationError('inventoryLocationId is required on return lines');

    lineDocs.push({
      organizationId,
      lineOrder: order++,
      receiptNoteId: rnLine.receiptNoteId,
      receiptNoteLineId: rnLine._id,
      purchaseOrderId: rnLine.purchaseOrderId || null,
      purchaseOrderLineId: rnLine.purchaseOrderLineId || null,
      variantId: rnLine.variantId,
      skuSnapshot: rnLine.skuSnapshot,
      itemNameSnapshot: rnLine.itemNameSnapshot,
      vendorItemCode: rnLine.vendorItemCode || null,
      vendorItemName: rnLine.vendorItemName || null,
      quantityReceived: rnLine.quantityAccepted,
      quantityReturnable: returnable,
      quantityReturned: qty,
      unitOfMeasure: rnLine.unitOfMeasure,
      unitPrice,
      returnReason: row.returnReason,
      taxSnapshot: rnLine.taxSnapshot || {},
      chargeSnapshot: rnLine.chargeSnapshot || {},
      lineSubtotal,
      lineTaxTotal: 0,
      lineTotal: lineSubtotal,
      inventoryLocationId: locationId
    });
  }
  return { lineDocs, subtotal };
}

async function createPurchaseReturn({ organizationId, userId, payload }) {
  // Resolve vendor: explicit or from receipt note
  let vendorId = payload.vendorId || null;
  if (!vendorId && payload.receiptNoteId) {
    const rn = await ReceiptNote.findOne({
      _id: payload.receiptNoteId,
      organizationId,
      deletedAt: null
    }).lean();
    if (!rn) throw validationError('Receipt note not found', 'NOT_FOUND');
    vendorId = rn.vendorId;
  }
  if (!vendorId) throw validationError('vendorId is required');
  await assertVendorForPo(organizationId, vendorId);

  const subject = String(payload.subject || '').trim();
  if (!subject) throw validationError('subject is required');

  const returnWarehouseId = payload.returnWarehouseId || null;
  if (returnWarehouseId) {
    await assertActiveLocation({ organizationId, inventoryLocationId: returnWarehouseId });
  }

  const hasLineInput =
    (Array.isArray(payload.lines) && payload.lines.length > 0) ||
    payload.receiptNoteId ||
    (Array.isArray(payload.receiptNoteIds) && payload.receiptNoteIds.length) ||
    payload.purchaseOrderId ||
    (Array.isArray(payload.purchaseOrderIds) && payload.purchaseOrderIds.length);

  let lineDocs = [];
  let subtotal = 0;
  if (hasLineInput) {
    const resolved = await resolveReturnLineInputs({ organizationId, vendorId, payload });
    if (!resolved.length) throw validationError('No returnable quantities for selected sources');
    const built = await buildPrLineDocs({
      organizationId,
      resolved,
      headerReturnWarehouseId: returnWarehouseId
    });
    lineDocs = built.lineDocs;
    subtotal = built.subtotal;
  }

  const purchaseReturnNumber = await nextDocNumber(organizationId, 'purchase_returns', 'PR');
  const rnIds = [...new Set(lineDocs.map((l) => String(l.receiptNoteId)))];
  const poIds = [
    ...new Set(
      lineDocs.map((l) => (l.purchaseOrderId ? String(l.purchaseOrderId) : null)).filter(Boolean)
    )
  ];

  const pr = await PurchaseReturn.create({
    organizationId,
    purchaseReturnNumber,
    subject,
    returnDate: payload.returnDate || new Date(),
    vendorId,
    vendorContactId: payload.vendorContactId || null,
    ownerId: payload.ownerId || userId,
    receiptNoteId: rnIds.length === 1 ? rnIds[0] : payload.receiptNoteId || null,
    purchaseOrderId: poIds.length === 1 ? poIds[0] : payload.purchaseOrderId || null,
    returnType: normalizeReturnType(payload.returnType),
    returnReason: payload.returnReason || null,
    supplierReference: payload.supplierReference || null,
    returnWarehouseId: returnWarehouseId,
    currency: payload.currency || 'USD',
    status: PR_STATUSES.DRAFT,
    vendorNotes: payload.vendorNotes || payload.notes || null,
    internalNotes: payload.internalNotes || null,
    notes: payload.notes || payload.vendorNotes || null,
    subtotal,
    taxTotal: 0,
    chargesTotal: 0,
    grandTotal: subtotal,
    createdBy: userId,
    modifiedBy: userId
  });

  if (lineDocs.length) {
    for (const ld of lineDocs) ld.purchaseReturnId = pr._id;
    await PurchaseReturnLine.insertMany(lineDocs);
  }
  return getPurchaseReturn({ organizationId, id: pr._id });
}

async function updatePurchaseReturn({ organizationId, id, userId, payload }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (pr.status !== PR_STATUSES.DRAFT && pr.status !== PR_STATUSES.PENDING_APPROVAL) {
    throw validationError('Only draft purchase returns can be edited');
  }

  const allowed = [
    'subject',
    'returnDate',
    'vendorContactId',
    'ownerId',
    'returnType',
    'returnReason',
    'supplierReference',
    'returnWarehouseId',
    'currency',
    'vendorNotes',
    'internalNotes',
    'notes'
  ];
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === 'returnType') {
      pr.returnType = normalizeReturnType(payload.returnType);
    } else if (key === 'returnWarehouseId' && payload.returnWarehouseId) {
      await assertActiveLocation({
        organizationId,
        inventoryLocationId: payload.returnWarehouseId
      });
      pr.returnWarehouseId = payload.returnWarehouseId;
    } else {
      pr[key] = payload[key];
    }
  }
  if (payload.subject !== undefined && !String(payload.subject || '').trim()) {
    throw validationError('subject is required');
  }
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

async function updatePurchaseReturnLine({ organizationId, id, lineId, userId, payload }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (pr.status !== PR_STATUSES.DRAFT && pr.status !== PR_STATUSES.PENDING_APPROVAL) {
    throw validationError('Only draft purchase returns can edit lines');
  }
  const line = await PurchaseReturnLine.findOne({
    _id: lineId,
    organizationId,
    purchaseReturnId: id
  });
  if (!line) throw validationError('Purchase return line not found', 'NOT_FOUND');

  const rnLine = await ReceiptNoteLine.findOne({
    _id: line.receiptNoteLineId,
    organizationId
  }).lean();
  if (!rnLine) throw validationError('Source receipt line not found', 'NOT_FOUND');

  if (payload.quantityReturned !== undefined) {
    const qty = Number(payload.quantityReturned);
    const returnable = returnableQtyFromRnLine(rnLine);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityReturned must be > 0');
    if (qty > returnable) throw validationError('Cannot return more than available received quantity');
    line.quantityReturned = qty;
    line.quantityReturnable = returnable;
    line.lineSubtotal = qty * Number(line.unitPrice || 0);
    line.lineTotal = line.lineSubtotal;
  }
  if (payload.returnReason !== undefined) {
    if (!String(payload.returnReason || '').trim()) throw validationError('returnReason is required');
    line.returnReason = payload.returnReason;
  }
  if (payload.unitPrice !== undefined) {
    line.unitPrice = Number(payload.unitPrice) || 0;
    line.lineSubtotal = Number(line.quantityReturned) * Number(line.unitPrice);
    line.lineTotal = line.lineSubtotal;
  }
  await line.save();

  const allLines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id }).lean();
  const subtotal = allLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  pr.subtotal = subtotal;
  pr.grandTotal = subtotal + Number(pr.taxTotal || 0) + Number(pr.chargesTotal || 0);
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

async function deletePurchaseReturnLine({ organizationId, id, lineId, userId }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (pr.status !== PR_STATUSES.DRAFT && pr.status !== PR_STATUSES.PENDING_APPROVAL) {
    throw validationError('Only draft purchase returns can remove lines');
  }
  const result = await PurchaseReturnLine.deleteOne({
    _id: lineId,
    organizationId,
    purchaseReturnId: id
  });
  if (!result.deletedCount) throw validationError('Purchase return line not found', 'NOT_FOUND');
  const remaining = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id }).lean();
  const subtotal = remaining.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  pr.subtotal = subtotal;
  pr.grandTotal = subtotal + Number(pr.taxTotal || 0) + Number(pr.chargesTotal || 0);
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

/**
 * Import additional returnable lines from sources into a draft PR.
 */
async function addPurchaseReturnLinesFromSources({ organizationId, id, userId, payload }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (pr.status !== PR_STATUSES.DRAFT && pr.status !== PR_STATUSES.PENDING_APPROVAL) {
    throw validationError('Only draft purchase returns can add lines');
  }

  const resolved = await resolveReturnLineInputs({
    organizationId,
    vendorId: pr.vendorId,
    payload: {
      ...payload,
      returnReason: payload.returnReason || pr.returnReason || 'Return'
    }
  });
  const existing = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id }).lean();
  const existingRnLineIds = new Set(existing.map((l) => String(l.receiptNoteLineId)));
  const filtered = resolved.filter((r) => !existingRnLineIds.has(String(r.rnLine._id)));
  if (!filtered.length) throw validationError('No new returnable lines to add');

  const maxOrder = existing.reduce((m, l) => Math.max(m, Number(l.lineOrder) || 0), 0);
  const { lineDocs, subtotal: addSub } = await buildPrLineDocs({
    organizationId,
    resolved: filtered,
    headerReturnWarehouseId: pr.returnWarehouseId
  });
  for (let i = 0; i < lineDocs.length; i++) {
    lineDocs[i].purchaseReturnId = pr._id;
    lineDocs[i].lineOrder = maxOrder + i + 1;
  }
  await PurchaseReturnLine.insertMany(lineDocs);
  pr.subtotal = Number(pr.subtotal || 0) + addSub;
  pr.grandTotal = Number(pr.subtotal) + Number(pr.taxTotal || 0) + Number(pr.chargesTotal || 0);
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

/** Approve only — no inventory (PM: Approved). */
async function approvePurchaseReturn({ organizationId, id, userId }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (![PR_STATUSES.DRAFT, PR_STATUSES.PENDING_APPROVAL].includes(pr.status)) {
    throw validationError('Purchase return cannot be approved');
  }
  const lineCount = await PurchaseReturnLine.countDocuments({
    organizationId,
    purchaseReturnId: id
  });
  if (!lineCount) throw validationError('Purchase return has no lines');

  pr.status = PR_STATUSES.APPROVED;
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

/**
 * Mark Returned: post inventory out, update RN/PO return qty, vendor catalog.
 * Idempotent if already returned with inventoryPostedAt set.
 */
async function markPurchaseReturnReturned({ organizationId, id, userId }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');

  if (pr.status === PR_STATUSES.RETURNED && pr.inventoryPostedAt) {
    return getPurchaseReturn({ organizationId, id });
  }
  if (
    ![
      PR_STATUSES.DRAFT,
      PR_STATUSES.PENDING_APPROVAL,
      PR_STATUSES.APPROVED
    ].includes(pr.status)
  ) {
    throw validationError('Purchase return cannot be marked returned from current status');
  }

  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id });
  if (!lines.length) throw validationError('Purchase return has no lines');

  // Re-validate returnable against live RN state
  for (const line of lines) {
    const rnLine = await ReceiptNoteLine.findOne({
      _id: line.receiptNoteLineId,
      organizationId
    }).lean();
    if (!rnLine) throw validationError('Source receipt line missing');
    const returnable = returnableQtyFromRnLine(rnLine);
    if (Number(line.quantityReturned) > returnable) {
      throw validationError(
        `Return quantity exceeds available for ${line.itemNameSnapshot || line.skuSnapshot || 'line'}`
      );
    }
  }

  if (!pr.inventoryPostedAt) {
    const byLocation = new Map();
    for (const line of lines) {
      const loc = String(line.inventoryLocationId);
      if (!byLocation.has(loc)) byLocation.set(loc, []);
      byLocation.get(loc).push({
        variantId: line.variantId,
        quantityDelta: -Number(line.quantityReturned),
        entryType: 'adjustment_out',
        unitCostSnapshot: line.unitPrice,
        lineId: String(line._id),
        sourceRef: {
          moduleKey: 'purchase_returns',
          recordId: String(pr._id),
          lineId: String(line._id)
        }
      });
    }

    const { resolveInventoryLocationUuid } = require('./inventoryLocationService');
    for (const [loc, invLines] of byLocation.entries()) {
      const locUuid = await resolveInventoryLocationUuid({ organizationId, locationRef: loc });
      await postInventoryTransaction({
        organizationId,
        userId,
        transactionType: 'adjustment',
        inventoryLocationId: locUuid,
        lines: invLines,
        sourceContext: 'purchase_return',
        sourceRef: {
          moduleKey: 'purchase_returns',
          recordId: String(pr._id),
          lineId: null
        },
        idempotent: true
      });
    }

    for (const line of lines) {
      await ReceiptNoteLine.updateOne(
        { _id: line.receiptNoteLineId, organizationId },
        { $inc: { quantityReturned: Number(line.quantityReturned) } }
      );
      if (line.purchaseOrderLineId) {
        await PurchaseOrderLine.updateOne(
          { _id: line.purchaseOrderLineId, organizationId },
          { $inc: { quantityReturned: Number(line.quantityReturned) } }
        );
      }
    }

    try {
      const vendorCatalogService = require('./vendorCatalogService');
      await vendorCatalogService.recordReturnsFromPurchaseReturn({
        organizationId,
        vendorId: pr.vendorId,
        lines: lines.map((l) => (l.toObject ? l.toObject() : l)),
        returnDate: pr.returnDate || new Date(),
        userId
      });
    } catch (catalogErr) {
      console.warn(
        '[procurementService] vendor catalog return update failed',
        catalogErr?.message
      );
    }

    pr.inventoryPostedAt = new Date();
  }

  pr.status = PR_STATUSES.RETURNED;
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

async function cancelPurchaseReturn({ organizationId, id, userId }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (
    ![PR_STATUSES.DRAFT, PR_STATUSES.PENDING_APPROVAL, PR_STATUSES.APPROVED].includes(pr.status)
  ) {
    throw validationError('Only draft or approved purchase returns can be cancelled');
  }
  pr.status = PR_STATUSES.CANCELLED;
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

async function duplicatePurchaseReturn({ organizationId, id, userId }) {
  const src = await getPurchaseReturn({ organizationId, id });
  const pr = src.purchaseReturn;
  return createPurchaseReturn({
    organizationId,
    userId,
    payload: {
      subject: pr.subject ? `Copy of ${pr.subject}` : 'Purchase Return',
      vendorId: pr.vendorId,
      vendorContactId: pr.vendorContactId,
      ownerId: userId,
      returnType: pr.returnType,
      returnReason: pr.returnReason,
      supplierReference: pr.supplierReference,
      returnWarehouseId: pr.returnWarehouseId,
      currency: pr.currency,
      vendorNotes: pr.vendorNotes || pr.notes,
      internalNotes: pr.internalNotes,
      lines: (src.lines || []).map((l) => ({
        receiptNoteLineId: l.receiptNoteLineId,
        quantityReturned: l.quantityReturned,
        returnReason: l.returnReason,
        inventoryLocationId: l.inventoryLocationId
      }))
    }
  });
}

async function listPurchaseReturns({
  organizationId,
  limit = 50,
  page = 1,
  status = null,
  search = null,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const q = { organizationId, deletedAt: null };
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) q.status = statuses[0];
    else if (statuses.length > 1) q.status = { $in: statuses };
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      q.$or = [
        { purchaseReturnNumber: new RegExp(term, 'i') },
        { subject: new RegExp(term, 'i') }
      ];
    }
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const sort = { [sortBy || 'createdAt']: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };
  const [data, total] = await Promise.all([
    PurchaseReturn.find(q)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    PurchaseReturn.countDocuments(q)
  ]);
  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
}

async function getPurchaseReturn({ organizationId, id }) {
  const purchaseReturn = await PurchaseReturn.findOne({
    _id: id,
    organizationId,
    deletedAt: null
  })
    .populate({ path: 'vendorId', select: 'name types email phone participations' })
    .populate({ path: 'vendorContactId', select: 'firstName lastName first_name last_name email' })
    .populate({ path: 'ownerId', select: 'name firstName lastName email' })
    .populate({ path: 'createdBy', select: 'name firstName lastName email' })
    .populate({ path: 'modifiedBy', select: 'name firstName lastName email' })
    .lean();
  if (!purchaseReturn) throw validationError('Purchase return not found', 'NOT_FOUND');
  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id })
    .sort({ lineOrder: 1 })
    .lean();
  return { purchaseReturn, lines };
}

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrder,
  addPurchaseOrderLine,
  updatePurchaseOrderLine,
  deletePurchaseOrderLine,
  submitPurchaseOrder,
  approvePurchaseOrder,
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  duplicatePurchaseOrder,
  patchPurchaseOrderTaxesCharges,
  createReceiptNote,
  verifyReceiptNote,
  listReceiptNotes,
  getReceiptNote,
  listEligibleReturnSources,
  createPurchaseReturn,
  updatePurchaseReturn,
  updatePurchaseReturnLine,
  deletePurchaseReturnLine,
  addPurchaseReturnLinesFromSources,
  approvePurchaseReturn,
  markPurchaseReturnReturned,
  cancelPurchaseReturn,
  duplicatePurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturn
};
