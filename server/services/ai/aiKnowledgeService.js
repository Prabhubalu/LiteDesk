const { resolveEmbeddingModel } = require('../../constants/aiProviders');
const { getLlmAdapter, getEmbeddingAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { getVectorStore } = require('./vector/vectorStoreRegistry');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText, redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const DEFAULT_TOP_K = 5;
const MIN_SCORE = 0.18;
const MAX_EXCERPT_CHARS = 500;
const MAX_QUESTION_CHARS = 2000;

function normalizeQuestion(question) {
  return redactText(String(question || '').replace(/\s+/g, ' ').trim()).slice(0, MAX_QUESTION_CHARS);
}

function filterHitsByScore(hits, { minScore = MIN_SCORE, topK = DEFAULT_TOP_K } = {}) {
  return (hits || [])
    .filter((hit) => Number(hit.score || 0) >= minScore)
    .slice(0, Math.max(1, Number(topK) || DEFAULT_TOP_K));
}

function formatCitations(hits) {
  return (hits || []).map((hit, index) => ({
    index: index + 1,
    chunkId: hit.chunkId,
    sourceType: hit.sourceType,
    sourceId: hit.sourceId,
    chunkIndex: hit.chunkIndex,
    score: Number(hit.score || 0),
    excerpt: String(hit.text || '').slice(0, MAX_EXCERPT_CHARS),
  }));
}

function buildRagUserPrompt(question, citations) {
  if (!citations.length) {
    return [
      `Question: ${question}`,
      '',
      'No knowledge excerpts were retrieved.',
      'Respond that you could not find an answer in the organization knowledge base. Do not invent facts.',
    ].join('\n');
  }

  const blocks = citations.map((citation) => (
    `[${citation.index}] sourceType=${citation.sourceType} sourceId=${citation.sourceId} score=${citation.score.toFixed(3)}\n${citation.excerpt}`
  ));

  return [
    `Question: ${question}`,
    '',
    'Answer using only the excerpts below. Cite sources as [n]. If the excerpts are insufficient, say you could not find an answer.',
    '',
    'Excerpts:',
    ...blocks,
  ].join('\n');
}

async function askKnowledge({
  organizationId,
  userId,
  question,
  topK = DEFAULT_TOP_K,
  sourceType = null,
  abilityKey = 'ask',
  promptKey = 'ask_knowledge_system',
  hitFilter = null,
}) {
  const startedAt = Date.now();
  const normalizedQuestion = normalizeQuestion(question);
  let auditBase = {
    organizationId,
    userId,
    abilityKey,
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  if (!normalizedQuestion) {
    throw new AiConfigurationError('Question is required', 'AI_QUESTION_REQUIRED');
  }

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: abilityKey === 'portal_ask' ? 'ask' : abilityKey });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    assertCreditsAvailable({
      keyMode: config.keyMode,
      creditsBalance: config.creditsBalance,
    });

    const embeddingAdapter = getEmbeddingAdapter(config.embeddingProvider);
    const embeddingModel = resolveEmbeddingModel(config.embeddingProvider);
    const embedded = await embeddingAdapter.embed({
      apiKey: config.embeddingApiKey || config.apiKey,
      model: embeddingModel,
      texts: [normalizedQuestion],
    });

    const queryVector = embedded.vectors?.[0] || [];
    const store = getVectorStore();
    const filters = {};
    if (sourceType) filters.sourceType = sourceType;

    const rawHits = await store.search({
      organizationId,
      vector: queryVector,
      topK: Math.max(Number(topK) || DEFAULT_TOP_K, DEFAULT_TOP_K) * (hitFilter ? 2 : 1),
      filters,
    });
    let hits = filterHitsByScore(rawHits, { topK: hitFilter ? DEFAULT_TOP_K * 2 : topK });
    if (typeof hitFilter === 'function') {
      hits = await hitFilter(hits);
      hits = hits.slice(0, Math.max(1, Number(topK) || DEFAULT_TOP_K));
    }
    const citations = formatCitations(hits);

    const systemPrompt = getPrompt(promptKey);
    const adapter = getLlmAdapter(config.provider);
    const messages = redactMessages([
      {
        role: 'system',
        content: systemPrompt.text,
      },
      {
        role: 'user',
        content: buildRagUserPrompt(normalizedQuestion, citations),
      },
    ]);

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages,
      temperature: 0.2,
      maxTokens: 600,
      providerOptions: config.providerOptions,
    });

    const combinedUsage = {
      promptTokens:
        Number(embedded.usage?.promptTokens || 0) + Number(completion.usage?.promptTokens || 0),
      completionTokens: Number(completion.usage?.completionTokens || 0),
      totalTokens:
        Number(embedded.usage?.totalTokens || 0) + Number(completion.usage?.totalTokens || 0),
    };

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: combinedUsage,
    });

    const answer = String(completion.text || '').trim();
    const found = citations.length > 0;

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: citations.map((citation) => ({
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        moduleKey: 'knowledge',
      })),
      usage: combinedUsage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      answer,
      found,
      citations,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: error?.code?.includes('NOT') || error?.code?.includes('DISABLED') || error?.code?.includes('CONSENT') || error?.code?.includes('CREDITS') || error?.code?.includes('KEY') || error?.code?.includes('QUESTION')
        ? 'not_configured'
        : 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_ASK_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

const PORTAL_ASK_DISCLAIMER =
  'Answers are generated from published help articles only and may be incomplete. Contact support for account-specific help.';

/**
 * Customer-tier Ask: KB articles only, portal-visible citation filter, containment tracking.
 */
async function askPortalKnowledge({
  organizationId,
  userId,
  question,
  topK = DEFAULT_TOP_K,
  isPortalVisibleArticle = null,
}) {
  const portalKnowledgeService = require('../portalKnowledgeService');
  const visibilityFn =
    typeof isPortalVisibleArticle === 'function'
      ? isPortalVisibleArticle
      : async (sourceId) => {
          const doc = await portalKnowledgeService.getPortalKnowledgeArticle({
            organizationId,
            documentId: sourceId,
          });
          return Boolean(doc);
        };

  const visibleCache = new Map();
  async function hitFilter(hits) {
    const out = [];
    for (const hit of hits || []) {
      if (hit.sourceType && hit.sourceType !== 'article') continue;
      const id = String(hit.sourceId || '');
      if (!id) continue;
      if (!visibleCache.has(id)) {
        visibleCache.set(id, await visibilityFn(id));
      }
      if (visibleCache.get(id)) out.push(hit);
    }
    return out;
  }

  const result = await askKnowledge({
    organizationId,
    userId,
    question,
    topK,
    sourceType: 'article',
    abilityKey: 'portal_ask',
    promptKey: 'ask_portal_knowledge_system',
    hitFilter,
  });

  const contained = Boolean(result.found && result.citations?.length);
  return {
    ...result,
    tier: 'customer',
    corpus: 'portal_knowledge',
    disclaimer: PORTAL_ASK_DISCLAIMER,
    containment: {
      contained,
      escalateSuggested: !contained,
      citationCount: Array.isArray(result.citations) ? result.citations.length : 0,
    },
  };
}

module.exports = {
  askKnowledge,
  askPortalKnowledge,
  normalizeQuestion,
  filterHitsByScore,
  formatCitations,
  buildRagUserPrompt,
  PORTAL_ASK_DISCLAIMER,
  MIN_SCORE,
};
