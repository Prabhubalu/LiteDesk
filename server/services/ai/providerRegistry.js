const { AI_PROVIDERS } = require('../../constants/aiProviders');
const {
  createOpenAiLlmAdapter,
  createOpenRouterLlmAdapter,
  createNvidiaLlmAdapter,
} = require('./adapters/openAiLlmAdapter');
const { createAzureOpenAiLlmAdapter } = require('./adapters/azureOpenAiLlmAdapter');
const { createAnthropicLlmAdapter } = require('./adapters/anthropicLlmAdapter');
const { createGeminiLlmAdapter } = require('./adapters/geminiLlmAdapter');
const { createOpenAiEmbeddingAdapter, createOpenRouterEmbeddingAdapter } = require('./adapters/openAiEmbeddingAdapter');
const { wrapLlmAdapter } = require('./aiCircuitBreaker');
const { AiConfigurationError } = require('./errors');

const llmAdapters = new Map([
  [AI_PROVIDERS.OPENAI, createOpenAiLlmAdapter()],
  [AI_PROVIDERS.AZURE_OPENAI, createAzureOpenAiLlmAdapter()],
  [AI_PROVIDERS.ANTHROPIC, createAnthropicLlmAdapter()],
  [AI_PROVIDERS.GEMINI, createGeminiLlmAdapter()],
  [AI_PROVIDERS.OPENROUTER, createOpenRouterLlmAdapter()],
  [AI_PROVIDERS.NVIDIA, createNvidiaLlmAdapter()],
]);

const embeddingAdapters = new Map([
  [AI_PROVIDERS.OPENAI, createOpenAiEmbeddingAdapter()],
  [AI_PROVIDERS.OPENROUTER, createOpenRouterEmbeddingAdapter()],
]);

function getLlmAdapter(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  const adapter = llmAdapters.get(normalized);
  if (!adapter) {
    throw new AiConfigurationError(`LLM provider ${normalized || '(empty)'} is not configured`, 'AI_PROVIDER_NOT_CONFIGURED');
  }
  return wrapLlmAdapter(normalized, adapter);
}

function getEmbeddingAdapter(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  const adapter = embeddingAdapters.get(normalized);
  if (adapter) return adapter;

  // Azure / Anthropic / Gemini orgs often share OpenAI embeddings via platform key.
  // Prefer an explicit OpenAI-compatible embedding adapter over a hard 500/400 crash.
  if (
    normalized === AI_PROVIDERS.AZURE_OPENAI
    || normalized === AI_PROVIDERS.ANTHROPIC
    || normalized === AI_PROVIDERS.GEMINI
    || normalized === AI_PROVIDERS.NVIDIA
    || normalized === AI_PROVIDERS.BEDROCK
  ) {
    return embeddingAdapters.get(AI_PROVIDERS.OPENAI);
  }

  throw new AiConfigurationError(
    `Embedding provider ${normalized || '(empty)'} is not configured`,
    'AI_EMBEDDING_PROVIDER_NOT_CONFIGURED',
  );
}

function listSupportedProviders() {
  return {
    llmProviders: Array.from(llmAdapters.keys()),
    embeddingProviders: Array.from(embeddingAdapters.keys()),
    plannedLlmProviders: [
      AI_PROVIDERS.BEDROCK,
    ],
  };
}

module.exports = {
  getLlmAdapter,
  getEmbeddingAdapter,
  listSupportedProviders,
};
