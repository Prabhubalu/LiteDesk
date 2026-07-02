'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeMaxSendableRecipients,
  buildCampaignCreditPrecheckChecksFromPolicy
} = require('../marketingCampaignCreditPrecheckService');

describe('marketingCampaignCreditPrecheckService', () => {
  it('computeMaxSendableRecipients uses min of credits and plan cap', () => {
    const creditBound = computeMaxSendableRecipients({
      creditsRemaining: 1200,
      creditsReserved: 200,
      maxCampaignSize: 5000,
      warmupEnabled: false
    });
    assert.equal(creditBound.maxSendableRecipients, 1000);
    assert.equal(creditBound.limitingFactor, 'credits');

    const planBound = computeMaxSendableRecipients({
      creditsRemaining: 500_000,
      creditsReserved: 0,
      maxCampaignSize: 25_000,
      warmupEnabled: false
    });
    assert.equal(planBound.maxSendableRecipients, 25_000);
    assert.equal(planBound.limitingFactor, 'maxCampaignSize');
  });

  it('computeMaxSendableRecipients applies daily send limit and warm-up throughput', () => {
    const dailyBound = computeMaxSendableRecipients({
      status: 'active',
      creditsRemaining: 499_999,
      creditsReserved: 0,
      maxCampaignSize: 500_000,
      dailySendLimit: 100_000,
      warmupEnabled: false,
      senderReputation: 80
    });
    assert.equal(dailyBound.maxSendableRecipients, 100_000);
    assert.equal(dailyBound.limitingFactor, 'dailySendLimit');

    const warmupBound = computeMaxSendableRecipients({
      status: 'active',
      creditsRemaining: 499_999,
      creditsReserved: 0,
      maxCampaignSize: 500_000,
      dailySendLimit: 100_000,
      maxHourlyRate: 10_000,
      warmupEnabled: true,
      effectiveHourlyRate: 75,
      effectiveBurstRate: 1,
      senderReputation: 52.81
    });
    assert.equal(warmupBound.maxSendableRecipients, 750);
    assert.equal(warmupBound.limitingFactor, 'throughputDaily');
    assert.equal(warmupBound.throughputDaily, 750);
  });

  it('computeMaxSendableRecipients returns zero when reputation or status blocks sends', () => {
    const reputationBlocked = computeMaxSendableRecipients({
      status: 'active',
      creditsRemaining: 10_000,
      maxCampaignSize: 10_000,
      senderReputation: 25,
      reputationEnabled: true
    });
    assert.equal(reputationBlocked.maxSendableRecipients, 0);
    assert.equal(reputationBlocked.limitingFactor, 'reputation');

    const suspended = computeMaxSendableRecipients({
      status: 'suspended',
      creditsRemaining: 10_000,
      maxCampaignSize: 10_000
    });
    assert.equal(suspended.maxSendableRecipients, 0);
    assert.equal(suspended.limitingFactor, 'suspended');
  });

  it('buildCampaignCreditPrecheckChecksFromPolicy blocks when recipients exceed capacity', () => {
    const result = buildCampaignCreditPrecheckChecksFromPolicy(
      {
        status: 'active',
        creditsRemaining: 100,
        creditsReserved: 0,
        maxCampaignSize: 5000,
        reputationEnabled: false,
        warmupEnabled: false
      },
      250
    );

    const capacityCheck = result.checks.find((check) => check.key === 'sendCapacity');
    assert.ok(capacityCheck);
    assert.equal(capacityCheck.status, 'error');
    assert.equal(result.credits.maxSendableRecipients, 100);
  });
});
