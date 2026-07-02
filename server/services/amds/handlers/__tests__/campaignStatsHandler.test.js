'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  isMarketingTestSendEvent,
  buildCampaignProductionCommunicationFilter
} = require('../campaignStatsHandler');

describe('campaignStatsHandler production send helpers', () => {
  it('isMarketingTestSendEvent detects test sends from event or communication metadata', () => {
    assert.equal(isMarketingTestSendEvent({ metadata: { is_test_send: true } }, null), true);
    assert.equal(isMarketingTestSendEvent(null, { metadata: { isTestSend: true } }), true);
    assert.equal(
      isMarketingTestSendEvent({ metadata: { is_test_send: false } }, { metadata: { isTestSend: false } }),
      false
    );
    assert.equal(isMarketingTestSendEvent({}, {}), false);
  });

  it('buildCampaignProductionCommunicationFilter excludes test sends', () => {
    const organizationId = new mongoose.Types.ObjectId();
    const campaignId = new mongoose.Types.ObjectId();
    const filter = buildCampaignProductionCommunicationFilter(organizationId, campaignId);

    assert.equal(String(filter.organizationId), String(organizationId));
    assert.equal(filter['relatedTo.moduleKey'], 'campaigns');
    assert.equal(String(filter['relatedTo.recordId']), String(campaignId));
    assert.deepEqual(filter['metadata.isTestSend'], { $ne: true });
  });
});
