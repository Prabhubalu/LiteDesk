'use strict';

/**
 * Unauthenticated agent endpoints (pairing code / agent token).
 * Mounted at /api/connectors/tally/agent — must NOT use user JWT middleware.
 */

const express = require('express');
const tallyConnectionService = require('../services/connectors/tally/tallyConnectionService');
const { handleAgentRpc } = require('../services/connectors/tally/tallyAgentProtocol');
const {
  claimJobsForAgent,
  acknowledgeAgentJob,
} = require('../services/connectors/tally/tallyAgentJobService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const TallyAgentBridge = require('../models/TallyAgentBridge');

const router = express.Router();

/**
 * POST /pair
 * Body: { pairingCode, agentDeviceId, agentVersion?, agentHostname? }
 */
router.post('/pair', async (req, res) => {
  try {
    const { pairingCode, agentDeviceId, agentVersion, agentHostname } = req.body || {};
    if (!pairingCode || !agentDeviceId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'pairingCode and agentDeviceId are required',
      });
    }

    const code = String(pairingCode).trim().toUpperCase();
    const bridge = await TallyAgentBridge.findOne({
      pairingCode: code,
      status: 'pending_pair',
    });

    if (!bridge) {
      return res.status(400).json({
        success: false,
        code: 'PAIRING_INVALID',
        message: 'Invalid or expired pairing code. Generate a new code in Arivu and try again.',
      });
    }

    if (bridge.pairingCodeExpiresAt && bridge.pairingCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        code: 'PAIRING_EXPIRED',
        message: 'Pairing code expired. Generate a new code in Arivu.',
      });
    }

    const result = await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      tallyConnectionService.completePairing({
        organizationId: bridge.organizationId,
        pairingCode: code,
        agentDeviceId,
        agentVersion,
        agentHostname,
      })
    );

    const { connection, agentToken } = result;

    bridge.status = 'paired';
    bridge.connectionId = String(connection._id);
    bridge.pairingCode = null;
    bridge.pairingCodeExpiresAt = null;
    bridge.agentDeviceId = String(agentDeviceId);
    bridge.agentTokenHash = tallyConnectionService.hashToken(agentToken);
    bridge.agentHostname = agentHostname || null;
    bridge.agentVersion = agentVersion || null;
    bridge.lastSeenAt = new Date();
    await bridge.save();

    return res.json({
      success: true,
      data: {
        connectionId: String(connection._id),
        organizationId: String(bridge.organizationId),
        status: connection.status,
        agentToken,
      },
    });
  } catch (error) {
    const status =
      error.code === 'PAIRING_INVALID' || error.code === 'PAIRING_EXPIRED' ? 400 : 500;
    console.error('[tallyAgent] pair', error);
    return res.status(status).json({
      success: false,
      message: error.message || 'Pairing failed',
      code: error.code,
    });
  }
});

async function resolveBridgeFromAgentToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : String(req.body?.agentToken || '').trim();
  if (!token) {
    const err = new Error('Agent token required (Authorization: Bearer …)');
    err.code = 'AGENT_UNAUTHORIZED';
    throw err;
  }
  const hash = tallyConnectionService.hashToken(token);
  const bridge = await TallyAgentBridge.findOne({
    agentTokenHash: hash,
    status: { $in: ['paired', 'online', 'offline'] },
  });
  if (!bridge) {
    const err = new Error('Invalid agent token');
    err.code = 'AGENT_UNAUTHORIZED';
    throw err;
  }
  return { bridge, token };
}

router.post('/heartbeat', async (req, res) => {
  try {
    const { bridge } = await resolveBridgeFromAgentToken(req);
    const { agentVersion, metadata } = req.body || {};

    const connection = await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      tallyConnectionService.recordHeartbeat({
        organizationId: bridge.organizationId,
        connectionId: bridge.connectionId,
        agentDeviceId: bridge.agentDeviceId,
        agentVersion,
        metadata,
      })
    );

    bridge.status = 'online';
    bridge.lastSeenAt = new Date();
    if (agentVersion) bridge.agentVersion = agentVersion;
    await bridge.save();

    return res.json({
      success: true,
      data: {
        connectionId: String(connection._id),
        status: connection.status,
        heartbeatAt: connection.heartbeatAt,
      },
    });
  } catch (error) {
    const status = error.code === 'AGENT_UNAUTHORIZED' ? 401 : 500;
    console.error('[tallyAgent] heartbeat', error);
    return res.status(status).json({
      success: false,
      message: error.message || 'Heartbeat failed',
      code: error.code,
    });
  }
});

router.post('/poll', async (req, res) => {
  try {
    const { bridge } = await resolveBridgeFromAgentToken(req);
    const limit = Math.min(parseInt(req.body?.limit || '5', 10) || 5, 20);

    // Touch connection on every poll so UI doesn't show false "stale" when agent is active
    await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      tallyConnectionService.recordHeartbeat({
        organizationId: bridge.organizationId,
        connectionId: bridge.connectionId,
        agentDeviceId: bridge.agentDeviceId,
        agentVersion: req.body?.agentVersion,
        metadata: { source: 'poll' },
      })
    ).catch(() => {});

    bridge.status = 'online';
    bridge.lastSeenAt = new Date();
    await bridge.save().catch(() => {});

    const jobs = await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      claimJobsForAgent({ organizationId: bridge.organizationId, limit })
    );
    return res.json({ success: true, data: { jobs } });
  } catch (error) {
    const status = error.code === 'AGENT_UNAUTHORIZED' ? 401 : 500;
    console.error('[tallyAgent] poll', error);
    return res.status(status).json({ success: false, message: error.message, code: error.code });
  }
});

router.post('/ack', async (req, res) => {
  try {
    const { bridge } = await resolveBridgeFromAgentToken(req);
    const { jobId, status, result, error: jobError } = req.body || {};
    const data = await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      acknowledgeAgentJob({
        organizationId: bridge.organizationId,
        connectionId: bridge.connectionId,
        jobId,
        status,
        result,
        error: jobError,
      })
    );
    return res.json({ success: true, data: { acked: true, ...data } });
  } catch (error) {
    const status =
      error.code === 'AGENT_UNAUTHORIZED' ? 401 : error.code === 'JOB_NOT_FOUND' ? 404 : 500;
    console.error('[tallyAgent] ack', error);
    return res.status(status).json({ success: false, message: error.message, code: error.code });
  }
});

router.post('/rpc', async (req, res) => {
  try {
    const { bridge } = await resolveBridgeFromAgentToken(req);
    const message = {
      ...(req.body || {}),
      organizationId: bridge.organizationId,
    };
    const result = await runWithOrganizationTenantContext(bridge.organizationId, async () =>
      handleAgentRpc(message)
    );
    return res.status(result.ok ? 200 : 400).json({ success: result.ok, data: result });
  } catch (error) {
    const status = error.code === 'AGENT_UNAUTHORIZED' ? 401 : 500;
    return res.status(status).json({ success: false, message: error.message, code: error.code });
  }
});

module.exports = router;
