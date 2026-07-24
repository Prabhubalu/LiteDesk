'use strict';

/**
 * Grounded knowledge retriever — shared by Astra knowledge.search, case drafts, Live Chat bot.
 */

const { getVectorStore } = require('../../ai/vector/vectorStoreRegistry');
const { resolveAiRequestConfig } = require('../../ai/aiSettingsResolver');
const { getEmbeddingAdapter } = require('../../ai/providerRegistry');
const { resolveEmbeddingModel } = require('../../../constants/aiProviders');
const LiveChatWebsiteContentPage = require('../../../models/LiveChatWebsiteContentPage');
const AstraKnowledgeSources = require('../../../models/AstraKnowledgeSources');

const MIN_SCORE_PUBLIC = 0.55;
const MIN_SCORE_INTERNAL = 0.45;

async function loadOrgKnowledgeSources(organizationId) {
  if (!organizationId) {
    return {
      articlesEnabled: true,
      documentsEnabled: true,
      websiteEnabled: true,
    };
  }
  try {
    const doc = await AstraKnowledgeSources.findOne({ organizationId }).lean();
    if (!doc) {
      return { articlesEnabled: true, documentsEnabled: true, websiteEnabled: true };
    }
    return {
      articlesEnabled: doc.articlesEnabled !== false,
      documentsEnabled: doc.documentsEnabled !== false,
      websiteEnabled: doc.websiteEnabled !== false,
    };
  } catch {
    return { articlesEnabled: true, documentsEnabled: true, websiteEnabled: true };
  }
}

function sourceTypesForAudience(audience, sources) {
  const types = [];
  if (sources.articlesEnabled) types.push('article');
  if (sources.documentsEnabled && audience === 'internal') types.push('document');
  if (sources.websiteEnabled) types.push('website');
  return types;
}

async function embedQuery(organizationId, query) {
  const text = String(query || '').trim();
  if (!text) return null;
  try {
    const cfg = await resolveAiRequestConfig({ organizationId, purpose: 'embedding' });
    const embeddingModel = resolveEmbeddingModel(cfg);
    const adapter = getEmbeddingAdapter(cfg);
    if (!adapter || typeof adapter.embed !== 'function') return null;
    const vectors = await adapter.embed({
      texts: [text],
      model: embeddingModel,
      organizationId,
    });
    return Array.isArray(vectors?.[0]) ? vectors[0] : null;
  } catch {
    return null;
  }
}

/**
 * Lexical fallback over curated website pages (and empty otherwise).
 */
async function lexicalWebsiteFallback(organizationId, query, audience, topK) {
  if (!organizationId) return [];
  const q = String(query || '').toLowerCase();
  const tokens = q.split(/\W+/).filter((t) => t.length > 2).slice(0, 12);
  if (!tokens.length) return [];

  const filter = { organizationId, enabled: true };
  if (audience === 'public') {
    filter.$or = [{ audience: 'public' }, { audience: { $exists: false } }];
  }

  let pages = [];
  try {
    pages = await LiveChatWebsiteContentPage.find(filter).limit(80).lean();
  } catch {
    return [];
  }

  const scored = pages.map((p) => {
    const hay = `${p.title || ''} ${p.body || ''}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 1;
    }
    return {
      id: String(p._id),
      title: p.title || 'Website page',
      text: String(p.body || '').slice(0, 800),
      score: score / Math.max(tokens.length, 1),
      sourceType: 'website',
      sourceId: String(p._id),
      citation: {
        title: p.title || 'Website page',
        url: p.sourceUrl || p.matchPath || null,
        sourceType: 'website',
        id: String(p._id),
      },
    };
  }).filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * @param {{ organizationId: string, query: string, audience?: 'internal'|'public', topK?: number, sourceTypes?: string[] }} args
 */
async function groundedRetrieve({
  organizationId,
  query,
  audience = 'internal',
  topK = 5,
  sourceTypes = null,
  vectorStore = null,
  minScore = null,
} = {}) {
  const aud = audience === 'public' ? 'public' : 'internal';
  const limit = Math.min(Math.max(Number(topK) || 5, 1), 20);
  const threshold = minScore != null
    ? Number(minScore)
    : (aud === 'public' ? MIN_SCORE_PUBLIC : MIN_SCORE_INTERNAL);

  const sources = await loadOrgKnowledgeSources(organizationId);
  const allowedTypes = Array.isArray(sourceTypes) && sourceTypes.length
    ? sourceTypes
    : sourceTypesForAudience(aud, sources);

  if (!allowedTypes.length) {
    return {
      hits: [],
      counts: { total: 0 },
      guidance: 'No knowledge sources are enabled for this organization.',
      weak: true,
      audience: aud,
      citations: [],
    };
  }

  const store = vectorStore || getVectorStore();
  const vector = await embedQuery(organizationId, query);
  let hits = [];

  if (store && typeof store.search === 'function' && vector) {
    // Prefer per-type searches then merge (filters only support one sourceType)
    const perType = await Promise.all(
      allowedTypes.map(async (sourceType) => {
        try {
          return await store.search({
            organizationId,
            vector,
            topK: limit,
            filters: { sourceType },
          });
        } catch {
          return [];
        }
      }),
    );
    const merged = perType.flat().map((m) => ({
      id: m.chunkId || m.sourceId,
      title: m.moduleKey || m.sourceType || 'Knowledge',
      text: m.text || '',
      score: Number(m.score) || 0,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      citation: {
        title: m.moduleKey || m.sourceType || 'Knowledge',
        url: null,
        sourceType: m.sourceType,
        id: String(m.sourceId || m.chunkId || ''),
        snippet: String(m.text || '').slice(0, 240),
      },
    }));
    hits = merged.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  if (!hits.length && allowedTypes.includes('website')) {
    hits = await lexicalWebsiteFallback(organizationId, query, aud, limit);
  }

  const strong = hits.filter((h) => h.score >= threshold);
  const weak = strong.length === 0;
  const finalHits = weak ? hits.slice(0, Math.min(3, hits.length)) : strong;

  return {
    hits: finalHits,
    counts: { total: finalHits.length },
    guidance: weak
      ? (finalHits.length
        ? 'Low-confidence matches only — do not invent facts beyond these snippets.'
        : 'No grounded knowledge found. Do not invent an answer.')
      : 'Grounded in your knowledge base.',
    weak,
    audience: aud,
    citations: finalHits.map((h) => h.citation).filter(Boolean),
    refuse: weak && finalHits.length === 0,
  };
}

/**
 * Adapter used by knowledge.search tool (vectorStore.port.query shape).
 */
function createVectorStoreQueryAdapter(organizationId) {
  return {
    async query({ query, topK, audience, organizationId: orgFromCall }) {
      const result = await groundedRetrieve({
        organizationId: orgFromCall || organizationId,
        query,
        topK,
        audience: audience || 'internal',
      });
      return result.hits.map((h) => ({
        id: h.id,
        text: h.text,
        score: h.score,
        metadata: { title: h.title, sourceType: h.sourceType, citation: h.citation },
      }));
    },
    async search(args) {
      const store = getVectorStore();
      return store.search(args);
    },
  };
}

module.exports = {
  groundedRetrieve,
  createVectorStoreQueryAdapter,
  loadOrgKnowledgeSources,
  MIN_SCORE_PUBLIC,
  MIN_SCORE_INTERNAL,
};
