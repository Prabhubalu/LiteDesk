/**
 * Payment lifecycle constants and rollup helpers.
 */

const PAYMENT_PURPOSES = ['invoice_payment', 'deposit', 'retainer', 'on_account'];

const PAYMENT_PURPOSE_DEFAULT = 'invoice_payment';

const PAYMENT_INSTRUMENT_METHODS = ['cash', 'check', 'bank_transfer', 'card', 'other'];

const PAYMENT_INSTRUMENT_METHOD_DEFAULT = 'other';

const PAYMENT_STATUSES = [
  'recorded',
  'partially_allocated',
  'fully_allocated',
  'partially_refunded',
  'fully_refunded',
  'reversed'
];

const PAYMENT_STATUS_DEFAULT = 'recorded';

const PAYMENT_ALLOCATION_STATUSES = ['active', 'reversed'];

const PAYMENT_ALLOCATION_STATUS_DEFAULT = 'active';

const PAYMENT_REVERSAL_TYPES = [
  'allocation_error',
  'nsf',
  'chargeback',
  'refund',
  'admin_void',
  'other'
];

const INVOICE_PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'written_off'];

const PAYABLE_INVOICE_STATUSES = ['Posted', 'Partially Paid'];

const MONEY_PRECISION = 2;

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** MONEY_PRECISION) / 10 ** MONEY_PRECISION;
}

function isPaymentPurpose(value) {
  return PAYMENT_PURPOSES.includes(String(value || '').trim());
}

function assertValidPaymentPurpose(value) {
  if (!isPaymentPurpose(value)) {
    const err = new Error('Invalid paymentPurpose');
    err.code = 'VALIDATION';
    err.details = { paymentPurpose: value };
    throw err;
  }
}

function defaultAutoApplyForPurpose(paymentPurpose) {
  return String(paymentPurpose || PAYMENT_PURPOSE_DEFAULT) === 'invoice_payment';
}

function derivePaymentStatus(payment) {
  const amount = roundMoney(payment?.amount);
  const allocated = roundMoney(payment?.amountAllocated);
  const refunded = roundMoney(payment?.amountRefunded);

  if (amount <= 0 && allocated <= 0) return 'reversed';
  if (refunded >= amount && amount > 0) return 'fully_refunded';
  if (refunded > 0) return 'partially_refunded';
  if (allocated <= 0) return 'recorded';
  if (allocated >= amount) return 'fully_allocated';
  return 'partially_allocated';
}

function deriveInvoicePaymentStatus(invoice) {
  const grandTotal = roundMoney(invoice?.grandTotal);
  const amountPaid = roundMoney(invoice?.amountPaid);
  const creditAppliedTotal = roundMoney(invoice?.creditAppliedTotal);
  const writeOffTotal = roundMoney(invoice?.writeOffTotal);
  const amountDue = roundMoney(invoice?.amountDue);

  if (writeOffTotal > 0 && amountDue <= 0) return 'written_off';
  if (amountDue <= 0 && (amountPaid > 0 || creditAppliedTotal > 0)) return 'paid';
  if (amountPaid <= 0 && creditAppliedTotal <= 0) return 'unpaid';
  if (amountPaid > 0 || creditAppliedTotal > 0) return 'partially_paid';
  return 'partially_paid';
}

function deriveInvoiceLifecycleStatusFromPayment(invoice) {
  const status = String(invoice?.status || '').trim();
  const amountDue = roundMoney(invoice?.amountDue);
  const amountPaid = roundMoney(invoice?.amountPaid);
  const creditAppliedTotal = roundMoney(invoice?.creditAppliedTotal);
  const writeOffTotal = roundMoney(invoice?.writeOffTotal);

  if (status === 'Void' || status === 'Written Off') return status;
  if (!['Posted', 'Partially Paid', 'Paid'].includes(status)) return status;

  if (writeOffTotal > 0 && amountDue <= 0 && amountPaid < roundMoney(invoice?.grandTotal)) {
    return 'Written Off';
  }
  if (amountDue <= 0 && (amountPaid > 0 || creditAppliedTotal > 0)) return 'Paid';
  if ((amountPaid > 0 || creditAppliedTotal > 0) && amountDue > 0) return 'Partially Paid';
  return status === 'Partially Paid' || status === 'Paid' ? 'Posted' : status;
}

module.exports = {
  PAYMENT_PURPOSES,
  PAYMENT_PURPOSE_DEFAULT,
  PAYMENT_INSTRUMENT_METHODS,
  PAYMENT_INSTRUMENT_METHOD_DEFAULT,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_DEFAULT,
  PAYMENT_ALLOCATION_STATUSES,
  PAYMENT_ALLOCATION_STATUS_DEFAULT,
  PAYMENT_REVERSAL_TYPES,
  INVOICE_PAYMENT_STATUSES,
  PAYABLE_INVOICE_STATUSES,
  MONEY_PRECISION,
  roundMoney,
  isPaymentPurpose,
  assertValidPaymentPurpose,
  defaultAutoApplyForPurpose,
  derivePaymentStatus,
  deriveInvoicePaymentStatus,
  deriveInvoiceLifecycleStatusFromPayment
};
