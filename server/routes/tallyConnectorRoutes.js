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
const { CONNECTOR_KEYS, CONFLICT_STATUSES, CONFLICT_RESOLUTIONS } = require('../services/connectors/connectorConstants');

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
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    let settings = null;
    let defaultOwnerUserId = null;
    if (connection) {
      defaultOwnerUserId = await tallyModuleMappingService.ensureDefaultOwnerUserId(
        req.user.organizationId,
        req.user._id
      );
      settings = await tallyModuleMappingService.getMergedSettings(req.user.organizationId);
    }
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
        settings: settings
          ? {
            defaultOwnerUserId: settings.defaultOwnerUserId || defaultOwnerUserId || null,
            scheduledSyncEnabled: Boolean(settings.scheduledSyncEnabled),
            syncIntervalMinutes: settings.syncIntervalMinutes ?? 5,
            dryRunDefault: settings.dryRunDefault !== false,
          }
          : null,
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
    const [openConflicts, queuedJobs, companyCount, companies] = await Promise.all([
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
      TallyCompanyBinding.find({ organizationId, enabled: true })
        .sort({ companyName: 1 })
        .lean(),
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
        companies,
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
    if (!companyGuid) {
      return res.status(400).json({ success: false, message: 'companyGuid required' });
    }
    const connection = await tallyConnectionService.getConnection(req.user.organizationId);
    if (!connection) {
      return res.status(400).json({ success: false, message: 'Pair the agent first' });
    }
    const existing = await TallyCompanyBinding.findOne({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    const name = companyName || existing?.companyName;
    if (!name) {
      return res.status(400).json({ success: false, message: 'companyName required' });
    }
    const shouldEnable = enabled !== false;
    const binding = await TallyCompanyBinding.findOneAndUpdate(
      { organizationId: req.user.organizationId, companyGuid },
      {
        $set: {
          connectionId: connection._id,
          companyName: name,
          financialYear: financialYear != null ? financialYear : existing?.financialYear || null,
          enabled: shouldEnable,
          status: shouldEnable ? 'active' : 'paused',
          boundAt: shouldEnable ? new Date() : null,
          healthState: shouldEnable ? 'metadata_pending' : 'found',
        },
        $setOnInsert: {
          organizationId: req.user.organizationId,
          companyGuid,
          sourceOfTruth: { stock: 'arivu', parties: 'arivu', vouchers: 'arivu' },
        },
      },
      { upsert: true, new: true }
    );

    let metadataJob = null;
    if (shouldEnable) {
      try {
        const { metadataEngine } = require('../services/connectors/tally/engines');
        metadataJob = await metadataEngine.enqueueMetadataDiscovery({
          organizationId: req.user.organizationId,
          companyGuid,
          requestedBy: req.user._id,
        });
      } catch (err) {
        console.warn('[tallyConnector] metadata enqueue on bind failed', err.message);
      }
    }

    return res.json({
      success: true,
      data: binding,
      metadataJob: metadataJob
        ? { mode: metadataJob.mode, jobId: metadataJob.job ? String(metadataJob.job._id) : null }
        : null,
    });
  } catch (error) {
    console.error('[tallyConnector] companies/bind', error);
    return res.status(500).json({ success: false, message: error.message || 'Bind failed' });
  }
});

router.post('/companies/unbind', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) {
      return res.status(400).json({ success: false, message: 'companyGuid required' });
    }
    const binding = await TallyCompanyBinding.findOneAndUpdate(
      { organizationId: req.user.organizationId, companyGuid },
      {
        $set: {
          enabled: false,
          status: 'paused',
        },
      },
      { new: true }
    );
    if (!binding) {
      return res.status(404).json({ success: false, message: 'Company binding not found' });
    }
    return res.json({ success: true, data: binding });
  } catch (error) {
    console.error('[tallyConnector] companies/unbind', error);
    return res.status(500).json({ success: false, message: error.message || 'Unbind failed' });
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
    const tallyMappingService = require('../services/connectors/tally/tallyMappingService');
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const skip = Math.max(parseInt(req.query.skip || '0', 10) || 0, 0);
    const result = await tallyMappingService.listExternalObjects({
      organizationId: req.user.organizationId,
      companyGuid: req.query.companyGuid || null,
      entityType: req.query.entityType || null,
      status: req.query.status || 'all',
      q: req.query.q || '',
      limit,
      skip,
    });
    return res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.total,
        limit: result.limit,
        skip: result.skip,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] external-objects', error);
    return res.status(500).json({ success: false, message: 'Failed to list external objects' });
  }
});

router.post('/external-objects/:id/ignore', async (req, res) => {
  try {
    const tallyMappingService = require('../services/connectors/tally/tallyMappingService');
    const row = await tallyMappingService.ignoreExternalObject({
      organizationId: req.user.organizationId,
      externalObjectId: req.params.id,
      reason: req.body?.reason || 'user_ignored',
    });
    return res.json({ success: true, data: row });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.post('/external-objects/:id/link', async (req, res) => {
  try {
    const tallyMappingService = require('../services/connectors/tally/tallyMappingService');
    const row = await tallyMappingService.linkExternalObject({
      organizationId: req.user.organizationId,
      externalObjectId: req.params.id,
      arivuId: req.body?.arivuId,
      createdBy: req.user._id,
    });
    return res.json({ success: true, data: row });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.post('/external-objects/:id/create', async (req, res) => {
  try {
    const tallyMappingService = require('../services/connectors/tally/tallyMappingService');
    const result = await tallyMappingService.createFromExternal({
      organizationId: req.user.organizationId,
      externalObjectId: req.params.id,
      createdBy: req.user._id,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    const status =
      error.code === 'NOT_FOUND' ? 404 : error.code === 'UNSUPPORTED' ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/field-mappings', async (req, res) => {
  try {
    const tallyFieldMappingService = require('../services/connectors/tally/tallyFieldMappingService');
    const ConnectorFieldMapping = require('../models/ConnectorFieldMapping');
    const entityType = String(req.query.entityType || 'party').toLowerCase();
    const companyGuid = req.query.companyGuid || null;
    const existing = await ConnectorFieldMapping.findOne({
      organizationId: req.user.organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType,
      companyGuid,
      active: true,
    })
      .sort({ version: -1 })
      .lean();
    const suggested = await tallyFieldMappingService.suggestMappings({
      organizationId: req.user.organizationId,
      entityType,
      companyGuid,
    });
    const arivuFields = suggested.arivuFields || tallyFieldMappingService.listArivuFieldsForEntity(entityType);
    const arivuFieldMeta = tallyFieldMappingService.listArivuFieldMetaForEntity(entityType);
    const arivuFieldLabels = Object.fromEntries(arivuFieldMeta.map((m) => [m.key, m.label]));
    const requiredKeys = new Set(arivuFieldMeta.filter((m) => m.required).map((m) => m.key));
    const tallyFields =
      suggested.tallyFields ||
      (await tallyFieldMappingService.listTallyFieldsForEntity({
        organizationId: req.user.organizationId,
        companyGuid,
        entityType,
      }));
    // Prefer saved rules when present; merge so every Arivu field still has a row
    const savedByArivu = new Map((existing?.rules || []).map((r) => [r.arivuFieldKey, r]));
    const rows = arivuFields.map((arivuFieldKey) => {
      const saved = savedByArivu.get(arivuFieldKey);
      if (saved) {
        return {
          arivuFieldKey,
          arivuFieldLabel: arivuFieldLabels[arivuFieldKey] || arivuFieldKey,
          required: requiredKeys.has(arivuFieldKey),
          externalFieldKey: saved.externalFieldKey,
          confidence: saved.confidence ?? 1,
          approved: true,
        };
      }
      const sug = (suggested.suggestions || []).find((s) => s.arivuFieldKey === arivuFieldKey);
      return {
        arivuFieldKey,
        arivuFieldLabel: arivuFieldLabels[arivuFieldKey] || arivuFieldKey,
        required: requiredKeys.has(arivuFieldKey),
        externalFieldKey: sug?.externalFieldKey || null,
        confidence: sug?.confidence || 0,
        approved: false,
      };
    });
    const unmappedRequired = tallyFieldMappingService.getUnmappedRequiredFields(entityType, rows);
    return res.json({
      success: true,
      data: {
        saved: existing,
        catalog: {
          arivu: arivuFields,
          external: tallyFields,
        },
        arivuFields,
        arivuFieldLabels,
        arivuFieldMeta,
        unmappedRequired,
        tallyFields,
        entityOptions: tallyFieldMappingService.getEntityOptions(),
        suggestions: rows,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] field-mappings', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/field-mappings/accept', async (req, res) => {
  try {
    const tallyFieldMappingService = require('../services/connectors/tally/tallyFieldMappingService');
    const doc = await tallyFieldMappingService.acceptMappings({
      organizationId: req.user.organizationId,
      entityType: req.body?.entityType,
      companyGuid: req.body?.companyGuid || null,
      rules: req.body?.rules || [],
      version: req.body?.version,
    });
    return res.json({ success: true, data: doc });
  } catch (error) {
    const status = error.code === 'MANDATORY_FIELDS_UNMAPPED' ? 422 : 400;
    return res.status(status).json({
      success: false,
      message: error.message,
      code: error.code || 'VALIDATION',
      unmappedRequired: error.unmappedRequired || [],
    });
  }
});

router.post('/masters/sync-items', async (req, res) => {
  try {
    const { syncStockItems } = require('../services/connectors/tally/tallyMasterSyncService');
    const companyGuid = req.body?.companyGuid;
    if (!companyGuid) {
      return res.status(400).json({
        success: false,
        message: 'companyGuid required — select a Tally company',
      });
    }
    const result = await syncStockItems({
      organizationId: req.user.organizationId,
      companyGuid,
      dryRun: Boolean(req.body?.dryRun),
      limit: Math.min(parseInt(req.body?.limit || '100', 10) || 100, 500),
      variantIds: Array.isArray(req.body?.variantIds) ? req.body.variantIds : null,
    });
    if (!req.body?.dryRun && !req.body?.skipDrain) {
      await triggerBidirectionalSync({
        organizationId: req.user.organizationId,
        companyGuid,
        jobType: 'incremental',
        createdBy: req.user._id,
      });
    }
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    console.error('[tallyConnector] masters/sync-items', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/masters/sync-parties', async (req, res) => {
  try {
    const { syncParties } = require('../services/connectors/tally/tallyMasterSyncService');
    const companyGuid = req.body?.companyGuid;
    if (!companyGuid) {
      return res.status(400).json({
        success: false,
        message: 'companyGuid required — select a Tally company',
      });
    }
    const result = await syncParties({
      organizationId: req.user.organizationId,
      companyGuid,
      dryRun: Boolean(req.body?.dryRun),
      limit: Math.min(parseInt(req.body?.limit || '100', 10) || 100, 500),
      partyIds: Array.isArray(req.body?.partyIds) ? req.body.partyIds : null,
    });
    if (!req.body?.dryRun && !req.body?.skipDrain) {
      await triggerBidirectionalSync({
        organizationId: req.user.organizationId,
        companyGuid,
        jobType: 'incremental',
        createdBy: req.user._id,
      });
    }
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    console.error('[tallyConnector] masters/sync-parties', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conflicts/:id/resolve', async (req, res) => {
  try {
    const resolution = String(req.body?.resolution || '').trim();
    const allowed = Object.values(CONFLICT_RESOLUTIONS);
    if (!allowed.includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: `resolution must be one of: ${allowed.join(', ')}`,
      });
    }
    const tallyConflictApplyService = require('../services/connectors/tally/tallyConflictApplyService');
    const result = await tallyConflictApplyService.resolveAndApply({
      organizationId: req.user.organizationId,
      conflictId: req.params.id,
      resolution,
      resolvedBy: req.user._id,
      note: req.body?.note || null,
    });
    return res.json({ success: true, data: result.conflict, applyResult: result.applyResult });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION' ? 400 : 500;
    console.error('[tallyConnector] conflicts/resolve', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const settings = await tallyModuleMappingService.getMergedSettings(req.user.organizationId);
    return res.json({
      success: true,
      data: {
        autoOutboxFanOutToAllLinkedCompanies: settings.autoOutboxFanOutToAllLinkedCompanies !== false,
        migrationMode: Boolean(settings.migrationMode),
        preventProductTaxUpdate: Boolean(settings.preventProductTaxUpdate),
        recordsPerSyncCycle: settings.recordsPerSyncCycle ?? 200,
        recordsPerSyncCycleMin: settings.recordsPerSyncCycleMin ?? 50,
        recordsPerSyncCycleMax: settings.recordsPerSyncCycleMax ?? 500,
        dryRunDefault: settings.dryRunDefault !== false,
        scheduledSyncEnabled: Boolean(settings.scheduledSyncEnabled),
        syncIntervalMinutes: settings.syncIntervalMinutes ?? 5,
        defaultOwnerUserId: settings.defaultOwnerUserId || null,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] settings get', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const settings = await tallyModuleMappingService.patchSettings(req.user.organizationId, req.body || {});
    return res.json({
      success: true,
      data: {
        autoOutboxFanOutToAllLinkedCompanies: settings.autoOutboxFanOutToAllLinkedCompanies !== false,
        migrationMode: Boolean(settings.migrationMode),
        preventProductTaxUpdate: Boolean(settings.preventProductTaxUpdate),
        recordsPerSyncCycle: settings.recordsPerSyncCycle ?? 200,
        dryRunDefault: settings.dryRunDefault !== false,
        scheduledSyncEnabled: Boolean(settings.scheduledSyncEnabled),
        syncIntervalMinutes: settings.syncIntervalMinutes ?? 5,
        defaultOwnerUserId: settings.defaultOwnerUserId || null,
      },
    });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION' ? 400 : 500;
    console.error('[tallyConnector] settings patch', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/module-mappings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const companyGuid = req.query.companyGuid || null;
    const data = await tallyModuleMappingService.listModuleMappings({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    await tallyModuleMappingService.seedDefaultFieldMaps({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] module-mappings get', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/module-mappings/:tallyModuleKey', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const row = await tallyModuleMappingService.updateModuleMapping({
      organizationId: req.user.organizationId,
      companyGuid: req.body?.companyGuid || req.query.companyGuid || null,
      tallyModuleKey: req.params.tallyModuleKey,
      patch: req.body || {},
    });
    return res.json({ success: true, data: row });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION' ? 400 : 500;
    console.error('[tallyConnector] module-mappings patch', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.put('/module-mappings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const rows = await tallyModuleMappingService.bulkUpdateModuleMappings({
      organizationId: req.user.organizationId,
      companyGuid: req.body?.companyGuid || null,
      rows: req.body?.rows || [],
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    const status = error.code === 'VALIDATION' ? 400 : 500;
    console.error('[tallyConnector] module-mappings put', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/tax-mappings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const rows = await tallyModuleMappingService.listTaxMappings({
      organizationId: req.user.organizationId,
      companyGuid: req.query.companyGuid || null,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[tallyConnector] tax-mappings get', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tax-mappings', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const row = await tallyModuleMappingService.upsertTaxMapping({
      organizationId: req.user.organizationId,
      companyGuid: req.body?.companyGuid || null,
      mapping: req.body || {},
    });
    return res.json({ success: true, data: row });
  } catch (error) {
    const status = error.code === 'VALIDATION' ? 400 : 500;
    console.error('[tallyConnector] tax-mappings post', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.delete('/tax-mappings/:id', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    await tallyModuleMappingService.deleteTaxMapping({
      organizationId: req.user.organizationId,
      companyGuid: req.query.companyGuid || null,
      id: req.params.id,
    });
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('[tallyConnector] tax-mappings delete', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reset/module', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const data = await tallyModuleMappingService.resetModule({
      organizationId: req.user.organizationId,
      companyGuid: req.body?.companyGuid || null,
      tallyModuleKey: req.body?.tallyModuleKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[tallyConnector] reset/module', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.post('/reset/full', async (req, res) => {
  try {
    const tallyModuleMappingService = require('../services/connectors/tally/tallyModuleMappingService');
    const data = await tallyModuleMappingService.resetFullConfiguration({
      organizationId: req.user.organizationId,
      companyGuid: req.body?.companyGuid || null,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] reset/full', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sync-logs', async (req, res) => {
  try {
    const tallySyncLogService = require('../services/connectors/tally/tallySyncLogService');
    const data = await tallySyncLogService.listRunLogs({
      organizationId: req.user.organizationId,
      companyGuid: req.query.companyGuid || null,
      moduleKey: req.query.moduleKey || null,
      limit: parseInt(req.query.limit || '50', 10),
      skip: parseInt(req.query.skip || '0', 10),
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] sync-logs', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sync-logs/:id/records', async (req, res) => {
  try {
    const tallySyncLogService = require('../services/connectors/tally/tallySyncLogService');
    const data = await tallySyncLogService.getRunLogRecords({
      organizationId: req.user.organizationId,
      logId: req.params.id,
      action: req.query.action || null,
      side: req.query.side || null,
    });
    if (req.query.download === 'csv') {
      const csv = tallySyncLogService.recordsToCsv(data.records);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tally-sync-${req.params.id}.csv"`);
      return res.send(csv);
    }
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[tallyConnector] sync-logs records', error);
    return res.status(status).json({ success: false, message: error.message });
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

// ─── ATIP platform routes ───────────────────────────────────────────

router.get('/atip/wizard', async (req, res) => {
  try {
    const { connectionEngine } = require('../services/connectors/tally/engines');
    const data = await connectionEngine.getWizardState({ organizationId: req.user.organizationId });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/wizard', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load wizard' });
  }
});

router.get('/atip/dashboard', async (req, res) => {
  try {
    const { monitoringEngine } = require('../services/connectors/tally/engines');
    const data = await monitoringEngine.getDashboard({ organizationId: req.user.organizationId });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/dashboard', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load ATIP dashboard' });
  }
});

router.post('/atip/metadata/discover', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { metadataEngine } = require('../services/connectors/tally/engines');
    const job = await metadataEngine.enqueueMetadataDiscovery({
      organizationId: req.user.organizationId,
      companyGuid,
      requestedBy: req.user._id,
    });
    return res.json({ success: true, data: job });
  } catch (error) {
    console.error('[tallyConnector] atip/metadata/discover', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to enqueue metadata discovery' });
  }
});

router.post('/atip/ledgers/dump', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { metadataEngine } = require('../services/connectors/tally/engines');
    const job = await metadataEngine.enqueueLedgerDump({
      organizationId: req.user.organizationId,
      companyGuid,
      requestedBy: req.user._id,
    });
    return res.json({ success: true, data: job });
  } catch (error) {
    console.error('[tallyConnector] atip/ledgers/dump', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to enqueue ledger dump' });
  }
});

router.get('/atip/ledgers', async (req, res) => {
  try {
    const { companyGuid } = req.query;
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const tallyMappingService = require('../services/connectors/tally/tallyMappingService');
    const TallyCompanyBinding = require('../models/TallyCompanyBinding');
    const binding = await TallyCompanyBinding.findOne({
      organizationId: req.user.organizationId,
      companyGuid,
    })
      .select('companyName')
      .lean();
    const companyName = binding?.companyName || null;
    const limit = Math.min(parseInt(req.query.limit || '500', 10) || 500, 2000);
    const skip = Math.max(parseInt(req.query.skip || '0', 10) || 0, 0);
    const result = await tallyMappingService.listExternalObjects({
      organizationId: req.user.organizationId,
      companyGuid,
      entityType: 'party',
      status: 'all',
      q: req.query.q || '',
      limit,
      skip,
    });
    const ledgers = (result.rows || []).map((row) => {
      const remote = row.metadata?.remotePayload || {};
      const values = { ...(remote.tallyValues || remote) };
      if (companyName && !values._companyName) values._companyName = companyName;
      if (companyName && !values.COMPANYNAME) values.COMPANYNAME = companyName;
      return {
        _id: row._id,
        externalId: row.externalId,
        name: row.displayName || values.NAME || values.name || remote.name,
        parent: values.PARENT || values.parent || remote.parent,
        mappingStatus: row.mappingStatus,
        updatedAt: row.updatedAt,
        values,
      };
    });
    return res.json({
      success: true,
      data: ledgers,
      meta: {
        total: result.total,
        limit: result.limit,
        skip: result.skip,
        hasMore: result.hasMore,
        companyName,
      },
    });
  } catch (error) {
    console.error('[tallyConnector] atip/ledgers', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list ledgers' });
  }
});

router.get('/atip/metadata/objects', async (req, res) => {
  try {
    const { companyGuid } = req.query;
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { metadataEngine } = require('../services/connectors/tally/engines');
    const objects = await metadataEngine.listObjectSchemas({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data: objects });
  } catch (error) {
    console.error('[tallyConnector] atip/metadata/objects', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list object schemas' });
  }
});

router.get('/atip/ledger-groups', async (req, res) => {
  try {
    const { companyGuid } = req.query;
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { metadataEngine } = require('../services/connectors/tally/engines');
    const data = await metadataEngine.listLedgerGroups({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/ledger-groups', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list ledger groups' });
  }
});

router.post('/atip/schema/generate', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { schemaGenerator } = require('../services/connectors/tally/engines');
    const data = await schemaGenerator.generateForBinding({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/schema/generate', error);
    return res.status(500).json({ success: false, message: error.message || 'Schema generation failed' });
  }
});

router.post('/atip/mappings/draft', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { mappingEngine } = require('../services/connectors/tally/engines');
    const data = await mappingEngine.createDraftFromSchemas({
      organizationId: req.user.organizationId,
      companyGuid,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/mappings/draft', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create mapping draft' });
  }
});

router.post('/atip/mappings/:versionId/activate', async (req, res) => {
  try {
    const { companyGuid } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { mappingEngine } = require('../services/connectors/tally/engines');
    const data = await mappingEngine.activateVersion({
      organizationId: req.user.organizationId,
      companyGuid,
      versionId: req.params.versionId,
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/mappings/activate', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to activate mapping' });
  }
});

router.get('/atip/mappings/active', async (req, res) => {
  try {
    const { companyGuid } = req.query;
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { mappingEngine } = require('../services/connectors/tally/engines');
    const data = await mappingEngine.getActiveMappingVersion({
      organizationId: req.user.organizationId,
      companyGuid,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/mappings/active', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load mapping' });
  }
});

router.get('/atip/audit', async (req, res) => {
  try {
    const { auditEngine } = require('../services/connectors/tally/engines');
    const data = await auditEngine.searchEvents({
      organizationId: req.user.organizationId,
      q: req.query.q || null,
      level: req.query.level || null,
      moduleKey: req.query.moduleKey || null,
      correlationId: req.query.correlationId || null,
      limit: Number(req.query.limit) || 50,
      skip: Number(req.query.skip) || 0,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/audit', error);
    return res.status(500).json({ success: false, message: error.message || 'Audit search failed' });
  }
});

router.post('/atip/assistant', async (req, res) => {
  try {
    const aiSyncAssistant = require('../services/connectors/tally/engines/aiSyncAssistant');
    const data = await aiSyncAssistant.ask({
      organizationId: req.user.organizationId,
      question: req.body?.question,
      companyGuid: req.body?.companyGuid || null,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/assistant', error);
    return res.status(500).json({ success: false, message: error.message || 'Assistant failed' });
  }
});

router.post('/atip/onboarding/complete-metadata', async (req, res) => {
  try {
    const { companyGuid, rawPayload } = req.body || {};
    if (!companyGuid) return res.status(400).json({ success: false, message: 'companyGuid required' });
    const { synchronisationEngine } = require('../services/connectors/tally/engines');
    const data = await synchronisationEngine.completeMetadataOnboarding({
      organizationId: req.user.organizationId,
      companyGuid,
      rawPayload: rawPayload || {},
      userId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[tallyConnector] atip/onboarding/complete-metadata', error);
    return res.status(500).json({ success: false, message: error.message || 'Onboarding metadata failed' });
  }
});

module.exports = router;
