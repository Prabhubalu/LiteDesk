'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  releaseCampaignSendCredits,
  finalizeCampaignSendCredits
} = require('../campaignSendCreditService');

test('releaseCampaignSendCredits is a no-op for zero amount', async () => {
  await assert.doesNotReject(() =>
    releaseCampaignSendCredits('000000000000000000000001', '000000000000000000000002', 0)
  );
});

test('finalizeCampaignSendCredits is a no-op for zero reservation', async () => {
  await assert.doesNotReject(() =>
    finalizeCampaignSendCredits('000000000000000000000001', '000000000000000000000002', {
      reserved: 0,
      accepted: 0
    })
  );
});
