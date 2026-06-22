const mongoose = require('mongoose');
const User = require('../models/User');
const LiveChatQueue = require('../models/LiveChatQueue');
const ChatMessage = require('../models/ChatMessage');
const {
  aggregateOperationalMetricsBySessionIds,
  resolveOperationalMetricsForRow,
} = require('./liveChatSessionOperationalService');

function userDisplayName(user) {
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.username
    || user?.email
    || null
  );
}

function mapUserRef(user) {
  if (!user?._id) return null;
  return {
    _id: user._id,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    displayName: userDisplayName(user) || 'Agent',
  };
}

function mapQueueRef(queue) {
  if (!queue?._id) return null;
  return {
    _id: queue._id,
    name: String(queue.name || '').trim() || 'Queue',
  };
}

async function loadQueuesById(queueIds) {
  const ids = [...queueIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();

  const rows = await LiveChatQueue.find({ _id: { $in: ids } })
    .select('_id name')
    .lean();

  return new Map(rows.map((row) => [String(row._id), mapQueueRef(row)]));
}

async function loadUsersById(userIds) {
  const ids = [...userIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();

  const rows = await User.find({ _id: { $in: ids } })
    .select('_id firstName lastName username email')
    .lean();

  return new Map(rows.map((row) => [String(row._id), mapUserRef(row)]));
}

async function loadMessageCountsBySessionId(sessionIds) {
  const ids = sessionIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await ChatMessage.aggregate([
    { $match: { sessionId: { $in: objectIds } } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.count) || 0]));
}

/**
 * Batch-resolve queue, agent, handled-by, and message count for session rows.
 */
async function buildSessionRelationMaps(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return {
      queuesById: new Map(),
      usersById: new Map(),
      messageCountBySessionId: new Map(),
      operationalMetricsBySessionId: new Map(),
    };
  }

  const queueIds = new Set();
  const userIds = new Set();
  const sessionIds = [];

  for (const row of rows) {
    sessionIds.push(row._id);
    if (row.queueId) queueIds.add(String(row.queueId));
    if (row.assignedAgentId) userIds.add(String(row.assignedAgentId));
    if (row.endedByAgentId) userIds.add(String(row.endedByAgentId));
    if (Array.isArray(row.agentsInvolved)) {
      for (const agentId of row.agentsInvolved) {
        if (agentId) userIds.add(String(agentId));
      }
    }
  }

  const [queuesById, usersById, messageCountBySessionId, operationalMetricsBySessionId] = await Promise.all([
    loadQueuesById(queueIds),
    loadUsersById(userIds),
    loadMessageCountsBySessionId(sessionIds),
    aggregateOperationalMetricsBySessionIds(sessionIds),
  ]);

  return { queuesById, usersById, messageCountBySessionId, operationalMetricsBySessionId };
}

function applySessionRelations(row, maps) {
  const queue = row.queueId ? maps.queuesById.get(String(row.queueId)) || null : null;
  const assignedAgent = row.assignedAgentId
    ? maps.usersById.get(String(row.assignedAgentId)) || null
    : null;
  const handledBy = row.endedByAgentId
    ? maps.usersById.get(String(row.endedByAgentId)) || null
    : null;
  const messageCount = maps.messageCountBySessionId.get(String(row._id)) ?? 0;
  const operational = resolveOperationalMetricsForRow(row, maps.operationalMetricsBySessionId || new Map());
  const agentsInvolvedAgents = Array.isArray(row.agentsInvolved)
    ? row.agentsInvolved
      .map((agentId) => maps.usersById.get(String(agentId)) || null)
      .filter(Boolean)
    : [];

  return {
    queue,
    assignedAgent,
    handledBy,
    messageCount,
    agentsInvolvedAgents,
    visitorMessageCount: operational.visitorMessageCount,
    agentMessageCount: operational.agentMessageCount,
    attachmentCount: operational.attachmentCount,
    agentCount: operational.agentCount,
  };
}

module.exports = {
  buildSessionRelationMaps,
  applySessionRelations,
  userDisplayName,
  loadUsersById,
};
