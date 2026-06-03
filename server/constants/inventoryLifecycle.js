/**
 * INV0 — Inventory lifecycle constants and qty helpers.
 */

const INVENTORY_LOCATION_TYPES = ['warehouse', 'store', 'virtual', 'transit', 'quarantine'];

const INVENTORY_LOCATION_STATUSES = ['active', 'inactive'];

const INVENTORY_LOCATION_STATUS_DEFAULT = 'active';

const DEFAULT_MAIN_WAREHOUSE_CODE = 'MAIN';

const DEFAULT_MAIN_WAREHOUSE_NAME = 'Main Warehouse';

const INVENTORY_LEDGER_ENTRY_TYPES = [
  'receipt',
  'fulfillment_deduct',
  'fulfillment_restore',
  'adjustment_in',
  'adjustment_out',
  'transfer_out',
  'transfer_in',
  'count_variance',
  'opening_balance'
];

const INVENTORY_LEDGER_ENTRY_STATUSES = ['posted', 'reversed'];

const INVENTORY_LEDGER_STATUS_DEFAULT = 'posted';

/** INV2 — locked InventoryTransaction.transactionType values */
const INVENTORY_TRANSACTION_TYPES = [
  'opening_balance',
  'reservation',
  'reservation_release',
  'shipment',
  'return',
  'adjustment',
  'transfer',
  'count_variance'
];

/** Pre-INV2 types retained for read-compat on legacy rows */
const INVENTORY_TRANSACTION_TYPES_LEGACY = ['fulfillment_deduct', 'fulfillment_restore', 'count_post'];

const INVENTORY_TRANSACTION_TYPES_ALL = [
  ...INVENTORY_TRANSACTION_TYPES,
  ...INVENTORY_TRANSACTION_TYPES_LEGACY
];

const INVENTORY_TRANSFER_STATUSES = ['draft', 'in_transit', 'posted', 'cancelled'];

const INVENTORY_TRANSFER_STATUS_DEFAULT = 'draft';

const INVENTORY_COUNT_STATUSES = ['draft', 'counting', 'posted', 'cancelled'];

const INVENTORY_COUNT_STATUS_DEFAULT = 'draft';

const INVENTORY_TRANSACTION_STATUSES = ['posted', 'reversed', 'failed'];

const INVENTORY_TRANSACTION_STATUS_DEFAULT = 'posted';

const INVENTORY_ADJUSTMENT_STATUSES = ['draft', 'posted', 'void'];

const INVENTORY_ADJUSTMENT_STATUS_DEFAULT = 'draft';

const INVENTORY_ADJUSTMENT_REASONS = [
  'opening_balance',
  'damaged',
  'found',
  'shrinkage',
  'correction',
  'physical_count',
  'write_off',
  'reclass',
  'other'
];

const INVENTORY_SOURCE_CONTEXTS = [
  'adjustment',
  'opening_balance',
  'manual',
  'fulfillment',
  'transfer',
  'count',
  'purchase_receipt'
];

/** INV4 — lot/serial tracking modes */
const INVENTORY_TRACKING_MODES = ['none', 'lot', 'serial'];

const INVENTORY_TRACKING_MODE_DEFAULT = 'none';

const INVENTORY_LOT_STATUSES = ['active', 'depleted', 'quarantine'];

const INVENTORY_LOT_STATUS_DEFAULT = 'active';

const INVENTORY_SERIAL_STATUSES = ['available', 'reserved', 'consumed', 'scrapped'];

const INVENTORY_SERIAL_STATUS_DEFAULT = 'available';

/** INV4 — valuation methods (standard live; others hook-ready) */
const INVENTORY_VALUATION_METHODS = ['standard', 'average', 'fifo_layer'];

const INVENTORY_VALUATION_METHOD_DEFAULT = 'standard';

const INVENTORY_INCOMING_STUB_STATUSES = ['active', 'received', 'cancelled'];

const INVENTORY_INCOMING_STUB_STATUS_DEFAULT = 'active';

/** INV1 base ATP; INV4 optional extension adds incoming when org flag set */
function computeAtpExtended({ onHand = 0, reserved = 0, incoming = 0, includeIncoming = false }) {
  const base = computeAtp({ onHand, reserved });
  if (!includeIncoming) return base;
  return roundQty(base + roundQty(incoming));
}

const QTY_PRECISION = 4;

function roundQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** QTY_PRECISION) / 10 ** QTY_PRECISION;
}

function computeAvailable({ onHand = 0, reserved = 0, safetyStock = 0, incoming = 0 }) {
  return roundQty(
    roundQty(onHand) - roundQty(reserved) - roundQty(safetyStock) + roundQty(incoming)
  );
}

/** INV1 — locked ATP formula: onHand - reserved */
function computeAtp({ onHand = 0, reserved = 0 }) {
  return roundQty(roundQty(onHand) - roundQty(reserved));
}

const INVENTORY_RESERVATION_STATUSES = [
  'active',
  'partially_consumed',
  'consumed',
  'released',
  'cancelled'
];

const INVENTORY_RESERVATION_STATUS_DEFAULT = 'active';

const INVENTORY_RESERVATION_ACTIVE_STATUSES = ['active', 'partially_consumed'];

const INVENTORY_RESERVATION_SOURCE_CONTEXTS = ['so_confirm', 'manual_hold'];

const INVENTORY_FULFILLMENT_DEDUCT_TYPES = ['ship', 'deliver', 'complete'];

/** INV3 — ATP guard policies for line-add and quote accept */
const INVENTORY_ATP_GUARD_POLICIES = ['off', 'warn', 'block'];

const INVENTORY_ATP_GUARD_POLICY_DEFAULT = 'off';

const INVENTORY_ATP_LINE_ADD_POLICY_DEFAULT = 'off';

const INVENTORY_ATP_QUOTE_ACCEPT_POLICY_DEFAULT = 'off';

module.exports = {
  INVENTORY_LOCATION_TYPES,
  INVENTORY_LOCATION_STATUSES,
  INVENTORY_LOCATION_STATUS_DEFAULT,
  DEFAULT_MAIN_WAREHOUSE_CODE,
  DEFAULT_MAIN_WAREHOUSE_NAME,
  INVENTORY_LEDGER_ENTRY_TYPES,
  INVENTORY_LEDGER_ENTRY_STATUSES,
  INVENTORY_LEDGER_STATUS_DEFAULT,
  INVENTORY_TRANSACTION_TYPES,
  INVENTORY_TRANSACTION_TYPES_LEGACY,
  INVENTORY_TRANSACTION_TYPES_ALL,
  INVENTORY_TRANSFER_STATUSES,
  INVENTORY_TRANSFER_STATUS_DEFAULT,
  INVENTORY_COUNT_STATUSES,
  INVENTORY_COUNT_STATUS_DEFAULT,
  INVENTORY_TRANSACTION_STATUSES,
  INVENTORY_TRANSACTION_STATUS_DEFAULT,
  INVENTORY_ADJUSTMENT_STATUSES,
  INVENTORY_ADJUSTMENT_STATUS_DEFAULT,
  INVENTORY_ADJUSTMENT_REASONS,
  INVENTORY_SOURCE_CONTEXTS,
  QTY_PRECISION,
  roundQty,
  computeAvailable,
  computeAtp,
  computeAtpExtended,
  INVENTORY_TRACKING_MODES,
  INVENTORY_TRACKING_MODE_DEFAULT,
  INVENTORY_LOT_STATUSES,
  INVENTORY_LOT_STATUS_DEFAULT,
  INVENTORY_SERIAL_STATUSES,
  INVENTORY_SERIAL_STATUS_DEFAULT,
  INVENTORY_VALUATION_METHODS,
  INVENTORY_VALUATION_METHOD_DEFAULT,
  INVENTORY_INCOMING_STUB_STATUSES,
  INVENTORY_INCOMING_STUB_STATUS_DEFAULT,
  INVENTORY_RESERVATION_STATUSES,
  INVENTORY_RESERVATION_STATUS_DEFAULT,
  INVENTORY_RESERVATION_ACTIVE_STATUSES,
  INVENTORY_RESERVATION_SOURCE_CONTEXTS,
  INVENTORY_FULFILLMENT_DEDUCT_TYPES,
  INVENTORY_ATP_GUARD_POLICIES,
  INVENTORY_ATP_GUARD_POLICY_DEFAULT,
  INVENTORY_ATP_LINE_ADD_POLICY_DEFAULT,
  INVENTORY_ATP_QUOTE_ACCEPT_POLICY_DEFAULT
};
