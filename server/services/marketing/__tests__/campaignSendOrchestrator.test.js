'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const orchestrator = require('../campaignSendOrchestrator');
const queueService = require('../campaignSendQueueService');
const { CAMPAIGN_SEND_INLINE_MAX } = require('../campaignSendConstants');

test('shouldRunCampaignSendInline respects inline max threshold', () => {
  assert.equal(orchestrator.shouldRunCampaignSendInline(CAMPAIGN_SEND_INLINE_MAX), true);
  assert.equal(orchestrator.shouldRunCampaignSendInline(CAMPAIGN_SEND_INLINE_MAX + 1), false);
});

test('enqueueCampaignSendJob uses inline mode for small recipient lists', () => {
  let inlineCalled = false;
  const original = queueService.enqueueCampaignSendJob;
  queueService.enqueueCampaignSendJob = (payload, options) => {
    inlineCalled = true;
    return original.call(queueService, payload, options);
  };

  try {
    const result = queueService.enqueueCampaignSendJob(
      {
        organizationId: new mongoose.Types.ObjectId(),
        campaignId: new mongoose.Types.ObjectId(),
        recipients: [{ email: 'a@example.com', recipientId: 'r1' }]
      },
      { recipientCount: 1 }
    );
    assert.equal(inlineCalled, true);
    assert.equal(result.mode, 'inline');
  } finally {
    queueService.enqueueCampaignSendJob = original;
  }
});
