/**
 * CPQ Pricing engine — vocabulary and policy.
 *
 * Calculation order (locked):
 *   1. Base unit price (CatalogPriceBook entry or variant fallback)
 *   2. Pricing rules (priority ASC; CONTRACT fixed_price replaces running unit)
 *   3. Promotions (priority ASC; all eligible apply — stackable by default)
 *   4. Taxes & charges (handled by commercial tax layer — not this engine)
 *
 * Multiple promotions: all eligible promotions apply in priority order.
 * Order-level promotions require context.orderSubtotal.
 */

const PRICING_CUSTOMER_TYPES = Object.freeze([
  'RETAIL',
  'DEALER',
  'DISTRIBUTOR',
  'CORPORATE',
]);

const PRICING_RULE_TYPES = Object.freeze([
  'QUANTITY',
  'CUSTOMER',
  'REGION',
  'DATE',
  'CONTRACT',
  'CHANNEL',
]);

const PRICING_PROMO_TYPES = Object.freeze([
  'PRODUCT_DISCOUNT',
  'ORDER_DISCOUNT',
  'BUY_X_GET_Y',
  'VOLUME_DISCOUNT',
  'CUSTOMER_DISCOUNT',
  'SHIPPING_DISCOUNT',
  'FESTIVAL',
]);

const PRICING_ADJUSTMENT_TYPES = Object.freeze(['percent', 'amount', 'fixed_price']);

const PRICING_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE']);

function isPricingCustomerType(value) {
  return PRICING_CUSTOMER_TYPES.includes(String(value || '').toUpperCase());
}

function normalizeCustomerType(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toUpperCase();
  return isPricingCustomerType(v) ? v : null;
}

function isPricingRuleType(value) {
  return PRICING_RULE_TYPES.includes(String(value || '').toUpperCase());
}

function isPricingPromoType(value) {
  return PRICING_PROMO_TYPES.includes(String(value || '').toUpperCase());
}

function isPricingAdjustmentType(value) {
  return PRICING_ADJUSTMENT_TYPES.includes(String(value || '').toLowerCase());
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

module.exports = {
  PRICING_CUSTOMER_TYPES,
  PRICING_RULE_TYPES,
  PRICING_PROMO_TYPES,
  PRICING_ADJUSTMENT_TYPES,
  PRICING_STATUSES,
  isPricingCustomerType,
  normalizeCustomerType,
  isPricingRuleType,
  isPricingPromoType,
  isPricingAdjustmentType,
  roundMoney,
};
