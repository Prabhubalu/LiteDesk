/**
 * Invoice lifecycle (billing / receivable — not SO fulfillment).
 */

const INVOICE_STATUSES = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Posted',
  'Partially Posted',
  'Partially Paid',
  'Paid',
  'Void',
  'Written Off'
];

/** Reserved lifecycle states — documented only; no transitions in INV0–INV2. */
const INVOICE_RESERVED_STATUSES = ['Partially Posted'];

const INVOICE_STATUS_DEFAULT = 'Draft';

const INVOICE_SOURCE_TYPES = ['sales_order', 'manual', 'credit_note', 'merge', 'api'];

const INVOICE_TYPES = ['standard', 'credit_note', 'debit_note', 'proforma'];

const INVOICE_TYPE_DEFAULT = 'standard';

const INVOICE_ALLOWED_TRANSITIONS = {
  Draft: ['Pending Approval', 'Approved', 'Posted', 'Void'],
  'Pending Approval': ['Draft', 'Approved', 'Void'],
  Approved: ['Draft', 'Posted', 'Void'],
  Posted: ['Void', 'Partially Paid', 'Written Off'],
  'Partially Posted': [],
  'Partially Paid': ['Paid', 'Written Off', 'Void'],
  Paid: ['Written Off'],
  Void: [],
  'Written Off': []
};

const INVOICE_COMMERCIALLY_LOCKED_STATUSES = [
  'Posted',
  'Partially Posted',
  'Partially Paid',
  'Paid',
  'Written Off'
];

const INVOICE_RECORD_READ_ONLY_STATUSES = ['Void', 'Written Off'];

function isInvoiceStatus(value) {
  return INVOICE_STATUSES.includes(value);
}

function isInvoiceReservedStatus(value) {
  return INVOICE_RESERVED_STATUSES.includes(String(value || '').trim());
}

function assertValidInvoiceStatus(value) {
  if (!isInvoiceStatus(value)) {
    const err = new Error('Invalid invoice status');
    err.code = 'VALIDATION';
    err.details = { status: value };
    throw err;
  }
}

function canTransitionInvoiceStatus(fromStatus, toStatus) {
  if (!isInvoiceStatus(fromStatus) || !isInvoiceStatus(toStatus)) return false;
  if (isInvoiceReservedStatus(fromStatus) || isInvoiceReservedStatus(toStatus)) return false;
  const allowed = INVOICE_ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function assertCanTransitionInvoiceStatus(fromStatus, toStatus) {
  assertValidInvoiceStatus(fromStatus);
  assertValidInvoiceStatus(toStatus);
  if (isInvoiceReservedStatus(fromStatus) || isInvoiceReservedStatus(toStatus)) {
    const err = new Error(`Invoice status "${toStatus}" is reserved and not implemented.`);
    err.code = 'INVOICE_STATUS_RESERVED';
    err.details = { fromStatus, toStatus };
    throw err;
  }
  if (!canTransitionInvoiceStatus(fromStatus, toStatus)) {
    const err = new Error(`Invalid invoice status transition: ${fromStatus} -> ${toStatus}`);
    err.code = 'INVALID_TRANSITION';
    err.details = { fromStatus, toStatus };
    throw err;
  }
}

function isInvoiceCommerciallyLockedStatus(status) {
  return INVOICE_COMMERCIALLY_LOCKED_STATUSES.includes(String(status || '').trim());
}

function assertInvoiceCommercialEditAllowed(invoice) {
  const status = String(invoice?.status || '').trim();
  if (!isInvoiceCommerciallyLockedStatus(status)) return;
  const err = new Error(
    `Posted invoices are commercially immutable (status: "${status}"). Use credit note, void, write-off, or payments.`
  );
  err.code = 'INVOICE_COMMERCIAL_LOCK';
  err.details = { status };
  throw err;
}

function isInvoiceRecordReadOnly(status) {
  return INVOICE_RECORD_READ_ONLY_STATUSES.includes(String(status || '').trim());
}

function assertInvoiceRecordEditable(invoice) {
  const status = String(invoice?.status || '').trim();
  if (!isInvoiceRecordReadOnly(status)) return;
  const err = new Error(`Invoices in status "${status}" cannot be edited.`);
  err.code = 'INVOICE_RECORD_LOCKED';
  err.details = { status };
  throw err;
}

module.exports = {
  INVOICE_STATUSES,
  INVOICE_RESERVED_STATUSES,
  INVOICE_STATUS_DEFAULT,
  INVOICE_SOURCE_TYPES,
  INVOICE_TYPES,
  INVOICE_TYPE_DEFAULT,
  INVOICE_ALLOWED_TRANSITIONS,
  INVOICE_COMMERCIALLY_LOCKED_STATUSES,
  INVOICE_RECORD_READ_ONLY_STATUSES,
  isInvoiceStatus,
  isInvoiceReservedStatus,
  assertValidInvoiceStatus,
  canTransitionInvoiceStatus,
  assertCanTransitionInvoiceStatus,
  isInvoiceCommerciallyLockedStatus,
  assertInvoiceCommercialEditAllowed,
  isInvoiceRecordReadOnly,
  assertInvoiceRecordEditable
};
