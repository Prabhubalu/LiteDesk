const LiveChatAgentPresence = require('../models/LiveChatAgentPresence');
const { PRESENCE_STATUSES } = require('../models/LiveChatAgentPresence');

function normalizePresenceStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return PRESENCE_STATUSES.includes(status) ? status : null;
}

function mapPresenceRow(row) {
  if (!row) return null;
  return {
    userId: row.userId,
    status: row.status || 'offline',
    updatedAt: row.updatedAt,
  };
}

async function getPresenceForUser(organizationId, userId) {
  const row = await LiveChatAgentPresence.findOne({ organizationId, userId }).lean();
  return mapPresenceRow(row) || { userId, status: 'offline', updatedAt: null };
}

async function setPresenceForUser(organizationId, userId, status) {
  const normalized = normalizePresenceStatus(status);
  if (!normalized) {
    const err = new Error('Invalid presence status');
    err.statusCode = 400;
    throw err;
  }

  const row = await LiveChatAgentPresence.findOneAndUpdate(
    { organizationId, userId },
    { $set: { status: normalized, updatedAt: new Date() } },
    { upsert: true, new: true },
  ).lean();

  return mapPresenceRow(row);
}

async function listOnlineUserIds(organizationId, candidateUserIds = []) {
  const ids = (Array.isArray(candidateUserIds) ? candidateUserIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  if (!ids.length) return [];

  const rows = await LiveChatAgentPresence.find({
    organizationId,
    userId: { $in: ids },
  })
    .select('userId status')
    .lean();

  const statusByUser = new Map(rows.map((row) => [String(row.userId), row.status]));

  return ids.filter((id) => {
    const status = statusByUser.get(id);
    if (!status) return true;
    return status === 'online' || status === 'busy';
  });
}

module.exports = {
  getPresenceForUser,
  setPresenceForUser,
  listOnlineUserIds,
  normalizePresenceStatus,
  PRESENCE_STATUSES,
};
