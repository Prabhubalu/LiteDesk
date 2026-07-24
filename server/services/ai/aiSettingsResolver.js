'use strict';

const Organization = require('../../models/Organization');
const { AI_DEFAULTS, AI_KEY_MODES, AI_PROVIDERS, AI_PROVIDER_MODEL_DEFAULTS } = require('../../constants/aiProviders');
const { AiConfigurationError } = require('./errors');
const { decryptByokApiKey } = require('./aiSettingsService');
const { normalizeCustomPiiRulesForDisplay } = require('./piiRedaction');
const {
  getPlatformApiKey,
  getPlatformDefaults,
} = require('./platformAiConfigService');

/** Org sentinel for Control Plane defaults (not a real LLM adapter). */
const ARIVU_PROVIDER = AI_PROVIDERS.ARIVU;

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
  'tenant_agent',
]);

function resolveModel(settings, abilityKey) {
  const overrides = settings?.modelOverrides || {};
  const providerDefaults =
    AI_PROVIDER_MODEL_DEFAULTS[settings?.llmProvider]
    || { classify: AI_DEFAULTS.classifyModel, generate: AI_DEFAULTS.generateModel };
  const tenantModel = String(settings?.llmModel || '').trim();

  // Per-ability override always wins.
  if (overrides[abilityKey]) return overrides[abilityKey];

  // Astra ask: default to classify/mini for TTFT — opt into larger via modelOverrides.tenant_agent.
  if (abilityKey === 'tenant_agent') {
    return overrides.classify || providerDefaults.classify;
  }

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

  const { ensureTokenLedger } = require('./aiCreditService');
  await ensureTokenLedger(organizationId);
  const refreshed = await Organization.findById(organizationId)
    .select('+aiSettings.apiKeyEncrypted')
    .lean();
  const org = refreshed || organization;

  const aiSettings = org.aiSettings || {};
  const storedProvider = String(aiSettings.llmProvider || '').trim().toLowerCase();
  return {
    organization: org,
    aiSettings: {
      enabled: Boolean(aiSettings.enabled),
      llmProvider: storedProvider || ARIVU_PROVIDER,
      llmModel: aiSettings.llmModel || null,
      embeddingProvider: aiSettings.embeddingProvider || AI_DEFAULTS.embeddingProvider,
      keyMode: aiSettings.keyMode || AI_KEY_MODES.PLATFORM,
      apiKeyEncrypted: aiSettings.apiKeyEncrypted || null,
      apiKeyLast4: aiSettings.apiKeyLast4 || null,
      region: aiSettings.region || null,
      azureResourceName: aiSettings.azureResourceName || null,
      azureDeploymentName: aiSettings.azureDeploymentName || null,
      modelOverrides: aiSettings.modelOverrides || {},
      credits: aiSettings.credits || { balance: 0, ledgerUnit: 'tokens' },
      dataUseConsent: aiSettings.dataUseConsent || { accepted: false },
      piiCustomRules: normalizeCustomPiiRulesForDisplay(aiSettings.piiCustomRules),
    },
  };
}

/**
 * Expand org provider `arivu` → Control Plane default provider; apply platform default model when org has Auto.
 */
async function expandPlatformProviderSettings(aiSettings) {
  const keyMode = aiSettings.keyMode || AI_KEY_MODES.PLATFORM;
  let llmProvider = String(aiSettings.llmProvider || '').trim().toLowerCase();
  let llmModel = aiSettings.llmModel;

  const needsPlatformDefaults =
    keyMode === AI_KEY_MODES.PLATFORM
    && (!llmProvider || llmProvider === ARIVU_PROVIDER);

  if (needsPlatformDefaults) {
    const defaults = await getPlatformDefaults();
    llmProvider = defaults.defaultLlmProvider || AI_DEFAULTS.llmProvider;
    if (!String(llmModel || '').trim() && defaults.defaultLlmModel) {
      llmModel = defaults.defaultLlmModel;
    }
  }

  return {
    ...aiSettings,
    llmProvider,
    llmModel,
    requestedProvider: aiSettings.llmProvider,
  };
}

async function resolveApiKey(aiSettings) {
  if (aiSettings.keyMode === AI_KEY_MODES.BYOK) {
    return decryptByokApiKey(aiSettings.apiKeyEncrypted);
  }
  return getPlatformApiKey(aiSettings.llmProvider);
}

async function resolveEmbeddingApiKey(aiSettings, llmApiKey) {
  if (aiSettings.keyMode === AI_KEY_MODES.BYOK) {
    return aiSettings.embeddingProvider === aiSettings.llmProvider
      ? llmApiKey
      : getPlatformApiKey(aiSettings.embeddingProvider);
  }
  return getPlatformApiKey(aiSettings.embeddingProvider);
}

async function resolveAiRequestConfig({ organizationId, abilityKey, modelOverride = '' }) {
  const { aiSettings: rawSettings } = await loadOrgAiSettings(organizationId);

  if (!rawSettings.enabled) {
    throw new AiConfigurationError('AI is not enabled for this organization', 'AI_DISABLED');
  }

  if (!rawSettings.dataUseConsent?.accepted) {
    throw new AiConfigurationError('AI data-use consent has not been accepted', 'AI_CONSENT_REQUIRED');
  }

  if (rawSettings.keyMode === AI_KEY_MODES.BYOK && rawSettings.llmProvider === ARIVU_PROVIDER) {
    throw new AiConfigurationError(
      'Bring Your Own Key requires a concrete LLM provider (not Arivu default).',
      'AI_PROVIDER_INVALID',
    );
  }

  if (
    rawSettings.keyMode === AI_KEY_MODES.PLATFORM
    && rawSettings.llmProvider
    && rawSettings.llmProvider !== ARIVU_PROVIDER
  ) {
    throw new AiConfigurationError(
      'Only Arivu (default) uses platform keys. Switch to Bring Your Own Key for this provider, or select Arivu (default).',
      'AI_KEY_MODE_INVALID',
    );
  }

  const aiSettings = await expandPlatformProviderSettings(rawSettings);

  const apiKey = await resolveApiKey(aiSettings);
  if (!apiKey) {
    throw new AiConfigurationError('AI provider key is not configured', 'AI_KEY_NOT_CONFIGURED');
  }

  let embeddingProvider = aiSettings.embeddingProvider;
  let embeddingApiKey = await resolveEmbeddingApiKey(aiSettings, apiKey);
  const supportedEmbed = new Set([AI_PROVIDERS.OPENAI, AI_PROVIDERS.OPENROUTER]);
  if (!supportedEmbed.has(String(embeddingProvider || '').toLowerCase())) {
    embeddingProvider = AI_PROVIDERS.OPENAI;
    embeddingApiKey = (await getPlatformApiKey(AI_PROVIDERS.OPENAI)) || embeddingApiKey;
  }

  const override = String(modelOverride || '').trim();
  const resolvedModel = override || resolveModel(aiSettings, abilityKey);

  return {
    provider: aiSettings.llmProvider,
    requestedProvider: aiSettings.requestedProvider,
    embeddingProvider,
    keyMode: aiSettings.keyMode,
    apiKey,
    embeddingApiKey,
    model: resolvedModel,
    creditsBalance: Number(aiSettings.credits?.balance || 0),
    tokensBalance: Number(aiSettings.credits?.balance || 0),
    piiCustomRules: aiSettings.piiCustomRules || [],
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
  expandPlatformProviderSettings,
};
