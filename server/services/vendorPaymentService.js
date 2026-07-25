/**
 * Vendor payment (AP) — record + allocate to purchase bills.
 */

const ModuleSequence = require('../models/ModuleSequence');
const { VendorPayment } = require('../models/VendorPayment');
const { VendorPaymentAllocation } = require('../models/VendorPaymentAllocation');
const { PurchaseBill } = require('../models/PurchaseBill');

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

async function recordVendorPayment({ organizationId, userId, payload }) {
  if (!payload?.vendorId) throw validationError('vendorId is required');
  const amount = Number(payload.amount);
  if (!(amount > 0)) throw validationError('amount must be greater than 0');
  if (!payload.paymentDate) throw validationError('paymentDate is required');

  const vendorPaymentNumber =
    payload.vendorPaymentNumber ||
    (await nextDocNumber(organizationId, 'vendor_payments', 'VP'));

  const payment = await VendorPayment.create({
    organizationId,
    vendorPaymentNumber,
    vendorId: payload.vendorId,
    amount,
    currency: payload.currency || 'INR',
    exchangeRateSnapshot: Number(payload.exchangeRateSnapshot) || 1,
    paymentDate: payload.paymentDate,
    valueDate: payload.valueDate || null,
    paymentInstrumentSnapshot: payload.paymentInstrumentSnapshot || {},
    amountAllocated: 0,
    amountUnallocated: amount,
    status: 'recorded',
    notes: payload.notes || null,
    externalReferenceId: payload.externalReferenceId || null,
    recordedAt: new Date(),
    recordedBy: userId,
    createdBy: userId,
    modifiedBy: userId
  });

  const allocations = Array.isArray(payload.allocations) ? payload.allocations : [];
  if (allocations.length) {
    return allocateVendorPayment({
      organizationId,
      userId,
      id: payment._id,
      allocations
    });
  }

  return getVendorPayment({ organizationId, id: payment._id });
}

async function allocateVendorPayment({ organizationId, userId, id, allocations }) {
  const payment = await VendorPayment.findOne({ _id: id, organizationId, deletedAt: null });
  if (!payment) throw validationError('Vendor payment not found', 'NOT_FOUND');
  if (['void', 'reversed'].includes(payment.status)) {
    throw validationError('Cannot allocate a void/reversed payment');
  }

  const rows = Array.isArray(allocations) ? allocations : [];
  if (!rows.length) throw validationError('allocations are required');

  let remaining = Number(payment.amountUnallocated);
  const created = [];

  for (const row of rows) {
    const amountApplied = Number(row.amountApplied);
    if (!(amountApplied > 0)) throw validationError('amountApplied must be greater than 0');
    if (amountApplied > remaining + 1e-9) {
      throw validationError('Allocation exceeds unallocated payment amount');
    }

    const billQuery = row.purchaseBillMongoId
      ? { _id: row.purchaseBillMongoId, organizationId, deletedAt: null }
      : { purchaseBillId: row.purchaseBillId, organizationId, deletedAt: null };
    const bill = await PurchaseBill.findOne(billQuery);
    if (!bill) throw validationError('Purchase bill not found', 'NOT_FOUND');
    if (bill.status !== 'posted') throw validationError('Can only allocate to posted purchase bills');
    if (String(bill.vendorId) !== String(payment.vendorId)) {
      throw validationError('Purchase bill vendor must match payment vendor');
    }
    const due = Number(bill.amountDue);
    if (amountApplied > due + 1e-9) {
      throw validationError('Allocation exceeds purchase bill amount due');
    }

    const alloc = await VendorPaymentAllocation.create({
      organizationId,
      vendorPaymentId: payment.vendorPaymentId,
      vendorPaymentMongoId: payment._id,
      purchaseBillId: bill.purchaseBillId,
      purchaseBillMongoId: bill._id,
      amountApplied,
      billCurrency: bill.currency,
      paymentCurrency: payment.currency,
      exchangeRateSnapshot: row.exchangeRateSnapshot || null,
      status: 'applied',
      appliedAt: new Date(),
      appliedBy: userId
    });

    bill.amountPaid = Number(bill.amountPaid) + amountApplied;
    bill.amountDue = Math.max(0, Number(bill.grandTotal) - Number(bill.amountPaid));
    bill.modifiedBy = userId;
    await bill.save();

    remaining -= amountApplied;
    created.push(alloc.toObject());
  }

  payment.amountAllocated = Number(payment.amount) - remaining;
  payment.amountUnallocated = Math.max(0, remaining);
  payment.status = payment.amountUnallocated <= 0 ? 'allocated' : 'recorded';
  payment.modifiedBy = userId;
  await payment.save();

  return getVendorPayment({ organizationId, id: payment._id });
}

async function listVendorPayments({ organizationId, vendorId = null, limit = 50 }) {
  const q = { organizationId, deletedAt: null };
  if (vendorId) q.vendorId = vendorId;
  return VendorPayment.find(q).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getVendorPayment({ organizationId, id }) {
  const vendorPayment = await VendorPayment.findOne({
    _id: id,
    organizationId,
    deletedAt: null
  }).lean();
  if (!vendorPayment) throw validationError('Vendor payment not found', 'NOT_FOUND');
  const allocations = await VendorPaymentAllocation.find({
    organizationId,
    vendorPaymentMongoId: id,
    status: 'applied'
  }).lean();
  return { vendorPayment, allocations };
}

module.exports = {
  recordVendorPayment,
  allocateVendorPayment,
  listVendorPayments,
  getVendorPayment
};
