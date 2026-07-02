'use strict';

/**
 * Per-plan email entitlements (LiteDesk source of truth for AMDS policy sync).
 * @see docs/LITEDESK-TRACK-6-PHASE1-DRAFT.md
 */

/** Minimum sender reputation (0–100) required for marketing campaign sends. */
const MARKETING_MIN_SENDER_REPUTATION = 40;

/**
 * Burst is derived from max hourly rate at AMDS sync — not a separate plan entitlement.
 * @param {number} maxHourlyRate
 * @returns {number}
 */
function deriveBurstRatePerMin(maxHourlyRate) {
  const hourly = Math.max(0, Number(maxHourlyRate) || 0);
  if (hourly <= 0) return 1;
  return Math.max(1, Math.ceil(hourly / 60));
}

/** @type {Record<string, import('../services/orgEmailPolicyService').EmailPlanLimits>} */
const EMAIL_POLICY_BY_PLAN = {
  BASIC: {
    emailCredits: 5_000,
    dailySendLimit: 1_000,
    maxHourlyRate: 500,
    maxCampaignSize: 5_000
  },
  PRO: {
    emailCredits: 50_000,
    dailySendLimit: 10_000,
    maxHourlyRate: 2_000,
    maxCampaignSize: 25_000
  },
  ENTERPRISE: {
    emailCredits: 500_000,
    dailySendLimit: 100_000,
    maxHourlyRate: 10_000,
    maxCampaignSize: 500_000
  },
  TRIAL: {
    emailCredits: 5_000,
    dailySendLimit: 1_000,
    maxHourlyRate: 500,
    maxCampaignSize: 5_000
  }
};

const PLAN_RANK = { BASIC: 1, PRO: 2, ENTERPRISE: 3, TRIAL: 0 };

/**
 * @param {string} [planKey]
 * @returns {import('../services/orgEmailPolicyService').EmailPlanLimits}
 */
function getEmailPolicyDefaultsForPlan(planKey) {
  const normalized = String(planKey || 'BASIC').trim().toUpperCase();
  return { ...(EMAIL_POLICY_BY_PLAN[normalized] || EMAIL_POLICY_BY_PLAN.BASIC) };
}

/**
 * Pick the highest-tier plan from subscription app entries.
 * @param {{ planKey?: string }[]} [apps]
 * @returns {string}
 */
function resolveHighestPlanKey(apps = []) {
  let best = 'BASIC';
  let bestRank = PLAN_RANK.BASIC;

  for (const app of apps) {
    const key = String(app?.planKey || '').trim().toUpperCase();
    const rank = PLAN_RANK[key];
    if (typeof rank === 'number' && rank > bestRank) {
      bestRank = rank;
      best = key;
    }
  }

  return best;
}

module.exports = {
  EMAIL_POLICY_BY_PLAN,
  MARKETING_MIN_SENDER_REPUTATION,
  deriveBurstRatePerMin,
  getEmailPolicyDefaultsForPlan,
  resolveHighestPlanKey
};
