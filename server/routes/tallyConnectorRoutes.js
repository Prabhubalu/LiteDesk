'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const tallyConnectionService = require('../services/connectors/tally/tallyConnectionService');
const { handleAgentRpc } = require('../services/connectors/tally/tallyAgentProtocol');
const { enqueueTallySyncJob } = require('../services/connectors/tally/tallySyncQueueService');
const { triggerBidirectionalSync } = require('../services/connectors/tally/tallySyncOrchestrator');
const { reconcileGodownBalances } = require('../services/connectors/tally/tallyInventorySyncService');
const ConnectorSyncJob = require('../models/ConnectorSyncJob');
const ConnectorSyncEvent = require('../models/ConnectorSyncEvent');
const ConnectorConflict = require('../models/ConnectorConflict');
const ConnectorExternalObject = require('../models/ConnectorExternalObject');
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

    const meta = connection?.metadata || {};
    const lastHealth = meta.lastHealth || null;
    const heartbeatFresh =
      connection?.heartbeatAt &&
      Date.now() - new Date(connection.heartbeatAt).getTime() < 2 * 60 * 1000;

    const health = connection
      ? lastHealth || {
          ok: Boolean(heartbeatFresh),
          mode: 'live',
          tallyVersion: null,
          tallyPort: meta.tallyPort || null,
          tdlLoaded: Boolean(meta.tdlLoaded),
          tdlPackVersion: meta.tdlPackVersion || null,
          checks: {
            internet: true,
            tallyRunning: Boolean(meta.tallyPort),
            xmlEnabled: Boolean(meta.tallyPort),
            companyAvailable: companyCount > 0,
            financialYear: false,
            tdlLoaded: Boolean(meta.tdlLoaded),
          },
          message: heartbeatFresh
            ? 'Agent online — run Dry run to discover Tally companies'
            : 'Waiting for agent heartbeat',
        }
      : { ok: false, mode: 'disconnected' };

    // Prefer nested lastHealth but surface top-level heartbeat TDL flags if present
    if (health && meta.tdlLoaded != null && health.tdlLoaded == null) {
      health.tdlLoaded = Boolean(meta.tdlLoaded);
      health.tdlPackVersion = meta.tdlPackVersion || health.tdlPackVersion || null;
      health.checks = {
        ...(health.checks || {}),
        tdlLoaded: Boolean(meta.tdlLoaded),
      };
    }

    return res.json({
      success: true,
      data: {
        connectionStatus: connection?.status || 'none',
        heartbeatAt: connection?.heartbeatAt || null,
        agentVersion: connection?.agentVersion || null,
        agentHostname: connection?.agentHostname || meta.hostname || null,
        companyCount,
        openConflicts,
        queuedJobs,
        health,
        stub: false,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] dashboard', error);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

router.post('/sync/trigger', async (req, res) => {
  try {
    const {
      companyGuid = null,
      jobType = 'incremental',
      direction = 'bidirectional',
      payload = {},
    } = req.body || {};

    const dryRun = jobType === 'dry_run' || payload.dryRun === true;
    if (dryRun || direction === 'bidirectional' || jobType === 'incremental' || jobType === 'full') {
      const result = await triggerBidirectionalSync({
        organizationId: req.user.organizationId,
        companyGuid,
        jobType: dryRun ? 'dry_run' : jobType,
        createdBy: req.user._id,
        dryRun,
      });
      return res.status(202).json({
        success: true,
        data: {
          mode: result.mode,
          jobId: String(result.job._id),
          status: result.job.status,
          drained: result.drained || 0,
          pullJobs: result.pullJobs || [],
        },
      });
    }

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

router.post('/companies/bind', async (req, res) => {
  try {
    const { companyGuid, companyName, financialYear = null, enabled = true } = req.body || {};
    if (!companyGuid || !companyName) {
      return res.status(400).json({ success: false, message: 'companyGuid and companyName required' });
    }
    const connection = await tallyConnectionService.getConnection(req.user.organizationId);
    if (!connection) {
      return res.status(400).json({ success: false, message: 'Pair the agent first' });
    }
    const binding = await TallyCompanyBinding.findOneAndUpdate(
      { organizationId: req.user.organizationId, companyGuid },
      {
        $set: {
          connectionId: connection._id,
          companyName,
          financialYear,
          enabled: Boolean(enabled),
          status: 'active',
          lastSyncAt: new Date(),
        },
        $setOnInsert: {
          organizationId: req.user.organizationId,
          companyGuid,
          sourceOfTruth: { stock: 'arivu', parties: 'arivu', vouchers: 'arivu' },
        },
      },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: binding });
  } catch (error) {
    console.error('[tallyConnector] companies/bind', error);
    return res.status(500).json({ success: false, message: error.message || 'Bind failed' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const skip = Math.max(parseInt(req.query.skip || '0', 10) || 0, 0);
    const level = String(req.query.level || '').trim().toLowerCase();
    const code = String(req.query.code || '').trim();
    const q = String(req.query.q || '').trim();
    const jobId = String(req.query.jobId || '').trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const filter = {
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
    };
    if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
      filter.level = level;
    }
    if (code) filter.code = code;
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      filter.jobId = jobId;
    }
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      filter.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
    }
    if (q) {
      filter.$or = [
        { message: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { code: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      ConnectorSyncEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ConnectorSyncEvent.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: events,
      meta: {
        total,
        limit,
        skip,
        hasMore: skip + events.length < total,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] events', error);
    return res.status(500).json({ success: false, message: 'Failed to list events' });
  }
});

router.get('/sync/jobs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const skip = Math.max(parseInt(req.query.skip || '0', 10) || 0, 0);
    const status = String(req.query.status || '').trim().toLowerCase();
    const jobType = String(req.query.jobType || '').trim();
    const q = String(req.query.q || '').trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const filter = {
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
    };
    if (status && status !== 'all') filter.status = status;
    if (jobType) filter.jobType = jobType;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      filter.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
    }
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { jobType: { $regex: escaped, $options: 'i' } },
        { lastError: { $regex: escaped, $options: 'i' } },
        { companyGuid: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      ConnectorSyncJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ConnectorSyncJob.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: jobs,
      meta: { total, limit, skip, hasMore: skip + jobs.length < total },
    });
  } catch (error) {
    console.error('[tallyConnector] sync/jobs', error);
    return res.status(500).json({ success: false, message: 'Failed to list sync jobs' });
  }
});

router.get('/external-objects', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const entityType = req.query.entityType || null;
    const rows = await ConnectorExternalObject.find({
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      ...(entityType ? { entityType } : {}),
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[tallyConnector] external-objects', error);
    return res.status(500).json({ success: false, message: 'Failed to list external objects' });
  }
});

router.post('/unpair', async (req, res) => {
  try {
    const connection = await tallyConnectionService.getConnection(req.user.organizationId);
    if (!connection) {
      return res.json({ success: true, data: { unpaired: true } });
    }
    connection.status = 'revoked';
    connection.revokedAt = new Date();
    connection.agentTokenHash = null;
    connection.pairingCode = null;
    await connection.save();
    return res.json({ success: true, data: { unpaired: true } });
  } catch (error) {
    console.error('[tallyConnector] unpair', error);
    return res.status(500).json({ success: false, message: error.message || 'Unpair failed' });
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
