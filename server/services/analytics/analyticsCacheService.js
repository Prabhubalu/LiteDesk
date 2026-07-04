const crypto = require('node:crypto');
const { createClient } = require('redis');
const { ANALYTICS_DEFAULT_CACHE_TTL_SECONDS } = require('../../constants/analyticsExecution');

const CACHE_PREFIX = 'analytics:result:';

let redisClient = null;
let redisInitAttempted = false;

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

async function getRedisClient() {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  if (!isRedisConfigured()) {
    return null;
  }

  const url = process.env.REDIS_URL || getLegacyRedisUrl();
  try {
    const client = createClient({ url });
    client.on('error', (err) => {
      console.error('[analyticsCache] Redis error:', err.message);
    });
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (err) {
    console.error('[analyticsCache] Failed to connect:', err.message);
    return null;
  }
}

function stableSerialize(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {object} params
 */
function buildCacheKey(params) {
  const {
    organizationId,
    reportId,
    reportVersion,
    userId,
    runtimeFilters,
    matrixDrill,
  } = params;

  const filterHash = crypto
    .createHash('sha256')
    .update(
      stableSerialize({
        runtimeFilters: runtimeFilters || {},
        matrixDrill: matrixDrill || {},
      }),
    )
    .digest('hex')
    .slice(0, 16);

  const userHash = crypto
    .createHash('sha256')
    .update(String(userId || ''))
    .digest('hex')
    .slice(0, 16);

  return `${CACHE_PREFIX}${organizationId}:${reportId}:${reportVersion || 0}:${userHash}:${filterHash}`;
}

async function getCachedResult(cacheKey) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[analyticsCache] get failed:', err.message);
    return null;
  }
}

async function setCachedResult(cacheKey, payload, ttlSeconds = ANALYTICS_DEFAULT_CACHE_TTL_SECONDS) {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    await client.setEx(cacheKey, ttlSeconds, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[analyticsCache] set failed:', err.message);
    return false;
  }
}

async function invalidateReportCache(organizationId, reportId) {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const pattern = `${CACHE_PREFIX}${organizationId}:${reportId}:*`;
    let cursor = 0;
    let deleted = 0;

    do {
      const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      const keys = reply.keys || [];
      if (keys.length > 0) {
        await client.del(keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);

    return deleted;
  } catch (err) {
    console.error('[analyticsCache] invalidate failed:', err.message);
    return 0;
  }
}

module.exports = {
  buildCacheKey,
  getCachedResult,
  setCachedResult,
  invalidateReportCache,
  isRedisConfigured,
};
