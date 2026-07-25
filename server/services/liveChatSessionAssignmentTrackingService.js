'use strict';

const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const LiveChatSessionAssignmentEvent = require('../models/LiveChatSessionAssignmentEvent');
const {
  LIVE_CHAT_ASSIGNED_BY,
  LIVE_CHAT_ASSIGNMENT_ACTIONS,
  normalizeAssignedBy,
} = require('../constants/liveChatSessionAssignment');
const { emitSessionAssigned } = require('./liveChatEventService');

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function resolveAssignmentAction({ isTransfer, isClaim }) {
  if (isTransfer) return LIVE_CHAT_ASSIGNMENT_ACTIONS.TRANSFERRED;
  if (isClaim) return LIVE_CHAT_ASSIGNMENT_ACTIONS.CLAIMED;
  return LIVE_CHAT_ASSIGNMENT_ACTIONS.ASSIGNED;
}

/**
 * Persist agent assignment on session and append assignment history event.
 */
async function applySessionAgentAssignment({
  organizationId,
  sessionId,
  agentId,
  assignedBy,
  performedByUserId = null,
  previousAgentId = null,
  lifecycleStatus = null,
  metadata = {},
}) {
  if (!organizationId || !sessionId || !agentId) {
    return { applied: false, reason: 'invalid_input' };
  }

  const normalizedAssignedBy = normalizeAssignedBy(assignedBy);
  if (!normalizedAssignedBy) {
    return { applied: false, reason: 'invalid_assigned_by' };
  }

  const agentObjectId = toObjectId(agentId);
  if (!agentObjectId) {
    return { applied: false, reason: 'invalid_agent' };
  }

  const session = await ChatSession.findById(sessionId)
    .select('assignedAgentId agentsInvolved transferCount queueId lifecycleStatus status')
    .lean();
  if (!session || String(session.status || '') === 'closed') {
    return { applied: false, reason: 'session_not_found' };
  }

  const prevId = previousAgentId || session.assignedAgentId;
  const prevStr = prevId ? String(prevId) : '';
  const nextStr = String(agentObjectId);
  if (prevStr === nextStr) {
    return { applied: false, reason: 'already_assigned', agentId: nextStr };
  }

  // Queue routing must never steal ownership from an agent who already claimed/replied.
  const claimOnly =
    Boolean(metadata?.claimOnly)
    || normalizedAssignedBy === LIVE_CHAT_ASSIGNED_BY.QUEUE_ROUTING;
  if (claimOnly && prevStr) {
    return { applied: false, reason: 'assignment_conflict', agentId: prevStr };
  }

  const isTransfer = !claimOnly && Boolean(prevStr);
  const isClaim = Boolean(metadata?.claim) || claimOnly || !prevStr;
  const now = new Date();
  const agentsToAdd = [agentObjectId];
  const prevObjectId = toObjectId(prevId);
  if (isTransfer && prevObjectId) {
    agentsToAdd.push(prevObjectId);
  }

  const setFields = {
    assignedAgentId: agentObjectId,
    assignedAt: now,
    assignedBy: normalizedAssignedBy,
    updatedAt: now,
  };
  if (lifecycleStatus) {
    setFields.lifecycleStatus = lifecycleStatus;
  }

  const update = {
    $set: setFields,
    $addToSet: { agentsInvolved: { $each: agentsToAdd } },
  };
  if (isTransfer) {
    update.$inc = { transferCount: 1 };
  }

  // Atomic ownership change: claim only when unassigned; transfer only from expected owner.
  const filter = {
    _id: sessionId,
    status: { $ne: 'closed' },
  };
  if (isTransfer) {
    filter.assignedAgentId = prevObjectId;
  } else {
    filter.$or = [{ assignedAgentId: null }, { assignedAgentId: { $exists: false } }];
  }

  const updated = await ChatSession.findOneAndUpdate(filter, update, { new: true })
    .select('_id')
    .lean();
  if (!updated) {
    const current = await ChatSession.findById(sessionId)
      .select('assignedAgentId status')
      .lean();
    if (!current || String(current.status || '') === 'closed') {
      return { applied: false, reason: 'session_not_found' };
    }
    if (String(current.assignedAgentId || '') === nextStr) {
      return { applied: false, reason: 'already_assigned', agentId: nextStr };
    }
    return { applied: false, reason: 'assignment_conflict' };
  }

  const action = resolveAssignmentAction({ isTransfer, isClaim });
  await LiveChatSessionAssignmentEvent.create({
    organizationId,
    sessionId,
    action,
    agentId: agentObjectId,
    previousAgentId: prevObjectId,
    performedByUserId: toObjectId(performedByUserId),
    assignedBy: normalizedAssignedBy,
    metadata,
  });

  emitSessionAssigned({
    organizationId,
    sessionId,
    agentId: agentObjectId,
    queueId: session.queueId || null,
    triggeredBy: performedByUserId || null,
    metadata: {
      assignedBy: normalizedAssignedBy,
      action,
      previousAgentId: prevStr || null,
      ...metadata,
    },
  });

  return {
    applied: true,
    agentId: nextStr,
    previousAgentId: prevStr || null,
    isTransfer,
    action,
  };
}

async function recordFirstAgentResponse({ sessionId }) {
  if (!sessionId) return { recorded: false };

  const now = new Date();
  const result = await ChatSession.updateOne(
    { _id: sessionId, firstResponseAt: null },
    { $set: { firstResponseAt: now, updatedAt: now } },
  );

  return { recorded: result.modifiedCount > 0 };
}

async function listAssignmentEventsForSession({ organizationId, sessionId, limit = 50 }) {
  if (!organizationId || !sessionId) return [];

  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return LiveChatSessionAssignmentEvent.find({ organizationId, sessionId })
    .sort({ createdAt: -1 })
    .limit(cappedLimit)
    .lean();
}

module.exports = {
  LIVE_CHAT_ASSIGNED_BY,
  applySessionAgentAssignment,
  recordFirstAgentResponse,
  listAssignmentEventsForSession,
};
