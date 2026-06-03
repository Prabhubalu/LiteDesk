/**
 * Sales Order fulfillment mode + status vocabulary.
 * Mode-aware — not hardcoded to product-only ship/backorder flows.
 */

const SALES_ORDER_FULFILLMENT_MODES = ['product', 'service', 'hybrid'];

const SALES_ORDER_FULFILLMENT_MODE_DEFAULT = 'hybrid';

const SALES_ORDER_LINE_FULFILLMENT_STATUSES = [
  'Open',
  'In Progress',
  'Backordered',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled'
];

const SALES_ORDER_LINE_FULFILLMENT_DEFAULT = 'Open';

const SALES_ORDER_HEADER_FULFILLMENT_STATUSES = [
  'Not Started',
  'In Progress',
  'Partially Fulfilled',
  'Fulfilled',
  'Cancelled'
];

const SALES_ORDER_HEADER_FULFILLMENT_DEFAULT = 'Not Started';

/** Fulfillment event types (SO1+). */
const SALES_ORDER_FULFILLMENT_EVENT_TYPES = [
  'ship',
  'deliver',
  'complete',
  'cancel',
  'backorder',
  'progress'
];

function assertValidFulfillmentMode(mode) {
  const m = String(mode || '').trim().toLowerCase();
  if (!m) return SALES_ORDER_FULFILLMENT_MODE_DEFAULT;
  if (!SALES_ORDER_FULFILLMENT_MODES.includes(m)) {
    const err = new Error(`Invalid fulfillment mode: ${mode}`);
    err.code = 'VALIDATION';
    throw err;
  }
  return m;
}

function isValidLineFulfillmentStatus(status) {
  return SALES_ORDER_LINE_FULFILLMENT_STATUSES.includes(String(status || '').trim());
}

function isValidHeaderFulfillmentStatus(status) {
  return SALES_ORDER_HEADER_FULFILLMENT_STATUSES.includes(String(status || '').trim());
}

/**
 * Derive line fulfillment status from qty fields (mode-agnostic qty math).
 */
function deriveLineFulfillmentStatus(line) {
  const qty = Number(line?.quantity) || 0;
  const fulfilled = Number(line?.quantityFulfilled) || 0;
  const cancelled = Number(line?.quantityCancelled) || 0;
  const backordered = Number(line?.quantityBackordered) || 0;

  if (qty <= 0) return 'Cancelled';
  if (cancelled >= qty) return 'Cancelled';
  if (fulfilled >= qty - cancelled) return 'Fulfilled';
  if (fulfilled > 0) return 'Partially Fulfilled';
  if (backordered > 0) return 'Backordered';
  if (String(line?.fulfillmentStatus || '') === 'In Progress') return 'In Progress';
  return 'Open';
}

/**
 * Roll up header fulfillment from line statuses.
 */
function deriveHeaderFulfillmentStatus(lines) {
  const statuses = (lines || []).map((l) => deriveLineFulfillmentStatus(l));
  if (!statuses.length) return SALES_ORDER_HEADER_FULFILLMENT_DEFAULT;
  if (statuses.every((s) => s === 'Cancelled')) return 'Cancelled';
  if (statuses.every((s) => s === 'Fulfilled' || s === 'Cancelled')) return 'Fulfilled';
  if (statuses.some((s) => s === 'Partially Fulfilled' || s === 'Fulfilled')) {
    return 'Partially Fulfilled';
  }
  if (statuses.some((s) => s === 'In Progress' || s === 'Backordered')) {
    return 'In Progress';
  }
  return 'Not Started';
}

module.exports = {
  SALES_ORDER_FULFILLMENT_MODES,
  SALES_ORDER_FULFILLMENT_MODE_DEFAULT,
  SALES_ORDER_LINE_FULFILLMENT_STATUSES,
  SALES_ORDER_LINE_FULFILLMENT_DEFAULT,
  SALES_ORDER_HEADER_FULFILLMENT_STATUSES,
  SALES_ORDER_HEADER_FULFILLMENT_DEFAULT,
  SALES_ORDER_FULFILLMENT_EVENT_TYPES,
  assertValidFulfillmentMode,
  isValidLineFulfillmentStatus,
  isValidHeaderFulfillmentStatus,
  deriveLineFulfillmentStatus,
  deriveHeaderFulfillmentStatus
};
