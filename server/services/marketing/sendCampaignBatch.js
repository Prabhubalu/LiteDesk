'use strict';

const { processCampaignSendChunk } = require('./campaignSendChunkWorker');

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {{ email: string, name?: string, recipientId: string }[]} params.recipients
 * @param {{ email: string, name?: string }} [params.from]
 * @param {string} [params.subject]
 * @param {{ html: string, text?: string }} [params.content]
 * @param {boolean} [params.trackOpens]
 * @param {boolean} [params.trackClicks]
 * @param {'completed'|'running'} [params.finalizeStatus]
 * @param {boolean} [params.skipAlreadySentGuard]
 * @param {boolean} [params.appendStats]
 * @param {boolean} [params.skipPolicyChecks]
 * @param {boolean} [params.markSuppressedRecipients]
 */
async function sendCampaignBatch(params) {
  return processCampaignSendChunk({
    ...params,
    markSuppressedRecipients: params.markSuppressedRecipients ?? false
  });
}

module.exports = {
  sendCampaignBatch,
  processCampaignSendChunk
};
