'use strict';

const {
  computeCampaignSubmitPacing,
  computeBurstPacedSendEstimateSeconds,
  resolveEffectiveBurstRate
} = require('./campaignSubmitPacing');
const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');
const {
  getOrgEmailPolicy,
  MARKETING_MIN_SENDER_REPUTATION
} = require('../orgEmailPolicyService');

/**
 * Warm-up / throttled deliverable volume for the current UTC day.
 * Uses AMDS effective rates: hourly ceiling, plan daily scaled by throttle, and burst pacing.
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null} policy
 * @returns {number|null}
 */
function computeWarmupDeliverableDaily(policy) {
  if (!policy) return null;

  const warmupEnabled = policy.warmupEnabled !== false;
  const effectiveHourlyRate = Number(policy.effectiveHourlyRate);
  const maxHourlyRate = Math.max(0, Number(policy.maxHourlyRate) || 0);
  const dailySendLimit = Math.max(0, Number(policy.dailySendLimit) || 0);
  const effectiveBurstRate = Number(policy.effectiveBurstRate);

  const hasThroughputThrottle =
    Number.isFinite(effectiveHourlyRate) &&
    effectiveHourlyRate > 0 &&
    (warmupEnabled || (maxHourlyRate > 0 && effectiveHourlyRate < maxHourlyRate * 0.95));

  if (!hasThroughputThrottle) return null;

  let deliverable = Math.floor(effectiveHourlyRate * 24);

  if (dailySendLimit > 0 && maxHourlyRate > 0) {
    deliverable = Math.min(
      deliverable,
      Math.floor(dailySendLimit * (effectiveHourlyRate / maxHourlyRate))
    );
  }

  if (Number.isFinite(effectiveBurstRate) && effectiveBurstRate > 0) {
    deliverable = Math.min(deliverable, Math.floor(effectiveBurstRate * 1440));
  }

  return deliverable > 0 ? deliverable : null;
}

/**
 * Max recipients allowed for the next campaign under current policy + throughput constraints.
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null} policy
 */
function computeMaxSendableRecipients(policy) {
  const empty = {
    maxSendableRecipients: 0,
    limitingFactor: 'credits',
    availableCredits: 0,
    maxCampaignSize: null,
    dailySendLimit: null,
    throughputDaily: null,
    factors: {}
  };

  if (!policy) {
    return empty;
  }

  const creditsRemaining = Math.max(0, Number(policy.creditsRemaining) || 0);
  const creditsReserved = Math.max(0, Number(policy.creditsReserved) || 0);
  const availableCredits = Math.max(0, creditsRemaining - creditsReserved);
  const maxCampaignSize = Math.max(0, Number(policy.maxCampaignSize) || 0);
  const dailySendLimit = Math.max(0, Number(policy.dailySendLimit) || 0);

  if (policy.status === 'suspended') {
    return {
      ...empty,
      limitingFactor: 'suspended',
      availableCredits,
      maxCampaignSize: maxCampaignSize > 0 ? maxCampaignSize : null,
      dailySendLimit: dailySendLimit > 0 ? dailySendLimit : null,
      factors: { credits: availableCredits, suspended: 0 }
    };
  }

  if (policy.reputationEnabled !== false) {
    const score = policy.senderReputation;
    if (score != null && score < MARKETING_MIN_SENDER_REPUTATION) {
      return {
        ...empty,
        limitingFactor: 'reputation',
        availableCredits,
        maxCampaignSize: maxCampaignSize > 0 ? maxCampaignSize : null,
        dailySendLimit: dailySendLimit > 0 ? dailySendLimit : null,
        factors: { credits: availableCredits, reputation: 0 }
      };
    }
  }

  /** @type {{ key: string, value: number }[]} */
  const candidates = [{ key: 'credits', value: availableCredits }];
  if (maxCampaignSize > 0) {
    candidates.push({ key: 'maxCampaignSize', value: maxCampaignSize });
  }
  if (dailySendLimit > 0) {
    candidates.push({ key: 'dailySendLimit', value: dailySendLimit });
  }

  const throughputDaily = computeWarmupDeliverableDaily(policy);
  if (throughputDaily != null) {
    candidates.push({ key: 'throughputDaily', value: throughputDaily });
  }

  const binding = candidates.reduce((min, current) => (current.value < min.value ? current : min));
  const factors = Object.fromEntries(candidates.map((entry) => [entry.key, entry.value]));

  return {
    maxSendableRecipients: binding.value,
    limitingFactor: binding.key,
    availableCredits,
    maxCampaignSize: maxCampaignSize > 0 ? maxCampaignSize : null,
    dailySendLimit: dailySendLimit > 0 ? dailySendLimit : null,
    throughputDaily,
    factors
  };
}

/**
 * @param {string} limitingFactor
 * @returns {string}
 */
function describeSendCapacityLimit(limitingFactor) {
  switch (limitingFactor) {
    case 'maxCampaignSize':
      return 'max campaign size';
    case 'dailySendLimit':
      return 'daily send limit';
    case 'throughputDaily':
      return 'warm-up throughput';
    case 'reputation':
      return 'sender reputation';
    case 'suspended':
      return 'email policy suspension';
    default:
      return 'available email credits';
  }
}

/**
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null} policy
 */
function buildThroughputSummary(policy) {
  if (!policy) return null;
  return {
    maxHourlyRate: policy.maxHourlyRate ?? 0,
    effectiveHourlyRate: policy.effectiveHourlyRate ?? null,
    effectiveBurstRate: resolveEffectiveBurstRate(policy),
    senderReputation: policy.senderReputation ?? null,
    warmupStage: policy.warmupStage ?? null,
    infraMultiplier: policy.infraMultiplier ?? null
  };
}

/**
 * Credit, campaign-size, and reputation checks for marketing send precheck.
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null} policy
 * @param {number} [recipientCount]
 */
function buildCampaignCreditPrecheckChecksFromPolicy(policy, recipientCount = 0) {
  if (!policy) {
    return {
      checks: [],
      credits: null,
      throughput: null
    };
  }

  const count = Math.max(0, Number(recipientCount) || 0);
  const creditsRemaining = policy.creditsRemaining ?? 0;
  const creditsReserved = policy.creditsReserved ?? 0;
  const maxCampaignSize = policy.maxCampaignSize ?? 0;
  const sendCapacity = computeMaxSendableRecipients(policy);
  const availableCredits = sendCapacity.availableCredits;

  /** @type {{ key: string, status: string, message: string, details?: unknown }[]} */
  const checks = [];

  if (policy.status === 'suspended') {
    checks.push({
      key: 'emailPolicyStatus',
      status: 'error',
      message: 'Email sending is suspended for this organization'
    });
  } else {
    checks.push({
      key: 'emailPolicyStatus',
      status: 'ok',
      message: 'Email policy is active'
    });
  }

  if (policy.reputationEnabled !== false) {
    const score = policy.senderReputation;
    if (score != null && score < MARKETING_MIN_SENDER_REPUTATION) {
      checks.push({
        key: 'senderReputation',
        status: 'error',
        message: `Marketing campaigns require sender reputation of at least ${MARKETING_MIN_SENDER_REPUTATION}. Current score: ${score}.`,
        details: { senderReputation: score, minimum: MARKETING_MIN_SENDER_REPUTATION }
      });
    } else if (score != null) {
      checks.push({
        key: 'senderReputation',
        status: 'ok',
        message: `Sender reputation: ${score} / 100`,
        details: { senderReputation: score }
      });
    }
  }

  if (count > 0) {
    if (count > sendCapacity.maxSendableRecipients) {
      const limitLabel = describeSendCapacityLimit(sendCapacity.limitingFactor);
      checks.push({
        key: 'sendCapacity',
        status: 'error',
        message: `This campaign has ${count.toLocaleString()} recipients but you can send at most ${sendCapacity.maxSendableRecipients.toLocaleString()} (${limitLabel})`,
        details: {
          recipientCount: count,
          ...sendCapacity
        }
      });
    } else {
      checks.push({
        key: 'sendCapacity',
        status: 'ok',
        message: `You can send up to ${sendCapacity.maxSendableRecipients.toLocaleString()} recipients in the next campaign`,
        details: {
          recipientCount: count,
          ...sendCapacity
        }
      });
    }

    if (maxCampaignSize > 0 && count > maxCampaignSize) {
      checks.push({
        key: 'campaignSize',
        status: 'error',
        message: `Recipient count (${count.toLocaleString()}) exceeds max campaign size (${maxCampaignSize.toLocaleString()})`,
        details: { recipientCount: count, maxCampaignSize }
      });
    } else {
      checks.push({
        key: 'campaignSize',
        status: 'ok',
        message:
          maxCampaignSize > 0
            ? `Recipient count (${count.toLocaleString()}) is within max campaign size (${maxCampaignSize.toLocaleString()})`
            : `Recipient count: ${count.toLocaleString()}`,
        details: { recipientCount: count, maxCampaignSize }
      });
    }

    if (count > availableCredits) {
      checks.push({
        key: 'emailCredits',
        status: 'error',
        message: `Credits needed (${count.toLocaleString()}) exceed credits remaining (${availableCredits.toLocaleString()})`,
        details: {
          recipientCount: count,
          creditsNeeded: count,
          creditsRemaining: availableCredits,
          creditsReserved
        }
      });
    } else {
      checks.push({
        key: 'emailCredits',
        status: 'ok',
        message: `Credits needed: ${count.toLocaleString()} · Credits remaining: ${availableCredits.toLocaleString()}`,
        details: {
          recipientCount: count,
          creditsNeeded: count,
          creditsRemaining: availableCredits,
          creditsReserved
        }
      });
    }

    const pacing = computeCampaignSubmitPacing(policy);
    if (pacing.effectiveBurstRate != null) {
      const burstMinutes = Math.ceil(count / pacing.effectiveBurstRate);
      checks.push({
        key: 'sendPacing',
        status: 'ok',
        message:
          count <= pacing.effectiveBurstRate
            ? `Burst limit: ${pacing.effectiveBurstRate.toLocaleString()}/min — this send fits in one batch`
            : `Burst limit: ${pacing.effectiveBurstRate.toLocaleString()}/min — delivery paced over ~${burstMinutes.toLocaleString()} min`,
        details: pacing
      });
    }
  } else if (availableCredits === 0) {
    checks.push({
      key: 'emailCredits',
      status: 'warning',
      message: 'No email credits remaining',
      details: { creditsRemaining: availableCredits, creditsReserved }
    });
  }

  if (count === 0 && sendCapacity.maxSendableRecipients >= 0) {
    checks.push({
      key: 'sendCapacity',
      status: sendCapacity.maxSendableRecipients > 0 ? 'ok' : 'warning',
      message:
        sendCapacity.maxSendableRecipients > 0
          ? `You can send up to ${sendCapacity.maxSendableRecipients.toLocaleString()} recipients in the next campaign`
          : 'No send capacity remaining for the next campaign',
      details: sendCapacity
    });
  }

  if (policy.amdsSyncError) {
    checks.push({
      key: 'amdsSync',
      status: 'warning',
      message: `AMDS sync issue: ${policy.amdsSyncError}`
    });
  }

  return {
    checks,
    credits: {
      recipientCount: count,
      creditsNeeded: count,
      creditsRemaining: availableCredits,
      creditsReserved,
      maxCampaignSize,
      monthlyCredits: policy.monthlyCredits ?? 0,
      maxSendableRecipients: sendCapacity.maxSendableRecipients,
      limitingFactor: sendCapacity.limitingFactor
    },
    throughput: buildThroughputSummary(policy)
  };
}

/**
 * Credit, campaign-size, and reputation checks for marketing send precheck.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} [recipientCount]
 */
async function buildCampaignCreditPrecheckChecks(organizationId, recipientCount = 0) {
  const policy = await getOrgEmailPolicy(organizationId);
  return buildCampaignCreditPrecheckChecksFromPolicy(policy, recipientCount);
}

/**
 * @param {number} recipientCount
 * @param {number|null|undefined} effectiveHourlyRate
 * @param {number|null|undefined} [maxHourlyRate]
 * @param {number|null|undefined} [effectiveBurstRate]
 * @returns {number|null}
 */
function computeLocalSendEstimateSeconds(
  recipientCount,
  effectiveHourlyRate,
  maxHourlyRate,
  effectiveBurstRate
) {
  const count = Math.max(0, Number(recipientCount) || 0);
  if (count <= 0) return null;

  const rate = Number(effectiveHourlyRate) || Number(maxHourlyRate) || 0;
  /** @type {number|null} */
  let hourlyEstimate = null;
  if (Number.isFinite(rate) && rate > 0) {
    hourlyEstimate = Math.ceil((count / rate) * 3600);
  }

  const burstEstimate = computeBurstPacedSendEstimateSeconds(count, effectiveBurstRate);
  if (hourlyEstimate == null) {
    return burstEstimate;
  }
  if (burstEstimate == null) {
    return hourlyEstimate;
  }

  return Math.max(hourlyEstimate, burstEstimate);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {number} recipientCount
 */
async function fetchCampaignSendEstimate(organizationId, campaignId, recipientCount) {
  const count = Math.max(0, Number(recipientCount) || 0);
  if (count <= 0 || !isAmdsEnvConfigured()) return null;

  const client = getAmdsClient();
  if (!client) return null;

  try {
    const estimate = await client.getCampaignEstimate(
      String(organizationId),
      String(campaignId),
      count
    );

    return {
      estimatedSeconds: estimate.estimated_seconds ?? null,
      estimatedCompletion: estimate.estimated_completion ?? null,
      throughput: estimate.throughput
        ? {
            maxHourlyRate: estimate.throughput.max_hourly_rate ?? null,
            effectiveHourlyRate: estimate.throughput.effective_hourly_rate ?? null,
            senderReputation: estimate.throughput.reputation_score ?? null,
            warmupStage: estimate.throughput.multipliers?.warmup_stage ?? null,
            infraMultiplier: estimate.throughput.multipliers?.infra ?? null
          }
        : null
    };
  } catch (err) {
    console.warn('[marketingCampaignCreditPrecheckService] estimate fetch failed:', err?.message || err);
    return null;
  }
}

module.exports = {
  buildCampaignCreditPrecheckChecks,
  buildCampaignCreditPrecheckChecksFromPolicy,
  computeMaxSendableRecipients,
  computeWarmupDeliverableDaily,
  describeSendCapacityLimit,
  fetchCampaignSendEstimate,
  buildThroughputSummary,
  computeLocalSendEstimateSeconds,
  computeCampaignSubmitPacing,
  resolveEffectiveBurstRate
};
