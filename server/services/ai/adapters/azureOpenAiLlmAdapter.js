const { AiProviderError } = require('../errors');

const AZURE_API_VERSION = '2024-06-01';

function toOpenAiMessages(messages) {
  return (messages || []).map((message) => ({
    role: message.role,
    content: String(message.content || ''),
  }));
}

function buildAzureUrl({ azureResourceName, azureDeploymentName }) {
  if (!azureResourceName || !azureDeploymentName) {
    throw new AiProviderError(
      'Azure OpenAI resource and deployment names are required in AI settings',
      'AZURE_OPENAI_NOT_CONFIGURED',
      400
    );
  }
  return `https://${azureResourceName}.openai.azure.com/openai/deployments/${encodeURIComponent(azureDeploymentName)}/chat/completions?api-version=${AZURE_API_VERSION}`;
}

function createAzureOpenAiLlmAdapter() {
  return {
    provider: 'azure_openai',

    async complete({ apiKey, messages, temperature = 0.2, maxTokens = 800, providerOptions = {} }) {
      if (!apiKey) {
        throw new AiProviderError('Azure OpenAI API key is not configured', 'AZURE_OPENAI_KEY_MISSING', 400);
      }

      const url = buildAzureUrl(providerOptions);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: toOpenAiMessages(messages),
          temperature,
          max_tokens: maxTokens,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `Azure OpenAI request failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.code || 'AZURE_OPENAI_REQUEST_FAILED', response.status);
      }

      return {
        text: payload?.choices?.[0]?.message?.content || '',
        usage: {
          promptTokens: payload?.usage?.prompt_tokens || 0,
          completionTokens: payload?.usage?.completion_tokens || 0,
          totalTokens: payload?.usage?.total_tokens || 0,
        },
        raw: payload,
      };
    },

    // Non-streaming fallback: yields the full completion once.
    async *stream(options) {
      const result = await this.complete(options);
      if (result.text) {
        yield { type: 'delta', text: result.text };
      }
      yield { type: 'done', usage: result.usage };
    },
  };
}

module.exports = {
  createAzureOpenAiLlmAdapter,
};
