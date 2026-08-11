'use strict';

const mongoose = require('mongoose');
const TelephonyQueue = require('../../models/TelephonyQueue');
const TelephonyAgentPresence = require('../../models/TelephonyAgentPresence');
const TelephonyCall = require('../../models/TelephonyCall');
const telephonySSEHub = require('./telephonySSEHub');

const { STRATEGIES } = TelephonyQueue;

async function ensureDefaultQueue(organizationId) {
  let row = await TelephonyQueue.findOne({
    organizationId,
    isDefault: true,
    enabled: { $ne: false },
  });
  if (row) return row.toObject ? row.toObject() : row;

  row = await TelephonyQueue.findOne({ organizationId, enabled: { $ne: false } }).sort({
    priority: -1,
    createdAt: 1,
  });
  if (row) {
    row.isDefault = true;
    await row.save();
    return row.toObject ? row.toObject() : row;
  }

  row = await TelephonyQueue.create({
    organizationId,
    name: 'Default',
    strategy: 'round_robin',
    isDefault: true,
    enabled: true,
    priority: 0,
    skills: [],
  });
  return row.toObject ? row.toObject() : row;
}

async function listQueues(organizationId) {
  return TelephonyQueue.find({ organizationId }).sort({ priority: -1, name: 1 }).lean();
}

async function createQueue(organizationId, payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  const strategy = STRATEGIES.includes(payload.strategy) ? payload.strategy : 'round_robin';
  if (payload.isDefault === true) {
    await TelephonyQueue.updateMany(
      { organizationId, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
  const row = await TelephonyQueue.create({
    organizationId,
    name,
    strategy,
    overflowQueueId: payload.overflowQueueId || null,
    businessHours: payload.businessHours || null,
    skills: Array.isArray(payload.skills) ? payload.skills : [],
    priority: Number(payload.priority) || 0,
    isDefault: payload.isDefault === true,
    enabled: payload.enabled !== false,
  });
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'QueueUpdated',
    queueId: String(row._id),
    action: 'created',
  });
  return row;
}

async function updateQueue(organizationId, queueId, payload = {}) {
  if (!mongoose.Types.ObjectId.isValid(queueId)) {
    const err = new Error('Invalid queue id');
    err.statusCode = 400;
    throw err;
  }
  const row = await TelephonyQueue.findOne({ _id: queueId, organizationId });
  if (!row) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }
  if (payload.name != null) row.name = String(payload.name).trim();
  if (payload.strategy && STRATEGIES.includes(payload.strategy)) row.strategy = payload.strategy;
  if (payload.overflowQueueId !== undefined) row.overflowQueueId = payload.overflowQueueId;
  if (payload.businessHours !== undefined) row.businessHours = payload.businessHours;
  if (Array.isArray(payload.skills)) row.skills = payload.skills;
  if (payload.priority != null) row.priority = Number(payload.priority) || 0;
  if (payload.enabled != null) row.enabled = payload.enabled !== false;
  if (payload.isDefault === true) {
    await TelephonyQueue.updateMany(
      { organizationId, isDefault: true, _id: { $ne: queueId } },
      { $set: { isDefault: false } }
    );
    row.isDefault = true;
  }
  await row.save();
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'QueueUpdated',
    queueId: String(row._id),
    action: 'updated',
  });
  return row;
}

async function pickAgent(organizationId, queueId = null) {
  let queue = null;
  if (queueId && mongoose.Types.ObjectId.isValid(queueId)) {
    queue = await TelephonyQueue.findOne({ _id: queueId, organizationId, enabled: { $ne: false } });
  }
  if (!queue) {
    const def = await ensureDefaultQueue(organizationId);
    queue = await TelephonyQueue.findById(def._id);
  }

  const idleAgents = await TelephonyAgentPresence.find({
    organizationId,
    status: 'idle',
  })
    .sort({ lastStatusAt: 1 })
    .lean();

  if (!idleAgents.length) return null;

  const strategy = queue.strategy || 'round_robin';
  let selected = null;

  if (strategy === 'longest_idle') {
    selected = idleAgents[0];
  } else if (strategy === 'least_calls') {
    let minCalls = Infinity;
    for (const agent of idleAgents) {
      const count = await TelephonyCall.countDocuments({
        organizationId,
        agentUserId: agent.userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      if (count < minCalls) {
        minCalls = count;
        selected = agent;
      }
    }
  } else {
    // round_robin / priority / skill_based fallback
    const lastUserId = queue.lastAssignedUserId ? String(queue.lastAssignedUserId) : null;
    if (!lastUserId) {
      selected = idleAgents[0];
    } else {
      const idx = idleAgents.findIndex((a) => String(a.userId) === lastUserId);
      selected = idleAgents[(idx + 1) % idleAgents.length];
    }
  }

  if (selected) {
    queue.lastAssignedAt = new Date();
    queue.lastAssignedUserId = selected.userId;
    await queue.save();
  }

  return selected;
}

module.exports = {
  STRATEGIES,
  ensureDefaultQueue,
  listQueues,
  createQueue,
  updateQueue,
  pickAgent,
};
