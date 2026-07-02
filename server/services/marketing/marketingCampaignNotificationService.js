'use strict';

const { emitNotification } = require('../notificationEngine');
const domainEvents = require('../../constants/domainEvents');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildCampaignEntity(campaign, overrides = {}) {
  return {
    type: 'Campaign',
    id: toIdString(campaign?._id),
    title: campaign?.name || '',
    name: campaign?.name || '',
    subject: campaign?.subject || '',
    createdByUserId: toIdString(campaign?.createdByUserId),
    ...overrides
  };
}

async function emitCampaignApprovalEvent(campaign, eventType, { actorId = null, entityOverrides = {} } = {}) {
  if (!campaign?._id || !campaign?.organizationId) return;
  try {
    await emitNotification({
      eventType,
      entity: buildCampaignEntity(campaign, entityOverrides),
      organizationId: campaign.organizationId,
      triggeredBy: actorId || null,
      sourceAppKey: 'MARKETING'
    });
  } catch (error) {
    console.error('[marketingCampaignNotificationService] emit failed:', error.message);
  }
}

async function notifyCampaignSubmittedForReview(campaign, { actorId, reviewerUserIds = [], comment = '' } = {}) {
  await emitCampaignApprovalEvent(campaign, domainEvents.MARKETING_CAMPAIGN_SUBMITTED_FOR_REVIEW, {
    actorId,
    entityOverrides: {
      reviewerUserIds: reviewerUserIds.map((id) => toIdString(id)).filter(Boolean),
      comment: String(comment || '').trim()
    }
  });
}

async function notifyCampaignApproved(campaign, { actorId, comment = '' } = {}) {
  await emitCampaignApprovalEvent(campaign, domainEvents.MARKETING_CAMPAIGN_APPROVED, {
    actorId,
    entityOverrides: { comment: String(comment || '').trim() }
  });
}

async function notifyCampaignRejected(campaign, { actorId, comment = '' } = {}) {
  await emitCampaignApprovalEvent(campaign, domainEvents.MARKETING_CAMPAIGN_REJECTED, {
    actorId,
    entityOverrides: { comment: String(comment || '').trim() }
  });
}

module.exports = {
  notifyCampaignSubmittedForReview,
  notifyCampaignApproved,
  notifyCampaignRejected
};
