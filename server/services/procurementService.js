/**
 * Procurement services — PO / Receipt Note / Purchase Return.
 * Inventory posts only on RN verify (accepted qty) and PR approve.
 */

const ModuleSequence = require('../models/ModuleSequence');
const { PurchaseOrder, PurchaseOrderLine } = require('../models/PurchaseOrder');
const { ReceiptNote, ReceiptNoteLine } = require('../models/ReceiptNote');
const { PurchaseReturn, PurchaseReturnLine } = require('../models/PurchaseReturn');
const {
  PO_STATUSES,
  RN_STATUSES,
  PR_STATUSES
} = require('../constants/procurementLifecycle');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { assertActiveLocation } = require('./inventoryLocationService');
const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const seq = await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey, periodKey: '' },
    { $inc: { nextValue: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const n = Number(seq.nextValue) || 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
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

async function createPurchaseOrder({ organizationId, userId, payload }) {
  const vendorId = payload.vendorId;
  if (!vendorId) throw validationError('Vendor is required');
  const linesInput = Array.isArray(payload.lines) ? payload.lines : [];
  if (!linesInput.length) throw validationError('At least one line is required');

  const poNumber = await nextDocNumber(organizationId, 'purchase_orders', 'PO');
  let subtotal = 0;
  const lineDocs = [];

  for (let i = 0; i < linesInput.length; i++) {
    const row = linesInput[i];
    if (!row.variantId) throw validationError('Line variantId is required');
    const qty = Number(row.quantityOrdered ?? row.quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityOrdered must be > 0');
    const { variant, item } = await hydrateVariant(organizationId, row.variantId);
    const unitPrice = Number(row.unitPrice ?? variant.purchase_price ?? variant.cost_price ?? 0) || 0;
    const money = lineMoney({
      quantity: qty,
      unitPrice,
      discountType: row.discountType,
      discountValue: row.discountValue
    });
    subtotal += money.lineSubtotal;
    lineDocs.push({
      organizationId,
      lineOrder: i + 1,
      variantId: variant._id,
      skuSnapshot: variant.variant_code || variant.barcode || String(variant._id),
      itemNameSnapshot: item?.item_name || null,
      descriptionSnapshot: row.description || item?.description || null,
      quantityOrdered: qty,
      quantityReceived: 0,
      quantityPending: qty,
      unitOfMeasure: row.unitOfMeasure || variant.unit_of_measure || item?.unit_of_measure || null,
      unitPrice,
      discountType: row.discountType || null,
      discountValue: Number(row.discountValue) || 0,
      taxSnapshot: row.taxSnapshot || { taxes: [] },
      chargeSnapshot: row.chargeSnapshot || { charges: [] },
      lineSubtotal: money.lineSubtotal,
      lineTaxTotal: money.lineTaxTotal,
      lineTotal: money.lineTotal,
      expectedDeliveryDate: row.expectedDeliveryDate || null
    });
  }

  const po = await PurchaseOrder.create({
    organizationId,
    poNumber,
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
    notes: payload.notes || null,
    termsAndConditions: payload.termsAndConditions || null,
    subtotal,
    taxTotal: Number(payload.taxTotal) || 0,
    chargesTotal: Number(payload.chargesTotal) || 0,
    grandTotal: subtotal + (Number(payload.taxTotal) || 0) + (Number(payload.chargesTotal) || 0),
    createdBy: userId,
    modifiedBy: userId
  });

  for (const ld of lineDocs) {
    ld.purchaseOrderId = po._id;
  }
  await PurchaseOrderLine.insertMany(lineDocs);
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId: po._id }).lean();
  return { purchaseOrder: po.toObject(), lines };
}

async function listPurchaseOrders({ organizationId, status = null, limit = 50 }) {
  const q = { organizationId, deletedAt: null };
  if (status) q.status = status;
  return PurchaseOrder.find(q).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getPurchaseOrder({ organizationId, id }) {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!purchaseOrder) throw validationError('Purchase order not found', 'NOT_FOUND');
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId: id }).sort({ lineOrder: 1 }).lean();
  return { purchaseOrder, lines };
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
    po.status = PO_STATUSES.APPROVED;
  }
  await po.save();
  return po;
}

async function createReceiptNote({ organizationId, userId, payload }) {
  const purchaseOrderId = payload.purchaseOrderId;
  if (!purchaseOrderId) throw validationError('purchaseOrderId is required');
  const { purchaseOrder, lines: poLines } = await getPurchaseOrder({ organizationId, id: purchaseOrderId });
  if (![PO_STATUSES.APPROVED, PO_STATUSES.PARTIALLY_RECEIVED].includes(purchaseOrder.status)) {
    throw validationError('Receipt notes require an approved purchase order');
  }
  const receiptLocationId = payload.receiptLocationId;
  if (!receiptLocationId) throw validationError('receiptLocationId is required');
  await assertActiveLocation({ organizationId, inventoryLocationId: receiptLocationId });

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
    await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'adjustment',
      inventoryLocationId: rn.receiptLocationId,
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

  return getReceiptNote({ organizationId, id });
}

async function listReceiptNotes({ organizationId, purchaseOrderId = null, limit = 50 }) {
  const q = { organizationId, deletedAt: null };
  if (purchaseOrderId) q.purchaseOrderId = purchaseOrderId;
  return ReceiptNote.find(q).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getReceiptNote({ organizationId, id }) {
  const receiptNote = await ReceiptNote.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!receiptNote) throw validationError('Receipt note not found', 'NOT_FOUND');
  const lines = await ReceiptNoteLine.find({ organizationId, receiptNoteId: id }).lean();
  return { receiptNote, lines };
}

async function createPurchaseReturn({ organizationId, userId, payload }) {
  const receiptNoteId = payload.receiptNoteId;
  if (!receiptNoteId) throw validationError('receiptNoteId is required');
  const { receiptNote, lines: rnLines } = await getReceiptNote({ organizationId, id: receiptNoteId });
  if (![RN_STATUSES.INVENTORY_UPDATED, RN_STATUSES.VERIFIED, RN_STATUSES.CLOSED].includes(receiptNote.status)) {
    throw validationError('Purchase return requires a verified receipt note');
  }
  if (!payload.returnReason) throw validationError('returnReason is required');

  const purchaseReturnNumber = await nextDocNumber(organizationId, 'purchase_returns', 'PR');
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!inputLines.length) throw validationError('At least one return line is required');

  let subtotal = 0;
  const lineDocs = [];
  for (const row of inputLines) {
    const rnLine = rnLines.find((l) => String(l._id) === String(row.receiptNoteLineId));
    if (!rnLine) throw validationError('Invalid receiptNoteLineId');
    const returnable = Number(rnLine.quantityAccepted) - Number(rnLine.quantityReturned || 0);
    const qty = Number(row.quantityReturned);
    if (!Number.isFinite(qty) || qty <= 0) throw validationError('quantityReturned must be > 0');
    if (qty > returnable) throw validationError('Cannot return more than available received quantity');
    if (!row.returnReason) throw validationError('Line returnReason is required');
    const lineTotal = qty * Number(rnLine.unitPrice);
    subtotal += lineTotal;
    lineDocs.push({
      organizationId,
      receiptNoteLineId: rnLine._id,
      variantId: rnLine.variantId,
      skuSnapshot: rnLine.skuSnapshot,
      itemNameSnapshot: rnLine.itemNameSnapshot,
      quantityReceived: rnLine.quantityAccepted,
      quantityReturned: qty,
      unitOfMeasure: rnLine.unitOfMeasure,
      unitPrice: rnLine.unitPrice,
      returnReason: row.returnReason,
      taxSnapshot: rnLine.taxSnapshot,
      chargeSnapshot: rnLine.chargeSnapshot,
      lineTotal,
      inventoryLocationId: row.inventoryLocationId || rnLine.inventoryLocationId
    });
  }

  const pr = await PurchaseReturn.create({
    organizationId,
    purchaseReturnNumber,
    returnDate: payload.returnDate || new Date(),
    vendorId: receiptNote.vendorId,
    receiptNoteId,
    purchaseOrderId: receiptNote.purchaseOrderId,
    returnReason: payload.returnReason,
    currency: payload.currency || 'USD',
    status: PR_STATUSES.DRAFT,
    notes: payload.notes || null,
    subtotal,
    taxTotal: 0,
    chargesTotal: 0,
    grandTotal: subtotal,
    createdBy: userId,
    modifiedBy: userId
  });

  for (const ld of lineDocs) ld.purchaseReturnId = pr._id;
  await PurchaseReturnLine.insertMany(lineDocs);
  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: pr._id }).lean();
  return { purchaseReturn: pr.toObject(), lines };
}

async function approvePurchaseReturn({ organizationId, id, userId }) {
  const pr = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!pr) throw validationError('Purchase return not found', 'NOT_FOUND');
  if (![PR_STATUSES.DRAFT, PR_STATUSES.PENDING_APPROVAL].includes(pr.status)) {
    throw validationError('Purchase return cannot be approved');
  }
  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id });

  const byLocation = new Map();
  for (const line of lines) {
    const loc = String(line.inventoryLocationId);
    if (!byLocation.has(loc)) byLocation.set(loc, []);
    byLocation.get(loc).push({
      variantId: line.variantId,
      quantityDelta: -Number(line.quantityReturned),
      entryType: 'return',
      unitCostSnapshot: line.unitPrice,
      lineId: String(line._id),
      sourceRef: {
        moduleKey: 'purchase_returns',
        recordId: String(pr._id),
        lineId: String(line._id)
      }
    });
  }

  for (const [loc, invLines] of byLocation.entries()) {
    await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'adjustment',
      inventoryLocationId: loc,
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
  }

  pr.status = PR_STATUSES.RETURNED;
  pr.modifiedBy = userId;
  await pr.save();
  return getPurchaseReturn({ organizationId, id });
}

async function listPurchaseReturns({ organizationId, limit = 50 }) {
  return PurchaseReturn.find({ organizationId, deletedAt: null }).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getPurchaseReturn({ organizationId, id }) {
  const purchaseReturn = await PurchaseReturn.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!purchaseReturn) throw validationError('Purchase return not found', 'NOT_FOUND');
  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: id }).lean();
  return { purchaseReturn, lines };
}

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createReceiptNote,
  verifyReceiptNote,
  listReceiptNotes,
  getReceiptNote,
  createPurchaseReturn,
  approvePurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturn
};
