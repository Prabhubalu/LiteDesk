'use strict';

/**
 * modelRouter — Astra v2 Models layer.
 *
 * Thin composition over the existing, battle-tested AI primitives:
 *   - providerRegistry     (LLM + embedding adapters, circuit-broken)
 *   - aiSettingsResolver   (org settings, model + key resolution, consent/credits)
 *   - vectorStoreRegistry  (Atlas / Mongo / memory VectorStorePort)
 *
 * The orchestrator only talks to this router, never to providers directly.
 * Implements LlmPort + EmbeddingPort + exposes the VectorStorePort.
 */

const { getLlmAdapter, getEmbeddingAdapter } = require('../../ai/providerRegistry');
const { resolveAiRequestConfig } = require('../../ai/aiSettingsResolver');
const { getVectorStore } = require('../../ai/vector/vectorStoreRegistry');
const { assertCreditsAvailable, debitCredits } = require('../../ai/aiCreditService');
const { AI_KEY_MODES } = require('../../../constants/aiProviders');

/**
 * Resolve provider/model/key config for an org + ability.
 * @param {{ organizationId: string, abilityKey: string, modelOverride?: string }} params
 */
async function resolveConfig({ organizationId, abilityKey, modelOverride = '' }) {
  return resolveAiRequestConfig({ organizationId, abilityKey, modelOverride });
}

/**
 * LlmPort.complete — resolve config then call the provider adapter.
 * @param {string} organizationId
 * @param {string} abilityKey
 * @param {import('./ports/llmPort').LlmCompleteParams} params
 * @returns {Promise<import('./ports/llmPort').LlmCompletion & { config: object }>}
 */
async function complete(organizationId, abilityKey, params = {}) {
  const started = Date.now();
  const config = await resolveConfig({
    organizationId,
    abilityKey,
    modelOverride: params.modelOverride || '',
  });

  // Platform key: gate + debit. BYOK: no token debit.
  assertCreditsAvailable({
    keyMode: config.keyMode,
    creditsBalance: config.creditsBalance,
  });

  const adapter = getLlmAdapter(config.provider);
  const result = await adapter.complete({
    apiKey: config.apiKey,
    model: config.model,
    messages: params.messages || [],
    temperature: params.temperature ?? 0.2,
    maxTokens: params.maxTokens ?? 800,
    providerOptions: config.providerOptions,
  });
  const usage = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const creditsDebited = await debitCredits({
    organizationId,
    keyMode: config.keyMode || AI_KEY_MODES.PLATFORM,
    usage,
  });

  // Ask orchestrator sets skipAudit and writes one rolled-up row per turn.
  if (params.skipAudit !== true && organizationId) {
    try {
      const { writeAiAuditLog } = require('../../ai/aiAuditLogService');
      await writeAiAuditLog({
        organizationId,
        userId: params.userId || null,
        abilityKey: abilityKey || 'astra_v2_ask',
        provider: config.provider || 'unknown',
        model: config.model || abilityKey,
        keyMode: config.keyMode || AI_KEY_MODES.PLATFORM,
        promptVersion: params.promptVersion || 'astra-v2',
        status: 'success',
        usage,
        creditsDebited,
        latencyMs: Date.now() - started,
        metadata: params.auditMetadata || null,
      });
    } catch (err) {
      console.warn('[modelRouter] audit write failed:', err?.message || err);
    }
  }

  return {
    text: result.text || '',
    usage,
    raw: result.raw,
    creditsDebited,
    config,
  };
}

/**
 * EmbeddingPort.embed — resolve config then call the embedding adapter.
 * @param {string} organizationId
 * @param {string[]} inputs
 */
async function embed(organizationId, inputs = []) {
  const config = await resolveConfig({ organizationId, abilityKey: 'embed' });
  const adapter = getEmbeddingAdapter(config.embeddingProvider);
  const result = await adapter.embed({
    apiKey: config.embeddingApiKey,
    inputs: Array.isArray(inputs) ? inputs : [inputs],
  });
  return result;
}

/** VectorStorePort accessor. */
function vectorStore() {
  return getVectorStore();
}

module.exports = {
  resolveConfig,
  complete,
  embed,
  vectorStore,
};
