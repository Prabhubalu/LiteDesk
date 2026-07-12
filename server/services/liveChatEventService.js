const { emit: emitDomainEvent } = require('./domainEvents');
const domainEvents = require('../constants/domainEvents');

function emitLiveChatDomainEvent({
  organizationId,
  sessionId,
  eventType,
  triggeredBy = null,
  metadata = {},
  currentState = null,
  previousState = null,
  changedFields = []
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
      previousState,
      currentState: currentState || metadata,
      changedFields
    });
  } catch (err) {
    console.warn('[liveChatEventService] emit failed', {
      eventType,
      sessionId: String(sessionId),
      error: err?.message
    });
  }
}

/** Core Process Designer record_* triggers use live_chat_session.created|updated */
function emitLiveChatLifecycle({
  organizationId,
  sessionId,
  kind,
  triggeredBy = null,
  currentState = null,
  previousState = null,
  changedFields = []
}) {
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: kind === 'created' ? 'live_chat_session.created' : 'live_chat_session.updated',
    triggeredBy,
    previousState,
    currentState,
    changedFields: kind === 'created' ? [] : changedFields
  });
}

function emitSessionStarted({ organizationId, sessionId, metadata }) {
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_STARTED,
    metadata
  });
  emitLiveChatLifecycle({
    organizationId,
    sessionId,
    kind: 'created',
    currentState: metadata || { status: 'started' }
  });
}

function emitMessageReceived({ organizationId, sessionId, messageId, direction, metadata }) {
  const state = {
    messageId: String(messageId),
    direction,
    ...metadata
  };
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
    metadata: state
  });
  emitLiveChatLifecycle({
    organizationId,
    sessionId,
    kind: 'updated',
    currentState: state,
    changedFields: ['message', 'direction']
  });
}

function emitSessionEnded({
  organizationId,
  sessionId,
  outcome,
  sessionKey = null,
  triggeredBy = null,
  metadata = {}
}) {
  const normalizedOutcome = String(outcome || '').trim();
  const sessionRef = {
    sessionId: String(sessionId),
    sessionKey: sessionKey ? String(sessionKey) : null,
    outcome: normalizedOutcome || null
  };

  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_ENDED,
    triggeredBy,
    metadata: {
      ...sessionRef,
      ...metadata
    },
    currentState: sessionRef
  });

  if (normalizedOutcome) {
    emitLiveChatDomainEvent({
      organizationId,
      sessionId,
      eventType: domainEvents.LIVE_CHAT_OUTCOME_SET,
      triggeredBy,
      metadata: {
        ...sessionRef,
        ...metadata
      },
      currentState: sessionRef
    });
  }

  emitLiveChatLifecycle({
    organizationId,
    sessionId,
    kind: 'updated',
    triggeredBy,
    currentState: sessionRef,
    changedFields: ['status', 'outcome']
  });
}

function emitSessionAssigned({
  organizationId,
  sessionId,
  agentId,
  queueId = null,
  triggeredBy = null,
  metadata = {}
}) {
  const state = {
    agentId: agentId ? String(agentId) : null,
    queueId: queueId ? String(queueId) : null,
    ...metadata
  };
  emitLiveChatDomainEvent({
    organizationId,
    sessionId,
    eventType: domainEvents.LIVE_CHAT_SESSION_ASSIGNED,
    triggeredBy,
    metadata: state
  });
  emitLiveChatLifecycle({
    organizationId,
    sessionId,
    kind: 'updated',
    triggeredBy,
    currentState: state,
    changedFields: ['assignedTo', 'agentId', 'queueId']
  });
}

module.exports = {
  emitSessionStarted,
  emitMessageReceived,
  emitSessionEnded,
  emitSessionAssigned
};
