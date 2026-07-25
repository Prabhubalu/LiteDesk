/**
 * Purchase bill (AP) — draft create, post, list, get.
 */

const ModuleSequence = require('../models/ModuleSequence');
const { PurchaseBill, PurchaseBillLine } = require('../models/PurchaseBill');

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

function lineMoney(line) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  let gross = qty * price;
  let discount = Number(line.discountAmount) || 0;
  const t = String(line.discountType || '').toLowerCase();
  const dv = Number(line.discountValue) || 0;
  if (!discount) {
    if (t === 'percent' || t === 'percentage') discount = Math.min((gross * dv) / 100, gross);
    else if (t === 'amount' || t === 'fixed') discount = Math.min(dv, gross);
  }
  const lineSubtotal = Math.max(0, gross - discount);
  const lineTaxTotal = Number(line.lineTaxTotal) || 0;
  return {
    discountAmount: discount,
    lineSubtotal,
    lineTaxTotal,
    lineTotal: lineSubtotal + lineTaxTotal
  };
}

async function createDraft({ organizationId, userId, payload }) {
  if (!payload?.vendorId) throw validationError('vendorId is required');
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!inputLines.length) throw validationError('At least one line is required');

  const purchaseBillNumber =
    payload.purchaseBillNumber ||
    (await nextDocNumber(organizationId, 'purchase_bills', 'PB'));

  let subtotal = 0;
  let taxTotal = 0;
  const preparedLines = inputLines.map((line, idx) => {
    const money = lineMoney(line);
    subtotal += money.lineSubtotal;
    taxTotal += money.lineTaxTotal;
    return {
      organizationId,
      purchaseOrderLineId: line.purchaseOrderLineId || null,
      receiptNoteLineId: line.receiptNoteLineId || null,
      variantId: line.variantId || null,
      skuSnapshot: line.skuSnapshot || null,
      itemNameSnapshot: line.itemNameSnapshot || null,
      description: line.description || null,
      quantity: Number(line.quantity) || 0,
      unitOfMeasure: line.unitOfMeasure || null,
      unitPrice: Number(line.unitPrice) || 0,
      discountType: line.discountType || null,
      discountValue: Number(line.discountValue) || 0,
      discountAmount: money.discountAmount,
      taxSnapshot: line.taxSnapshot || {},
      chargeSnapshot: line.chargeSnapshot || {},
      lineSubtotal: money.lineSubtotal,
      lineTaxTotal: money.lineTaxTotal,
      lineTotal: money.lineTotal,
      lineOrder: line.lineOrder != null ? Number(line.lineOrder) : idx,
      remarks: line.remarks || null
    };
  });

  const chargesTotal = Number(payload.chargesTotal) || 0;
  const discountTotal = Number(payload.discountTotal) || 0;
  const adjustmentTotal = Number(payload.adjustmentTotal) || 0;
  const grandTotal = Math.max(
    0,
    subtotal + taxTotal + chargesTotal - discountTotal + adjustmentTotal
  );

  const bill = await PurchaseBill.create({
    organizationId,
    purchaseBillNumber,
    billDate: payload.billDate || new Date(),
    dueDate: payload.dueDate || null,
    vendorId: payload.vendorId,
    purchaseOrderId: payload.purchaseOrderId || null,
    receiptNoteId: payload.receiptNoteId || null,
    status: 'draft',
    currency: payload.currency || 'INR',
    exchangeRateSnapshot: Number(payload.exchangeRateSnapshot) || 1,
    placeOfSupply: payload.placeOfSupply || null,
    partyGstin: payload.partyGstin || null,
    taxDocumentSnapshot: payload.taxDocumentSnapshot || {},
    transactionTaxSnapshot: payload.transactionTaxSnapshot || { taxes: [] },
    chargeDocumentSnapshot: payload.chargeDocumentSnapshot || { charges: [] },
    subtotal,
    taxTotal,
    chargesTotal,
    discountTotal,
    adjustmentTotal,
    grandTotal,
    amountPaid: 0,
    amountDue: grandTotal,
    notes: payload.notes || null,
    externalReferenceId: payload.externalReferenceId || null,
    createdBy: userId,
    modifiedBy: userId
  });

  const lineDocs = preparedLines.map((l) => ({ ...l, purchaseBillId: bill._id }));
  await PurchaseBillLine.insertMany(lineDocs);
  return getPurchaseBill({ organizationId, id: bill._id });
}

async function postPurchaseBill({ organizationId, id, userId }) {
  const bill = await PurchaseBill.findOne({ _id: id, organizationId, deletedAt: null });
  if (!bill) throw validationError('Purchase bill not found', 'NOT_FOUND');
  if (!['draft', 'pending_approval'].includes(bill.status)) {
    throw validationError('Only draft or pending_approval bills can be posted');
  }
  bill.status = 'posted';
  bill.postedAt = new Date();
  bill.modifiedBy = userId;
  await bill.save();
  return getPurchaseBill({ organizationId, id });
}

async function listPurchaseBills({ organizationId, vendorId = null, status = null, limit = 50 }) {
  const q = { organizationId, deletedAt: null };
  if (vendorId) q.vendorId = vendorId;
  if (status) q.status = status;
  return PurchaseBill.find(q).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getPurchaseBill({ organizationId, id }) {
  const purchaseBill = await PurchaseBill.findOne({
    _id: id,
    organizationId,
    deletedAt: null
  }).lean();
  if (!purchaseBill) throw validationError('Purchase bill not found', 'NOT_FOUND');
  const lines = await PurchaseBillLine.find({ organizationId, purchaseBillId: id }).lean();
  return { purchaseBill, lines };
}

module.exports = {
  createDraft,
  postPurchaseBill,
  listPurchaseBills,
  getPurchaseBill
};
