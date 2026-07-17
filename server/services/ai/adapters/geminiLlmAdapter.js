const { AiProviderError } = require('../errors');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function toGeminiPayload(messages, temperature, maxTokens) {
  const systemText = (messages || [])
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || ''))
    .join('\n\n');

  const contents = (messages || [])
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(message.content || '') }],
    }));

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
}

function createGeminiLlmAdapter() {
  return {
    provider: 'gemini',

    async complete({ apiKey, model, messages, temperature = 0.2, maxTokens = 800 }) {
      if (!apiKey) {
        throw new AiProviderError('Gemini API key is not configured', 'GEMINI_KEY_MISSING', 400);
      }

      const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toGeminiPayload(messages, temperature, maxTokens)),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `Gemini request failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.status || 'GEMINI_REQUEST_FAILED', response.status);
      }

      const text = (payload?.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || '')
        .join('');

      return {
        text,
        usage: {
          promptTokens: payload?.usageMetadata?.promptTokenCount || 0,
          completionTokens: payload?.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: payload?.usageMetadata?.totalTokenCount || 0,
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
  createGeminiLlmAdapter,
};
