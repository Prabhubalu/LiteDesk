/**
 * Commercial charge engine constants (shared across Sales + Inventory docs).
 */

const CHARGE_TYPES = Object.freeze({
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  PERCENTAGE: 'PERCENTAGE'
});

const CHARGE_TYPE_VALUES = Object.freeze(Object.values(CHARGE_TYPES));

const CHARGE_SCOPES = Object.freeze({
  ITEM: 'ITEM',
  TRANSACTION: 'TRANSACTION',
  BOTH: 'BOTH'
});

const CHARGE_SCOPE_VALUES = Object.freeze(Object.values(CHARGE_SCOPES));

const CHARGE_APPLICABLE_ON = Object.freeze({
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  BOTH: 'BOTH'
});

const CHARGE_APPLICABLE_ON_VALUES = Object.freeze(Object.values(CHARGE_APPLICABLE_ON));

const CHARGE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

const CHARGE_STATUS_VALUES = Object.freeze(Object.values(CHARGE_STATUSES));

const CHARGE_CALC_STEPS = Object.freeze([
  'LINE_TOTAL',
  'ITEM_LEVEL_CHARGES',
  'DOCUMENT_SUBTOTAL',
  'TRANSACTION_LEVEL_CHARGES',
  'HAND_OFF_TO_TAX_ENGINE'
]);

function isItemScope(scope) {
  return scope === CHARGE_SCOPES.ITEM || scope === CHARGE_SCOPES.BOTH;
}

function isTransactionScope(scope) {
  return scope === CHARGE_SCOPES.TRANSACTION || scope === CHARGE_SCOPES.BOTH;
}

module.exports = {
  CHARGE_TYPES,
  CHARGE_TYPE_VALUES,
  CHARGE_SCOPES,
  CHARGE_SCOPE_VALUES,
  CHARGE_APPLICABLE_ON,
  CHARGE_APPLICABLE_ON_VALUES,
  CHARGE_STATUSES,
  CHARGE_STATUS_VALUES,
  CHARGE_CALC_STEPS,
  isItemScope,
  isTransactionScope
};
