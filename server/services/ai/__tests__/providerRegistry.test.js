const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getLlmAdapter, getEmbeddingAdapter, listSupportedProviders } = require('../providerRegistry');

describe('providerRegistry', () => {
  it('resolves all shipped LLM adapters', () => {
    for (const provider of ['openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter']) {
      const adapter = getLlmAdapter(provider);
      assert.equal(adapter.provider, provider);
      assert.equal(typeof adapter.complete, 'function');
      assert.equal(typeof adapter.stream, 'function');
    }
  });

  it('resolves openai/openrouter embedding adapters and rejects unknown providers', () => {
    assert.equal(getEmbeddingAdapter('openai').provider, 'openai');
    assert.equal(getEmbeddingAdapter('openrouter').provider, 'openrouter');
    assert.throws(() => getLlmAdapter('bedrock'), /not configured/);
  });

  it('reports supported providers', () => {
    const supported = listSupportedProviders();
    assert.deepEqual(
      supported.llmProviders.sort(),
      ['anthropic', 'azure_openai', 'gemini', 'openai', 'openrouter']
    );
    assert.deepEqual(
      supported.embeddingProviders.sort(),
      ['openai', 'openrouter']
    );
  });
});
