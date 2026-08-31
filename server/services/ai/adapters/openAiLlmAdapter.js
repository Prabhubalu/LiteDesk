const { AiProviderError } = require('../errors');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function toOpenAiMessages(messages) {
  return (messages || []).map((message) => ({
    role: message.role,
    content: String(message.content || ''),
  }));
}

/**
 * OpenAI Chat Completions–compatible LLM adapter.
 * Also used for OpenRouter (same wire format, different base URL).
 */
function createOpenAiLlmAdapter(options = {}) {
  const provider = options.provider || 'openai';
  const chatUrl = options.chatUrl || OPENAI_CHAT_URL;
  const label = options.label || 'OpenAI';
  const includeStreamUsage = options.includeStreamUsage !== false;
  const buildExtraHeaders = typeof options.buildExtraHeaders === 'function'
    ? options.buildExtraHeaders
    : () => ({});

  return {
    provider,

    async complete({ apiKey, model, messages, temperature = 0.2, maxTokens = 800 }) {
      if (!apiKey) {
        throw new AiProviderError(`${label} API key is not configured`, `${provider.toUpperCase()}_KEY_MISSING`, 400);
      }

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...buildExtraHeaders(),
        },
        body: JSON.stringify({
          model,
          messages: toOpenAiMessages(messages),
          temperature,
          max_tokens: maxTokens,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message
          || payload?.detail
          || `${label} request failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.code || `${provider.toUpperCase()}_REQUEST_FAILED`, response.status);
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

    async *stream({ apiKey, model, messages, temperature = 0.2, maxTokens = 800 }) {
      if (!apiKey) {
        throw new AiProviderError(`${label} API key is not configured`, `${provider.toUpperCase()}_KEY_MISSING`, 400);
      }

      const body = {
        model,
        messages: toOpenAiMessages(messages),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };
      // OpenAI-only; NVIDIA NIM rejects unknown stream_options.
      if (includeStreamUsage) {
        body.stream_options = { include_usage: true };
      }

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...buildExtraHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error?.message
          || payload?.detail
          || `${label} stream failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.code || `${provider.toUpperCase()}_STREAM_FAILED`, response.status);
      }

      const reader = response.body?.getReader?.();
      if (!reader) {
        throw new AiProviderError(`${label} stream body is not readable`, `${provider.toUpperCase()}_STREAM_UNAVAILABLE`, 502);
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          let payload;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          const delta = payload?.choices?.[0]?.delta?.content;
          if (delta) {
            yield { type: 'delta', text: delta };
          }

          if (payload?.usage) {
            usage = {
              promptTokens: payload.usage.prompt_tokens || 0,
              completionTokens: payload.usage.completion_tokens || 0,
              totalTokens: payload.usage.total_tokens || 0,
            };
          }
        }
      }

      yield { type: 'done', usage };
    },
  };
}

function createOpenRouterLlmAdapter() {
  return createOpenAiLlmAdapter({
    provider: 'openrouter',
    label: 'OpenRouter',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
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

function createNvidiaLlmAdapter() {
  return createOpenAiLlmAdapter({
    provider: 'nvidia',
    label: 'NVIDIA NIM',
    chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    includeStreamUsage: false,
  });
}

module.exports = {
  createOpenAiLlmAdapter,
  createOpenRouterLlmAdapter,
  createNvidiaLlmAdapter,
};
