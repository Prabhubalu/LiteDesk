'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const tallyConnectionService = require('../services/connectors/tally/tallyConnectionService');
const { handleAgentRpc } = require('../services/connectors/tally/tallyAgentProtocol');
const { enqueueTallySyncJob } = require('../services/connectors/tally/tallySyncQueueService');
const { getTallyConnectorAdapter } = require('../services/connectors/tally/tallyConnectorAdapterRegistry');
const { reconcileGodownBalances } = require('../services/connectors/tally/tallyInventorySyncService');
const ConnectorSyncJob = require('../models/ConnectorSyncJob');
const ConnectorConflict = require('../models/ConnectorConflict');
const TallyCompanyBinding = require('../models/TallyCompanyBinding');
const { CONNECTOR_KEYS, CONFLICT_STATUSES } = require('../services/connectors/connectorConstants');

const router = express.Router();

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(requireAddonEntitlement(ADDON_KEYS.TALLY));

router.post('/pair/start', async (req, res) => {
  try {
    const data = await tallyConnectionService.createPairingCode({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] pair/start', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to start pairing' });
  }
});

router.post('/pair/complete', async (req, res) => {
  try {
    const { pairingCode, agentDeviceId, agentVersion, agentHostname, encryptedSecrets } = req.body || {};
    const { connection, agentToken } = await tallyConnectionService.completePairing({
      organizationId: req.user.organizationId,
      pairingCode,
      agentDeviceId,
      agentVersion,
      agentHostname,
      encryptedSecrets,
    });
    return res.json({
      success: true,
      data: {
        connectionId: String(connection._id),
        status: connection.status,
        agentToken,
      },
    });
  } catch (error) {
    const status = error.code === 'PAIRING_INVALID' || error.code === 'PAIRING_EXPIRED' ? 400 : 500;
    console.error('[tallyConnector] pair/complete', error);
    return res.status(status).json({ success: false, message: error.message || 'Pairing failed', code: error.code });
  }
});

router.get('/connection', async (req, res) => {
  try {
    const connection = await tallyConnectionService.getConnection(req.user.organizationId);
    const bindings = connection
      ? await TallyCompanyBinding.find({
        organizationId: req.user.organizationId,
        connectionId: connection._id,
      }).lean()
      : [];
    return res.json({
      success: true,
      data: {
        connection: connection
          ? {
            id: String(connection._id),
            status: connection.status,
            agentVersion: connection.agentVersion,
            agentHostname: connection.agentHostname,
            heartbeatAt: connection.heartbeatAt,
            lastSeenAt: connection.lastSeenAt,
            pairingCompletedAt: connection.pairingCompletedAt,
          }
          : null,
        companies: bindings,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] connection', error);
    return res.status(500).json({ success: false, message: 'Failed to load connection' });
  }
});

router.post('/agent/heartbeat', async (req, res) => {
  try {
    const { connectionId, agentDeviceId, agentVersion, metadata } = req.body || {};
    const connection = await tallyConnectionService.recordHeartbeat({
      organizationId: req.user.organizationId,
      connectionId,
      agentDeviceId,
      agentVersion,
      metadata,
    });
    return res.json({
      success: true,
      data: {
        connectionId: String(connection._id),
        status: connection.status,
        heartbeatAt: connection.heartbeatAt,
      },
    });
  } catch (error) {
    const status = error.code === 'CONNECTION_NOT_FOUND' ? 404 : 500;
    console.error('[tallyConnector] agent/heartbeat', error);
    return res.status(status).json({ success: false, message: error.message || 'Heartbeat failed', code: error.code });
  }
});

router.post('/agent/rpc', async (req, res) => {
  try {
    const message = {
      ...(req.body || {}),
      organizationId: req.user.organizationId,
    };
    const result = await handleAgentRpc(message);
    const status = result.ok ? 200 : 400;
    return res.status(status).json({ success: result.ok, data: result });
  } catch (error) {
    console.error('[tallyConnector] agent/rpc', error);
    return res.status(500).json({ success: false, message: error.message || 'Agent RPC failed' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const connection = await tallyConnectionService.getConnection(organizationId);
    const [openConflicts, queuedJobs, companyCount] = await Promise.all([
      ConnectorConflict.countDocuments({
        organizationId,
        connectorKey: CONNECTOR_KEYS.TALLY,
        status: CONFLICT_STATUSES.OPEN,
      }),
      ConnectorSyncJob.countDocuments({
        organizationId,
        connectorKey: CONNECTOR_KEYS.TALLY,
        status: { $in: ['queued', 'running'] },
      }),
      TallyCompanyBinding.countDocuments({ organizationId, enabled: true }),
    ]);

    const adapter = getTallyConnectorAdapter();
    const health = connection
      ? await adapter.verifyConnection({ organizationId, companyGuid: null })
      : { ok: false, mode: 'disconnected' };

    return res.json({
      success: true,
      data: {
        connectionStatus: connection?.status || 'none',
        heartbeatAt: connection?.heartbeatAt || null,
        agentVersion: connection?.agentVersion || null,
        companyCount,
        openConflicts,
        queuedJobs,
        health,
        stub: true,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] dashboard', error);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

router.post('/sync/trigger', async (req, res) => {
  try {
    const { companyGuid = null, jobType = 'incremental', direction = 'bidirectional', payload = {} } = req.body || {};
    const result = await enqueueTallySyncJob({
      organizationId: req.user.organizationId,
      companyGuid,
      jobType,
      direction,
      payload,
      createdBy: req.user._id,
    });
    return res.status(202).json({
      success: true,
      data: {
        mode: result.mode,
        jobId: String(result.job._id),
        status: result.job.status,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] sync/trigger', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to trigger sync' });
  }
});

router.get('/sync/jobs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const jobs = await ConnectorSyncJob.find({
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('[tallyConnector] sync/jobs', error);
    return res.status(500).json({ success: false, message: 'Failed to list sync jobs' });
  }
});

router.get('/conflicts', async (req, res) => {
  try {
    const status = req.query.status || CONFLICT_STATUSES.OPEN;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const conflicts = await ConnectorConflict.find({
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      ...(status !== 'all' ? { status } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: conflicts });
  } catch (error) {
    console.error('[tallyConnector] conflicts', error);
    return res.status(500).json({ success: false, message: 'Failed to list conflicts' });
  }
});

router.get('/inventory/reconcile', async (req, res) => {
  try {
    const companyGuid = req.query.companyGuid || null;
    const data = await reconcileGodownBalances({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] inventory/reconcile', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to reconcile inventory' });
  }
});

router.get('/agent/download/status', async (req, res) => {
  try {
    const { getInstallerStatus } = require('../services/connectors/tally/tallyInstallerDownloadService');
    return res.json({ success: true, data: getInstallerStatus() });
  } catch (error) {
    console.error('[tallyConnector] agent/download/status', error);
    return res.status(500).json({ success: false, message: 'Failed to check installer status' });
  }
});

router.get('/agent/download', async (req, res) => {
  try {
    const {
      resolveInstallerPath,
      INSTALLER_NAME,
    } = require('../services/connectors/tally/tallyInstallerDownloadService');
    const resolved = resolveInstallerPath();
    if (!resolved.available || !resolved.path) {
      return res.status(404).json({
        success: false,
        code: 'INSTALLER_NOT_PUBLISHED',
        message:
          'Installer not published yet. Build on Windows with connectors/arivu-agent/installer/build.ps1 (or CI), then place ArivuConnectorSetup.exe under client/public/connectors/.',
      });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${INSTALLER_NAME}"`);
    res.setHeader('Content-Length', String(resolved.size));
    return res.sendFile(resolved.path);
  } catch (error) {
    console.error('[tallyConnector] agent/download', error);
    return res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

module.exports = router;
