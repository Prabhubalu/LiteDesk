/**
 * DealLine commercial intent types.
 * Product lines may reference catalog (itemId/variantId); others are free-form.
 */
const DEAL_LINE_TYPES = Object.freeze([
  'product',
  'service',
  'fee',
  'bundle',
  'misc'
]);

const DEFAULT_DEAL_LINE_TYPE = 'product';

function normalizeDealLineType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (DEAL_LINE_TYPES.includes(raw)) return raw;
  return null;
}

module.exports = {
  DEAL_LINE_TYPES,
  DEFAULT_DEAL_LINE_TYPE,
  normalizeDealLineType
};
