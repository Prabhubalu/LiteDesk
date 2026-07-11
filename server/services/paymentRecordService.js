/**
 * PAY0 — Record inbound payment with optional auto/manual apply.
 */

const { resolveCurrencyOrOrgDefault } = require('../utils/orgCurrency');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const {
  roundMoney,
  assertValidPaymentPurpose,
  defaultAutoApplyForPurpose,
  PAYMENT_INSTRUMENT_METHODS
} = require('../constants/paymentLifecycle');
const { buildAutoApplyPlan } = require('./paymentAllocationPolicyService');
const { applyPaymentAllocations } = require('./paymentAllocationService');
const { writePaymentActivity } = require('./paymentActivityService');

function normalizeInstrumentSnapshot(input = {}) {
  const method = PAYMENT_INSTRUMENT_METHODS.includes(String(input.method || '').trim())
    ? String(input.method).trim()
    : 'other';

  return {
    method,
    referenceNumber: input.referenceNumber ? String(input.referenceNumber).trim() : null,
    bankName: input.bankName ? String(input.bankName).trim() : null,
    maskedAccount: input.maskedAccount ? String(input.maskedAccount).trim() : null,
    provider: input.provider ? String(input.provider).trim() : 'manual'
  };
}

async function findOpenInvoicesForAccount({ organizationId, organizationRefId, paymentCurrency }) {
  return Invoice.find({
    organizationId,
    organizationRefId,
    deletedAt: null,
    invoiceType: 'standard',
    status: { $in: ['Posted', 'Partially Paid'] },
    amountDue: { $gt: 0 },
    ...(paymentCurrency ? { currency: paymentCurrency } : {})
  })
    .select(
      'invoiceId invoiceNumber invoiceDate dueDate currency amountDue grandTotal organizationRefId status'
    )
    .lean();
}

async function recordPayment({
  organizationId,
  userId,
  organizationRefId,
  contactId = null,
  amount,
  paymentCurrency = null,
  paymentDate,
  valueDate = null,
  paymentPurpose = 'invoice_payment',
  paymentInstrumentSnapshot = {},
  externalReference = null,
  notes = null,
  sourceContext = 'manual',
  sourceRef = null,
  autoApply = null,
  allocations = null
}) {
  if (!organizationId || !organizationRefId) {
    const err = new Error('organizationId and organizationRefId are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const paymentAmount = roundMoney(amount);
  if (paymentAmount <= 0) {
    const err = new Error('amount must be greater than zero');
    err.code = 'VALIDATION';
    throw err;
  }

  assertValidPaymentPurpose(paymentPurpose);

  const shouldAutoApply =
    allocations && allocations.length > 0
      ? false
      : autoApply !== null
        ? Boolean(autoApply)
        : defaultAutoApplyForPurpose(paymentPurpose);

  const now = new Date();
  const resolvedPaymentCurrency = await resolveCurrencyOrOrgDefault(paymentCurrency, organizationId);
  const payment = await Payment.create({
    organizationId,
    organizationRefId,
    contactId: contactId || null,
    amount: paymentAmount,
    paymentCurrency: resolvedPaymentCurrency,
    paymentDate: paymentDate ? new Date(paymentDate) : now,
    valueDate: valueDate ? new Date(valueDate) : null,
    paymentPurpose,
    paymentInstrumentSnapshot: normalizeInstrumentSnapshot(paymentInstrumentSnapshot),
    externalReference: externalReference ? String(externalReference).trim() : null,
    amountAllocated: 0,
    amountUnallocated: paymentAmount,
    amountRefunded: 0,
    status: 'recorded',
    recordedAt: now,
    recordedBy: userId || null,
    sourceContext: sourceContext || 'manual',
    sourceRef: sourceRef || null,
    notes: notes ? String(notes).trim() : null,
    createdBy: userId || null,
    modifiedBy: userId || null
  });

  await writePaymentActivity({
    organizationId,
    paymentId: payment.paymentId,
    userId,
    action: 'payment_recorded',
    message: `Payment ${payment.paymentNumber} recorded`,
    details: {
      paymentNumber: payment.paymentNumber,
      amount: paymentAmount,
      paymentCurrency: payment.paymentCurrency,
      paymentPurpose,
      paymentInstrumentSnapshot: payment.paymentInstrumentSnapshot
    }
  });

  let applyResult = null;
  let applyPlan = [];

  if (allocations && allocations.length > 0) {
    applyPlan = allocations.map((row) => ({
      invoiceId: row.invoiceId,
      invoiceMongoId: row.invoiceMongoId,
      amountApplied: roundMoney(row.amountApplied)
    }));
  } else if (shouldAutoApply) {
    const openInvoices = await findOpenInvoicesForAccount({
      organizationId,
      organizationRefId,
      paymentCurrency: payment.paymentCurrency
    });
    applyPlan = buildAutoApplyPlan({
      paymentAmount,
      invoices: openInvoices,
      paymentCurrency: payment.paymentCurrency
    });
  }

  if (applyPlan.length > 0) {
    applyResult = await applyPaymentAllocations({
      organizationId,
      paymentMongoId: payment._id,
      userId,
      allocations: applyPlan,
      manualOverride: Boolean(allocations && allocations.length > 0)
    });
  }

  const finalPayment = applyResult?.payment || (await Payment.findById(payment._id).lean());

  try {
    const { tryMatchBankTransferInstruction } = require('./bankTransferInstructionService');
    await tryMatchBankTransferInstruction({
      organizationId,
      payment: finalPayment,
      userId
    });
  } catch (matchErr) {
    if (matchErr.code === 'BANK_TRANSFER_AMOUNT_MISMATCH') throw matchErr;
  }

  return {
    payment: finalPayment,
    allocations: applyResult?.allocations || [],
    autoApplied: shouldAutoApply && !(allocations && allocations.length > 0)
  };
}

module.exports = {
  normalizeInstrumentSnapshot,
  findOpenInvoicesForAccount,
  recordPayment
};
