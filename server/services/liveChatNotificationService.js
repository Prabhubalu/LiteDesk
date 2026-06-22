const { emitNotification } = require('./notificationEngine');
const domainEvents = require('../constants/domainEvents');

async function notifyLiveChatSessionStarted({ organizationId, session, actorId = null }) {
  if (!organizationId || !session?._id) return;

  const sessionKey = String(session.sessionKey || '').trim();
  const visitorName = String(session.visitor?.name || '').trim() || 'Visitor';

  try {
    await emitNotification({
      eventType: domainEvents.LIVE_CHAT_SESSION_STARTED,
      entity: {
        type: 'LiveChatSession',
        id: String(session._id),
        title: sessionKey || visitorName,
        sessionKey,
        authorName: visitorName,
        visitorEmail: String(session.visitor?.email || '').trim(),
      },
      organizationId,
      triggeredBy: actorId,
      sourceAppKey: 'PLATFORM',
    });
  } catch (error) {
    console.error('[liveChatNotificationService] session started notify failed:', error.message);
  }
}

async function notifyLiveChatInboundMessage({ organizationId, session, message, actorId = null }) {
  if (!organizationId || !session?._id || !message) return;

  const visitorName =
    String(message.authorName || '').trim() ||
    String(session.visitor?.name || '').trim() ||
    'Visitor';

  try {
    await emitNotification({
      eventType: domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
      entity: {
        type: 'LiveChatSession',
        id: String(session._id),
        title: String(session.sessionKey || session.visitor?.name || 'Live Chat').trim(),
        sessionKey: String(session.sessionKey || '').trim(),
        authorName: visitorName,
        preview: String(message.body || '').slice(0, 200),
        visitorEmail: String(session.visitor?.email || '').trim(),
      },
      organizationId,
      triggeredBy: actorId,
      sourceAppKey: 'PLATFORM',
    });
  } catch (error) {
    console.error('[liveChatNotificationService] notify failed:', error.message);
  }
}

module.exports = {
  notifyLiveChatSessionStarted,
  notifyLiveChatInboundMessage,
};
