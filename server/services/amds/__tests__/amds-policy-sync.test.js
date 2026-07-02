'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toAmdsPolicy } = require('../amds-policy-sync');
const { isTenantAmdsEventType } = require('../handlers/tenantEventHandler');
const { AmdsApiError } = require('../amds-errors');

describe('amds-policy-sync', () => {
  it('toAmdsPolicy maps MongoDB doc to AMDS payload', () => {
    const payload = toAmdsPolicy({
      status: 'active',
      monthlyCredits: 1000,
      creditsRemaining: 800,
      dailySendLimit: 500,
      maxHourlyRate: 100,
      burstRatePerMin: 20,
      maxCampaignSize: 5000,
      warmupEnabled: true,
      reputationEnabled: false
    });

    assert.equal(payload.status, 'active');
    assert.equal(payload.monthly_credits, 1000);
    assert.equal(payload.credits_remaining, 800);
    assert.equal(payload.burst_rate_per_min, 2);
    assert.equal(payload.reputation_enabled, false);
  });

  it('toAmdsPolicy maps suspended status', () => {
    const payload = toAmdsPolicy({ status: 'suspended', monthlyCredits: 0, creditsRemaining: 0 });
    assert.equal(payload.status, 'suspended');
  });
});

describe('tenantEventHandler', () => {
  it('recognizes tenant AMDS webhook event types', () => {
    assert.equal(isTenantAmdsEventType('credit.consumed'), true);
    assert.equal(isTenantAmdsEventType('reputation.updated'), true);
    assert.equal(isTenantAmdsEventType('message.delivered'), false);
  });
});

describe('amds-errors track6', () => {
  it('flags insufficient credits and campaign size errors', () => {
    const credits = new AmdsApiError(402, { error: 'insufficient_credits' });
    assert.equal(credits.isInsufficientCredits, true);
    assert.match(credits.userMessage, /credits/i);

    const size = new AmdsApiError(422, { error: 'campaign_size_exceeded', limit: 1000 });
    assert.equal(size.isCampaignSizeExceeded, true);
    assert.match(size.userMessage, /campaign size/i);
  });
});
