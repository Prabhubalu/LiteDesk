'use strict';

const {
  TALLY_SYNC_QUEUE_NAME,
  TALLY_RETRY_PROFILE,
  TALLY_WORKER_CONCURRENCY,
} = require('./tallySyncConstants');
const ConnectorSyncJob = require('../../../models/ConnectorSyncJob');
const ConnectorSyncRun = require('../../../models/ConnectorSyncRun');
const { CONNECTOR_KEYS, SYNC_JOB_STATUSES } = require('../connectorConstants');
const { getTallyConnectorAdapter } = require('./tallyConnectorAdapterRegistry');

let tallySyncQueue = null;

function getLegacyRedisUrl() {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

function isRedisConfigured() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim() || String(process.env.REDIS_HOST || '').trim()
  );
}

function initQueue() {
  if (tallySyncQueue !== null) return tallySyncQueue;
  if (!isRedisConfigured()) {
    tallySyncQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...TALLY_RETRY_PROFILE } };
    if (isTls) {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: { rejectUnauthorized: true },
      };
    } else {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }

    tallySyncQueue = new Bull(TALLY_SYNC_QUEUE_NAME, redisUrl, opts);
    tallySyncQueue.on('error', (err) => console.error('[tallySyncQueue] Redis error:', err.message));
    return tallySyncQueue;
  } catch (error) {
    console.error('[tallySyncQueue] Failed to init:', error.message);
    tallySyncQueue = false;
    return false;
  }
}

async function processSyncJob(syncJobId) {
  const job = await ConnectorSyncJob.findById(syncJobId);
  if (!job) {
    throw new Error(`ConnectorSyncJob not found: ${syncJobId}`);
  }

  job.status = SYNC_JOB_STATUSES.RUNNING;
  job.startedAt = new Date();
  job.attempts = (job.attempts || 0) + 1;
  await job.save();

  const run = await ConnectorSyncRun.create({
    organizationId: job.organizationId,
    jobId: job._id,
    connectorKey: job.connectorKey,
    companyGuid: job.companyGuid,
    status: 'running',
    startedAt: new Date(),
  });

  try {
    const adapter = getTallyConnectorAdapter();
    const result = await adapter.pullChanges({
      organizationId: job.organizationId,
      companyGuid: job.companyGuid,
      jobType: job.jobType,
      payload: job.payload,
    });

    run.status = 'succeeded';
    run.finishedAt = new Date();
    run.stats = result?.stats || { stub: true };
    await run.save();

    job.status = SYNC_JOB_STATUSES.SUCCEEDED;
    job.finishedAt = new Date();
    job.lastError = null;
    await job.save();
    return { jobId: String(job._id), runId: String(run._id), result };
  } catch (error) {
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = error.message;
    await run.save();

    job.status = SYNC_JOB_STATUSES.FAILED;
    job.finishedAt = new Date();
    job.lastError = error.message;
    await job.save();
    throw error;
  }
}

function runSyncInline(syncJobId) {
  setImmediate(() => {
    processSyncJob(syncJobId).catch((error) => {
      console.error('[tallySyncQueue] Inline sync failed:', syncJobId, error.message);
    });
  });
}

/**
 * Enqueue a sync job for the Windows agent (poll/ack).
 * Cloud never executes Tally XML — jobs stay queued until the agent claims them.
 * Bull/inline mock processing is opt-in via TALLY_SYNC_CLOUD_PROCESS=1 (tests only).
 */
async function enqueueTallySyncJob({
  organizationId,
  companyGuid = null,
  jobType = 'incremental',
  direction = 'bidirectional',
  payload = {},
  createdBy = null,
  priority = 0,
}) {
  const job = await ConnectorSyncJob.create({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    companyGuid,
    jobType,
    direction,
    status: SYNC_JOB_STATUSES.QUEUED,
    priority,
    payload,
    createdBy,
  });

  const cloudProcess = String(process.env.TALLY_SYNC_CLOUD_PROCESS || '').trim() === '1';
  if (!cloudProcess) {
    return { mode: 'agent', job };
  }

  const queue = initQueue();
  if (!queue) {
    runSyncInline(job._id);
    return { mode: 'inline', job };
  }

  try {
    const bullJob = await queue.add(
      {
        syncJobId: String(job._id),
        organizationId: String(organizationId),
        companyGuid: companyGuid || null,
      },
      {
        // Unique per job; companyGuid prefix documents company affinity for ops/debug.
        jobId: companyGuid
          ? `tally-sync-${organizationId}-${companyGuid}-${job._id}`
          : `tally-sync-${organizationId}-${job._id}`,
        priority,
        ...TALLY_RETRY_PROFILE,
      }
    );

    job.bullJobId = String(bullJob.id);
    await job.save();
    return { mode: 'queued', job };
  } catch (error) {
    console.error('[tallySyncQueue] Enqueue failed, falling back to inline:', error.message);
    runSyncInline(job._id);
    return { mode: 'inline-fallback', job };
  }
}

function startWorker() {
  const queue = initQueue();
  if (!queue) {
    console.log('[tallySyncQueue] Redis unavailable — tally sync runs inline in API process');
    return false;
  }

  queue.process(TALLY_WORKER_CONCURRENCY, async (bullJob) => {
    const { syncJobId } = bullJob.data || {};
    if (!syncJobId) {
      throw new Error('syncJobId missing from tally sync job payload');
    }
    await processSyncJob(syncJobId);
  });

  console.log(
    `[tallySyncQueue] Worker started (${TALLY_SYNC_QUEUE_NAME}, concurrency=${TALLY_WORKER_CONCURRENCY})`
  );
  return true;
}

async function closeQueue() {
  if (tallySyncQueue && tallySyncQueue !== false) {
    await tallySyncQueue.close();
    tallySyncQueue = null;
  }
}

module.exports = {
  TALLY_SYNC_QUEUE_NAME,
  enqueueTallySyncJob,
  processSyncJob,
  startWorker,
  closeQueue,
};
