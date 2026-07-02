'use strict';

const mongoose = require('mongoose');
const Organization = require('../../models/Organization');
const Campaign = require('../../models/Campaign');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { sendCampaignBatch } = require('./sendCampaignBatch');
const { runCampaignSendJob, assertCampaignSendPolicy } = require('./campaignSendOrchestrator');
const {
  snapshotCampaignRecipients,
  hasCampaignRecipientSnapshot
} = require('./campaignRecipientSnapshotService');
const { resolveAudienceRecipients } = require('./marketingAudienceService');
const { assertApprovedForSend } = require('./marketingCampaignApprovalService');

const BATCH_LIMIT = Math.min(
  100,
  Math.max(1, parseInt(String(process.env.MARKETING_CAMPAIGN_SCHEDULE_BATCH_LIMIT || '25'), 10) || 25)
);

/**
 * @param {Date} date
 * @param {string} timezone
 * @returns {string}
 */
function formatLocalHm(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === 'hour')?.value || '00';
    const minute = parts.find((part) => part.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  } catch {
    const utc = date.toISOString().slice(11, 16);
    return utc;
  }
}

/**
 * @param {string} hm
 * @returns {number}
 */
function hmToMinutes(hm) {
  const [hour, minute] = String(hm || '00:00').split(':').map((part) => parseInt(part, 10) || 0);
  return hour * 60 + minute;
}

/**
 * @param {{ quietHours?: { enabled?: boolean, start?: string, end?: string }, timezone?: string }} campaign
 * @param {Date} [now]
 */
function isWithinQuietHours(campaign, now = new Date()) {
  const quietHours = campaign?.quietHours;
  if (!quietHours?.enabled) return false;

  const timezone = campaign.timezone || 'UTC';
  const current = hmToMinutes(formatLocalHm(now, timezone));
  const start = hmToMinutes(quietHours.start || '22:00');
  const end = hmToMinutes(quietHours.end || '08:00');

  if (start === end) return false;
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

/**
 * @param {import('mongoose').Document} campaign
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function resolveScheduledRecipients(campaign, organizationId) {
  if (Array.isArray(campaign.scheduledRecipients) && campaign.scheduledRecipients.length > 0) {
    return campaign.scheduledRecipients.map((recipient) => ({
      email: String(recipient.email || '').trim(),
      name: recipient.name ? String(recipient.name).trim() : undefined,
      recipientId: String(recipient.recipientId || recipient.email || '').trim()
    })).filter((recipient) => recipient.email && recipient.recipientId);
  }

  if (campaign.audienceId) {
    return resolveAudienceRecipients(organizationId, campaign.audienceId);
  }

  return [];
}

/**
 * @param {import('mongoose').Document} campaign
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function executeScheduledCampaign(campaign, organizationId) {
  if (campaign.approvalStatus !== 'approved') {
    await Campaign.updateOne(
      { _id: campaign._id, organizationId },
      {
        $set: {
          status: 'failed',
          'stats.sendError': 'Scheduled send blocked: campaign is not approved'
        }
      }
    );
    return { skipped: true, reason: 'not_approved' };
  }

  if (isWithinQuietHours(campaign)) {
    return { skipped: true, reason: 'quiet_hours' };
  }

  const recipients = await resolveScheduledRecipients(campaign, organizationId);
  const hasSnapshot = await hasCampaignRecipientSnapshot(organizationId, campaign._id);

  let sendPayload;
  if (hasSnapshot) {
    sendPayload = {
      organizationId,
      campaignId: campaign._id,
      useSnapshot: true,
      skipSnapshot: true,
      recipients: [],
      abTestEnabled: Boolean(campaign.abTest?.enabled),
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks
    };
  } else if (Array.isArray(recipients) && recipients.length > 0) {
    sendPayload = {
      organizationId,
      campaignId: campaign._id,
      recipients,
      abTestEnabled: Boolean(campaign.abTest?.enabled),
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks,
      useSnapshot: !campaign.abTest?.enabled && recipients.length > 100,
      audienceId: campaign.audienceId || undefined
    };
  } else if (campaign.audienceId) {
    sendPayload = {
      organizationId,
      campaignId: campaign._id,
      useSnapshot: true,
      recipients: [],
      audienceId: campaign.audienceId,
      abTestEnabled: Boolean(campaign.abTest?.enabled),
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks
    };
  } else {
    await Campaign.updateOne(
      { _id: campaign._id, organizationId },
      {
        $set: {
          status: 'failed',
          'stats.sendError': 'Scheduled send has no recipients'
        }
      }
    );
    return { skipped: true, reason: 'no_recipients' };
  }

  const result = await runCampaignSendJob(sendPayload);

  await Campaign.updateOne(
    { _id: campaign._id, organizationId },
    { $set: { scheduledRecipients: [] } }
  );

  return { sent: true, result };
}

/**
 * @returns {Promise<{ tenantsProcessed: number, due: number, sent: number, skipped: number, failed: number }>}
 */
async function processDueScheduledCampaigns() {
  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id')
    .lean();

  let tenantsProcessed = 0;
  let due = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const now = new Date();

  for (const tenant of tenants) {
    try {
      await runWithOrganizationTenantContext(tenant._id, async () => {
        const campaigns = await Campaign.find({
          organizationId: tenant._id,
          status: 'scheduled',
          scheduledAt: { $lte: now }
        })
          .limit(BATCH_LIMIT)
          .exec();

        if (campaigns.length === 0) return;
        tenantsProcessed += 1;
        due += campaigns.length;

        for (const campaign of campaigns) {
          try {
            const outcome = await executeScheduledCampaign(campaign, tenant._id);
            if (outcome.skipped) {
              skipped += 1;
            } else if (outcome.sent) {
              sent += 1;
            }
          } catch (err) {
            failed += 1;
            await Campaign.updateOne(
              { _id: campaign._id, organizationId: tenant._id },
              {
                $set: {
                  status: 'failed',
                  'stats.sendError': err instanceof Error ? err.message : String(err)
                }
              }
            );
            console.error(
              `[marketingCampaignSchedule] campaign ${campaign._id} org ${tenant._id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }
      });
    } catch (err) {
      failed += 1;
      console.error(`[marketingCampaignSchedule] tenant ${tenant._id}:`, err.message);
    }
  }

  return { tenantsProcessed, due, sent, skipped, failed };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {Date} params.scheduledAt
 * @param {string} [params.timezone]
 * @param {object} [params.quietHours]
 * @param {object} [params.businessHours]
 * @param {import('mongoose').Types.ObjectId|string|null} [params.audienceId]
 * @param {{ email: string, name?: string, recipientId: string }[]} [params.recipients]
 */
async function scheduleCampaignSend({
  organizationId,
  campaignId,
  scheduledAt,
  timezone,
  quietHours,
  businessHours,
  audienceId,
  recipients
}) {
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  const scheduleDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(scheduleDate.getTime())) {
    throw new Error('scheduledAt is invalid');
  }
  if (scheduleDate.getTime() <= Date.now()) {
    throw new Error('scheduledAt must be in the future');
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    const campaign = await Campaign.findOne({ _id: campaignObjectId, organizationId });
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error('Only draft or scheduled campaigns can be scheduled');
    }

    assertApprovedForSend(campaign);

    const normalizedRecipients = Array.isArray(recipients)
      ? recipients
          .map((recipient) => ({
            email: String(recipient?.email || '').trim(),
            name: recipient?.name ? String(recipient.name).trim() : '',
            recipientId: String(recipient?.recipientId || recipient?.email || '').trim()
          }))
          .filter((recipient) => recipient.email && recipient.recipientId)
      : [];

    const resolvedAudienceId =
      audienceId !== undefined
        ? audienceId
        : campaign.audienceId;

    if (!resolvedAudienceId && normalizedRecipients.length === 0) {
      throw new Error('At least one recipient is required to schedule a send');
    }

    if (resolvedAudienceId) {
      const snapshot = await snapshotCampaignRecipients({
        organizationId,
        campaignId: campaignObjectId,
        audienceId: resolvedAudienceId
      });
      if (snapshot.total === 0) {
        throw new Error('Selected audience has no mailable recipients');
      }
      campaign.audienceId = new mongoose.Types.ObjectId(String(resolvedAudienceId));
      campaign.scheduledRecipients = [];
      campaign.sendState = {
        ...(campaign.sendState || {}),
        phase: 'idle',
        recipientSource: 'snapshot',
        audienceId: campaign.audienceId,
        resolvedCount: snapshot.total,
        preparedCount: 0,
        lastChunkIndex: 0,
        error: null
      };
    } else {
      const snapshot = await snapshotCampaignRecipients({
        organizationId,
        campaignId: campaignObjectId,
        inlineRecipients: normalizedRecipients
      });
      if (snapshot.total === 0) {
        throw new Error('At least one mailable recipient is required to schedule a send');
      }
      campaign.scheduledRecipients = [];
      campaign.sendState = {
        ...(campaign.sendState || {}),
        phase: 'idle',
        recipientSource: 'snapshot',
        resolvedCount: snapshot.total,
        preparedCount: 0,
        lastChunkIndex: 0,
        error: null
      };
    }

    campaign.scheduledAt = scheduleDate;
    campaign.timezone = String(timezone || campaign.timezone || 'UTC').trim() || 'UTC';
    if (quietHours && typeof quietHours === 'object') {
      campaign.quietHours = {
        enabled: quietHours.enabled === true,
        start: String(quietHours.start || '22:00').trim() || '22:00',
        end: String(quietHours.end || '08:00').trim() || '08:00'
      };
    }
    if (businessHours && typeof businessHours === 'object') {
      campaign.businessHours = {
        enabled: businessHours.enabled === true,
        businessHourSetId:
          businessHours.businessHourSetId && mongoose.Types.ObjectId.isValid(businessHours.businessHourSetId)
            ? new mongoose.Types.ObjectId(String(businessHours.businessHourSetId))
            : null
      };
    }

    const recipientCount = Number(campaign.sendState?.resolvedCount) || 0;
    await assertCampaignSendPolicy(organizationId, recipientCount);

    campaign.status = 'scheduled';
    await campaign.save();
    return campaign.toObject();
  });
}

module.exports = {
  scheduleCampaignSend,
  processDueScheduledCampaigns,
  executeScheduledCampaign,
  isWithinQuietHours,
  formatLocalHm
};
