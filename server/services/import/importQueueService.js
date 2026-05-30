const { IMPORT_QUEUE_NAME, IMPORT_RETRY_PROFILE, IMPORT_WORKER_CONCURRENCY } = require('./importConstants');
const { runImportJob } = require('./importJobRunner');

let importQueue = null;

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
  if (importQueue !== null) return importQueue;
  if (!isRedisConfigured()) {
    importQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...IMPORT_RETRY_PROFILE } };
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

    importQueue = new Bull(IMPORT_QUEUE_NAME, redisUrl, opts);
    importQueue.on('error', (err) => console.error('[importQueue] Redis error:', err.message));
    return importQueue;
  } catch (error) {
    console.error('[importQueue] Failed to init:', error.message);
    importQueue = false;
    return false;
  }
}

function runImportInline(importHistoryId) {
  setImmediate(() => {
    runImportJob(importHistoryId).catch((error) => {
      console.error('[importQueue] Inline import failed:', importHistoryId, error.message);
    });
  });
}

function enqueueImportJob(importHistoryId, organizationId) {
  const queue = initQueue();
  if (!queue) {
    runImportInline(importHistoryId);
    return { mode: 'inline' };
  }

  try {
    queue.add(
      {
        importHistoryId: String(importHistoryId),
        organizationId: organizationId ? String(organizationId) : null,
      },
      {
        jobId: `import-${importHistoryId}`,
        ...IMPORT_RETRY_PROFILE,
      }
    );
    return { mode: 'queued' };
  } catch (error) {
    console.error('[importQueue] Enqueue failed, falling back to inline:', error.message);
    runImportInline(importHistoryId);
    return { mode: 'inline-fallback' };
  }
}

function startWorker() {
  const queue = initQueue();
  if (!queue) {
    console.log('[importQueue] Redis unavailable — imports run inline in API process');
    return false;
  }

  queue.process(IMPORT_WORKER_CONCURRENCY, async (job) => {
    const { importHistoryId } = job.data || {};
    if (!importHistoryId) {
      throw new Error('importHistoryId missing from job payload');
    }
    await runImportJob(importHistoryId);
  });

  console.log(`[importQueue] Worker started (${IMPORT_QUEUE_NAME}, concurrency=${IMPORT_WORKER_CONCURRENCY})`);
  return true;
}

async function closeQueue() {
  if (importQueue && importQueue !== false) {
    await importQueue.close();
    importQueue = null;
  }
}

module.exports = {
  IMPORT_QUEUE_NAME,
  enqueueImportJob,
  startWorker,
  closeQueue,
  runImportJob,
};
