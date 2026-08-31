const { AiProviderError } = require('../errors');

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/**
 * OpenAI Embeddings–compatible adapter (also used for OpenRouter).
 */
function createOpenAiEmbeddingAdapter(options = {}) {
  const provider = options.provider || 'openai';
  const embeddingsUrl = options.embeddingsUrl || OPENAI_EMBEDDINGS_URL;
  const label = options.label || 'OpenAI';
  const buildExtraHeaders = typeof options.buildExtraHeaders === 'function'
    ? options.buildExtraHeaders
    : () => ({});

  return {
    provider,

    async embed({ apiKey, model, texts }) {
      if (!apiKey) {
        throw new AiProviderError(`${label} API key is not configured`, `${provider.toUpperCase()}_KEY_MISSING`, 400);
      }

      const response = await fetch(embeddingsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...buildExtraHeaders(),
        },
        body: JSON.stringify({
          model,
          input: texts,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `${label} embeddings request failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.code || `${provider.toUpperCase()}_EMBEDDINGS_FAILED`, response.status);
      }

      return {
        vectors: (payload?.data || []).map((item) => item.embedding),
        usage: {
          promptTokens: payload?.usage?.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: payload?.usage?.total_tokens || 0,
        },
        raw: payload,
      };
    },
  };
}

function createOpenRouterEmbeddingAdapter() {
  return createOpenAiEmbeddingAdapter({
    provider: 'openrouter',
    label: 'OpenRouter',
    embeddingsUrl: 'https://openrouter.ai/api/v1/embeddings',
    buildExtraHeaders: () => {
      const headers = {};
      const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.APP_URL || process.env.CLIENT_URL;
      const title = process.env.OPENROUTER_APP_TITLE || 'Arivu';
      if (referer) headers['HTTP-Referer'] = referer;
      if (title) headers['X-Title'] = title;
      return headers;
    },
  });
}

module.exports = {
  createOpenAiEmbeddingAdapter,
  createOpenRouterEmbeddingAdapter,
};
