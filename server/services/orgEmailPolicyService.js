'use strict';

const OrgEmailPolicy = require('../models/org-email-policy');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const {
  deriveBurstRatePerMin,
  getEmailPolicyDefaultsForPlan,
  resolveHighestPlanKey,
  MARKETING_MIN_SENDER_REPUTATION
} = require('../constants/emailPolicyDefaults');
const { isInternalOrganization } = require('../utils/internalOrganization');
const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { syncOrgPolicyToAmds } = require('./amds/amds-policy-sync');

/**
 * @typedef {Object} EmailPlanLimits
 * @property {number} emailCredits
 * @property {number} dailySendLimit
 * @property {number} maxHourlyRate
 * @property {number} maxCampaignSize
 */

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<string>}
 */
async function resolvePlanKeyForOrganization(organizationId) {
  if (await isInternalOrganization(organizationId)) {
    return 'ENTERPRISE';
  }

  const subscription = await OrganizationSubscription.findOne({ organizationId })
    .select('apps.planKey')
    .lean();

  if (subscription?.apps?.length) {
    return resolveHighestPlanKey(subscription.apps);
  }

  return 'TRIAL';
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} [planKeyOverride]
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function ensureOrgEmailPolicy(organizationId, planKeyOverride) {
  const existing = await OrgEmailPolicy.findOne({ organizationId });
  if (existing) return existing;

  const planKey = planKeyOverride || (await resolvePlanKeyForOrganization(organizationId));
  const limits = getEmailPolicyDefaultsForPlan(planKey);

  const doc = await OrgEmailPolicy.create({
    organizationId,
    status: 'active',
    monthlyCredits: limits.emailCredits,
    creditsRemaining: limits.emailCredits,
    dailySendLimit: limits.dailySendLimit,
    maxHourlyRate: limits.maxHourlyRate,
    burstRatePerMin: deriveBurstRatePerMin(limits.maxHourlyRate),
    maxCampaignSize: limits.maxCampaignSize
  });

  queuePolicySync(organizationId);
  return doc;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} planKey
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function applyPlanLimitsToOrgEmailPolicy(organizationId, planKey) {
  const limits = getEmailPolicyDefaultsForPlan(planKey);
  const doc = await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        monthlyCredits: limits.emailCredits,
        creditsRemaining: limits.emailCredits,
        dailySendLimit: limits.dailySendLimit,
        maxHourlyRate: limits.maxHourlyRate,
        burstRatePerMin: deriveBurstRatePerMin(limits.maxHourlyRate),
        maxCampaignSize: limits.maxCampaignSize,
        status: 'active'
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  queuePolicySync(organizationId);
  return doc;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<import('mongoose').LeanDocument|null>}
 */
async function getOrgEmailPolicy(organizationId) {
  let doc = await OrgEmailPolicy.findOne({ organizationId }).lean();
  if (!doc) {
    await ensureOrgEmailPolicy(organizationId);
    doc = await OrgEmailPolicy.findOne({ organizationId }).lean();
  }
  return doc;
}

/**
 * @param {import('mongoose').Document|Record<string, unknown>} doc
 */
function serializeOrgEmailPolicy(doc) {
  if (!doc) return null;
  return {
    monthlyCredits: doc.monthlyCredits ?? 0,
    creditsRemaining: doc.creditsRemaining ?? 0,
    creditsReserved: doc.creditsReserved ?? 0,
    dailySendLimit: doc.dailySendLimit ?? 0,
    maxHourlyRate: doc.maxHourlyRate ?? 0,
    maxCampaignSize: doc.maxCampaignSize ?? 0,
    status: doc.status ?? 'active',
    warmupEnabled: doc.warmupEnabled !== false,
    reputationEnabled: doc.reputationEnabled !== false,
    amdsSyncedAt: doc.amdsSyncedAt ?? null,
    amdsSyncError: doc.amdsSyncError ?? null,
    senderReputation: doc.senderReputation ?? null,
    reputationPreviousScore: doc.reputationPreviousScore ?? null,
    reputationDelta: doc.reputationDelta ?? null,
    reputationFactors: Array.isArray(doc.reputationFactors) ? doc.reputationFactors : [],
    reputationUpdatedAt: doc.reputationUpdatedAt ?? null,
    reputationRecoveryDayStartScore: doc.reputationRecoveryDayStartScore ?? null,
    reputationRemainingGainToday: doc.reputationRemainingGainToday ?? null,
    reputationGuidanceReasons: Array.isArray(doc.reputationGuidanceReasons)
      ? doc.reputationGuidanceReasons
      : [],
    reputationGuidanceRecommendations: Array.isArray(doc.reputationGuidanceRecommendations)
      ? doc.reputationGuidanceRecommendations
      : [],
    reputationGuidanceUpdatedAt: doc.reputationGuidanceUpdatedAt ?? null,
    effectiveHourlyRate: doc.effectiveHourlyRate ?? null,
    effectiveBurstRate: doc.effectiveBurstRate ?? null,
    warmupStage: doc.warmupStage ?? null,
    infraMultiplier: doc.infraMultiplier ?? null,
    throughputUpdatedAt: doc.throughputUpdatedAt ?? null
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<{ allowed: boolean, code?: string, error?: string }>}
 */
async function assertEmailSendingAllowed(organizationId) {
  const policy = await getOrgEmailPolicy(organizationId);
  if (policy?.status === 'suspended') {
    return {
      allowed: false,
      code: 'EMAIL_SENDING_SUSPENDED',
      error: 'Email sending is suspended for this organization'
    };
  }
  return { allowed: true };
}

/**
 * Poll AMDS for latest reputation and cache on OrgEmailPolicy.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function refreshOrgEmailReputation(organizationId) {
  if (!isAmdsEnvConfigured()) return null;

  const client = getAmdsClient();
  if (!client) return null;

  try {
    const reputation = await client.getTenantReputation(String(organizationId));
    await OrgEmailPolicy.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          senderReputation: reputation.score,
          reputationPreviousScore: reputation.previous_score ?? null,
          reputationDelta: reputation.delta ?? null,
          reputationFactors: Array.isArray(reputation.factors) ? reputation.factors : [],
          reputationRecoveryDayStartScore: reputation.recovery?.day_start_score ?? null,
          reputationRemainingGainToday: reputation.recovery?.remaining_gain_today ?? null,
          reputationUpdatedAt: reputation.updated_at ? new Date(reputation.updated_at) : new Date()
        }
      }
    );
    return reputation;
  } catch (err) {
    console.warn('[orgEmailPolicyService] reputation refresh failed:', err?.message || err);
    return null;
  }
}

/**
 * Poll AMDS for reputation guidance and cache on OrgEmailPolicy.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function refreshOrgEmailReputationGuidance(organizationId) {
  if (!isAmdsEnvConfigured()) return null;

  const client = getAmdsClient();
  if (!client) return null;

  try {
    const guidance = await client.getReputationGuidance(String(organizationId));
    await OrgEmailPolicy.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          reputationGuidanceReasons: Array.isArray(guidance.reasons) ? guidance.reasons : [],
          reputationGuidanceRecommendations: Array.isArray(guidance.recommendations)
            ? guidance.recommendations
            : [],
          reputationGuidanceUpdatedAt: guidance.updated_at
            ? new Date(guidance.updated_at)
            : new Date()
        }
      }
    );
    return guidance;
  } catch (err) {
    console.warn('[orgEmailPolicyService] reputation guidance refresh failed:', err?.message || err);
    return null;
  }
}

/**
 * Poll AMDS for latest throughput and cache on OrgEmailPolicy.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function refreshOrgEmailThroughput(organizationId) {
  if (!isAmdsEnvConfigured()) return null;

  const client = getAmdsClient();
  if (!client) return null;

  try {
    const throughput = await client.getTenantThroughput(String(organizationId));
    await OrgEmailPolicy.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          effectiveHourlyRate: throughput.effective_hourly_rate ?? null,
          effectiveBurstRate: throughput.effective_burst_rate ?? null,
          warmupStage: throughput.multipliers?.warmup_stage ?? null,
          infraMultiplier: throughput.multipliers?.infra ?? null,
          throughputUpdatedAt: throughput.updated_at ? new Date(throughput.updated_at) : new Date()
        }
      }
    );
    return throughput;
  } catch (err) {
    console.warn('[orgEmailPolicyService] throughput refresh failed:', err?.message || err);
    return null;
  }
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<{ allowed: boolean, code?: string, error?: string }>}
 */
async function assertMarketingSendAllowed(organizationId) {
  const policy = await getOrgEmailPolicy(organizationId);
  if (policy?.reputationEnabled === false) {
    return { allowed: true };
  }

  const score = policy?.senderReputation;
  if (score != null && score < MARKETING_MIN_SENDER_REPUTATION) {
    return {
      allowed: false,
      code: 'MARKETING_RESTRICTED',
      error: 'Sender reputation too low for marketing sends'
    };
  }

  return { allowed: true };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
function queuePolicySync(organizationId) {
  setImmediate(() => {
    syncOrgPolicyToAmds(organizationId).catch((err) => {
      console.warn('[orgEmailPolicyService] AMDS policy sync failed:', err?.message || err);
    });
  });
}

module.exports = {
  ensureOrgEmailPolicy,
  applyPlanLimitsToOrgEmailPolicy,
  getOrgEmailPolicy,
  resolvePlanKeyForOrganization,
  serializeOrgEmailPolicy,
  queuePolicySync,
  assertEmailSendingAllowed,
  assertMarketingSendAllowed,
  refreshOrgEmailReputation,
  refreshOrgEmailReputationGuidance,
  refreshOrgEmailThroughput,
  MARKETING_MIN_SENDER_REPUTATION
};
