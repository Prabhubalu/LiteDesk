const { emitNotification } = require('./notificationEngine');
const domainEvents = require('../constants/domainEvents');
const {
  isPortalChannelCase,
  resolvePortalCaseRequesterUserIds
} = require('./portalCaseAccessService');

const CUSTOMER_VISIBLE_ACTIVITY_TYPES = new Set([
  'agent_message',
  'email_sent',
  'message_sent',
  'comment',
  'message'
]);

function isCustomerVisibleActivity(activity) {
  if (!activity || activity.internal === true) return false;
  const type = String(activity.activityType || '').trim();
  return CUSTOMER_VISIBLE_ACTIVITY_TYPES.has(type);
}

async function emitPortalCaseNotification(caseRecord, eventType, { actorId = null, entityOverrides = {} } = {}) {
  if (!caseRecord?._id || !caseRecord?.organizationId || !isPortalChannelCase(caseRecord)) {
    return;
  }

  const requesterIds = await resolvePortalCaseRequesterUserIds(caseRecord.organizationId, caseRecord);
  if (!requesterIds.length) return;

  try {
    await emitNotification({
      eventType,
      entity: {
        type: 'Case',
        id: String(caseRecord._id),
        title: caseRecord.title || '',
        status: caseRecord.status || '',
        caseId: caseRecord.caseId || '',
        ...entityOverrides
      },
      organizationId: caseRecord.organizationId,
      triggeredBy: actorId || null,
      sourceAppKey: 'PORTAL'
    });
  } catch (error) {
    console.error('[portalCaseNotificationService] emit failed:', error.message);
  }
}

async function notifyPortalCaseAgentReply(caseRecord, { actorId = null, preview = '', subject = '' } = {}) {
  await emitPortalCaseNotification(caseRecord, domainEvents.CASE_PORTAL_AGENT_REPLY, {
    actorId,
    entityOverrides: {
      preview: String(preview || '').slice(0, 200),
      subject: String(subject || '').trim()
    }
  });
}

async function notifyPortalCaseStatusUpdate(caseRecord, { actorId = null, toStatus = '' } = {}) {
  const status = String(toStatus || caseRecord?.status || '');
  const notifyStatuses = new Set(['Waiting for Customer', 'Resolved', 'Closed', 'In Progress']);
  if (!notifyStatuses.has(status)) return;

  await emitPortalCaseNotification(caseRecord, domainEvents.CASE_PORTAL_STATUS_UPDATE, {
    actorId,
    entityOverrides: {
      toStatus: status
    }
  });
}

async function notifyPortalCaseCustomerActivity(caseRecord, activity, { actorId = null } = {}) {
  if (!isCustomerVisibleActivity(activity)) return;
  await notifyPortalCaseAgentReply(caseRecord, {
    actorId,
    preview: activity?.message || '',
    subject: activity?.metadata?.subject || ''
  });
}

module.exports = {
  isPortalChannelCase,
  isCustomerVisibleActivity,
  resolvePortalCaseRequesterUserIds,
  notifyPortalCaseAgentReply,
  notifyPortalCaseStatusUpdate,
  notifyPortalCaseCustomerActivity
};
