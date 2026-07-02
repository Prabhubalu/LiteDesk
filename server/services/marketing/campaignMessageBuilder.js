'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Communication = require('../../models/Communication');
const { MARKETING_MODULE } = require('../amds/handlers/campaignStatsHandler');
const {
  prepareCampaignHtmlForRecipient,
  applyPreferenceMergeTags
} = require('./marketingSubscriptionService');
const { evaluateHubspotConditionalsForRecipient } = require('./marketingConditionalContentService');

/**
 * @param {object} params
 * @returns {Promise<{ messages: import('../amds/amds-types').CampaignBatchMessage[], communications: object[], personalizedByRecipientId: Map<string, object> }>}
 */
async function buildPersonalizedCampaignMessages(params) {
  const orgIdStr = String(params.organizationId);
  const externalCampaignId = String(params.campaignId);
  const resolvedSubject = params.subject;
  const resolvedContent = params.content;
  const organizationName = params.organizationName || '';

  /** @type {import('../amds/amds-types').CampaignBatchMessage[]} */
  const messages = [];
  /** @type {object[]} */
  const communications = [];
  /** @type {Map<string, object>} */
  const personalizedByRecipientId = new Map();

  for (const recipient of params.subscribedRecipients) {
    const recipientId = String(recipient.recipientId || recipient.email).trim();
    const idempotencyKey = `litedesk-marketing-${orgIdStr}-${externalCampaignId}-${recipientId}`.slice(0, 256);
    const idempotencyKeyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');

    const mergeScope = recipient.mergeData || {};
    const htmlWithConditionals = evaluateHubspotConditionalsForRecipient(
      resolvedContent.html || '',
      mergeScope
    );
    const textWithConditionals = resolvedContent.text
      ? evaluateHubspotConditionalsForRecipient(resolvedContent.text, mergeScope)
      : undefined;

    const personalized = await prepareCampaignHtmlForRecipient({
      organizationId: orgIdStr,
      email: recipient.email,
      personId: recipientId,
      campaignId: externalCampaignId,
      html: htmlWithConditionals,
      text: textWithConditionals,
      organizationName,
      mergeScope
    });

    const personalizedSubject = applyPreferenceMergeTags(
      recipient.subject || resolvedSubject,
      personalized.scope
    );
    const messageContent = {
      html: personalized.html,
      ...(personalized.text ? { text: personalized.text } : {})
    };

    const communicationId = new mongoose.Types.ObjectId();
    const communication = {
      _id: communicationId,
      organizationId: params.organizationId,
      kind: 'email',
      direction: 'outbound',
      subject: personalizedSubject,
      body: personalized.html || personalized.text || '',
      fromAddress: params.from.email,
      toAddresses: [recipient.email],
      status: 'sending',
      relatedTo: {
        moduleKey: 'campaigns',
        recordId: new mongoose.Types.ObjectId(String(params.campaignId))
      },
      idempotencyKey,
      idempotencyKeyHash,
      metadata: {
        provider: 'amds',
        campaignId: externalCampaignId,
        recipientId,
        amdsQueue: 'campaign',
        preferenceToken: personalized.urls.token,
        ...(recipient.variantKey ? { abVariantKey: recipient.variantKey } : {})
      }
    };

    communications.push(communication);
    personalizedByRecipientId.set(recipientId, { personalizedSubject, messageContent });

    messages.push({
      idempotency_key: idempotencyKey,
      to: [{ email: recipient.email, ...(recipient.name ? { name: recipient.name } : {}) }],
      subject: personalizedSubject,
      content: messageContent,
      metadata: {
        litedesk_module: MARKETING_MODULE,
        litedesk_entity_id: externalCampaignId,
        litedesk_communication_id: String(communicationId),
        litedesk_recipient_id: recipientId,
        litedesk_org_id: orgIdStr,
        campaign_external_id: externalCampaignId,
        ...(recipient.variantKey ? { ab_variant_key: recipient.variantKey } : {})
      },
      tags: recipient.variantKey
        ? ['marketing', 'campaign', 'ab_test', `variant_${recipient.variantKey}`]
        : ['marketing', 'campaign']
    });
  }

  return { messages, communications, personalizedByRecipientId };
}

/**
 * @param {object} params
 * @param {import('../amds/amds-client').AmdsClient} params.client
 */
async function submitCampaignMessagesToAmds(params) {
  const orgIdStr = String(params.organizationId);
  const externalCampaignId = String(params.campaignId);

  const batchResults = await params.client.sendCampaignBatch(externalCampaignId, {
    tenant_id: orgIdStr,
    from: params.from,
    tracking: { opens: params.trackOpens, clicks: params.trackClicks },
    metadata: {
      litedesk_module: MARKETING_MODULE,
      litedesk_entity_id: externalCampaignId,
      litedesk_org_id: orgIdStr
    },
    messages: params.messages,
    ...(params.pacing ? { pacing: params.pacing } : {})
  });

  let accepted = 0;
  let rejected = 0;
  const rejectedKeys = new Set(
    batchResults.flatMap((result) => (result.errors || []).map((error) => error.idempotency_key))
  );

  for (const result of batchResults) {
    accepted += result.accepted || 0;
    rejected += result.rejected || 0;
  }

  const resultByKey = new Map(
    batchResults.flatMap((result) => (result.messages || []).map((message) => [message.idempotency_key, message]))
  );

  return {
    accepted,
    rejected,
    rejectedKeys,
    resultByKey,
    batchResults
  };
}

/**
 * Idempotent insert — reuses existing Communication rows by idempotencyKeyHash (AMDS retry/resume).
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 */
async function persistCampaignCommunications(params) {
  const communications = Array.isArray(params.communications) ? params.communications : [];
  if (communications.length === 0) {
    return [];
  }

  const organizationId = params.organizationId || communications[0]?.organizationId;
  const hashes = communications.map((communication) => communication.idempotencyKeyHash).filter(Boolean);
  if (hashes.length === 0) {
    return Communication.insertMany(communications, { ordered: true });
  }

  const existing = await Communication.find({
    organizationId,
    idempotencyKeyHash: { $in: hashes }
  }).lean();

  const existingByHash = new Map(existing.map((communication) => [communication.idempotencyKeyHash, communication]));
  const toInsert = communications.filter((communication) => !existingByHash.has(communication.idempotencyKeyHash));

  /** @type {object[]} */
  let inserted = [];
  if (toInsert.length > 0) {
    inserted = await Communication.insertMany(toInsert, { ordered: false });
  }

  const insertedByHash = new Map(inserted.map((communication) => [communication.idempotencyKeyHash, communication]));

  return communications.map(
    (communication) =>
      existingByHash.get(communication.idempotencyKeyHash)
      || insertedByHash.get(communication.idempotencyKeyHash)
      || communication
  );
}

/**
 * @param {import('../amds/amds-types').CampaignBatchMessage[]} messages
 * @param {object[]} communications
 */
function alignCampaignMessageCommunicationIds(messages, communications) {
  const communicationByKey = new Map(
    communications.map((communication) => [communication.idempotencyKey, communication])
  );

  for (const message of messages) {
    const communication = communicationByKey.get(message.idempotency_key);
    if (communication?._id) {
      message.metadata.litedesk_communication_id = String(communication._id);
    }
  }
}

/**
 * @param {object} params
 */
async function applyCampaignCommunicationResults(params) {
  const orgIdStr = String(params.organizationId);
  const externalCampaignId = String(params.campaignId);

  for (const communication of params.communications) {
    const recipientId = communication.metadata?.recipientId;
    const key = `litedesk-marketing-${orgIdStr}-${externalCampaignId}-${recipientId}`;

    if (params.rejectedKeys.has(key)) {
      await Communication.updateOne(
        { _id: communication._id },
        {
          $set: {
            status: 'failed',
            'metadata.sendErrorCode': 'suppressed_or_rejected',
            'metadata.deliveryError': 'suppressed_or_rejected'
          }
        }
      );
      continue;
    }

    const amdsResult = params.resultByKey.get(key);
    if (amdsResult) {
      await Communication.updateOne(
        { _id: communication._id },
        {
          $set: {
            status: 'sent',
            sentAt: new Date(),
            'metadata.amdsMessageId': amdsResult.message_id,
            'metadata.amdsQueue': 'campaign'
          }
        }
      );
    }
  }
}

module.exports = {
  buildPersonalizedCampaignMessages,
  submitCampaignMessagesToAmds,
  persistCampaignCommunications,
  alignCampaignMessageCommunicationIds,
  applyCampaignCommunicationResults
};
