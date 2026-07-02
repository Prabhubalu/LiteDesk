'use strict';

const { CAMPAIGN_BATCH_MAX } = require('../amds/amds-client');
const { deriveBurstRatePerMin } = require('../../constants/emailPolicyDefaults');

/**
 * Burst for send pacing comes from AMDS effective rate (warm-up × reputation × infra).
 * When AMDS throughput is unavailable, estimate from org max hourly rate only.
 *
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null|undefined} policy
 * @returns {number|null}
 */
function resolveEffectiveBurstRate(policy) {
  const effective = Number(policy?.effectiveBurstRate);
  if (Number.isFinite(effective) && effective > 0) {
    return Math.floor(effective);
  }

  const maxHourlyRate = Number(policy?.maxHourlyRate);
  if (Number.isFinite(maxHourlyRate) && maxHourlyRate > 0) {
    return deriveBurstRatePerMin(maxHourlyRate);
  }

  return null;
}

/**
 * AMDS burst limits apply per rolling minute window on each submit.
 * Cap batch size and delay between submits so campaigns do not fail with burst_limit_exceeded.
 *
 * @param {import('mongoose').LeanDocument|Record<string, unknown>|null|undefined} [policy]
 * @returns {{ submitBatchSize: number, submitBatchDelayMs: number, effectiveBurstRate: number|null }}
 */
function computeCampaignSubmitPacing(policy) {
  const envBatchParsed = parseInt(String(process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE || ''), 10);
  const envDelayParsed = parseInt(String(process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS || ''), 10);
  const envBatchCap =
    Number.isFinite(envBatchParsed) && envBatchParsed > 0
      ? Math.min(envBatchParsed, CAMPAIGN_BATCH_MAX)
      : CAMPAIGN_BATCH_MAX;
  const envDelayMs =
    Number.isFinite(envDelayParsed) && envDelayParsed >= 0 ? envDelayParsed : null;

  const burstRate = resolveEffectiveBurstRate(policy);
  if (!burstRate) {
    return {
      submitBatchSize: envBatchCap,
      submitBatchDelayMs: envDelayMs ?? 0,
      effectiveBurstRate: null
    };
  }

  const submitBatchSize = Math.max(1, Math.min(envBatchCap, burstRate));
  const computedDelayMs = Math.ceil((submitBatchSize / burstRate) * 60_000);
  const submitBatchDelayMs = Math.max(computedDelayMs, envDelayMs ?? 0);

  return {
    submitBatchSize,
    submitBatchDelayMs,
    effectiveBurstRate: burstRate
  };
}

/**
 * Wall-clock estimate when burst pacing governs submit cadence.
 * Assumes submitBatchSize === effectiveBurstRate (full burst window per batch).
 *
 * @param {number} recipientCount
 * @param {number|null|undefined} effectiveBurstRate
 * @returns {number|null} seconds
 */
function computeBurstPacedSendEstimateSeconds(recipientCount, effectiveBurstRate) {
  const count = Math.max(0, Number(recipientCount) || 0);
  const burst = Number(effectiveBurstRate);
  if (count <= 0 || !Number.isFinite(burst) || burst <= 0) {
    return null;
  }

  const submitCount = Math.ceil(count / burst);
  if (submitCount <= 1) {
    return 0;
  }

  return (submitCount - 1) * 60;
}

module.exports = {
  computeCampaignSubmitPacing,
  computeBurstPacedSendEstimateSeconds,
  resolveEffectiveBurstRate
};
