/**
 * Default addon billing configuration (fallback when master DB has no override).
 *
 * billingType:
 * - PER_AGENT: seat-based agent licensing
 * - FLAT: flat org rate (agentLimit ignored for billing)
 * - PER_ORG: alias of FLAT
 * - USAGE: consumable packs (see creditPacks on email_credits)
 *
 * Master org may override via AddonPricingDefinition (see addonPricingService).
 */

const { DEFAULT_EMAIL_CREDIT_PACKS } = require('./emailCreditPackConstants');

module.exports = {
  live_chat: {
    billingType: 'PER_AGENT',
    defaultPlan: 'BASIC',
    trialDays: 14,
    plans: {
      BASIC: {
        agentLimit: 3,
        pricePerAgentCents: 2900,
        currency: 'USD',
      },
      PRO: {
        agentLimit: 25,
        pricePerAgentCents: 4900,
        currency: 'USD',
      },
      ENTERPRISE: {
        agentLimit: null,
        pricePerAgentCents: null,
        currency: 'USD',
      },
    },
  },
  email_credits: {
    billingType: 'USAGE',
    defaultPlan: 'BASIC',
    trialDays: 0,
    plans: {
      BASIC: { flatPriceCents: null, currency: 'USD' },
      PRO: { flatPriceCents: null, currency: 'USD' },
      ENTERPRISE: { flatPriceCents: null, currency: 'USD' },
    },
    creditPacks: DEFAULT_EMAIL_CREDIT_PACKS,
  },
  articles: {
    billingType: 'FLAT',
    defaultPlan: 'BASIC',
    trialDays: 7,
    plans: {
      BASIC: { flatPriceCents: null, currency: 'USD' },
      PRO: { flatPriceCents: null, currency: 'USD' },
      ENTERPRISE: { flatPriceCents: null, currency: 'USD' },
    },
  },
  blog: {
    billingType: 'FLAT',
    defaultPlan: 'BASIC',
    trialDays: 7,
    plans: {
      BASIC: { flatPriceCents: null, currency: 'USD' },
      PRO: { flatPriceCents: null, currency: 'USD' },
      ENTERPRISE: { flatPriceCents: null, currency: 'USD' },
    },
  },
  announcements: {
    billingType: 'FLAT',
    defaultPlan: 'BASIC',
    trialDays: 14,
    plans: {
      BASIC: { flatPriceCents: null, currency: 'USD' },
      PRO: { flatPriceCents: null, currency: 'USD' },
      ENTERPRISE: { flatPriceCents: null, currency: 'USD' },
    },
  },
};
