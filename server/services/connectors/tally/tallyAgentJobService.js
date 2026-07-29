'use strict';

const ConnectorSyncJob = require('../../../models/ConnectorSyncJob');
const ConnectorSyncRun = require('../../../models/ConnectorSyncRun');
const ConnectorSyncEvent = require('../../../models/ConnectorSyncEvent');
const TallyCompanyBinding = require('../../../models/TallyCompanyBinding');
const TallyConnection = require('../../../models/TallyConnection');
const { CONNECTOR_KEYS, SYNC_JOB_STATUSES } = require('../connectorConstants');

function mapJobTypeToAgentType(jobType) {
  const t = String(jobType || '').toLowerCase();
  if (t === 'dry_run' || t === 'discover' || t === 'discover_companies') return 'discover';
  if (t === 'discover_metadata') return 'discover_metadata';
  if (t === 'dump_ledgers') return 'dump_ledgers';
  if (t === 'push_voucher' || t === 'push_master' || t === 'outbox') return 'push_voucher';
  if (t === 'pull_masters' || t === 'pull_vouchers') return 'pull_masters';
  if (t === 'selective_sync') return 'sync';
  if (t === 'full' || t === 'incremental' || t === 'sync') return 'sync';
  return t || 'sync';
}

/**
 * Claim queued ConnectorSyncJobs for the agent poll loop.
 * Cloud does not execute Tally XML — the Windows agent does.
 */
async function claimJobsForAgent({ organizationId, limit = 5 } = {}) {
  const candidates = await ConnectorSyncJob.find({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    status: SYNC_JOB_STATUSES.QUEUED,
  })
    .sort({ priority: 1, createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 20))
    .select('_id')
    .lean();

  const jobs = [];

  for (const row of candidates) {
    const claimed = await ConnectorSyncJob.findOneAndUpdate(
      {
        _id: row._id,
        organizationId,
        status: SYNC_JOB_STATUSES.QUEUED,
      },
      {
        $set: {
          status: SYNC_JOB_STATUSES.RUNNING,
          startedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    if (!claimed) continue;

    const run = await ConnectorSyncRun.create({
      organizationId,
      jobId: claimed._id,
      connectorKey: CONNECTOR_KEYS.TALLY,
      companyGuid: claimed.companyGuid,
      status: 'running',
      startedAt: new Date(),
    });

    await ConnectorSyncEvent.create({
      organizationId,
      runId: run._id,
      jobId: claimed._id,
      connectorKey: CONNECTOR_KEYS.TALLY,
      level: 'info',
      code: 'JOB_CLAIMED',
      message: `Agent claimed ${claimed.jobType} job`,
      payload: { jobType: claimed.jobType },
    });

    jobs.push({
      id: String(claimed._id),
      jobId: String(claimed._id),
      runId: String(run._id),
      type: mapJobTypeToAgentType(claimed.jobType),
      jobType: claimed.jobType,
      direction: claimed.direction,
      companyGuid: claimed.companyGuid,
      params: claimed.payload || {},
      payload: claimed.payload || {},
    });
  }

  return jobs;
}

function normalizeCompany(raw, fallbackPort = 9000) {
  if (!raw || typeof raw !== 'object') return null;
  const companyName = String(raw.companyName || raw.name || '').trim();
  if (!companyName) return null;
  const companyGuid = String(
    raw.companyGuid || raw.guid || raw.remoteCmpGuid || `tally:${companyName.toLowerCase()}`
  ).trim();
  return {
    companyGuid,
    companyName,
    financialYear: raw.financialYear || raw.fy || null,
    port: Number(raw.port) || fallbackPort,
    xmlEnabled: raw.xmlEnabled !== false,
  };
}

async function upsertCompaniesFromResult({ organizationId, connectionId, companies = [], port }) {
  const list = Array.isArray(companies) ? companies : [];
  const upserted = [];
  const now = new Date();

  for (const raw of list) {
    const company = normalizeCompany(raw, port);
    if (!company) continue;

    // Discovery only: never auto-bind. Preserve user bind/unbind across rediscovery.
    const existing = await TallyCompanyBinding.findOne({
      organizationId,
      companyGuid: company.companyGuid,
    });

    const discoveryMeta = {
      ...(typeof raw === 'object' && raw ? raw : {}),
      source: 'agent_discover',
      lastDiscoveredAt: now.toISOString(),
    };

    let doc;
    if (existing) {
      existing.connectionId = connectionId;
      existing.companyName = company.companyName;
      existing.financialYear = company.financialYear;
      existing.port = company.port;
      existing.lastDiscoveredAt = now;
      existing.metadata = {
        ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        ...discoveryMeta,
      };
      // Keep enabled / status / boundAt as the user left them
      await existing.save();
      doc = existing;
    } else {
      doc = await TallyCompanyBinding.create({
        organizationId,
        connectionId,
        companyGuid: company.companyGuid,
        companyName: company.companyName,
        financialYear: company.financialYear,
        port: company.port,
        enabled: false,
        status: 'discovered',
        boundAt: null,
        lastDiscoveredAt: now,
        sourceOfTruth: { stock: 'arivu', parties: 'arivu', vouchers: 'arivu' },
        metadata: discoveryMeta,
      });
    }
    upserted.push(doc);
  }

  return upserted;
}

/**
 * Acknowledge agent job completion and finalize ConnectorSyncJob / Run / Events.
 */
async function acknowledgeAgentJob({
  organizationId,
  connectionId,
  jobId,
  status,
  result = null,
  error = null,
} = {}) {
  if (!jobId) {
    const err = new Error('jobId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const job = await ConnectorSyncJob.findOne({
    _id: jobId,
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  });

  if (!job) {
    const err = new Error(`Sync job not found: ${jobId}`);
    err.code = 'JOB_NOT_FOUND';
    throw err;
  }

  const ok =
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'success' ||
    (result && result.ok === true);

  const run = await ConnectorSyncRun.findOne({ jobId: job._id, organizationId }).sort({
    createdAt: -1,
  });

  const companies =
    result?.result?.companies || result?.companies || result?.result?.discovery?.companies || [];
  const discovery = result?.result?.discovery || result?.discovery || null;
  const checks = result?.result?.checks || result?.checks || null;
  const stats = result?.result?.stats || result?.stats || {};

  // Finalize linked outbox row (outbound XML push)
  const outboxId = job.payload?.outboxId;
  if (outboxId) {
    try {
      const connectorOutboxService = require('../connectorOutboxService');
      await connectorOutboxService.markProcessed(outboxId, {
        error: ok ? null : error || result?.error || 'Agent job failed',
      });
    } catch (err) {
      console.warn('[tallyAgentJob] outbox finalize failed', err.message);
    }
  }

  // Inbound master export → catalog
  let inbound = null;
  if (
    ok &&
    (job.jobType === 'pull_masters' ||
      job.jobType === 'dump_ledgers' ||
      job.payload?.masterType ||
      job.payload?.exportId)
  ) {
    try {
      const { applyInboundExport } = require('./tallyInboundApplyService');
      const body = result?.result?.body || result?.body || '';
      const records =
        result?.result?.ledgers ||
        result?.ledgers ||
        result?.result?.records ||
        null;
      inbound = await applyInboundExport({
        organizationId,
        companyGuid: job.companyGuid || job.payload?.companyGuid || null,
        masterType: job.payload?.masterType || job.payload?.exportId || 'Ledger',
        body,
        records: Array.isArray(records) ? records : null,
        jobId: String(job._id),
        limitOverride: job.payload?.limit || (job.jobType === 'dump_ledgers' ? 5000 : null),
        sinceAlterId: job.payload?.sinceAlterId || null,
      });
    } catch (err) {
      console.warn('[tallyAgentJob] inbound apply failed', err.message);
    }
  }

  // ATIP 1B: metadata discovery result → snapshot + schemas
  let metadataResult = null;
  if (ok && job.jobType === 'discover_metadata') {
    try {
      const synchronisationEngine = require('./engines/synchronisationEngine');
      const rawPayload =
        result?.result?.metadata ||
        result?.metadata ||
        result?.result?.bodyParsed ||
        {
          tallyVersion: discovery?.tallyVersion || result?.result?.tallyVersion,
          tdlPackVersion: discovery?.tdlPackVersion || result?.result?.tdlPackVersion,
          financialYear: discovery?.financialYear || null,
          features: result?.result?.features || {},
          objects: result?.result?.objects || [],
        };
      metadataResult = await synchronisationEngine.completeMetadataOnboarding({
        organizationId,
        companyGuid: job.companyGuid || job.payload?.companyGuid,
        rawPayload,
      });
    } catch (err) {
      console.warn('[tallyAgentJob] metadata apply failed', err.message);
    }
  }

  let bindings = [];
  if (ok && connectionId && companies.length) {
    bindings = await upsertCompaniesFromResult({
      organizationId,
      connectionId,
      companies,
      port: discovery?.tallyPort || null,
    });
  }

  if (connectionId) {
    const healthPayload = {
      ok: Boolean(ok && (checks?.tallyRunning ?? discovery?.tallyRunning ?? true)),
      mode: 'live',
      tallyVersion: discovery?.tallyVersion || result?.result?.tallyVersion || null,
      tallyPort: discovery?.tallyPort || null,
      hint: result?.result?.hint || discovery?.hint || null,
      checks: checks || {
        internet: true,
        tallyRunning: Boolean(discovery?.tallyRunning),
        xmlEnabled: Boolean(discovery?.tallyRunning || discovery?.tallyPort),
        companyAvailable: (bindings.length || companies.length) > 0,
        financialYear: Boolean(
          (bindings[0] && bindings[0].financialYear) ||
            (companies[0] && (companies[0].financialYear || companies[0].fy))
        ),
      },
      companyCount: bindings.length || companies.length || 0,
      tdlLoaded: Boolean(
        discovery?.tdlLoaded || result?.result?.tdlLoaded || checks?.tdlLoaded
      ),
      tdlPackVersion:
        discovery?.tdlPackVersion ||
        result?.result?.tdlPackVersion ||
        result?.result?.discovery?.tdlPackVersion ||
        null,
      lastJobId: String(job._id),
      lastJobType: job.jobType,
      updatedAt: new Date().toISOString(),
    };

    await TallyConnection.findOneAndUpdate(
      { _id: connectionId, organizationId },
      {
        $set: {
          'metadata.lastHealth': healthPayload,
          'metadata.lastDiscovery': discovery,
          'metadata.lastSyncAt': new Date(),
        },
      }
    );
  }

  if (run) {
    run.status = ok ? 'succeeded' : 'failed';
    run.finishedAt = new Date();
    run.stats = {
      ...stats,
      companiesUpserted: bindings.length,
      inboundApplied: inbound?.applied || 0,
      inboundCreated: inbound?.created || 0,
    };
    if (!ok) run.error = error || result?.error || 'Agent job failed';
    await run.save();
  }

  job.status = ok ? SYNC_JOB_STATUSES.SUCCEEDED : SYNC_JOB_STATUSES.FAILED;
  job.finishedAt = new Date();
  job.lastError = ok ? null : error || result?.error || 'Agent job failed';
  await job.save();

  await ConnectorSyncEvent.create({
    organizationId,
    runId: run?._id || null,
    jobId: job._id,
    connectorKey: CONNECTOR_KEYS.TALLY,
    level: ok ? 'info' : 'error',
    code: ok ? 'JOB_ACKED' : 'JOB_FAILED',
    message: ok
      ? companies.length
        ? `Agent completed ${job.jobType} (${bindings.length || companies.length} companies)`
        : `Agent completed ${job.jobType} (0 companies)${
            result?.result?.hint || result?.result?.discovery?.hint
              ? ` — ${result?.result?.hint || result?.result?.discovery?.hint}`
              : ''
          }`
      : `Agent failed ${job.jobType}: ${job.lastError}`,
    payload: {
      status,
      companies: companies.length,
      bindings: bindings.length,
      checks,
      hint: result?.result?.hint || result?.result?.discovery?.hint || null,
      tallyPort: discovery?.tallyPort || null,
      openPorts: discovery?.openPorts || null,
    },
  });

  return {
    jobId: String(job._id),
    status: job.status,
    companiesUpserted: bindings.length,
  };
}

module.exports = {
  claimJobsForAgent,
  acknowledgeAgentJob,
  mapJobTypeToAgentType,
  upsertCompaniesFromResult,
};
