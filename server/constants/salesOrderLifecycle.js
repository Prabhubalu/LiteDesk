/**
 * Sales Order lifecycle (operational execution — not quote lifecycle).
 */

const {
  SALES_ORDER_HEADER_FULFILLMENT_DEFAULT
} = require('./salesOrderFulfillment');

const SALES_ORDER_STATUSES = [
  'Draft',
  'Confirmed',
  'On Hold',
  'In Fulfillment',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled',
  'Closed'
];

const SALES_ORDER_STATUS_DEFAULT = 'Draft';

/** Status assigned when converting from an accepted quote (locked decision). */
const SALES_ORDER_STATUS_ON_QUOTE_CONVERT = 'Confirmed';

const SALES_ORDER_ALLOWED_TRANSITIONS = {
  Draft: ['Confirmed', 'Cancelled'],
  Confirmed: ['On Hold', 'In Fulfillment', 'Cancelled'],
  'On Hold': ['Confirmed', 'Cancelled'],
  'In Fulfillment': ['Partially Fulfilled', 'Fulfilled', 'On Hold', 'Cancelled'],
  'Partially Fulfilled': ['Fulfilled', 'In Fulfillment', 'Cancelled', 'Closed'],
  Fulfilled: ['Closed', 'Cancelled'],
  Cancelled: [],
  Closed: []
};

const SALES_ORDER_SOURCE_TYPES = ['manual', 'quote', 'split', 'merge', 'api'];

function isSalesOrderStatus(value) {
  return SALES_ORDER_STATUSES.includes(value);
}

function assertValidSalesOrderStatus(value) {
  if (!isSalesOrderStatus(value)) {
    const err = new Error('Invalid sales order status');
    err.code = 'VALIDATION';
    err.details = { status: value };
    throw err;
  }
}

function canTransitionSalesOrderStatus(fromStatus, toStatus) {
  if (!isSalesOrderStatus(fromStatus) || !isSalesOrderStatus(toStatus)) return false;
  const allowed = SALES_ORDER_ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function assertCanTransitionSalesOrderStatus(fromStatus, toStatus) {
  assertValidSalesOrderStatus(fromStatus);
  assertValidSalesOrderStatus(toStatus);
  if (!canTransitionSalesOrderStatus(fromStatus, toStatus)) {
    const err = new Error(`Invalid sales order status transition: ${fromStatus} -> ${toStatus}`);
    err.code = 'INVALID_TRANSITION';
    err.details = { fromStatus, toStatus };
    throw err;
  }
}

/** Commercial lock after Confirmed (mirrors quote Sent+ lock). */
function isSalesOrderCommerciallyLockedStatus(status) {
  return ['Confirmed', 'On Hold', 'In Fulfillment', 'Partially Fulfilled', 'Fulfilled', 'Closed'].includes(
    String(status || '').trim()
  );
}

const SALES_ORDER_RECORD_READ_ONLY_STATUSES = ['Cancelled', 'Closed'];

function isSalesOrderRecordReadOnly(status) {
  return SALES_ORDER_RECORD_READ_ONLY_STATUSES.includes(String(status || '').trim());
}

function assertSalesOrderRecordEditable(order) {
  const status = String(order?.status || '').trim();
  if (!isSalesOrderRecordReadOnly(status)) return;
  const err = new Error(`Sales orders in status "${status}" cannot be edited.`);
  err.code = 'SALES_ORDER_RECORD_LOCKED';
  err.details = { status };
  throw err;
}

module.exports = {
  SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_DEFAULT,
  SALES_ORDER_STATUS_ON_QUOTE_CONVERT,
  SALES_ORDER_ALLOWED_TRANSITIONS,
  SALES_ORDER_SOURCE_TYPES,
  SALES_ORDER_HEADER_FULFILLMENT_DEFAULT,
  isSalesOrderStatus,
  assertValidSalesOrderStatus,
  canTransitionSalesOrderStatus,
  assertCanTransitionSalesOrderStatus,
  isSalesOrderCommerciallyLockedStatus,
  isSalesOrderRecordReadOnly,
  assertSalesOrderRecordEditable
};
