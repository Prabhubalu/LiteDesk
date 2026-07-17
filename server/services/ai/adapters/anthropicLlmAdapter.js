const { AiProviderError } = require('../errors');

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function splitMessages(messages) {
  const system = (messages || [])
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || ''))
    .join('\n\n');
  const conversation = (messages || [])
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
    }));
  return { system, conversation };
}

function createAnthropicLlmAdapter() {
  return {
    provider: 'anthropic',

    async complete({ apiKey, model, messages, temperature = 0.2, maxTokens = 800 }) {
      if (!apiKey) {
        throw new AiProviderError('Anthropic API key is not configured', 'ANTHROPIC_KEY_MISSING', 400);
      }

      const { system, conversation } = splitMessages(messages);
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: system || undefined,
          messages: conversation,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `Anthropic request failed with status ${response.status}`;
        throw new AiProviderError(message, payload?.error?.type || 'ANTHROPIC_REQUEST_FAILED', response.status);
      }

      const text = (payload?.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text || '')
        .join('');

      const promptTokens = payload?.usage?.input_tokens || 0;
      const completionTokens = payload?.usage?.output_tokens || 0;

      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
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
  createAnthropicLlmAdapter,
};
