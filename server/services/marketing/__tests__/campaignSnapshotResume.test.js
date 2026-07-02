'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCampaignSnapshotResumePlan } = require('../campaignRecipientSnapshotService');

test('buildCampaignSnapshotResumePlan detects resume after partial progress', () => {
  const plan = buildCampaignSnapshotResumePlan({
    sendState: {
      phase: 'failed',
      resolvedCount: 1000,
      preparedCount: 500,
      lastChunkIndex: 1,
      creditsReserved: 1000
    },
    totalRecipients: 1000,
    pendingCount: 500,
    initialQueued: 480
  });

  assert.equal(plan.isResume, true);
  assert.equal(plan.processedCount, 500);
  assert.equal(plan.preparedCount, 500);
  assert.equal(plan.lastChunkIndex, 1);
  assert.equal(plan.initialQueued, 480);
});

test('buildCampaignSnapshotResumePlan treats fresh snapshot as non-resume', () => {
  const plan = buildCampaignSnapshotResumePlan({
    sendState: { phase: 'idle', resolvedCount: 250, preparedCount: 0, lastChunkIndex: 0 },
    totalRecipients: 250,
    pendingCount: 250,
    initialQueued: 0
  });

  assert.equal(plan.isResume, false);
  assert.equal(plan.processedCount, 0);
});

test('buildCampaignSnapshotResumePlan detects failed send with remaining pending recipients', () => {
  const plan = buildCampaignSnapshotResumePlan({
    sendState: { phase: 'failed', resolvedCount: 2000, preparedCount: 500, lastChunkIndex: 1 },
    totalRecipients: 2000,
    pendingCount: 1500,
    initialQueued: 480
  });

  assert.equal(plan.isResume, true);
  assert.equal(plan.processedCount, 500);
});
