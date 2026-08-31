'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Campaign = require('../../models/Campaign');
const Communication = require('../../models/Communication');
const { isAmdsEnvConfigured } = require('../../config/amds');
const { sendViaAmds } = require('../emailProviders/amdsEmailDelivery');
const Organization = require('../../models/Organization');
const {
  prepareCampaignHtmlForRecipient,
  applyPreferenceMergeTags
} = require('./marketingSubscriptionService');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { MARKETING_MODULE } = require('../amds/handlers/campaignStatsHandler');
const { buildIdempotencyKey, writeMetadata } = require('../../utils/arivuMetadata');

/**
 * @param {{ email: string, name?: string }} recipient
 */
function buildTestMergeScope(recipient) {
  const email = String(recipient.email || '').trim();
  const displayName = String(recipient.name || 'Test User').trim();
  const nameParts = displayName.split(/\s+/).filter(Boolean);

  return {
    People: {
      firstName: nameParts[0] || 'Test',
      lastName: nameParts.slice(1).join(' ') || 'User',
      email,
      fullName: displayName
    },
    Organization: {
      name: 'Sample Organization'
    }
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {{ email: string, name?: string }} params.recipient
 */
async function sendCampaignTest({ organizationId, campaignId, recipient }) {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS is not configured');
  }

  const email = String(recipient?.email || '').trim();
  if (!email || !email.includes('@')) {
    throw new Error('A valid test recipient email is required');
  }

  const orgIdStr = String(organizationId);
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  return runWithOrganizationTenantContext(organizationId, async () => {
    const campaign = await Campaign.findOne({ _id: campaignObjectId, organizationId });
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const fromEmail = String(campaign.fromEmail || '').trim();
    if (!fromEmail) {
      throw new Error('Campaign from email is required');
    }

    const subject = String(campaign.subject || '').trim();
    const bodyHtml = String(campaign.bodyHtml || '').trim();
    const bodyText = String(campaign.bodyText || '').trim();
    if (!bodyHtml && !bodyText) {
      throw new Error('Campaign content is required');
    }

    const recipientId = `test-${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
    const mergeScope = buildTestMergeScope({ email, name: recipient?.name });
    const organization = await Organization.findById(organizationId).select('name').lean();
    const personalized = await prepareCampaignHtmlForRecipient({
      organizationId: orgIdStr,
      email,
      personId: recipientId,
      campaignId: String(campaignObjectId),
      html: bodyHtml,
      text: bodyText,
      organizationName: organization?.name || '',
      mergeScope
    });

    const resolvedSubject = applyPreferenceMergeTags(subject, personalized.scope);
    const resolvedHtml = personalized.html;
    const resolvedText = personalized.text || resolvedHtml.replace(/<[^>]+>/g, '');

    // Each test attempt gets a unique key — AMDS dedupes by idempotency_key and Communication
    // has a unique index on idempotencyKeyHash; a fixed key blocks repeat sends to the same address.
    const idempotencyKey = buildIdempotencyKey(
      'marketing-test',
      orgIdStr,
      String(campaignObjectId),
      crypto.randomUUID()
    );

    const communication = await Communication.create({
      organizationId,
      kind: 'email',
      direction: 'outbound',
      subject: resolvedSubject,
      body: resolvedHtml || resolvedText,
      fromAddress: fromEmail,
      toAddresses: [email],
      status: 'sending',
      relatedTo: {
        moduleKey: 'campaigns',
        recordId: campaignObjectId
      },
      idempotencyKey,
      idempotencyKeyHash: crypto.createHash('sha256').update(idempotencyKey).digest('hex'),
      metadata: {
        provider: 'amds',
        campaignId: String(campaignObjectId),
        recipientId,
        isTestSend: true,
        amdsQueue: 'transaction'
      }
    });

    const result = await sendViaAmds({
      from: campaign.fromName ? `${campaign.fromName} <${fromEmail}>` : fromEmail,
      to: email,
      subject: resolvedSubject || `[Test] ${campaign.name}`,
      html: resolvedHtml || undefined,
      text: resolvedText || undefined,
      organizationId: orgIdStr,
      idempotencyKey,
      tracking: {
        opens: campaign.trackOpens !== false,
        clicks: campaign.trackClicks !== false
      },
      metadata: {
        ...writeMetadata({
          module: MARKETING_MODULE,
          entity_id: String(campaignObjectId),
          communication_id: String(communication._id),
          recipient_id: recipientId,
          org_id: orgIdStr
        }),
        is_test_send: true
      },
      tags: ['marketing', 'test']
    });

    if (!result.success) {
      await Communication.updateOne(
        { _id: communication._id },
        {
          $set: {
            status: 'failed',
            'metadata.deliveryError': result.error || 'Test send failed',
            'metadata.sendErrorCode': result.code || 'test_send_failed'
          }
        }
      );
      throw new Error(result.error || 'Test send failed');
    }

    await Communication.updateOne(
      { _id: communication._id },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
          'metadata.amdsMessageId': result.messageId,
          providerMessageKey: result.messageId ? `amds:${result.messageId}` : undefined
        }
      }
    );

    return {
      messageId: result.messageId,
      communicationId: communication._id,
      unresolvedMergeTags: 0
    };
  });
}

module.exports = {
  sendCampaignTest,
  buildTestMergeScope
};
