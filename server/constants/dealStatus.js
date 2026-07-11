/**
 * Platform-owned Deal Status (execution state).
 *
 * Status is derived from Stage (tenant-configurable pipeline position).
 * It is not a business/workflow field — tenants configure Stage; the platform
 * owns Status for reporting, forecasting, automations, and open-pipeline logic.
 *
 * Canonical values: Open | Won | Lost.
 * Business nuance for losses belongs on lostReason (not additional Status values).
 *
 * Direct API/UI writes are blocked. Only stage-driven derivation, migrations,
 * and internal maintenance scripts may set Status.
 */

const DEAL_STATUS = Object.freeze({
  OPEN: 'Open',
  WON: 'Won',
  LOST: 'Lost',
});

const DEAL_STATUS_VALUES = Object.freeze([
  DEAL_STATUS.OPEN,
  DEAL_STATUS.WON,
  DEAL_STATUS.LOST,
]);

const DEAL_STATUS_SET = new Set(
  DEAL_STATUS_VALUES.map((v) => v.toLowerCase())
);

/** Legacy Status values collapsed into the canonical set. */
const LEGACY_DEAL_STATUS_MAP = Object.freeze({
  open: DEAL_STATUS.OPEN,
  active: DEAL_STATUS.OPEN,
  stalled: DEAL_STATUS.OPEN,
  won: DEAL_STATUS.WON,
  lost: DEAL_STATUS.LOST,
  abandoned: DEAL_STATUS.LOST,
  'closed won': DEAL_STATUS.WON,
  'closed lost': DEAL_STATUS.LOST,
});

/**
 * Normalize any deal status / derivedStatus / stage-outcome label to Open|Won|Lost.
 * Unknown values default to Open (still in pipeline).
 *
 * @param {unknown} value
 * @returns {'Open'|'Won'|'Lost'}
 */
function normalizeDealStatus(value) {
  if (value == null || value === '') return DEAL_STATUS.OPEN;
  const key = String(value).trim().toLowerCase();
  if (LEGACY_DEAL_STATUS_MAP[key]) return LEGACY_DEAL_STATUS_MAP[key];
  if (DEAL_STATUS_SET.has(key)) {
    return DEAL_STATUS_VALUES.find((v) => v.toLowerCase() === key) || DEAL_STATUS.OPEN;
  }
  return DEAL_STATUS.OPEN;
}

/**
 * Whether a status counts as open pipeline (not won/lost).
 * @param {unknown} value
 * @returns {boolean}
 */
function isOpenDealStatus(value) {
  return normalizeDealStatus(value) === DEAL_STATUS.OPEN;
}

/**
 * Whether migrating this legacy value should seed lostReason when empty.
 * @param {unknown} value
 * @returns {boolean}
 */
function isLegacyAbandonedStatus(value) {
  return String(value || '').trim().toLowerCase() === 'abandoned';
}

module.exports = {
  DEAL_STATUS,
  DEAL_STATUS_VALUES,
  LEGACY_DEAL_STATUS_MAP,
  normalizeDealStatus,
  isOpenDealStatus,
  isLegacyAbandonedStatus,
};
