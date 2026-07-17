'use strict';

const Document = require('../models/Document');
const {
  buildEmbedding,
  cosineSimilarity,
  buildDocumentSemanticSource
} = require('../constants/documentSemanticSearch');
const { applyDocumentVisibilityFilter } = require('../utils/documentVisibility');
const { isAiSuiteEntitledForOrg } = require('../utils/addonAccessUtils');

const DEFAULT_LIMIT = 20;
const MAX_CANDIDATES = 500;
const VECTOR_TOP_K_MULTIPLIER = 5;

async function indexDocumentSemanticEmbedding({ organizationId, documentId, doc = null }) {
  const row = doc || await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!row) return null;

  const source = buildDocumentSemanticSource(row);
  const searchEmbedding = buildEmbedding(source);

  await Document.updateOne(
    { _id: documentId, organizationId },
    {
      $set: {
        searchEmbedding,
        semanticIndexedAt: new Date()
      }
    }
  );

  return searchEmbedding;
}

async function semanticSearchViaHash({
  organizationId,
  searchTerm,
  page,
  limit,
  visibilityContext
}) {
  const queryEmbedding = buildEmbedding(searchTerm);
  const baseQuery = {
    organizationId,
    deletedAt: null,
    searchEmbedding: { $exists: true, $ne: null }
  };

  if (visibilityContext) {
    applyDocumentVisibilityFilter(baseQuery, visibilityContext);
  }

  const candidates = await Document.find(baseQuery)
    .select('_id title documentNumber documentType status updatedAt searchEmbedding folderId assignedTo')
    .populate('folderId', 'name path')
    .sort({ updatedAt: -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  const scored = candidates
    .map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.searchEmbedding || [])
    }))
    .filter((row) => row.score > 0.05)
    .sort((a, b) => b.score - a.score);

  const total = scored.length;
  const skip = Math.max((page - 1) * limit, 0);
  const pageRows = scored.slice(skip, skip + limit);

  return {
    data: pageRows.map((row) => ({
      ...row.doc,
      semanticScore: Number(row.score.toFixed(4)),
      folderName: row.doc.folderId?.name || null,
      semanticBackend: 'hash'
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

/**
 * Phase 1: prefer real AI vector chunks; fall back to Document.searchEmbedding hash path.
 */
async function semanticSearchViaVectorStore({
  organizationId,
  searchTerm,
  page,
  limit,
  visibilityContext
}) {
  const { resolveAiRequestConfig } = require('./ai/aiSettingsResolver');
  const { getEmbeddingAdapter } = require('./ai/providerRegistry');
  const { getVectorStore } = require('./ai/vector/vectorStoreRegistry');
  const { resolveEmbeddingModel } = require('../constants/aiProviders');

  const config = await resolveAiRequestConfig({
    organizationId,
    abilityKey: 'embed',
  });
  const embeddingProvider = config.embeddingProvider || config.provider;
  const embeddingModel = resolveEmbeddingModel(embeddingProvider);
  const adapter = getEmbeddingAdapter(embeddingProvider);
  const embedded = await adapter.embed({
    apiKey: config.embeddingApiKey || config.apiKey,
    model: embeddingModel,
    texts: [searchTerm],
  });
  const vector = embedded.vectors?.[0] || [];
  if (!vector.length) {
    return null;
  }

  const store = getVectorStore();
  const topK = Math.min(MAX_CANDIDATES, Math.max(limit * VECTOR_TOP_K_MULTIPLIER, limit));
  const hits = await store.search({
    organizationId,
    vector,
    topK,
    filters: { sourceType: 'document' },
  });

  if (!hits.length) {
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 1 }
    };
  }

  // Dedupe by sourceId keeping best score
  const bestBySource = new Map();
  for (const hit of hits) {
    const sourceId = String(hit.sourceId || '');
    if (!sourceId) continue;
    const existing = bestBySource.get(sourceId);
    if (!existing || Number(hit.score || 0) > Number(existing.score || 0)) {
      bestBySource.set(sourceId, hit);
    }
  }

  const sourceIds = Array.from(bestBySource.keys());
  const baseQuery = {
    organizationId,
    deletedAt: null,
    _id: { $in: sourceIds },
  };
  if (visibilityContext) {
    applyDocumentVisibilityFilter(baseQuery, visibilityContext);
  }

  const docs = await Document.find(baseQuery)
    .select('_id title documentNumber documentType status updatedAt folderId assignedTo')
    .populate('folderId', 'name path')
    .lean();

  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const scored = [];
  for (const [sourceId, hit] of bestBySource.entries()) {
    const doc = byId.get(sourceId);
    if (!doc) continue;
    scored.push({
      doc,
      score: Number(hit.score || 0),
    });
  }
  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const skip = Math.max((page - 1) * limit, 0);
  const pageRows = scored.slice(skip, skip + limit);

  return {
    data: pageRows.map((row) => ({
      ...row.doc,
      semanticScore: Number(row.score.toFixed(4)),
      folderName: row.doc.folderId?.name || null,
      semanticBackend: 'vector'
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

async function semanticSearchDocuments({
  organizationId,
  queryText,
  page = 1,
  limit = DEFAULT_LIMIT,
  visibilityContext = null
}) {
  const searchTerm = String(queryText || '').trim();
  if (!searchTerm) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } };
  }

  try {
    const entitled = await isAiSuiteEntitledForOrg(organizationId);
    if (entitled) {
      const vectorResult = await semanticSearchViaVectorStore({
        organizationId,
        searchTerm,
        page,
        limit,
        visibilityContext,
      });
      if (vectorResult) return vectorResult;
    }
  } catch (error) {
    console.warn(
      '[documentSemanticIndex] Vector semantic search unavailable; falling back to hash:',
      error.message
    );
  }

  return semanticSearchViaHash({
    organizationId,
    searchTerm,
    page,
    limit,
    visibilityContext,
  });
}

module.exports = {
  indexDocumentSemanticEmbedding,
  semanticSearchDocuments
};
