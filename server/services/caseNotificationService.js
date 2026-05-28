const { emitNotification } = require('./notificationEngine');
const notificationDomainEvents = require('../constants/domainEvents');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildCaseEntity(caseRecord, overrides = {}) {
  return {
    type: 'Case',
    id: toIdString(caseRecord?._id),
    title: caseRecord?.title || '',
    status: caseRecord?.status || '',
    priority: caseRecord?.priority || '',
    caseId: caseRecord?.caseId || '',
    ...overrides
  };
}

async function emitCaseNotificationEvent(caseRecord, eventType, { actorId = null, entityOverrides = {} } = {}) {
  if (!caseRecord?._id || !caseRecord?.organizationId) return;
  try {
    await emitNotification({
      eventType,
      entity: buildCaseEntity(caseRecord, entityOverrides),
      organizationId: caseRecord.organizationId,
      triggeredBy: actorId || null,
      sourceAppKey: 'HELPDESK'
    });
  } catch (error) {
    console.error('[caseNotificationService] emit failed:', error.message);
  }
}

async function notifyCaseEmailReceived(caseRecord, { fromAddress = '', subject = '', preview = '' } = {}) {
  await emitCaseNotificationEvent(caseRecord, notificationDomainEvents.CASE_EMAIL_RECEIVED, {
    entityOverrides: {
      fromAddress: String(fromAddress || '').trim(),
      subject: String(subject || '').trim(),
      preview: String(preview || '').slice(0, 200)
    }
  });
}

async function notifyCaseChatMessageReceived(
  caseRecord,
  { authorName = '', preview = '', chatSessionId = null } = {}
) {
  await emitCaseNotificationEvent(caseRecord, notificationDomainEvents.CASE_CHAT_MESSAGE_RECEIVED, {
    entityOverrides: {
      authorName: String(authorName || 'Visitor').trim(),
      preview: String(preview || '').slice(0, 200),
      chatSessionId: chatSessionId ? String(chatSessionId) : null
    }
  });
}

module.exports = {
  notifyCaseEmailReceived,
  notifyCaseChatMessageReceived,
  emitCaseNotificationEvent
};
