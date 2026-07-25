/**
 * Commercial tax engine constants (shared across Sales + Inventory docs).
 * FIXED_AMOUNT is schema-reserved; MVP calc supports PERCENTAGE only.
 */

const TAX_TYPES = Object.freeze({
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT'
});

const TAX_TYPE_VALUES = Object.freeze(Object.values(TAX_TYPES));

const TAX_SCOPES = Object.freeze({
  ITEM: 'ITEM',
  TRANSACTION: 'TRANSACTION',
  BOTH: 'BOTH'
});

const TAX_SCOPE_VALUES = Object.freeze(Object.values(TAX_SCOPES));

const TAX_APPLICABLE_ON = Object.freeze({
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  BOTH: 'BOTH'
});

const TAX_APPLICABLE_ON_VALUES = Object.freeze(Object.values(TAX_APPLICABLE_ON));

const TAX_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

const TAX_STATUS_VALUES = Object.freeze(Object.values(TAX_STATUSES));

const TAX_REGION_LEVELS = Object.freeze({
  COUNTRY: 'COUNTRY',
  STATE: 'STATE',
  REGION: 'REGION'
});

const TAX_REGION_LEVEL_VALUES = Object.freeze(Object.values(TAX_REGION_LEVELS));

/** MVP document calc order (charges hook between subtotal and txn taxes). */
const TAX_CALC_STEPS = Object.freeze([
  'LINE_TOTAL',
  'ITEM_LEVEL_TAXES',
  'DOCUMENT_SUBTOTAL',
  'ADDITIONAL_CHARGES',
  'TRANSACTION_LEVEL_TAXES',
  'GRAND_TOTAL'
]);

function isItemScope(scope) {
  return scope === TAX_SCOPES.ITEM || scope === TAX_SCOPES.BOTH;
}

function isTransactionScope(scope) {
  return scope === TAX_SCOPES.TRANSACTION || scope === TAX_SCOPES.BOTH;
}

function matchesApplicableOn(applicableOn, side) {
  if (!side) return true;
  const normalized = String(side).toUpperCase();
  if (applicableOn === TAX_APPLICABLE_ON.BOTH) return true;
  return applicableOn === normalized;
}

module.exports = {
  TAX_TYPES,
  TAX_TYPE_VALUES,
  TAX_SCOPES,
  TAX_SCOPE_VALUES,
  TAX_APPLICABLE_ON,
  TAX_APPLICABLE_ON_VALUES,
  TAX_STATUSES,
  TAX_STATUS_VALUES,
  TAX_REGION_LEVELS,
  TAX_REGION_LEVEL_VALUES,
  TAX_CALC_STEPS,
  isItemScope,
  isTransactionScope,
  matchesApplicableOn
};
