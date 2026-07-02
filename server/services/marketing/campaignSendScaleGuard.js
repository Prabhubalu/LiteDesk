'use strict';

const {
  CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE,
  CAMPAIGN_SEND_INLINE_MAX
} = require('./campaignSendConstants');

function isRedisConfigured() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim() || String(process.env.REDIS_HOST || '').trim()
  );
}

function isCampaignSendWorkerEnabled() {
  return process.env.ENABLE_MARKETING_CAMPAIGN_SEND_WORKER !== 'false';
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

/**
 * @param {number} recipientCount
 */
function requiresRedisForCampaignSend(recipientCount) {
  const count = Math.max(0, Number(recipientCount) || 0);
  return count > CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE;
}

/**
 * @param {number} recipientCount
 * @param {{ allowInline?: boolean }} [options]
 */
function assertCampaignSendScaleReady(recipientCount, options = {}) {
  const count = Math.max(0, Number(recipientCount) || 0);
  const needsRedis = requiresRedisForCampaignSend(count);
  const redisConfigured = isRedisConfigured();
  const workerEnabled = isCampaignSendWorkerEnabled();

  if (needsRedis && isProductionEnvironment() && !redisConfigured) {
    throw new Error(
      `Redis is required for campaign sends over ${CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE.toLocaleString()} recipients. Configure REDIS_URL and run a dedicated campaign send worker.`
    );
  }

  if (
    needsRedis
    && isProductionEnvironment()
    && redisConfigured
    && !workerEnabled
    && options.allowInline !== true
  ) {
    throw new Error(
      'Campaign send worker is disabled. Set ENABLE_MARKETING_CAMPAIGN_SEND_WORKER=true for large sends.'
    );
  }

  if (needsRedis && !redisConfigured && !options.allowInline) {
    return {
      ready: false,
      warning: `Large sends (${count.toLocaleString()} recipients) require Redis. Running inline in this environment may cause timeouts or OOM.`,
      mode: 'inline-risk'
    };
  }

  return {
    ready: true,
    warning: needsRedis && !redisConfigured
      ? `Redis is not configured. Sends above ${CAMPAIGN_SEND_INLINE_MAX.toLocaleString()} recipients may run inline and destabilize the API process.`
      : null,
    mode: needsRedis && redisConfigured ? 'queued' : 'inline'
  };
}

function getCampaignSendScaleStatus() {
  const redisConfigured = isRedisConfigured();
  const workerEnabled = isCampaignSendWorkerEnabled();

  return {
    redisConfigured,
    workerEnabled,
    redisRequiredAbove: CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE,
    inlineMax: CAMPAIGN_SEND_INLINE_MAX,
    production: isProductionEnvironment(),
    largeSendRequiresRedis: true,
    warning: !redisConfigured
      ? `Configure Redis before sending more than ${CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE.toLocaleString()} recipients in production.`
      : null
  };
}

module.exports = {
  assertCampaignSendScaleReady,
  requiresRedisForCampaignSend,
  getCampaignSendScaleStatus,
  isRedisConfigured,
  isCampaignSendWorkerEnabled
};
