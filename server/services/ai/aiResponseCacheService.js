'use strict';

const crypto = require('crypto');
const AiResponseCache = require('../../models/AiResponseCache');
const { resolveEmbeddingModel } = require('../../constants/aiProviders');
const { getEmbeddingAdapter } = require('./providerRegistry');
const { cosineSimilarity } = require('./vector/vectorMath');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/** Paraphrase threshold for text-embedding-3-small (same meaning vs new intent). */
const SEMANTIC_SIMILARITY_THRESHOLD = 0.88;
const SEMANTIC_CANDIDATE_LIMIT = 40;

function normalizeQuestion(question) {
  return String(question || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildCacheKey({
  moduleKey,
  recordId,
  question = '',
  model = '',
  promptVersion = 'v0',
  agentId = '',
}) {
  return crypto
    .createHash('sha256')
    .update([
      String(moduleKey || '').toLowerCase(),
      String(recordId || ''),
      String(agentId || ''),
      normalizeQuestion(question),
      String(model || ''),
      String(promptVersion || ''),
    ].join('|'))
    .digest('hex');
}

/** Scope without question — groups paraphrases for the same record/agent/model. */
function buildScopeKey({
  moduleKey,
  recordId,
  model = '',
  promptVersion = 'v0',
  agentId = '',
}) {
  return crypto
    .createHash('sha256')
    .update([
      String(moduleKey || '').toLowerCase(),
      String(recordId || ''),
      String(agentId || ''),
      String(model || ''),
      String(promptVersion || ''),
    ].join('|'))
    .digest('hex');
}

function isFresh(cached, recordUpdatedAt) {
  if (!cached) return false;
  if (cached.expiresAt && new Date(cached.expiresAt).getTime() <= Date.now()) return false;
  if (recordUpdatedAt && cached.recordUpdatedAt) {
    return new Date(recordUpdatedAt).getTime() === new Date(cached.recordUpdatedAt).getTime();
  }
  return true;
}

async function embedQuestion(question, embedConfig) {
  const text = String(question || '').replace(/\s+/g, ' ').trim();
  if (!text || !embedConfig) return null;

  const embeddingProvider = embedConfig.embeddingProvider || 'openai';
  const apiKey = embedConfig.embeddingApiKey || embedConfig.apiKey;
  if (!apiKey) return null;

  try {
    const adapter = getEmbeddingAdapter(embeddingProvider);
    const embeddingModel = resolveEmbeddingModel(embeddingProvider);
    const embedded = await adapter.embed({
      apiKey,
      model: embeddingModel,
      texts: [text.slice(0, 2000)],
    });
    const vector = embedded.vectors?.[0];
    if (!Array.isArray(vector) || !vector.length) return null;
    return { vector, embeddingModel, usage: embedded.usage || null };
  } catch (error) {
    console.error('[AiResponseCache] embed failed:', error.message);
    return null;
  }
}

function pickBestSemanticMatch(candidates, queryVector, recordUpdatedAt) {
  let best = null;
  let bestScore = -1;
  for (const row of candidates || []) {
    if (!isFresh(row, recordUpdatedAt)) continue;
    if (!Array.isArray(row.questionEmbedding) || !row.questionEmbedding.length) continue;
    const score = cosineSimilarity(queryVector, row.questionEmbedding);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (!best || bestScore < SEMANTIC_SIMILARITY_THRESHOLD) {
    return { payload: null, score: bestScore };
  }
  return { payload: best.payload || null, score: bestScore, row: best };
}

/**
 * Exact key first, then semantic paraphrase match within the same scope.
 * Returns { payload, hit: 'exact'|'semantic'|null, similarity?: number }.
 */
async function lookupResponseCache({
  organizationId,
  abilityKey,
  cacheKey,
  scopeKey = null,
  question = '',
  recordUpdatedAt = null,
  embedConfig = null,
}) {
  try {
    const exact = await AiResponseCache.findOne({
      organizationId,
      abilityKey,
      cacheKey,
    }).lean();
    if (isFresh(exact, recordUpdatedAt)) {
      return { payload: exact.payload || null, hit: 'exact', similarity: 1 };
    }

    const embedded = await embedQuestion(question, embedConfig);
    if (!embedded?.vector || !scopeKey) {
      return { payload: null, hit: null };
    }

    const candidates = await AiResponseCache.find({
      organizationId,
      abilityKey,
      scopeKey,
      expiresAt: { $gt: new Date() },
      questionEmbedding: { $exists: true, $ne: [] },
    })
      .sort({ createdAt: -1 })
      .limit(SEMANTIC_CANDIDATE_LIMIT)
      .lean();

    const match = pickBestSemanticMatch(candidates, embedded.vector, recordUpdatedAt);
    if (!match.payload) {
      return { payload: null, hit: null, similarity: match.score, queryEmbedding: embedded };
    }
    return {
      payload: match.payload,
      hit: 'semantic',
      similarity: match.score,
      queryEmbedding: embedded,
    };
  } catch (error) {
    console.error('[AiResponseCache] lookup failed:', error.message);
    return { payload: null, hit: null };
  }
}

/** @deprecated prefer lookupResponseCache — kept for simple exact callers/tests */
async function readResponseCache({
  organizationId,
  abilityKey,
  cacheKey,
  recordUpdatedAt = null,
}) {
  const result = await lookupResponseCache({
    organizationId,
    abilityKey,
    cacheKey,
    recordUpdatedAt,
  });
  return result.payload;
}

async function writeResponseCache({
  organizationId,
  abilityKey,
  cacheKey,
  scopeKey = null,
  moduleKey = null,
  recordId = null,
  agentId = null,
  recordUpdatedAt = null,
  question = '',
  payload,
  provider = 'unknown',
  model = 'unknown',
  keyMode = 'platform',
  ttlMs = DEFAULT_TTL_MS,
  embedConfig = null,
  questionEmbedding = null,
  embeddingModel = null,
}) {
  try {
    let embedding = questionEmbedding;
    let embModel = embeddingModel;
    if (!embedding && question && embedConfig) {
      const embedded = await embedQuestion(question, embedConfig);
      embedding = embedded?.vector || null;
      embModel = embedded?.embeddingModel || null;
    }

    const resolvedScope = scopeKey || buildScopeKey({
      moduleKey,
      recordId,
      model,
      promptVersion: 'v0',
      agentId,
    });

    await AiResponseCache.findOneAndUpdate(
      { organizationId, abilityKey, cacheKey },
      {
        $set: {
          organizationId,
          abilityKey,
          cacheKey,
          scopeKey: resolvedScope,
          moduleKey,
          recordId: recordId ? String(recordId) : null,
          agentId: agentId ? String(agentId) : null,
          recordUpdatedAt: recordUpdatedAt || null,
          questionText: String(question || '').replace(/\s+/g, ' ').trim().slice(0, 2000) || null,
          ...(embedding ? { questionEmbedding: embedding, embeddingModel: embModel } : {}),
          payload,
          provider,
          model,
          keyMode,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('[AiResponseCache] write failed:', error.message);
  }
}

module.exports = {
  DEFAULT_TTL_MS,
  SEMANTIC_SIMILARITY_THRESHOLD,
  buildCacheKey,
  buildScopeKey,
  isFresh,
  embedQuestion,
  pickBestSemanticMatch,
  lookupResponseCache,
  readResponseCache,
  writeResponseCache,
};
