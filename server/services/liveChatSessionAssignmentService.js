const ChatSession = require('../models/ChatSession');
const { runImmediateAssignmentForLiveChatSession } = require('./assignmentExecutionService');
const { getDefaultQueue, getQueueById } = require('./liveChatQueueService');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');
const {
  LIVE_CHAT_ASSIGNED_BY,
  applySessionAgentAssignment,
} = require('./liveChatSessionAssignmentTrackingService');
const { canAdminLiveChat } = require('../utils/liveChatPermissionUtils');

async function loadSessionScoped(sessionId, organizationId, { asDocument = false } = {}) {
  const scope = buildChatSessionScopeFilter(organizationId);
  const query = ChatSession.findOne({ _id: sessionId, ...scope });
  return asDocument ? query : query.lean();
}

async function resolveQueueForSession(organizationId, session) {
  if (session?.queueId) {
    const queue = await getQueueById(organizationId, session.queueId);
    if (queue && queue.enabled !== false) return queue;
  }
  return getDefaultQueue(organizationId);
}

/**
 * Assign a waiting session via Automation → Assignment Rules (PLATFORM / live_chat_sessions).
 */
async function assignWaitingSession({ organizationId, sessionId, triggeredBy = null }) {
  if (!organizationId || !sessionId) {
    return { assigned: false, reason: 'invalid_input' };
  }

  const session = await loadSessionScoped(sessionId, organizationId, { asDocument: true });
  if (!session || String(session.status || '') === 'closed') {
    return { assigned: false, reason: 'session_not_found' };
  }

  if (session.assignedAgentId) {
    return { assigned: false, reason: 'already_assigned' };
  }

  const queue = await resolveQueueForSession(organizationId, session);
  if (queue?._id && String(session.queueId || '') !== String(queue._id)) {
    session.queueId = queue._id;
    session.updatedAt = new Date();
    await session.save();
  }

  if (!session.organizationId) {
    session.organizationId = organizationId;
  }

  const result = await runImmediateAssignmentForLiveChatSession({
    sessionRecord: session,
    triggeredBy,
    triggerSource: 'immediate',
    changedFields: [],
  });

  return {
    assigned: Boolean(result.assigned),
    reason: result.reason || (result.assigned ? 'assigned' : 'not_assigned'),
    agentId: result.agentId || result.newOwnerId || null,
    queueId: result.queueId || session.queueId || queue?._id || null,
    ruleId: result.ruleId || null,
    outcome: result.outcome || null,
  };
}

async function claimSessionForAgent({ organizationId, sessionId, agentId }) {
  if (!organizationId || !sessionId || !agentId) {
    const err = new Error('Invalid claim request');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionScoped(sessionId, organizationId);
  if (!session || String(session.status || '') === 'closed') {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }

  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  const claimerId = String(agentId);
  if (assignedId && assignedId !== claimerId) {
    const err = new Error('Session is already assigned to another agent');
    err.statusCode = 409;
    throw err;
  }

  if (assignedId === claimerId) {
    return {
      claimed: true,
      sessionId: session._id,
      agentId: claimerId,
      lifecycleStatus: session.lifecycleStatus || 'assigned',
    };
  }

  const lifecycleStatus = session.lastMessageAt ? 'active' : 'assigned';
  const assignmentResult = await applySessionAgentAssignment({
    organizationId,
    sessionId: session._id,
    agentId,
    assignedBy: LIVE_CHAT_ASSIGNED_BY.MANUAL,
    performedByUserId: agentId,
    lifecycleStatus,
    metadata: { claim: true },
  });

  if (!assignmentResult.applied && assignmentResult.reason !== 'already_assigned') {
    const err = new Error(
      assignmentResult.reason === 'assignment_conflict'
        ? 'Session is already assigned to another agent'
        : 'Failed to claim session',
    );
    err.statusCode = 409;
    throw err;
  }

  return {
    claimed: true,
    sessionId: session._id,
    agentId: claimerId,
    lifecycleStatus,
  };
}

async function transferSessionToAgent({
  organizationId,
  sessionId,
  toAgentId,
  performedByUserId,
  isSupervisor = false,
}) {
  if (!organizationId || !sessionId || !toAgentId || !performedByUserId) {
    const err = new Error('Invalid transfer request');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionScoped(sessionId, organizationId);
  if (!session || String(session.status || '') === 'closed') {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }

  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  const performerId = String(performedByUserId);
  const targetId = String(toAgentId);

  if (!assignedId) {
    const err = new Error('Session is not assigned');
    err.statusCode = 409;
    throw err;
  }
  if (assignedId === targetId) {
    const err = new Error('Session is already assigned to this agent');
    err.statusCode = 409;
    throw err;
  }
  if (!isSupervisor && assignedId !== performerId) {
    const err = new Error('Only the assigned agent or a supervisor can transfer this session');
    err.statusCode = 403;
    throw err;
  }

  const lifecycleStatus = session.lastMessageAt ? 'active' : 'assigned';
  const assignmentResult = await applySessionAgentAssignment({
    organizationId,
    sessionId: session._id,
    agentId: toAgentId,
    assignedBy: isSupervisor ? LIVE_CHAT_ASSIGNED_BY.SUPERVISOR : LIVE_CHAT_ASSIGNED_BY.MANUAL,
    performedByUserId,
    previousAgentId: session.assignedAgentId,
    lifecycleStatus,
    metadata: { transfer: true },
  });

  if (!assignmentResult.applied) {
    const err = new Error('Failed to transfer session');
    err.statusCode = 409;
    throw err;
  }

  return {
    transferred: true,
    sessionId: session._id,
    agentId: targetId,
    previousAgentId: assignedId,
    lifecycleStatus,
  };
}

function canTransferSession(user, session) {
  if (!user || !session) return false;
  if (canAdminLiveChat(user)) return true;
  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  return assignedId && assignedId === String(user._id);
}

/**
 * Enforce single-agent ownership for handle actions.
 * Unassigned sessions are claimed atomically by the acting agent.
 */
async function ensureAgentOwnsOrClaimsSession({ organizationId, sessionId, agentId }) {
  if (!organizationId || !sessionId || !agentId) {
    const err = new Error('Invalid session ownership request');
    err.statusCode = 400;
    throw err;
  }

  const session = await loadSessionScoped(sessionId, organizationId);
  if (!session || String(session.status || '') === 'closed') {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }

  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  const actorId = String(agentId);

  if (assignedId && assignedId !== actorId) {
    const err = new Error('Session is assigned to another agent');
    err.statusCode = 403;
    throw err;
  }

  if (!assignedId) {
    await claimSessionForAgent({ organizationId, sessionId, agentId });
  }

  return session;
}

/** Block mutate/typing when another agent already owns the session. */
function assertAgentNotBlockedByAssignment(session, agentId) {
  if (!session || !agentId) return;
  const assignedId = session.assignedAgentId ? String(session.assignedAgentId) : '';
  if (assignedId && assignedId !== String(agentId)) {
    const err = new Error('Session is assigned to another agent');
    err.statusCode = 403;
    throw err;
  }
}

async function bindSessionToDefaultQueue({ organizationId, sessionId }) {
  const queue = await getDefaultQueue(organizationId);
  if (!queue?._id) return null;

  await ChatSession.updateOne(
    { _id: sessionId },
    { $set: { queueId: queue._id, updatedAt: new Date() } },
  );

  return queue._id;
}

module.exports = {
  assignWaitingSession,
  claimSessionForAgent,
  transferSessionToAgent,
  canTransferSession,
  ensureAgentOwnsOrClaimsSession,
  assertAgentNotBlockedByAssignment,
  bindSessionToDefaultQueue,
  resolveQueueForSession,
};
