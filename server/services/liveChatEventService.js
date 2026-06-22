const { emit: emitDomainEvent } = require('./domainEvents');
const domainEvents = require('../constants/domainEvents');

function emitLiveChatDomainEvent({
  organizationId,
  sessionId,
  eventType,
  triggeredBy = null,
  metadata = {},
  currentState = null,
}) {
  try {
    emitDomainEvent({
      entityType: 'live_chat_session',
      entityId: String(sessionId),
      eventType,
      appKey: 'PLATFORM',
      organizationId,
      triggeredBy,
      metadata,
      currentState: currentState || metadata,
    });
  } catch (err) {
    console.warn('[liveChatEventService] emit failed', {
      eventType,
      sessionId: String(sessionId),
      error: err?.message,
    });
  }
}

function emitSessionStarted({ organizationId, sessionId, metadata }) {
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_STARTED,
    metadata,
  });
}

function emitMessageReceived({ organizationId, sessionId, messageId, direction, metadata }) {
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
    metadata: {
      messageId: String(messageId),
      direction,
      ...metadata,
    },
  });
}

function emitSessionEnded({
  organizationId,
  sessionId,
  outcome,
  sessionKey = null,
  triggeredBy = null,
  metadata = {},
}) {
  const normalizedOutcome = String(outcome || '').trim();
  const sessionRef = {
    sessionId: String(sessionId),
    sessionKey: sessionKey ? String(sessionKey) : null,
    outcome: normalizedOutcome || null,
  };

  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_ENDED,
    triggeredBy,
    metadata: {
      ...sessionRef,
      ...metadata,
    },
    currentState: sessionRef,
  });

  if (normalizedOutcome) {
    emitLiveChatDomainEvent({
      organizationId,
      sessionId,
      eventType: domainEvents.LIVE_CHAT_OUTCOME_SET,
      triggeredBy,
      metadata: {
        ...sessionRef,
        ...metadata,
      },
      currentState: sessionRef,
    });
  }
}

function emitSessionAssigned({
  organizationId,
  sessionId,
  agentId,
  queueId = null,
  triggeredBy = null,
  metadata = {},
}) {
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_ASSIGNED,
    triggeredBy,
    metadata: {
      agentId: agentId ? String(agentId) : null,
      queueId: queueId ? String(queueId) : null,
      ...metadata,
    },
  });
}

module.exports = {
  emitSessionStarted,
  emitMessageReceived,
  emitSessionEnded,
  emitSessionAssigned,
};
