'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeCampaignSubmitPacing,
  computeBurstPacedSendEstimateSeconds,
  resolveEffectiveBurstRate
} = require('../campaignSubmitPacing');

describe('campaignSubmitPacing', () => {
  const originalBatchSize = process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE;
  const originalBatchDelay = process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS;

  afterEach(() => {
    if (originalBatchSize === undefined) {
      delete process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE;
    } else {
      process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE = originalBatchSize;
    }
    if (originalBatchDelay === undefined) {
      delete process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS;
    } else {
      process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS = originalBatchDelay;
    }
  });

  it('resolveEffectiveBurstRate prefers AMDS effective rate over hourly-derived estimate', () => {
    assert.equal(
      resolveEffectiveBurstRate({ effectiveBurstRate: 1, maxHourlyRate: 10_000 }),
      1
    );
    assert.equal(resolveEffectiveBurstRate({ maxHourlyRate: 500 }), 9);
    assert.equal(resolveEffectiveBurstRate({}), null);
  });

  it('computeCampaignSubmitPacing caps submit batch size to effective burst', () => {
    delete process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE;
    delete process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS;

    const pacing = computeCampaignSubmitPacing({ effectiveBurstRate: 1 });
    assert.equal(pacing.submitBatchSize, 1);
    assert.equal(pacing.submitBatchDelayMs, 60_000);
    assert.equal(pacing.effectiveBurstRate, 1);
  });

  it('computeCampaignSubmitPacing never exceeds burst even when env batch is larger', () => {
    process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE = '500';
    process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS = '0';

    const pacing = computeCampaignSubmitPacing({ effectiveBurstRate: 10 });
    assert.equal(pacing.submitBatchSize, 10);
    assert.equal(pacing.submitBatchDelayMs, 60_000);
  });

  it('computeCampaignSubmitPacing falls back to env defaults when burst is unknown', () => {
    process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE = '100';
    process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS = '250';

    const pacing = computeCampaignSubmitPacing({});
    assert.equal(pacing.submitBatchSize, 100);
    assert.equal(pacing.submitBatchDelayMs, 250);
    assert.equal(pacing.effectiveBurstRate, null);
  });

  it('computeBurstPacedSendEstimateSeconds estimates minutes from burst cadence', () => {
    assert.equal(computeBurstPacedSendEstimateSeconds(1, 1), 0);
    assert.equal(computeBurstPacedSendEstimateSeconds(2, 1), 60);
    assert.equal(computeBurstPacedSendEstimateSeconds(750, 1), 749 * 60);
    assert.equal(computeBurstPacedSendEstimateSeconds(100, 10), 9 * 60);
  });
});
