'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Campaign = require('../../models/Campaign');
const CampaignRecipient = require('../../models/CampaignRecipient');
const Organization = require('../../models/Organization');
const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');
const { AmdsApiError } = require('../amds/amds-errors');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { getOrgEmailPolicy, refreshOrgEmailThroughput } = require('../orgEmailPolicyService');
const { computeCampaignSubmitPacing } = require('./campaignSubmitPacing');
const { filterSubscribedRecipientsBulk } = require('./marketingSubscriptionService');
const { hydrateRecipientMergeScopes } = require('./campaignMergeScopeService');
const {
  buildPersonalizedCampaignMessages,
  submitCampaignMessagesToAmds,
  persistCampaignCommunications,
  alignCampaignMessageCommunicationIds,
  applyCampaignCommunicationResults
} = require('./campaignMessageBuilder');
const {
  recordCampaignSendChunkDuration,
  recordCampaignSendMergeDuration,
  recordCampaignSendAmdsSubmit
} = require('./campaignSendMetrics');

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {string[]} emails
 */
async function markCampaignRecipientsSuppressed(organizationId, campaignId, emails) {
  const normalized = [...new Set((emails || []).map((email) => String(email || '').trim().toLowerCase()))]
    .filter(Boolean);
  if (normalized.length === 0) return;

  await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.updateMany(
      {
        organizationId,
        campaignId: new mongoose.Types.ObjectId(String(campaignId)),
        email: { $in: normalized }
      },
      { $set: { status: 'suppressed', errorCode: 'unsubscribed' } }
    )
  );
}

/**
 * Persist recipient rows for inline sends (no pre-send snapshot) so the detail page can list them.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {object[]} subscribedRecipients
 * @param {object[]} persistedCommunications
 */
async function upsertCampaignRecipientSendRows(
  organizationId,
  campaignId,
  subscribedRecipients,
  persistedCommunications
) {
  const recipients = Array.isArray(subscribedRecipients) ? subscribedRecipients : [];
  if (recipients.length === 0) return;

  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  const orgIdStr = String(organizationId);
  const campaignIdStr = String(campaignId);

  /** @type {Map<string, object>} */
  const communicationByRecipientId = new Map();
  /** @type {Map<string, object>} */
  const communicationByEmail = new Map();
  for (const communication of persistedCommunications || []) {
    const recipientId = communication.metadata?.recipientId;
    if (recipientId) {
      communicationByRecipientId.set(String(recipientId), communication);
    }
    const email = Array.isArray(communication.toAddresses)
      ? String(communication.toAddresses[0] || '').trim().toLowerCase()
      : '';
    if (email) {
      communicationByEmail.set(email, communication);
    }
  }

  const ops = recipients.map((recipient) => {
    const recipientId = String(recipient.recipientId || recipient.email).trim();
    const email = String(recipient.email || '').trim().toLowerCase();
    const communication =
      communicationByRecipientId.get(recipientId)
      || communicationByEmail.get(email)
      || null;
    const idempotencyKey = `litedesk-marketing-${orgIdStr}-${campaignIdStr}-${recipientId}`.slice(0, 256);
    const idempotencyKeyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
    const personIdRaw = recipient.personId || recipient.mergeData?.personId || null;
    const personId =
      personIdRaw && mongoose.Types.ObjectId.isValid(String(personIdRaw))
        ? new mongoose.Types.ObjectId(String(personIdRaw))
        : null;

    return {
      updateOne: {
        filter: { organizationId: orgObjectId, campaignId: campaignObjectId, email },
        update: {
          $set: {
            personId,
            name: recipient.name ? String(recipient.name).trim() : '',
            recipientId,
            status: 'prepared',
            variantKey: recipient.variantKey || null,
            communicationId: communication?._id || null,
            errorCode: null,
            idempotencyKeyHash
          },
          $setOnInsert: {
            organizationId: orgObjectId,
            campaignId: campaignObjectId,
            chunkIndex: 0
          }
        },
        upsert: true
      }
    };
  });

  if (ops.length > 0) {
    await CampaignRecipient.bulkWrite(ops, { ordered: false });
  }
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {string[]} recipientIds
 */
async function markCampaignRecipientsQueued(organizationId, campaignId, recipientIds) {
  const ids = [...new Set((recipientIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return;

  await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.updateMany(
      {
        organizationId,
        campaignId: new mongoose.Types.ObjectId(String(campaignId)),
        recipientId: { $in: ids }
      },
      { $set: { status: 'queued', errorCode: null } }
    )
  );
}

/**
 * @param {object} params
 */
async function processCampaignSendChunk(params) {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS is not configured');
  }

  const client = getAmdsClient();
  if (!client) {
    throw new Error('AMDS is not configured');
  }

  const organizationId = params.organizationId;
  const campaignId = params.campaignId;
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  const incomingRecipients = Array.isArray(params.recipients) ? params.recipients : [];

  if (incomingRecipients.length === 0) {
    throw new Error('At least one recipient is required');
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    const chunkStartedAt = Date.now();
    const campaign = params.campaign || await Campaign.findOne({ _id: campaignObjectId, organizationId });
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const activeStatuses = new Set(['running', 'completed', 'sending', 'sent']);
    if (!params.skipAlreadySentGuard && activeStatuses.has(campaign.status)) {
      throw new Error('Campaign already sent or in progress');
    }
    if (campaign.status === 'cancelled' || campaign.status === 'archived') {
      throw new Error('Campaign cannot be sent in its current state');
    }

    const resolvedFrom = params.from || {
      email: campaign.fromEmail,
      ...(campaign.fromName ? { name: campaign.fromName } : {})
    };
    if (!resolvedFrom?.email) {
      throw new Error('Campaign from email is required');
    }

    const resolvedSubject = params.subject || campaign.subject;
    const resolvedContent = params.content || {
      html: campaign.bodyHtml,
      ...(campaign.bodyText ? { text: campaign.bodyText } : {})
    };
    if (!resolvedContent.html && !resolvedContent.text) {
      throw new Error('Campaign content is required');
    }

    const resolvedTrackOpens = params.trackOpens ?? campaign.trackOpens ?? true;
    const resolvedTrackClicks = params.trackClicks ?? campaign.trackClicks ?? true;

    const mergeStartedAt = Date.now();
    const hydratedRecipients = await hydrateRecipientMergeScopes({
      organizationId,
      recipients: incomingRecipients,
      subject: resolvedSubject,
      html: resolvedContent.html,
      text: resolvedContent.text
    });
    recordCampaignSendMergeDuration(Date.now() - mergeStartedAt, {
      organizationId: String(organizationId)
    });

    const { subscribed, unsubscribedEmails } = await filterSubscribedRecipientsBulk(
      organizationId,
      hydratedRecipients
    );

    if (params.markSuppressedRecipients !== false && unsubscribedEmails.length > 0) {
      await markCampaignRecipientsSuppressed(organizationId, campaignId, unsubscribedEmails);
    }

    if (subscribed.length === 0) {
      return {
        accepted: 0,
        rejected: 0,
        skippedUnsubscribed: incomingRecipients.length,
        batchResults: [],
        communicationIds: []
      };
    }

    const emailPolicy = await getOrgEmailPolicy(organizationId);
    if (emailPolicy?.status === 'suspended') {
      throw new Error('Email sending is suspended for this organization');
    }

    if (!params.skipPolicyChecks) {
      const maxCampaignSize = emailPolicy?.maxCampaignSize ?? 0;
      if (maxCampaignSize > 0 && subscribed.length > maxCampaignSize) {
        throw new Error(`Maximum campaign size is ${maxCampaignSize.toLocaleString()} recipients`);
      }
      const creditsRemaining = emailPolicy?.creditsRemaining ?? 0;
      if (subscribed.length > creditsRemaining) {
        throw new Error(
          `Insufficient email credits: need ${subscribed.length.toLocaleString()}, have ${creditsRemaining.toLocaleString()}`
        );
      }
    }

    const organization = await Organization.findById(organizationId).select('name').lean();
    const organizationName = organization?.name || '';

    if (!params.skipAlreadySentGuard) {
      await Campaign.updateOne(
        { _id: campaignObjectId },
        { $set: { status: 'running', 'stats.sendStartedAt': new Date() } }
      );
    }

    const { messages, communications } = await buildPersonalizedCampaignMessages({
      organizationId,
      campaignId,
      from: resolvedFrom,
      subject: resolvedSubject,
      content: resolvedContent,
      organizationName,
      subscribedRecipients: subscribed
    });

    const persistedCommunications = await persistCampaignCommunications({
      organizationId,
      communications
    });
    alignCampaignMessageCommunicationIds(messages, persistedCommunications);
    await upsertCampaignRecipientSendRows(
      organizationId,
      campaignId,
      subscribed,
      persistedCommunications
    );

    try {
      await refreshOrgEmailThroughput(organizationId);
      const pacingPolicy = await getOrgEmailPolicy(organizationId);
      const pacing = computeCampaignSubmitPacing(pacingPolicy);

      const amdsStartedAt = Date.now();
      const submitResult = await submitCampaignMessagesToAmds({
        client,
        organizationId,
        campaignId,
        from: resolvedFrom,
        trackOpens: resolvedTrackOpens,
        trackClicks: resolvedTrackClicks,
        messages,
        pacing
      });
      recordCampaignSendAmdsSubmit({
        organizationId: String(organizationId),
        accepted: submitResult.accepted,
        rejected: submitResult.rejected,
        durationMs: Date.now() - amdsStartedAt
      });

      await applyCampaignCommunicationResults({
        organizationId,
        campaignId,
        communications: persistedCommunications,
        rejectedKeys: submitResult.rejectedKeys,
        resultByKey: submitResult.resultByKey
      });

      if (params.markSuppressedRecipients !== false) {
        await markCampaignRecipientsQueued(
          organizationId,
          campaignId,
          subscribed.map((recipient) => recipient.recipientId)
        );
      }

      const statsUpdate = params.appendStats
        ? {
            $inc: {
              'stats.queued': submitResult.accepted,
              'stats.rejected': submitResult.rejected,
              'stats.skippedUnsubscribed': unsubscribedEmails.length
            },
            $set: {
              status: params.finalizeStatus === 'running' ? 'running' : 'completed',
              amdsCampaignId: String(campaignObjectId),
              ...(params.finalizeStatus === 'running' ? {} : { 'stats.sendCompletedAt': new Date() })
            }
          }
        : {
            $set: {
              status: params.finalizeStatus === 'running' ? 'running' : 'completed',
              amdsCampaignId: String(campaignObjectId),
              'stats.sendCompletedAt': params.finalizeStatus === 'running' ? null : new Date(),
              'stats.queued': submitResult.accepted,
              'stats.rejected': submitResult.rejected,
              'stats.totalRecipients': subscribed.length,
              'stats.skippedUnsubscribed': unsubscribedEmails.length
            }
          };

      await Campaign.updateOne({ _id: campaignObjectId }, statsUpdate);

      recordCampaignSendChunkDuration(Date.now() - chunkStartedAt, {
        organizationId: String(organizationId)
      });

      return {
        accepted: submitResult.accepted,
        rejected: submitResult.rejected,
        skippedUnsubscribed: unsubscribedEmails.length,
        batchResults: submitResult.batchResults,
        communicationIds: persistedCommunications.map((communication) => communication._id)
      };
    } catch (err) {
      const sendErrorMessage =
        err instanceof AmdsApiError
        && (err.isDomainNotVerified
          || err.isInsufficientCredits
          || err.isCampaignSizeExceeded
          || err.isRateLimited)
          ? err.userMessage
          : (err instanceof Error ? err.message : String(err));

      if (!params.skipAlreadySentGuard) {
        await Campaign.updateOne(
          { _id: campaignObjectId },
          {
            $set: {
              status: 'failed',
              'stats.sendError': sendErrorMessage
            }
          }
        );
      }

      if (err instanceof AmdsApiError) {
        if (err.isDomainNotVerified) {
          throw new Error(err.userMessage);
        }
        if (err.isInsufficientCredits || err.isCampaignSizeExceeded || err.isRateLimited) {
          throw new Error(err.userMessage);
        }
      }
      throw err;
    }
  });
}

module.exports = {
  processCampaignSendChunk,
  markCampaignRecipientsSuppressed,
  markCampaignRecipientsQueued,
  upsertCampaignRecipientSendRows
};
