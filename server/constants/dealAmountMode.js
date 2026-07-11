/**
 * Deal expected-value ownership.
 * AUTO  — DealPricingService writes Deal.amount from DealLine grand total.
 * MANUAL — user owns Deal.amount; lines do not overwrite it.
 */
const DEAL_AMOUNT_MODE = Object.freeze({
  AUTO: 'AUTO',
  MANUAL: 'MANUAL'
});

const DEAL_AMOUNT_MODE_VALUES = Object.freeze(Object.values(DEAL_AMOUNT_MODE));

const DEFAULT_DEAL_AMOUNT_MODE = DEAL_AMOUNT_MODE.MANUAL;

function normalizeDealAmountMode(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === DEAL_AMOUNT_MODE.AUTO) return DEAL_AMOUNT_MODE.AUTO;
  if (raw === DEAL_AMOUNT_MODE.MANUAL) return DEAL_AMOUNT_MODE.MANUAL;
  return null;
}

module.exports = {
  DEAL_AMOUNT_MODE,
  DEAL_AMOUNT_MODE_VALUES,
  DEFAULT_DEAL_AMOUNT_MODE,
  normalizeDealAmountMode
};
