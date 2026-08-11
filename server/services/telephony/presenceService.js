'use strict';

const TelephonyAgentPresence = require('../../models/TelephonyAgentPresence');
const telephonySSEHub = require('./telephonySSEHub');

const { PRESENCE_STATUSES } = TelephonyAgentPresence;

async function getPresence(organizationId, userId) {
  let row = await TelephonyAgentPresence.findOne({ organizationId, userId }).lean();
  if (!row) {
    row = {
      organizationId,
      userId,
      status: 'offline',
      lastStatusAt: null,
      currentCallId: null,
    };
  }
  return row;
}

async function setPresence(organizationId, userId, status, { currentCallId = undefined } = {}) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!PRESENCE_STATUSES.includes(normalized)) {
    const err = new Error(`Invalid presence status. Allowed: ${PRESENCE_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const update = {
    status: normalized,
    lastStatusAt: new Date(),
  };
  if (currentCallId !== undefined) {
    update.currentCallId = currentCallId;
  }

  const row = await TelephonyAgentPresence.findOneAndUpdate(
    { organizationId, userId },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  telephonySSEHub.publishToOrg(organizationId, {
    type: 'PresenceChanged',
    userId: String(userId),
    status: normalized,
    currentCallId: row.currentCallId ? String(row.currentCallId) : null,
  });

  return row;
}

async function listAgents(organizationId, { status = null } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  return TelephonyAgentPresence.find(filter).sort({ lastStatusAt: -1 }).lean();
}

module.exports = {
  PRESENCE_STATUSES,
  getPresence,
  setPresence,
  listAgents,
};
