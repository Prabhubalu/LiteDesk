const AI_EMBED_QUEUE_NAME = 'ai:embed';
const AI_EMBED_RETRY_PROFILE = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
});
const AI_EMBED_WORKER_CONCURRENCY = Number(process.env.AI_EMBED_WORKER_CONCURRENCY || 2);

let aiEmbedQueue = null;

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
  if (aiEmbedQueue !== null) return aiEmbedQueue;
  if (!isRedisConfigured()) {
    aiEmbedQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...AI_EMBED_RETRY_PROFILE } };
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

    aiEmbedQueue = new Bull(AI_EMBED_QUEUE_NAME, redisUrl, opts);
    aiEmbedQueue.on('error', (err) => console.error('[aiEmbedQueue] Redis error:', err.message));
    return aiEmbedQueue;
  } catch (error) {
    console.error('[aiEmbedQueue] Failed to init:', error.message);
    aiEmbedQueue = false;
    return false;
  }
}

function runEmbedInline(jobData) {
  setImmediate(() => {
    const {
      embedDocumentSource,
      embedContentDocumentSource,
    } = require('./aiEmbedService');
    const runner = jobData.contentDocumentId
      ? embedContentDocumentSource({
        organizationId: jobData.organizationId,
        contentDocumentId: jobData.contentDocumentId,
        userId: jobData.userId,
      })
      : embedDocumentSource({
        organizationId: jobData.organizationId,
        documentId: jobData.documentId,
        userId: jobData.userId,
      });
    runner.catch((error) => {
      console.error('[aiEmbedQueue] Inline embed failed:', error.message);
    });
  });
}

function enqueueDocumentEmbed({ organizationId, documentId, userId = null }) {
  const payload = {
    kind: 'document',
    organizationId: organizationId ? String(organizationId) : null,
    documentId: String(documentId),
    userId: userId ? String(userId) : null,
  };

  const queue = initQueue();
  if (!queue) {
    runEmbedInline(payload);
    return { mode: 'inline' };
  }

  try {
    queue.add(payload, {
      jobId: `ai-embed-document-${organizationId}-${documentId}`,
      ...AI_EMBED_RETRY_PROFILE,
    });
    return { mode: 'queued' };
  } catch (error) {
    console.error('[aiEmbedQueue] Enqueue failed, falling back to inline:', error.message);
    runEmbedInline(payload);
    return { mode: 'inline-fallback' };
  }
}

function enqueueContentDocumentEmbed({ organizationId, contentDocumentId, userId = null }) {
  const payload = {
    kind: 'content_document',
    organizationId: organizationId ? String(organizationId) : null,
    contentDocumentId: String(contentDocumentId),
    userId: userId ? String(userId) : null,
  };

  const queue = initQueue();
  if (!queue) {
    runEmbedInline(payload);
    return { mode: 'inline' };
  }

  try {
    queue.add(payload, {
      jobId: `ai-embed-content-${organizationId}-${contentDocumentId}`,
      ...AI_EMBED_RETRY_PROFILE,
    });
    return { mode: 'queued' };
  } catch (error) {
    console.error('[aiEmbedQueue] Content enqueue failed, falling back to inline:', error.message);
    runEmbedInline(payload);
    return { mode: 'inline-fallback' };
  }
}

function startWorker() {
  const queue = initQueue();
  if (!queue) {
    console.log('[aiEmbedQueue] Redis unavailable — embeds run inline in API process');
    return false;
  }

  const {
    embedDocumentSource,
    embedContentDocumentSource,
  } = require('./aiEmbedService');
  queue.process(AI_EMBED_WORKER_CONCURRENCY, async (job) => {
    const {
      organizationId,
      documentId,
      contentDocumentId,
      userId,
      kind,
    } = job.data || {};
    if (!organizationId) {
      throw new Error('organizationId is required');
    }
    if (kind === 'content_document' || contentDocumentId) {
      if (!contentDocumentId) throw new Error('contentDocumentId is required');
      return embedContentDocumentSource({ organizationId, contentDocumentId, userId });
    }
    if (!documentId) {
      throw new Error('documentId is required');
    }
    return embedDocumentSource({ organizationId, documentId, userId });
  });

  console.log(`[aiEmbedQueue] Worker started (${AI_EMBED_QUEUE_NAME}, concurrency=${AI_EMBED_WORKER_CONCURRENCY})`);
  return true;
}

async function closeQueue() {
  if (aiEmbedQueue && aiEmbedQueue !== false) {
    await aiEmbedQueue.close();
    aiEmbedQueue = null;
  }
}

module.exports = {
  AI_EMBED_QUEUE_NAME,
  enqueueDocumentEmbed,
  enqueueContentDocumentEmbed,
  startWorker,
  closeQueue,
};
