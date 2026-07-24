'use strict';

/**
 * Vector memory for agent catalog — routing + duplicate ≥0.88 merge signals.
 */

const crypto = require('crypto');
const AstraTenantAgent = require('../../../models/AstraTenantAgent');
const { resolveAiRequestConfig } = require('../../ai/aiSettingsResolver');
const { getEmbeddingAdapter } = require('../../ai/providerRegistry');
const { resolveEmbeddingModel } = require('../../../constants/aiProviders');
const { cosineSimilarity } = require('../../ai/vector/vectorMath');

function agentEmbedText(agent) {
  return [
    agent.title || '',
    agent.description || '',
    ...(agent.triggerPhrases || []),
    ...(agent.toolAllowlist || []).slice(0, 20),
  ].join('\n').slice(0, 4000);
}

async function embedTexts(organizationId, texts) {
  const cfg = await resolveAiRequestConfig({ organizationId, purpose: 'embedding' });
  const embeddingModel = resolveEmbeddingModel(cfg);
  const adapter = getEmbeddingAdapter(cfg);
  if (!adapter?.embed) return null;
  return adapter.embed({ texts, model: embeddingModel, organizationId });
}

async function upsertAgentEmbedding(organizationId, agentDoc) {
  if (!organizationId || !agentDoc) return null;
  try {
    const text = agentEmbedText(agentDoc);
    const vectors = await embedTexts(organizationId, [text]);
    if (!vectors?.[0]) return null;
    await AstraTenantAgent.updateOne(
      { _id: agentDoc._id || agentDoc.id, organizationId },
      { $set: { embedding: vectors[0] } },
    );
    return vectors[0];
  } catch (err) {
    console.warn('[agentVectorMemory] upsert failed:', err?.message || err);
    return null;
  }
}

async function findSimilarAgents(organizationId, queryText, { minScore = 0.88, limit = 5 } = {}) {
  if (!organizationId || !queryText) return [];
  try {
    const vectors = await embedTexts(organizationId, [String(queryText)]);
    const queryVec = vectors?.[0];
    if (!queryVec) return [];
    const agents = await AstraTenantAgent.find({
      organizationId,
      enabled: true,
      embedding: { $exists: true, $ne: null },
    })
      .select('key title description toolAllowlist embedding triggerPhrases')
      .limit(200)
      .lean();

    return agents
      .map((a) => ({
        key: a.key,
        title: a.title,
        score: cosineSimilarity(queryVec, a.embedding || []),
      }))
      .filter((a) => a.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function backfillOrgAgentEmbeddings(organizationId) {
  const agents = await AstraTenantAgent.find({ organizationId, enabled: true }).limit(100);
  let n = 0;
  for (const ag of agents) {
    const vec = await upsertAgentEmbedding(organizationId, ag);
    if (vec) n += 1;
  }
  return { embedded: n };
}

module.exports = {
  agentEmbedText,
  upsertAgentEmbedding,
  findSimilarAgents,
  backfillOrgAgentEmbeddings,
};
