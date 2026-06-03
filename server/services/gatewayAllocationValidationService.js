/**
 * PAY3 — Re-validate invoice targets before gateway capture allocation.
 */

const Invoice = require('../models/Invoice');
const { roundMoney, PAYABLE_INVOICE_STATUSES } = require('../constants/paymentLifecycle');

const BLOCKED_INVOICE_STATUSES = ['Void', 'Written Off', 'Paid'];

async function loadInvoiceTarget({ organizationId, target }) {
  const invoice = await Invoice.findOne({
    organizationId,
    deletedAt: null,
    ...(target.invoiceMongoId
      ? { _id: target.invoiceMongoId }
      : { invoiceId: String(target.invoiceId || '').trim() })
  });

  return invoice;
}

function validateInvoiceForCapture(invoice, { organizationRefId, currency, amountRequested } = {}) {
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'INVOICE_NOT_FOUND';
    throw err;
  }

  if (String(invoice.invoiceType || 'standard') !== 'standard') {
    const err = new Error('Only standard invoices can receive gateway payments');
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  const status = String(invoice.status || '').trim();
  if (!PAYABLE_INVOICE_STATUSES.includes(status) || BLOCKED_INVOICE_STATUSES.includes(status)) {
    const err = new Error(`Invoice status "${invoice.status}" is not credit-applicable`);
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  if (
    organizationRefId &&
    String(invoice.organizationRefId || '') !== String(organizationRefId)
  ) {
    const err = new Error('Invoice account does not match session account');
    err.code = 'ACCOUNT_MISMATCH';
    throw err;
  }

  if (currency && invoice.currency && currency !== invoice.currency) {
    const err = new Error('Invoice currency does not match session currency');
    err.code = 'CURRENCY_MISMATCH';
    throw err;
  }

  const amountDue = roundMoney(invoice.amountDue);
  if (amountDue <= 0) {
    const err = new Error('Invoice has no amount due');
    err.code = 'NOTHING_TO_APPLY';
    throw err;
  }

  const requested = roundMoney(amountRequested);
  if (requested <= 0) {
    const err = new Error('Requested apply amount must be greater than zero');
    err.code = 'VALIDATION';
    throw err;
  }

  if (requested > amountDue) {
    const err = new Error('Requested amount exceeds invoice amount due');
    err.code = 'AMOUNT_EXCEEDS_DUE';
    throw err;
  }

  return invoice;
}

async function assertCaptureTargets(session) {
  if (!session) {
    const err = new Error('Session is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const targets = Array.isArray(session.invoiceTargets) ? session.invoiceTargets : [];
  if (targets.length === 0) {
    const err = new Error('Session has no invoice targets');
    err.code = 'VALIDATION';
    throw err;
  }

  const organizationId = session.organizationId;
  const organizationRefId = session.organizationRefId;
  const currency = session.currency;
  let totalRequested = 0;

  for (const target of targets) {
    const invoice = await loadInvoiceTarget({ organizationId, target });
    validateInvoiceForCapture(invoice, {
      organizationRefId,
      currency,
      amountRequested: target.amountRequested
    });
    totalRequested = roundMoney(totalRequested + roundMoney(target.amountRequested));
  }

  const sessionAmount = roundMoney(session.amount);
  if (totalRequested > sessionAmount) {
    const err = new Error('Total requested allocation exceeds session amount');
    err.code = 'AMOUNT_EXCEEDS_DUE';
    throw err;
  }

  return { totalRequested, targetCount: targets.length };
}

module.exports = {
  loadInvoiceTarget,
  validateInvoiceForCapture,
  assertCaptureTargets
};
