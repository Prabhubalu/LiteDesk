/**
 * Inbound Email Queue Service (Phase 3).
 *
 * Bull-backed async pipeline for inbound MIME processing. The webhook
 * controller stores the raw MIME and enqueues a job; this worker handles
 * parse + thread + persist out-of-band so HTTP returns immediately.
 *
 * Falls back to synchronous processing when Redis is not available.
 */

const InboundDeadLetter = require('../models/InboundDeadLetter');
const { appendCommunicationEvent } = require('./communicationEventWriter');
const {
  processRawInbound,
  InboundDispatchError
} = require('../platform/communication/inbound/inboundDispatcher');

const COMMUNICATION_INBOUND_QUEUE_NAMES = Object.freeze({
  EMAIL_INBOUND: 'communication:email:inbound'
});

const COMMUNICATION_INBOUND_RETRY_PROFILES = Object.freeze({
  EMAIL_INBOUND: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

let inboundQueue = null;

function isRedisConfigured() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim() || String(process.env.REDIS_HOST || '').trim()
  );
}

function getLegacyRedisUrl() {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

function initQueue() {
  if (inboundQueue !== null) return inboundQueue;
  if (!isRedisConfigured()) {
    inboundQueue = false;
    return false;
  }
  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = {
      defaultJobOptions: { ...COMMUNICATION_INBOUND_RETRY_PROFILES.EMAIL_INBOUND }
    };
    if (isTls) {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: { rejectUnauthorized: true }
      };
    } else {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      };
    }
    inboundQueue = new Bull(COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND, redisUrl, opts);
    inboundQueue.on('error', (err) => console.error('[inboundEmailQueue] Redis error:', err.message));
    return inboundQueue;
  } catch (err) {
    console.error('[inboundEmailQueue] Failed to init:', err.message);
    inboundQueue = false;
    return false;
  }
}

async function persistDeadLetter({
  organizationId = null,
  stage = 'unknown',
  reason = '',
  error = '',
  rawMimeBuffer = null,
  parsedSummary = {},
  context = {}
}) {
  try {
    const rawSizeBytes = Buffer.isBuffer(rawMimeBuffer) ? rawMimeBuffer.length : 0;
    const rawMimeBase64 = Buffer.isBuffer(rawMimeBuffer) && rawSizeBytes <= 5 * 1024 * 1024
      ? rawMimeBuffer.toString('base64')
      : '';
    const doc = await InboundDeadLetter.create({
      organizationId,
      stage,
      reason,
      error,
      rawMimeBase64,
      rawSizeBytes,
      parsedSummary,
      context
    });
    return doc;
  } catch (writeErr) {
    console.error('[inboundEmailQueue] Failed to persist dead-letter:', writeErr.message);
    return null;
  }
}

function rawMimeFromBase64(rawMimeBase64) {
  if (!rawMimeBase64) return null;
  try {
    return Buffer.from(rawMimeBase64, 'base64');
  } catch (err) {
    console.error('[inboundEmailQueue] Failed to decode raw MIME:', err.message);
    return null;
  }
}

/**
 * Enqueue an inbound MIME payload for async processing.
 * @returns {boolean} true when queued, false when fallback to sync is required.
 */
function enqueueInbound({ rawMimeBase64, headerOrganizationId = null }) {
  const queue = initQueue();
  if (!queue) return false;
  try {
    queue.add(
      { rawMimeBase64, headerOrganizationId },
      { ...COMMUNICATION_INBOUND_RETRY_PROFILES.EMAIL_INBOUND }
    );
    return true;
  } catch (err) {
    console.error('[inboundEmailQueue] Enqueue failed:', err.message);
    return false;
  }
}

/**
 * Process a single inbound job. Used by the worker and by direct sync fallback.
 * Persists a dead-letter entry on terminal failure so the message is recoverable.
 */
async function processInboundJob({ rawMimeBase64, headerOrganizationId = null, source = 'inbound-worker' }) {
  const rawBuffer = rawMimeFromBase64(rawMimeBase64);
  if (!rawBuffer) {
    await persistDeadLetter({
      stage: 'parse',
      reason: 'invalid_payload',
      error: 'rawMimeBase64 missing or undecodable',
      context: { source }
    });
    throw new Error('invalid_inbound_payload');
  }
  try {
    let organizationId = headerOrganizationId || null;
    if (!organizationId) {
      try {
        const { tryResolveInboundOrganizationId } = require('../platform/communication/inbound/inboundDispatcher');
        organizationId = await tryResolveInboundOrganizationId(rawBuffer);
      } catch {
        /* best-effort */
      }
    }

    const {
      shouldUseMailroomForOrganization,
      processRawMimeThroughMailroom
    } = require('../platform/mailroom/pipeline/emailInboundPipeline');

    if (organizationId && (await shouldUseMailroomForOrganization(organizationId))) {
      return processRawMimeThroughMailroom({
        rawMime: rawBuffer,
        headerOrganizationId: organizationId,
        source
      });
    }

    const result = await processRawInbound({
      rawMime: rawBuffer,
      headerOrganizationId,
      source
    });
    return result;
  } catch (err) {
    const stage = err instanceof InboundDispatchError ? err.stage : 'unknown';
    const summary = err?.parsedSummary || {};
    let organizationId = headerOrganizationId || null;
    if (!organizationId && rawBuffer) {
      try {
        const { tryResolveInboundOrganizationId } = require('../platform/communication/inbound/inboundDispatcher');
        organizationId = await tryResolveInboundOrganizationId(rawBuffer);
      } catch {
        /* best-effort for dead-letter scoping */
      }
    }
    await persistDeadLetter({
      organizationId: organizationId || null,
      stage,
      reason: err.message,
      error: err?.cause?.message || err.message,
      rawMimeBuffer: rawBuffer,
      parsedSummary: summary,
      context: { source }
    });
    if (organizationId) {
      await appendCommunicationEvent({
        organizationId,
        eventType: 'inbound_failed',
        source,
        payload: {
          stage,
          reason: err.message
        }
      });
    }
    throw err;
  }
}

async function getQueueStats() {
  const queue = initQueue();
  if (!queue) {
    return {
      queueAvailable: false,
      queueName: COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0
    };
  }
  try {
    const [waiting, active, delayed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount()
    ]);
    return {
      queueAvailable: true,
      queueName: COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND,
      waiting,
      active,
      delayed,
      failed
    };
  } catch (error) {
    return {
      queueAvailable: true,
      queueName: COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      error: error.message
    };
  }
}

function startWorker() {
  const queue = initQueue();
  if (!queue) return;
  queue.process(async (job) => {
    const { rawMimeBase64, headerOrganizationId } = job.data || {};
    await processInboundJob({
      rawMimeBase64,
      headerOrganizationId,
      source: 'inbound-worker'
    });
  });
  console.log('[inboundEmailQueue] Worker started');
}

async function closeQueue() {
  if (inboundQueue && inboundQueue !== false) {
    try {
      await inboundQueue.close();
    } catch (e) {
      console.error('[inboundEmailQueue] close error:', e.message);
    }
  }
  inboundQueue = null;
}

module.exports = {
  COMMUNICATION_INBOUND_QUEUE_NAMES,
  COMMUNICATION_INBOUND_RETRY_PROFILES,
  initQueue,
  enqueueInbound,
  processInboundJob,
  startWorker,
  getQueueStats,
  isQueueAvailable: () => !!initQueue(),
  closeQueue,
  persistDeadLetter,
  rawMimeFromBase64
};
