/**
 * Default purchasable AI credit packs (addon: ai_credits).
 * 1 credit ≈ 1k tokens (see aiCreditService.estimateCreditsFromUsage).
 */

const DEFAULT_AI_CREDIT_PACKS = [
  {
    packKey: 'ai_credits_1k',
    name: '1,000 AI credits',
    credits: 1000,
    priceCents: 1000,
    currency: 'USD',
  },
  {
    packKey: 'ai_credits_5k',
    name: '5,000 AI credits',
    credits: 5000,
    priceCents: 4500,
    currency: 'USD',
  },
  {
    packKey: 'ai_credits_25k',
    name: '25,000 AI credits',
    credits: 25000,
    priceCents: 20000,
    currency: 'USD',
  },
];

module.exports = {
  DEFAULT_AI_CREDIT_PACKS,
};
