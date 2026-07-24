const AI_PROVIDERS = {
  /** Sentinel: tenant uses Control Plane default provider + platform keys. */
  ARIVU: 'arivu',
  OPENAI: 'openai',
  AZURE_OPENAI: 'azure_openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
  NVIDIA: 'nvidia',
  BEDROCK: 'bedrock',
};

const AI_KEY_MODES = {
  PLATFORM: 'platform',
  BYOK: 'byok',
};

const AI_DEFAULTS = {
  llmProvider: AI_PROVIDERS.ANTHROPIC,
  embeddingProvider: AI_PROVIDERS.OPENAI,
  classifyModel: 'claude-haiku-4-5-20251001',
  generateModel: 'claude-sonnet-4-6',
  embeddingModel: 'text-embedding-3-small',
};

/** Per-provider model defaults; org modelOverrides always win. */
const AI_PROVIDER_MODEL_DEFAULTS = {
  [AI_PROVIDERS.OPENAI]: { classify: 'gpt-4o-mini', generate: 'gpt-4o' },
  // Azure model is selected by deployment name; value kept for audit rows.
  [AI_PROVIDERS.AZURE_OPENAI]: { classify: 'gpt-4o-mini', generate: 'gpt-4o' },
  [AI_PROVIDERS.ANTHROPIC]: { classify: 'claude-haiku-4-5-20251001', generate: 'claude-sonnet-4-6' },
  [AI_PROVIDERS.GEMINI]: { classify: 'gemini-2.5-flash', generate: 'gemini-2.5-pro' },
  // OpenRouter model ids are provider-prefixed.
  [AI_PROVIDERS.OPENROUTER]: { classify: 'openai/gpt-4o-mini', generate: 'openai/gpt-4o' },
  [AI_PROVIDERS.NVIDIA]: {
    classify: 'nvidia/nemotron-3-nano-30b-a3b',
    generate: 'nvidia/nemotron-3-super-120b-a12b',
  },
};

const AI_PROVIDER_EMBEDDING_DEFAULTS = {
  [AI_PROVIDERS.OPENAI]: 'text-embedding-3-small',
  [AI_PROVIDERS.AZURE_OPENAI]: 'text-embedding-3-small',
  [AI_PROVIDERS.OPENROUTER]: 'openai/text-embedding-3-small',
};

const AI_PROVIDER_LLM_MODELS = {
  [AI_PROVIDERS.OPENAI]: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  [AI_PROVIDERS.AZURE_OPENAI]: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  // Static fallback only — live Anthropic /v1/models is the source of truth in Settings.
  [AI_PROVIDERS.ANTHROPIC]: [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-3-5-haiku-latest',
    'claude-sonnet-4-20250514',
  ],
  [AI_PROVIDERS.GEMINI]: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  [AI_PROVIDERS.OPENROUTER]: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-sonnet-4'],
  [AI_PROVIDERS.NVIDIA]: [
    'nvidia/nemotron-3-nano-30b-a3b',
    'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    'nvidia/llama-3.1-nemotron-nano-8b-v1',
  ],
};

function resolveEmbeddingModel(embeddingProvider) {
  return AI_PROVIDER_EMBEDDING_DEFAULTS[embeddingProvider] || AI_DEFAULTS.embeddingModel;
}

module.exports = {
  AI_PROVIDERS,
  AI_KEY_MODES,
  AI_DEFAULTS,
  AI_PROVIDER_MODEL_DEFAULTS,
  AI_PROVIDER_LLM_MODELS,
  AI_PROVIDER_EMBEDDING_DEFAULTS,
  resolveEmbeddingModel,
};
