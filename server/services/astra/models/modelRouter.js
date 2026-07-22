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
  const config = await resolveConfig({
    organizationId,
    abilityKey,
    modelOverride: params.modelOverride || '',
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
  return {
    text: result.text || '',
    usage: result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    raw: result.raw,
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
