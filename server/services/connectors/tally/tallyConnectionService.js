'use strict';

const crypto = require('crypto');
const TallyConnection = require('../../../models/TallyConnection');
const TallyAgentBridge = require('../../../models/TallyAgentBridge');

const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

function generatePairingCode() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function createPairingCode({ organizationId, createdBy = null }) {
  if (!organizationId) throw new Error('organizationId required');

  const pairingCode = generatePairingCode();
  const pairingCodeExpiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

  let connection = await TallyConnection.findOne({
    organizationId,
    status: { $in: ['pending_pair', 'paired', 'online', 'offline'] },
    revokedAt: null,
  }).sort({ updatedAt: -1 });

  if (!connection) {
    connection = await TallyConnection.create({
      organizationId,
      status: 'pending_pair',
      pairingCode,
      pairingCodeExpiresAt,
      createdBy,
    });
  } else {
    connection.status = 'pending_pair';
    connection.pairingCode = pairingCode;
    connection.pairingCodeExpiresAt = pairingCodeExpiresAt;
    connection.pairingCompletedAt = null;
    if (createdBy) connection.createdBy = createdBy;
    await connection.save();
  }

  // Master-DB bridge so the Windows agent can complete pairing without a user JWT
  await TallyAgentBridge.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        organizationId,
        connectionId: String(connection._id),
        status: 'pending_pair',
        pairingCode,
        pairingCodeExpiresAt,
        agentTokenHash: null,
        agentDeviceId: null,
      },
    },
    { upsert: true, new: true }
  );

  return {
    connectionId: String(connection._id),
    pairingCode,
    expiresAt: pairingCodeExpiresAt,
  };
}

async function completePairing({
  organizationId = null,
  pairingCode,
  agentDeviceId,
  agentVersion = null,
  agentHostname = null,
  encryptedSecrets = null,
}) {
  if (!pairingCode || !agentDeviceId) {
    throw new Error('pairingCode and agentDeviceId required');
  }

  const query = {
    pairingCode: String(pairingCode).trim().toUpperCase(),
    status: 'pending_pair',
    revokedAt: null,
  };
  if (organizationId) query.organizationId = organizationId;

  const connection = await TallyConnection.findOne(query);
  if (!connection) {
    const err = new Error('Invalid or expired pairing code');
    err.code = 'PAIRING_INVALID';
    throw err;
  }

  if (connection.pairingCodeExpiresAt && connection.pairingCodeExpiresAt.getTime() < Date.now()) {
    const err = new Error('Pairing code expired');
    err.code = 'PAIRING_EXPIRED';
    throw err;
  }

  const agentToken = crypto.randomBytes(32).toString('hex');
  connection.status = 'paired';
  connection.pairingCompletedAt = new Date();
  connection.pairingCode = null;
  connection.pairingCodeExpiresAt = null;
  connection.agentDeviceId = String(agentDeviceId);
  connection.agentVersion = agentVersion || null;
  connection.agentHostname = agentHostname || null;
  connection.agentTokenHash = hashToken(agentToken);
  connection.encryptedSecrets = encryptedSecrets;
  connection.heartbeatAt = new Date();
  connection.lastSeenAt = new Date();
  await connection.save();

  return {
    connection,
    agentToken,
  };
}

async function recordHeartbeat({
  organizationId,
  connectionId = null,
  agentDeviceId = null,
  agentVersion = null,
  metadata = {},
}) {
  const query = { organizationId, revokedAt: null };
  if (connectionId) query._id = connectionId;
  if (agentDeviceId) query.agentDeviceId = String(agentDeviceId);

  const connection = await TallyConnection.findOne(query).sort({ updatedAt: -1 });
  if (!connection) {
    const err = new Error('Tally connection not found');
    err.code = 'CONNECTION_NOT_FOUND';
    throw err;
  }

  connection.heartbeatAt = new Date();
  connection.lastSeenAt = new Date();
  connection.status = 'online';
  if (agentVersion) connection.agentVersion = agentVersion;
  if (metadata && typeof metadata === 'object') {
    connection.metadata = { ...(connection.metadata || {}), ...metadata };
  }
  await connection.save();
  return connection;
}

async function getConnection(organizationId) {
  if (!organizationId) return null;
  return TallyConnection.findOne({
    organizationId,
    revokedAt: null,
  }).sort({ updatedAt: -1 });
}

module.exports = {
  createPairingCode,
  completePairing,
  recordHeartbeat,
  getConnection,
  hashToken,
  PAIRING_CODE_TTL_MS,
};
