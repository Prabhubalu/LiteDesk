'use strict';

const crypto = require('crypto');

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

/** @type {Map<string, { buffer: Buffer, mimeType: string, expiresAt: number }>} */
const cache = new Map();

function stableStringify(value) {
  if (value == null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function buildRenderCacheKey(parts) {
  return crypto.createHash('sha256').update(stableStringify(parts)).digest('hex');
}

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function enforceMaxEntries() {
  while (cache.size > DEFAULT_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey == null) break;
    cache.delete(oldestKey);
  }
}

/**
 * @param {string} key
 * @returns {{ buffer: Buffer, mimeType: string } | null}
 */
function getCachedRender(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return { buffer: entry.buffer, mimeType: entry.mimeType };
}

/**
 * @param {string} key
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {number} [ttlMs]
 */
function setCachedRender(key, buffer, mimeType, ttlMs = DEFAULT_TTL_MS) {
  pruneExpired();
  cache.set(key, {
    buffer,
    mimeType,
    expiresAt: Date.now() + ttlMs
  });
  enforceMaxEntries();
}

function clearRenderPreviewCache() {
  cache.clear();
}

module.exports = {
  buildRenderCacheKey,
  getCachedRender,
  setCachedRender,
  clearRenderPreviewCache
};
