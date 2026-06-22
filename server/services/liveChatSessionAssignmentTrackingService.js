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

  const isTransfer = Boolean(prevStr);
  const isClaim = Boolean(metadata?.claim);
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

  await ChatSession.updateOne({ _id: sessionId }, update);

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
