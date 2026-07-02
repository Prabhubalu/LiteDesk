'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  requiresRedisForCampaignSend,
  assertCampaignSendScaleReady,
  getCampaignSendScaleStatus
} = require('../campaignSendScaleGuard');
const { getCampaignSendMetricsSnapshot } = require('../campaignSendMetrics');
const {
  recordCampaignSendChunkDuration,
  recordCampaignSendMergeDuration
} = require('../campaignSendMetrics');

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test('requiresRedisForCampaignSend respects threshold', () => {
  assert.equal(requiresRedisForCampaignSend(5000), false);
  assert.equal(requiresRedisForCampaignSend(5001), true);
});

test('assertCampaignSendScaleReady blocks large sends without Redis in production', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;

  assert.throws(
    () => assertCampaignSendScaleReady(10_000),
    /Redis is required/
  );
});

test('getCampaignSendScaleStatus exposes redis guidance', () => {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;
  const status = getCampaignSendScaleStatus();
  assert.equal(status.redisConfigured, false);
  assert.match(String(status.warning || ''), /Redis/i);
});

test('campaign send metrics track chunk p95', () => {
  for (let i = 1; i <= 20; i += 1) {
    recordCampaignSendChunkDuration(i * 100, { organizationId: 'org-test' });
    recordCampaignSendMergeDuration(i * 10, { organizationId: 'org-test' });
  }

  const snapshot = getCampaignSendMetricsSnapshot();
  assert.equal(snapshot.chunk.count, 20);
  assert.ok(snapshot.chunk.p95Ms >= 1500);
  assert.ok(snapshot.merge.p95Ms >= 150);
});
