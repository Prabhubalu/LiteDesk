/**
 * Default addon billing configuration (fallback when master DB has no override).
 *
 * billingType:
 * - PER_AGENT: seat-based agent licensing
 * - FLAT: flat org rate (agentLimit ignored for billing)
 * - PER_ORG: alias of FLAT
 *
 * Master org may override via AddonPricingDefinition (see addonPricingService).
 */

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
};
