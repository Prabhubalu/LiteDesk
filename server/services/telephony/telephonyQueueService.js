'use strict';

const TELEPHONY_QUEUE_NAME = 'telephony-jobs';
const TELEPHONY_RETRY_PROFILE = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
});
const TELEPHONY_WORKER_CONCURRENCY = Number(process.env.TELEPHONY_WORKER_CONCURRENCY || 2);

let telephonyQueue = null;
let workerStarted = false;

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
  if (telephonyQueue !== null) return telephonyQueue;
  if (!isRedisConfigured()) {
    telephonyQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...TELEPHONY_RETRY_PROFILE } };
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

    telephonyQueue = new Bull(TELEPHONY_QUEUE_NAME, redisUrl, opts);
    telephonyQueue.on('error', (err) =>
      console.error('[telephonyQueue] Redis error:', err.message)
    );
    return telephonyQueue;
  } catch (error) {
    console.error('[telephonyQueue] Failed to init:', error.message);
    telephonyQueue = false;
    return false;
  }
}

async function processJob(job) {
  const { name, data } = job;
  const jobName = name || data?.jobName;
  const payload = data || {};

  if (jobName === 'ingestRecording') {
    const telephonyAiService = require('./telephonyAiService');
    return telephonyAiService.ingestRecording(payload);
  }
  if (jobName === 'generateTranscript') {
    const telephonyAiService = require('./telephonyAiService');
    return telephonyAiService.generateTranscript(payload);
  }
  if (jobName === 'generateSummary') {
    const telephonyAiService = require('./telephonyAiService');
    return telephonyAiService.generateSummary(payload);
  }
  if (jobName === 'rollupAnalytics') {
    const analyticsService = require('./analyticsService');
    return analyticsService.rollupFromJob(payload);
  }

  console.warn('[telephonyQueue] Unknown job', jobName);
  return { ok: false, reason: 'unknown_job' };
}

function runJobInline(jobName, data) {
  setImmediate(() => {
    processJob({ name: jobName, data }).catch((error) => {
      console.error('[telephonyQueue] Inline job failed:', jobName, error.message);
    });
  });
}

function enqueueTelephonyJob(jobName, data = {}, options = {}) {
  const payload = { ...data, jobName };
  const queue = initQueue();
  if (!queue) {
    runJobInline(jobName, payload);
    return { mode: 'inline' };
  }

  try {
    const jobId =
      options.jobId ||
      `${jobName}:${data.callId || data.organizationId || Date.now()}:${Date.now()}`;
    queue.add(jobName, payload, {
      jobId,
      ...TELEPHONY_RETRY_PROFILE,
      ...options,
    });
    return { mode: 'queued', jobId };
  } catch (error) {
    console.error('[telephonyQueue] Enqueue failed:', error.message);
    runJobInline(jobName, payload);
    return { mode: 'inline_fallback' };
  }
}

function startWorker() {
  if (workerStarted) return;
  const queue = initQueue();
  if (!queue) {
    console.log('[telephonyQueue] Redis not configured — jobs will run inline');
    workerStarted = true;
    return;
  }

  for (const name of [
    'ingestRecording',
    'generateTranscript',
    'generateSummary',
    'rollupAnalytics',
  ]) {
    queue.process(name, TELEPHONY_WORKER_CONCURRENCY, async (job) => processJob(job));
  }

  workerStarted = true;
  console.log(`[telephonyQueue] Worker started (Bull: ${TELEPHONY_QUEUE_NAME})`);
}

async function closeQueue() {
  if (telephonyQueue && telephonyQueue !== false) {
    await telephonyQueue.close();
  }
  telephonyQueue = null;
  workerStarted = false;
}

module.exports = {
  TELEPHONY_QUEUE_NAME,
  enqueueTelephonyJob,
  startWorker,
  closeQueue,
  initQueue,
  processJob,
};
