'use strict';

const { readMetadata } = require('../../../utils/arivuMetadata');
const Communication = require('../../../models/Communication');
const { appendCommunicationEvent } = require('../../../services/communicationEventWriter');
const { runWithOrganizationTenantContext } = require('../../../utils/runWithOrganizationTenant');
const { processBounceContact } = require('./bounceContactHandler');
const { processComplaintContact } = require('./complaintContactHandler');
const { notifyAgentBounceFromEvent } = require('./bounceNotify');
const {
  isMarketingModule,
  resolveCampaignIdFromEvent,
  incrementCampaignEngagement,
  incrementCampaignDeliveryStat,
  isMarketingTestSendEvent
} = require('./campaignStatsHandler');

/**
 * @param {import('../amds-types').AmdsWebhookEvent} event
 * @returns {string|null}
 */
function resolveCommunicationId(event) {
  const fromMeta = readMetadata(event.metadata, 'communication_id');
  if (fromMeta) return fromMeta;

  const moduleKey = String(readMetadata(event.metadata, 'module') || '').trim().toLowerCase();
  if (isMarketingModule(moduleKey)) {
    return null;
  }

  const entityId = readMetadata(event.metadata, 'entity_id');
  return entityId || null;
}

/**
 * @param {import('../amds-types').AmdsWebhookEvent} event
 * @returns {'delivered'|'failed'|'bounced'|'complained'|null}
 */
function statusFromEventType(eventType) {
  switch (eventType) {
    case 'message.delivered':
      return 'delivered';
    case 'message.failed':
      return 'failed';
    case 'message.bounced':
      return 'bounced';
    case 'message.complained':
      return 'complained';
    default:
      return null;
  }
}

/**
 * @param {string} organizationId
 * @param {import('../amds-types').AmdsWebhookEvent} event
 * @param {string|null} communicationId
 * @returns {Promise<object|null>}
 */
async function findCommunicationDoc(organizationId, event, communicationId) {
  const messageId = String(event.message_id || '').trim();
  const filter = communicationId
    ? { _id: communicationId, organizationId }
    : {
        organizationId,
        $or: [
          { externalMessageId: messageId },
          { providerMessageKey: `amds:${messageId}` },
          { 'metadata.amdsMessageId': messageId }
        ]
      };

  return Communication.findOne(filter).lean();
}

/**
 * @param {import('../amds-types').AmdsWebhookEvent} event
 */
async function processEngagementEvent(event) {
  const organizationId = readMetadata(event.metadata, 'org_id') || event.tenant_id || null;
  const communicationId = resolveCommunicationId(event);
  const messageId = String(event.message_id || '').trim();

  if (!organizationId || !messageId) return;

  await runWithOrganizationTenantContext(organizationId, async () => {
    const doc = await findCommunicationDoc(organizationId, event, communicationId);
    if (!doc) return;

    /** @type {Record<string, unknown>} */
    const update = {
      'metadata.lastAmdsEvent': event.event_type
    };

    if (event.event_type === 'message.opened') {
      update['metadata.openedAt'] = event.timestamp ? new Date(event.timestamp) : new Date();
      update['metadata.openCount'] = event.engagement?.hit_count ?? 1;
      update.status = 'opened';
    } else if (event.event_type === 'message.clicked') {
      update['metadata.clickedAt'] = event.timestamp ? new Date(event.timestamp) : new Date();
      update['metadata.clickedUrl'] = event.engagement?.url ?? null;
      update['metadata.clickCount'] = event.engagement?.hit_count ?? 1;
    }

    await Communication.updateOne({ _id: doc._id, organizationId }, { $set: update });

    if (isMarketingModule(readMetadata(event.metadata, 'module'))) {
      if (isMarketingTestSendEvent(event, doc)) return;

      const campaignId = resolveCampaignIdFromEvent(event);
      const variantKey = event.metadata?.ab_variant_key ? String(event.metadata.ab_variant_key) : undefined;
      if (event.event_type === 'message.opened') {
        await incrementCampaignEngagement({
          campaignId,
          type: 'open',
          recipient: event.engagement?.recipient,
          variantKey
        });
      } else if (event.event_type === 'message.clicked') {
        await incrementCampaignEngagement({
          campaignId,
          type: 'click',
          recipient: event.engagement?.recipient,
          url: event.engagement?.url,
          variantKey
        });
      }
    }
  });
}

/**
 * @param {import('../amds-types').AmdsWebhookEvent} event
 */
async function processCommunicationAmdsEvent(event) {
  if (event.event_type === 'message.opened' || event.event_type === 'message.clicked') {
    await processEngagementEvent(event);
    return;
  }

  const organizationId = readMetadata(event.metadata, 'org_id') || event.tenant_id || null;
  const communicationId = resolveCommunicationId(event);
  const messageId = String(event.message_id || '').trim();
  const status = statusFromEventType(event.event_type);

  if (!organizationId || !messageId || !status) return;

  const deliveryUpdatedAt = event.timestamp ? new Date(event.timestamp) : new Date();

  /** @type {Record<string, unknown>} */
  const update = {
    status,
    'metadata.deliveryUpdatedAt': deliveryUpdatedAt,
    'metadata.amdsMessageId': messageId,
    'metadata.lastAmdsEvent': event.event_type
  };

  if (event.event_type === 'message.failed') {
    update['metadata.deliveryError'] = String(event.delivery?.error || 'Unknown error').slice(0, 2000);
  } else if (event.event_type === 'message.delivered') {
    update['metadata.deliveryError'] = null;
  } else if (event.event_type === 'message.bounced') {
    const classification = event.bounce?.classification ?? 'hard';
    update['metadata.bounceClassification'] = classification;
    update['metadata.bounceDiagnostic'] = String(event.bounce?.diagnostic || '').slice(0, 2000) || null;
    update['metadata.bounceRecipient'] = event.bounce?.recipient || event.delivery?.recipient || null;
    update['metadata.deliveryError'] = String(event.bounce?.diagnostic || 'Email bounced').slice(0, 2000);
  } else if (event.event_type === 'message.complained') {
    update['metadata.complaintRecipient'] =
      event.bounce?.recipient || event.delivery?.recipient || event.engagement?.recipient || null;
    update['metadata.deliveryError'] = 'Recipient marked this message as spam';
  }

  await runWithOrganizationTenantContext(organizationId, async () => {
    const filter = communicationId
      ? { _id: communicationId, organizationId }
      : {
          organizationId,
          $or: [
            { externalMessageId: messageId },
            { providerMessageKey: `amds:${messageId}` },
            { 'metadata.amdsMessageId': messageId }
          ]
        };

    const doc = await Communication.findOneAndUpdate(filter, { $set: update }, { new: true }).lean();
    if (!doc) return;

    if (event.event_type === 'message.bounced') {
      const classification = event.bounce?.classification ?? 'hard';
      if (classification === 'hard') {
        const bounceEmail =
          event.bounce?.recipient
          || (Array.isArray(doc.toAddresses) ? doc.toAddresses[0] : null)
          || null;
        if (bounceEmail) {
          await processBounceContact({
            tenantId: String(organizationId),
            email: bounceEmail,
            sourceMessageId: messageId,
            eventAt: deliveryUpdatedAt
          });
        }
      }
    }

    if (event.event_type === 'message.complained') {
      const complaintEmail =
        event.bounce?.recipient
        || event.delivery?.recipient
        || event.engagement?.recipient
        || (Array.isArray(doc.toAddresses) ? doc.toAddresses[0] : null)
        || null;
      if (complaintEmail) {
        await processComplaintContact({
          tenantId: String(organizationId),
          email: complaintEmail,
          sourceMessageId: messageId,
          eventAt: deliveryUpdatedAt
        });
      }
    }

    const eventType =
      status === 'delivered'
        ? 'delivered'
        : status === 'bounced'
          ? 'bounced'
          : status === 'complained'
            ? 'complained'
            : 'failed';

    await appendCommunicationEvent({
      organizationId,
      communicationId: doc._id,
      eventType,
      source: 'amds-webhook',
      webhookEventId: event.event_id,
      payload: {
        messageId,
        eventType: event.event_type,
        recipient: event.bounce?.recipient || event.delivery?.recipient || null,
        smtpResponse: event.delivery?.smtp_response || null,
        error: event.delivery?.error || event.bounce?.diagnostic || null,
        bounceClassification: event.bounce?.classification || null
      }
    });

    if (isMarketingModule(readMetadata(event.metadata, 'module'))) {
      if (isMarketingTestSendEvent(event, doc)) return;

      const campaignId = resolveCampaignIdFromEvent(event);
      if (event.event_type === 'message.delivered') {
        await incrementCampaignDeliveryStat({ campaignId, type: 'delivered' });
      } else if (event.event_type === 'message.failed') {
        await incrementCampaignDeliveryStat({ campaignId, type: 'failed' });
      } else if (event.event_type === 'message.bounced') {
        const classification = event.bounce?.classification ?? 'hard';
        await incrementCampaignDeliveryStat({
          campaignId,
          type: classification === 'soft' ? 'soft_bounced' : 'hard_bounced'
        });
      } else if (event.event_type === 'message.complained') {
        await incrementCampaignDeliveryStat({ campaignId, type: 'complained' });
      }
    }

    if (event.event_type === 'message.failed' || event.event_type === 'message.bounced') {
      await notifyAgentBounceFromEvent(event, doc);
    }
  });
}

module.exports = {
  processCommunicationAmdsEvent,
  processEngagementEvent,
  resolveCommunicationId,
  statusFromEventType
};
