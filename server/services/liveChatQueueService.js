const mongoose = require('mongoose');
const LiveChatQueue = require('../models/LiveChatQueue');

function normalizeQueueKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function mapQueueRow(row) {
  if (!row) return null;
  return {
    _id: row._id,
    queueKey: row.queueKey,
    name: row.name,
    description: row.description || '',
    isDefault: row.isDefault === true,
    enabled: row.enabled !== false,
    order: Number(row.order) || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function clearOtherDefaultQueues(organizationId, exceptId = null) {
  const filter = { organizationId, isDefault: true };
  if (exceptId) filter._id = { $ne: exceptId };
  await LiveChatQueue.updateMany(filter, { $set: { isDefault: false } });
}

async function listQueuesForOrganization(organizationId) {
  const rows = await LiveChatQueue.find({ organizationId })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();
  return rows.map(mapQueueRow);
}

async function getQueueById(organizationId, queueId) {
  if (!mongoose.Types.ObjectId.isValid(queueId)) return null;
  const row = await LiveChatQueue.findOne({ _id: queueId, organizationId }).lean();
  return mapQueueRow(row);
}

async function getDefaultQueue(organizationId) {
  const row = await LiveChatQueue.findOne({
    organizationId,
    enabled: { $ne: false },
    isDefault: true,
  }).lean();
  if (row) return mapQueueRow(row);

  const fallback = await LiveChatQueue.findOne({
    organizationId,
    enabled: { $ne: false },
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  return mapQueueRow(fallback);
}

async function ensureDefaultQueue(organizationId) {
  const existing = await getDefaultQueue(organizationId);
  if (existing) return existing;

  const row = await LiveChatQueue.create({
    organizationId,
    queueKey: 'general',
    name: 'General',
    description: 'Default queue for visitor chats',
    isDefault: true,
    enabled: true,
    order: 0,
  });
  return mapQueueRow(row.toObject ? row.toObject() : row);
}

async function createQueue(organizationId, payload) {
  const queueKey = normalizeQueueKey(payload.queueKey || payload.name);
  if (!queueKey) {
    const err = new Error('queueKey is required');
    err.statusCode = 400;
    throw err;
  }

  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }

  const isDefault = payload.isDefault === true;
  if (isDefault) {
    await clearOtherDefaultQueues(organizationId);
  }

  const row = await LiveChatQueue.create({
    organizationId,
    queueKey,
    name,
    description: String(payload.description || '').trim(),
    isDefault,
    enabled: payload.enabled !== false,
    order: Number(payload.order) || 0,
  });

  return mapQueueRow(row.toObject ? row.toObject() : row);
}

async function updateQueue(organizationId, queueId, payload) {
  const row = await LiveChatQueue.findOne({ _id: queueId, organizationId });
  if (!row) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('name is required');
      err.statusCode = 400;
      throw err;
    }
    row.name = name;
  }

  if (payload.queueKey !== undefined) {
    const queueKey = normalizeQueueKey(payload.queueKey);
    if (!queueKey) {
      const err = new Error('Invalid queueKey');
      err.statusCode = 400;
      throw err;
    }
    row.queueKey = queueKey;
  }

  if (payload.description !== undefined) {
    row.description = String(payload.description || '').trim();
  }

  if (payload.enabled !== undefined) {
    row.enabled = payload.enabled !== false;
  }

  if (payload.order !== undefined) {
    row.order = Number(payload.order) || 0;
  }

  if (payload.isDefault === true) {
    await clearOtherDefaultQueues(organizationId, row._id);
    row.isDefault = true;
  } else if (payload.isDefault === false && row.isDefault) {
    row.isDefault = false;
  }

  await row.save();
  return mapQueueRow(row.toObject());
}

async function deleteQueue(organizationId, queueId) {
  const row = await LiveChatQueue.findOne({ _id: queueId, organizationId }).lean();
  if (!row) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }

  if (row.isDefault) {
    const err = new Error('Cannot delete the default queue');
    err.statusCode = 409;
    throw err;
  }

  await LiveChatQueue.deleteOne({ _id: queueId, organizationId });
  return { deleted: true };
}

module.exports = {
  listQueuesForOrganization,
  getQueueById,
  getDefaultQueue,
  ensureDefaultQueue,
  createQueue,
  updateQueue,
  deleteQueue,
  mapQueueRow,
  normalizeQueueKey,
};
