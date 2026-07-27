'use strict';

/**
 * ATIP Monitoring Engine — operational dashboard aggregates.
 */

const ConnectorSyncJob = require('../../../../models/ConnectorSyncJob');
const ConnectorConflict = require('../../../../models/ConnectorConflict');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const TallyConnection = require('../../../../models/TallyConnection');
const TallySyncRunLog = require('../../../../models/TallySyncRunLog');
const { CONNECTOR_KEYS, CONFLICT_STATUSES } = require('../../connectorConstants');
const connectionEngine = require('./connectionEngine');

async function getDashboard({ organizationId }) {
  const connectorKey = CONNECTOR_KEYS.TALLY || 'tally';
  const connection = await TallyConnection.findOne({
    organizationId,
    revokedAt: null,
  }).sort({ updatedAt: -1 }).lean();

  const bindings = await TallyCompanyBinding.find({ organizationId }).lean();
  const activeBindings = bindings.filter((b) => b.enabled && b.boundAt);

  const jobFilter = { organizationId, connectorKey };
  const [pending, active, failed, succeededRecent, openConflicts, recentRuns] = await Promise.all([
    ConnectorSyncJob.countDocuments({ ...jobFilter, status: { $in: ['pending', 'queued'] } }),
    ConnectorSyncJob.countDocuments({ ...jobFilter, status: { $in: ['running', 'claimed', 'in_progress'] } }),
    ConnectorSyncJob.countDocuments({ ...jobFilter, status: { $in: ['failed', 'dead_letter', 'dlq'] } }),
    ConnectorSyncJob.countDocuments({
      ...jobFilter,
      status: { $in: ['completed', 'succeeded', 'acked'] },
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    ConnectorConflict.countDocuments({
      organizationId,
      connectorKey,
      status: CONFLICT_STATUSES?.OPEN || 'open',
    }),
    TallySyncRunLog.find({ organizationId }).sort({ startedAt: -1 }).limit(10).lean(),
  ]);

  const retryQueue = await ConnectorSyncJob.countDocuments({
    ...jobFilter,
    status: { $in: ['pending', 'queued'] },
    attempts: { $gte: 1 },
  });

  const completedWithDuration = recentRuns.filter((r) => r.durationMs != null);
  const avgSyncTimeMs = completedWithDuration.length
    ? Math.round(completedWithDuration.reduce((a, r) => a + r.durationMs, 0) / completedWithDuration.length)
    : null;

  const largestJobs = await ConnectorSyncJob.find({ ...jobFilter })
    .sort({ 'payload.recordCount': -1, createdAt: -1 })
    .limit(5)
    .select('jobType status payload companyGuid createdAt updatedAt')
    .lean();

  const wizard = await connectionEngine.getWizardState({ organizationId });

  const lastSyncAt = activeBindings
    .map((b) => b.lastSyncAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    connectionStatus: connection?.status || 'none',
    healthState: connection?.healthState || wizard.healthState,
    checklist: connection?.validationChecklist || wizard.checklist,
    connectedCompanies: activeBindings.map((b) => ({
      companyGuid: b.companyGuid,
      companyName: b.companyName,
      healthState: b.healthState,
      lastSyncAt: b.lastSyncAt,
      schemaVersion: b.schemaVersion,
    })),
    discoveredCompanies: bindings.length,
    queue: {
      pending,
      active,
      successful: succeededRecent,
      failed,
      retryQueue,
    },
    conflicts: { open: openConflicts },
    averageSyncTimeMs: avgSyncTimeMs,
    largestJobs,
    lastSynchronisation: lastSyncAt,
    apiHealth: connection?.status === 'online' ? 'ok' : 'degraded',
    workerStatus: 'agent_poll',
    queueHealth: failed > 20 ? 'degraded' : 'ok',
    wizard,
    recentRuns: recentRuns.map((r) => ({
      id: String(r._id),
      status: r.status,
      moduleKey: r.tallyModuleKey || r.moduleKey,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      durationMs: r.durationMs,
      error: r.error,
    })),
  };
}

module.exports = {
  getDashboard,
};
