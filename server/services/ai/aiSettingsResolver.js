const Organization = require('../../models/Organization');
const { AI_DEFAULTS, AI_KEY_MODES, AI_PROVIDERS, AI_PROVIDER_MODEL_DEFAULTS } = require('../../constants/aiProviders');
const { AiConfigurationError } = require('./errors');
const { decryptByokApiKey } = require('./aiSettingsService');

function getPlatformApiKey(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === AI_PROVIDERS.OPENAI) return process.env.OPENAI_API_KEY || process.env.AI_OPENAI_API_KEY || null;
  if (normalized === AI_PROVIDERS.AZURE_OPENAI) return process.env.AZURE_OPENAI_API_KEY || null;
  if (normalized === AI_PROVIDERS.ANTHROPIC) return process.env.ANTHROPIC_API_KEY || null;
  if (normalized === AI_PROVIDERS.GEMINI) return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
  if (normalized === AI_PROVIDERS.OPENROUTER) return process.env.OPENROUTER_API_KEY || process.env.AI_OPENROUTER_API_KEY || null;
  if (normalized === AI_PROVIDERS.NVIDIA) return process.env.NVIDIA_API_KEY || process.env.AI_NVIDIA_API_KEY || null;
  if (normalized === AI_PROVIDERS.BEDROCK) return process.env.AWS_BEDROCK_API_KEY || null;
  return null;
}

/** Background / structured classify-tier abilities — always prefer mini unless overridden. */
const CLASSIFY_TIER_ABILITIES = new Set([
  'classify',
  'route',
  'extract',
  'analytics_intent',
  'import_mapping',
]);

/**
 * User-facing abilities — honour org-selected llmModel when set so BYOK tenants
 * are not forced onto stale platform classify defaults (e.g. claude-3-5-haiku-latest).
 */
const TENANT_MODEL_ABILITIES = new Set([
  'summarize',
  'work_graph_ask',
  'record_research',
  'ask',
  'portal_ask',
  'live_chat_bot',
  'draft_reply',
  'tenant_agent',
  'tenant_agent_triggers',
  'astra_synthesize_agent',
  'astra_mutation',
  'process_designer',
  'echo',
]);

/** @deprecated use CLASSIFY_TIER_ABILITIES + TENANT_MODEL_ABILITIES */
const SMALL_MODEL_ABILITIES = new Set([
  ...CLASSIFY_TIER_ABILITIES,
  ...TENANT_MODEL_ABILITIES,
]);

function resolveModel(settings, abilityKey) {
  const overrides = settings?.modelOverrides || {};
  const providerDefaults =
    AI_PROVIDER_MODEL_DEFAULTS[settings?.llmProvider]
    || { classify: AI_DEFAULTS.classifyModel, generate: AI_DEFAULTS.generateModel };
  const tenantModel = String(settings?.llmModel || '').trim();

  // Per-ability override always wins.
  if (overrides[abilityKey]) return overrides[abilityKey];

  // Org-selected model applies to user-facing abilities (BYOK / provider-specific catalogs).
  if (TENANT_MODEL_ABILITIES.has(abilityKey) && tenantModel) {
    return tenantModel;
  }

  // Classify-tier + tenant abilities without an org model → mini / classify default.
  if (CLASSIFY_TIER_ABILITIES.has(abilityKey) || TENANT_MODEL_ABILITIES.has(abilityKey)) {
    return overrides.classify || providerDefaults.classify;
  }

  if (tenantModel) return tenantModel;
  return overrides.generate || providerDefaults.generate;
}

async function loadOrgAiSettings(organizationId) {
  const organization = await Organization.findById(organizationId)
    .select('+aiSettings.apiKeyEncrypted')
    .lean();

  if (!organization) {
    throw new AiConfigurationError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }

  const aiSettings = organization.aiSettings || {};
  return {
    organization,
    aiSettings: {
      enabled: Boolean(aiSettings.enabled),
      llmProvider: aiSettings.llmProvider || AI_DEFAULTS.llmProvider,
      llmModel: aiSettings.llmModel || null,
      embeddingProvider: aiSettings.embeddingProvider || AI_DEFAULTS.embeddingProvider,
      keyMode: aiSettings.keyMode || AI_KEY_MODES.PLATFORM,
      apiKeyEncrypted: aiSettings.apiKeyEncrypted || null,
      apiKeyLast4: aiSettings.apiKeyLast4 || null,
      region: aiSettings.region || null,
      azureResourceName: aiSettings.azureResourceName || null,
      azureDeploymentName: aiSettings.azureDeploymentName || null,
      modelOverrides: aiSettings.modelOverrides || {},
      credits: aiSettings.credits || { balance: 0 },
      dataUseConsent: aiSettings.dataUseConsent || { accepted: false },
    },
  };
}

function resolveApiKey(aiSettings) {
  if (aiSettings.keyMode === AI_KEY_MODES.BYOK) {
    return decryptByokApiKey(aiSettings.apiKeyEncrypted);
  }
  return getPlatformApiKey(aiSettings.llmProvider);
}

function resolveEmbeddingApiKey(aiSettings, llmApiKey) {
  // BYOK key is only valid for embeddings when both providers match.
  if (aiSettings.keyMode === AI_KEY_MODES.BYOK) {
    return aiSettings.embeddingProvider === aiSettings.llmProvider
      ? llmApiKey
      : getPlatformApiKey(aiSettings.embeddingProvider);
  }
  return getPlatformApiKey(aiSettings.embeddingProvider);
}

async function resolveAiRequestConfig({ organizationId, abilityKey }) {
  const { aiSettings } = await loadOrgAiSettings(organizationId);

  if (!aiSettings.enabled) {
    throw new AiConfigurationError('AI is not enabled for this organization', 'AI_DISABLED');
  }

  if (!aiSettings.dataUseConsent?.accepted) {
    throw new AiConfigurationError('AI data-use consent has not been accepted', 'AI_CONSENT_REQUIRED');
  }

  const apiKey = resolveApiKey(aiSettings);
  if (!apiKey) {
    throw new AiConfigurationError('AI provider key is not configured', 'AI_KEY_NOT_CONFIGURED');
  }

  // Embeddings currently support openai/openrouter adapters. If the org selected an
  // LLM-only provider for embeddings, fall back to OpenAI platform embeddings key.
  let embeddingProvider = aiSettings.embeddingProvider;
  let embeddingApiKey = resolveEmbeddingApiKey(aiSettings, apiKey);
  const supportedEmbed = new Set([AI_PROVIDERS.OPENAI, AI_PROVIDERS.OPENROUTER]);
  if (!supportedEmbed.has(String(embeddingProvider || '').toLowerCase())) {
    embeddingProvider = AI_PROVIDERS.OPENAI;
    embeddingApiKey = getPlatformApiKey(AI_PROVIDERS.OPENAI) || embeddingApiKey;
  }

  return {
    provider: aiSettings.llmProvider,
    embeddingProvider,
    keyMode: aiSettings.keyMode,
    apiKey,
    embeddingApiKey,
    model: resolveModel(aiSettings, abilityKey),
    creditsBalance: Number(aiSettings.credits?.balance || 0),
    providerOptions: {
      azureResourceName: aiSettings.azureResourceName || null,
      azureDeploymentName: aiSettings.azureDeploymentName || null,
    },
  };
}

module.exports = {
  CLASSIFY_TIER_ABILITIES,
  TENANT_MODEL_ABILITIES,
  SMALL_MODEL_ABILITIES,
  loadOrgAiSettings,
  resolveAiRequestConfig,
  resolveModel,
};
