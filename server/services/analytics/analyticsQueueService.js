const {
  ANALYTICS_EXECUTE_QUEUE_NAME,
  ANALYTICS_WORKER_CONCURRENCY,
  ANALYTICS_QUEUE_RETRY,
} = require('../../constants/analyticsExecution');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const AnalyticsReport = require('../../models/AnalyticsReport');
const User = require('../../models/User');
const { materializeRuntimePermissionsOnUser } = require('../runtimePermissionResolver');
const { runAnalyticsReportWithLogging } = require('./analyticsExecutionService');

let analyticsQueue = null;

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
  if (analyticsQueue !== null) return analyticsQueue;
  if (!isRedisConfigured()) {
    analyticsQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...ANALYTICS_QUEUE_RETRY } };
    opts.redis = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(isTls ? { tls: { rejectUnauthorized: true } } : {}),
    };

    analyticsQueue = new Bull(ANALYTICS_EXECUTE_QUEUE_NAME, redisUrl, opts);
    analyticsQueue.on('error', (err) => {
      console.error('[analyticsQueue] Redis error:', err.message);
    });
    return analyticsQueue;
  } catch (err) {
    console.error('[analyticsQueue] Failed to init:', err.message);
    analyticsQueue = false;
    return false;
  }
}

async function processAnalyticsJob(job) {
  const { executionId, organizationId, reportId, userId, runtimeFilters, rowLimit, preview } =
    job.data || {};

  if (!executionId || !organizationId || !reportId) {
    throw new Error('analytics job missing executionId, organizationId, or reportId');
  }

  await runWithOrganizationTenantContext(organizationId, async () => {
    const report = await AnalyticsReport.findOne({ _id: reportId, organizationId }).lean();
    if (!report) {
      throw new Error('Report not found for analytics job');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found for analytics job');
    }
    await materializeRuntimePermissionsOnUser(user);

    await runAnalyticsReportWithLogging(report, {
      organizationId,
      executionId,
      user,
      runtimeFilters,
      rowLimit,
      preview: Boolean(preview),
    });
  });
}

function enqueueAnalyticsExecution(payload) {
  const queue = initQueue();
  if (!queue) {
    return { mode: 'inline-required' };
  }

  return queue
    .add(payload, {
      jobId: `analytics-${payload.executionId}`,
      ...ANALYTICS_QUEUE_RETRY,
    })
    .then(() => ({ mode: 'queued' }))
    .catch((err) => {
      console.error('[analyticsQueue] enqueue failed:', err.message);
      return { mode: 'inline-required', error: err.message };
    });
}

function startWorker() {
  const queue = initQueue();
  if (!queue) {
    console.log('[analyticsQueue] Redis unavailable — analytics runs synchronously only');
    return false;
  }

  queue.process(ANALYTICS_WORKER_CONCURRENCY, async (job) => {
    await processAnalyticsJob(job);
  });

  console.log(
    `[analyticsQueue] Worker started (${ANALYTICS_EXECUTE_QUEUE_NAME}, concurrency=${ANALYTICS_WORKER_CONCURRENCY})`
  );
  return true;
}

async function closeQueue() {
  if (analyticsQueue && analyticsQueue !== false) {
    await analyticsQueue.close();
    analyticsQueue = null;
  }
}

module.exports = {
  ANALYTICS_EXECUTE_QUEUE_NAME,
  enqueueAnalyticsExecution,
  processAnalyticsJob,
  startWorker,
  closeQueue,
};
