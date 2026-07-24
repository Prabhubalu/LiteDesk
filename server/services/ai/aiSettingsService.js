const Organization = require('../../models/Organization');
const { encryptTenantSecret, decryptTenantSecret } = require('../../utils/tenantSecretCrypto');
const { AI_DEFAULTS, AI_KEY_MODES, AI_PROVIDERS, AI_PROVIDER_MODEL_DEFAULTS, AI_PROVIDER_LLM_MODELS } = require('../../constants/aiProviders');
const { AiConfigurationError } = require('./errors');
const { listSupportedProviders } = require('./providerRegistry');
const { getPiiRedactionCatalog, sanitizeCustomPiiRulesForStorage, normalizeCustomPiiRulesForDisplay } = require('./piiRedaction');

const LLM_PROVIDERS = new Set([...Object.values(AI_PROVIDERS)]);
const EMBEDDING_PROVIDERS = new Set([
  AI_PROVIDERS.OPENAI,
  AI_PROVIDERS.AZURE_OPENAI,
  AI_PROVIDERS.OPENROUTER,
  'voyage',
]);
const KEY_MODES = new Set(Object.values(AI_KEY_MODES));
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

function maskLast4(plain) {
  const value = String(plain || '');
  if (!value) return null;
  return value.slice(-4);
}

function getPlatformApiKey(provider) {
  // Sync env fallback for non-request paths (model catalog). Prefer platformAiConfigService at runtime.
  const { getEnvPlatformApiKey } = require('./platformAiConfigService');
  return getEnvPlatformApiKey(provider);
}

async function fetchProviderJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AiConfigurationError(
        payload?.error?.message || `Provider model lookup failed with status ${response.status}`,
        'AI_MODEL_LOOKUP_FAILED',
      );
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function listAvailableLlmModels({ organizationId, provider }) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!LLM_PROVIDERS.has(normalizedProvider)) {
    throw new AiConfigurationError(`Unsupported LLM provider: ${normalizedProvider}`, 'AI_PROVIDER_INVALID');
  }

  const organization = await Organization.findById(organizationId).select('+aiSettings.apiKeyEncrypted').lean();
  if (!organization) {
    throw new AiConfigurationError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }

  const settings = organization.aiSettings || {};
  const canUseByok = settings.keyMode === AI_KEY_MODES.BYOK && settings.llmProvider === normalizedProvider;
  const apiKey = canUseByok
    ? decryptByokApiKey(settings.apiKeyEncrypted)
    : getPlatformApiKey(normalizedProvider);

  if (normalizedProvider === AI_PROVIDERS.AZURE_OPENAI) {
    return {
      models: settings.azureDeploymentName ? [settings.azureDeploymentName] : [],
      source: 'azure_deployment',
    };
  }
  // OpenRouter + NVIDIA ship usable catalogs without a key (static / public list).
  if (
    !apiKey
    && normalizedProvider !== AI_PROVIDERS.OPENROUTER
    && normalizedProvider !== AI_PROVIDERS.NVIDIA
  ) {
    throw new AiConfigurationError('AI provider key is not configured', 'AI_KEY_NOT_CONFIGURED');
  }

  let models = [];
  if (normalizedProvider === AI_PROVIDERS.OPENAI) {
    const payload = await fetchProviderJson('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    models = (payload.data || []).map((model) => model?.id);
  } else if (normalizedProvider === AI_PROVIDERS.ANTHROPIC) {
    let afterId = '';
    for (let page = 0; page < 20; page += 1) {
      const suffix = afterId ? `&after_id=${encodeURIComponent(afterId)}` : '';
      const payload = await fetchProviderJson(`https://api.anthropic.com/v1/models?limit=100${suffix}`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      models.push(...(payload.data || []).map((model) => model?.id));
      if (!payload.has_more || !payload.last_id) break;
      afterId = payload.last_id;
    }
  } else if (normalizedProvider === AI_PROVIDERS.GEMINI) {
    let pageToken = '';
    for (let page = 0; page < 20; page += 1) {
      const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const payload = await fetchProviderJson(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${token}`,
        { headers: { 'x-goog-api-key': apiKey } },
      );
      models.push(...(payload.models || [])
        .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
        .map((model) => String(model.name || '').replace(/^models\//, '')));
      if (!payload.nextPageToken) break;
      pageToken = payload.nextPageToken;
    }
  } else if (normalizedProvider === AI_PROVIDERS.OPENROUTER) {
    const payload = await fetchProviderJson('https://openrouter.ai/api/v1/models', {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    models = (payload.data || []).map((model) => model?.id);
  } else if (normalizedProvider === AI_PROVIDERS.NVIDIA) {
    models = AI_PROVIDER_LLM_MODELS[AI_PROVIDERS.NVIDIA] || [];
    if (apiKey) {
      try {
        const payload = await fetchProviderJson('https://integrate.api.nvidia.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const live = (payload.data || []).map((model) => model?.id).filter(Boolean);
        if (live.length) models = live;
      } catch {
        // Keep static NVIDIA catalog when live /models is unavailable.
      }
    }
  }

  const storedModels = [
    String(settings.llmModel || '').trim(),
    ...Object.values(settings.modelOverrides || {}).map((m) => String(m || '').trim()),
  ].filter((model) => MODEL_ID_RE.test(model));

  const merged = [...new Set([
    ...storedModels,
    ...models.filter((model) => MODEL_ID_RE.test(String(model || ''))),
  ])].sort();

  return {
    models: merged,
    source: 'provider',
  };
}

function tokenPoolFromCredits(credits = {}) {
  const available = Math.max(0, Math.floor(Number(credits.balance) || 0));
  const grantedRaw = Number(credits.grantedTotal);
  const granted = Number.isFinite(grantedRaw) && grantedRaw >= 0
    ? Math.max(available, Math.floor(grantedRaw))
    : available;
  return {
    creditsBalance: available,
    tokensBalance: available,
    tokensAvailable: available,
    tokensGranted: granted,
    tokensConsumed: Math.max(0, granted - available),
    starterGrantTokens: Number(credits.starterGrantTokens || 0) || null,
  };
}

function toPublicAiSettings(aiSettings) {
  const storedProvider = String(aiSettings.llmProvider || '').trim().toLowerCase() || AI_PROVIDERS.ARIVU;
  const displayProvider = storedProvider === AI_PROVIDERS.ARIVU
    ? AI_PROVIDERS.ARIVU
    : (storedProvider || AI_DEFAULTS.llmProvider);
  const fallbackModel = storedProvider === AI_PROVIDERS.ARIVU
    ? AI_DEFAULTS.generateModel
    : (AI_PROVIDER_MODEL_DEFAULTS[displayProvider]?.generate || AI_DEFAULTS.generateModel);
  return {
    enabled: Boolean(aiSettings.enabled),
    llmProvider: displayProvider,
    // Empty stored model = "Auto": resolver routes per-ability tier defaults.
    autoModel: !String(aiSettings.llmModel || '').trim(),
    llmModel: String(aiSettings.llmModel || '').trim() || fallbackModel,
    embeddingProvider: aiSettings.embeddingProvider || AI_DEFAULTS.embeddingProvider,
    keyMode: aiSettings.keyMode || AI_KEY_MODES.PLATFORM,
    hasByokKey: Boolean(aiSettings.apiKeyLast4),
    apiKeyLast4: aiSettings.apiKeyLast4 || null,
    region: aiSettings.region || null,
    azureResourceName: aiSettings.azureResourceName || null,
    azureDeploymentName: aiSettings.azureDeploymentName || null,
    modelOverrides: aiSettings.modelOverrides || {},
    ...tokenPoolFromCredits(aiSettings.credits),
    dataUseConsent: {
      accepted: Boolean(aiSettings.dataUseConsent?.accepted),
      acceptedAt: aiSettings.dataUseConsent?.acceptedAt || null,
    },
    platformHomeAiFocus: Boolean(aiSettings.platformHomeAiFocus),
    piiCustomRules: normalizeCustomPiiRulesForDisplay(aiSettings.piiCustomRules),
  };
}

async function getPublicAiSettings(organizationId) {
  const { ensureTokenLedger } = require('./aiCreditService');
  await ensureTokenLedger(organizationId);
  const organization = await Organization.findById(organizationId).lean();
  if (!organization) {
    throw new AiConfigurationError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
  const piiCustomRules = normalizeCustomPiiRulesForDisplay(organization.aiSettings?.piiCustomRules);
  return {
    settings: toPublicAiSettings(organization.aiSettings || {}),
    piiRedaction: getPiiRedactionCatalog(piiCustomRules),
    supported: {
      ...listSupportedProviders(),
      llmProviders: [AI_PROVIDERS.ARIVU, ...listSupportedProviders().llmProviders],
      llmModelsByProvider: AI_PROVIDER_LLM_MODELS,
    },
  };
}

async function updateAiSettings({ organizationId, userId, patch }) {
  const organization = await Organization.findById(organizationId).select('+aiSettings.apiKeyEncrypted');
  if (!organization) {
    throw new AiConfigurationError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }

  if (!organization.aiSettings) {
    organization.aiSettings = {};
  }

  const settings = organization.aiSettings;

  if (patch.enabled !== undefined) {
    settings.enabled = Boolean(patch.enabled);
  }

  if (patch.llmProvider !== undefined) {
    const provider = String(patch.llmProvider).trim().toLowerCase();
    if (!LLM_PROVIDERS.has(provider)) {
      throw new AiConfigurationError(`Unsupported LLM provider: ${provider}`, 'AI_PROVIDER_INVALID');
    }
    if (provider === AI_PROVIDERS.ARIVU) {
      settings.llmProvider = AI_PROVIDERS.ARIVU;
      settings.keyMode = AI_KEY_MODES.PLATFORM;
    } else {
      const providerChanged = settings.llmProvider !== provider;
      settings.llmProvider = provider;
      // Non-Arivu providers are always BYOK for tenants.
      settings.keyMode = AI_KEY_MODES.BYOK;
      // OpenRouter key is valid for both chat + embeddings; keep them aligned unless caller overrides.
      if (provider === AI_PROVIDERS.OPENROUTER && patch.embeddingProvider === undefined) {
        settings.embeddingProvider = AI_PROVIDERS.OPENROUTER;
      }
      // Only reset model when provider actually changes AND caller did not send llmModel.
      if (providerChanged && patch.llmModel === undefined) {
        const allowedModels = AI_PROVIDER_LLM_MODELS[provider];
        const currentModel = String(settings.llmModel || '').trim();
        if (currentModel && Array.isArray(allowedModels) && allowedModels.length) {
          if (!allowedModels.includes(currentModel)) {
            settings.llmModel = AI_PROVIDER_MODEL_DEFAULTS[provider]?.generate || allowedModels[0];
          }
        }
      }
    }
  }

  if (patch.llmModel !== undefined) {
    // null / empty = "Auto": clear the override so resolver uses tier defaults.
    if (patch.llmModel === null || String(patch.llmModel).trim() === '') {
      settings.llmModel = null;
    } else {
      const model = String(patch.llmModel).trim();
      if (!MODEL_ID_RE.test(model)) {
        throw new AiConfigurationError(`Invalid model identifier: ${model}`, 'AI_MODEL_INVALID');
      }
      settings.llmModel = model;
    }
  }

  if (patch.embeddingProvider !== undefined) {
    const provider = String(patch.embeddingProvider).trim().toLowerCase();
    if (!EMBEDDING_PROVIDERS.has(provider)) {
      throw new AiConfigurationError(`Unsupported embedding provider: ${provider}`, 'AI_EMBEDDING_PROVIDER_INVALID');
    }
    settings.embeddingProvider = provider;
  }

  if (patch.keyMode !== undefined) {
    const keyMode = String(patch.keyMode).trim().toLowerCase();
    if (!KEY_MODES.has(keyMode)) {
      throw new AiConfigurationError(`Unsupported key mode: ${keyMode}`, 'AI_KEY_MODE_INVALID');
    }
    const provider = String(settings.llmProvider || '').trim().toLowerCase();
    // Enforce: Arivu → platform only; all other providers → BYOK only.
    if (provider === AI_PROVIDERS.ARIVU && keyMode !== AI_KEY_MODES.PLATFORM) {
      throw new AiConfigurationError(
        'Arivu (default) always uses the platform key. Choose another provider for Bring Your Own Key.',
        'AI_KEY_MODE_INVALID',
      );
    }
    if (provider && provider !== AI_PROVIDERS.ARIVU && keyMode !== AI_KEY_MODES.BYOK) {
      throw new AiConfigurationError(
        'Only Arivu (default) uses platform keys. Other providers require Bring Your Own Key.',
        'AI_KEY_MODE_INVALID',
      );
    }
    settings.keyMode = keyMode;
  }

  if (patch.region !== undefined) {
    settings.region = patch.region ? String(patch.region).trim() : null;
  }

  if (patch.azureResourceName !== undefined) {
    settings.azureResourceName = patch.azureResourceName
      ? String(patch.azureResourceName).trim()
      : null;
  }

  if (patch.azureDeploymentName !== undefined) {
    settings.azureDeploymentName = patch.azureDeploymentName
      ? String(patch.azureDeploymentName).trim()
      : null;
  }

  if (patch.modelOverrides !== undefined) {
    if (patch.modelOverrides === null || typeof patch.modelOverrides !== 'object' || Array.isArray(patch.modelOverrides)) {
      throw new AiConfigurationError('modelOverrides must be an object', 'AI_MODEL_OVERRIDES_INVALID');
    }
    settings.modelOverrides = patch.modelOverrides;
  }

  if (patch.clearByokKey === true) {
    settings.apiKeyEncrypted = null;
    settings.apiKeyLast4 = null;
  }

  if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) {
    const plain = patch.apiKey.trim();
    settings.apiKeyEncrypted = encryptTenantSecret(plain);
    settings.apiKeyLast4 = maskLast4(plain);
  }

  if (patch.acceptDataUseConsent === true) {
    settings.dataUseConsent = {
      accepted: true,
      acceptedBy: userId,
      acceptedAt: new Date(),
    };
  }

  if (patch.platformHomeAiFocus !== undefined) {
    settings.platformHomeAiFocus = Boolean(patch.platformHomeAiFocus);
  }

  if (patch.piiCustomRules !== undefined) {
    try {
      settings.piiCustomRules = sanitizeCustomPiiRulesForStorage(patch.piiCustomRules);
    } catch (err) {
      throw new AiConfigurationError(
        err.message || 'Invalid custom PII rules',
        'AI_PII_RULES_INVALID',
      );
    }
  }

  if (patch.tokensBalance !== undefined) {
    const tokens = Number(patch.tokensBalance);
    if (!Number.isFinite(tokens) || tokens < 0) {
      throw new AiConfigurationError('tokensBalance must be a non-negative number', 'AI_TOKENS_INVALID');
    }
    if (!settings.credits) settings.credits = {};
    const next = Math.floor(tokens);
    settings.credits.balance = next;
    settings.credits.ledgerUnit = 'tokens';
    settings.credits.grantedTotal = Math.max(
      Math.floor(Number(settings.credits.grantedTotal) || 0),
      next,
    );
  } else if (patch.creditsBalance !== undefined) {
    // Legacy alias: creditsBalance is now tokens.
    const balance = Number(patch.creditsBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      throw new AiConfigurationError('creditsBalance must be a non-negative number', 'AI_TOKENS_INVALID');
    }
    if (!settings.credits) settings.credits = {};
    const next = Math.floor(balance);
    settings.credits.balance = next;
    settings.credits.ledgerUnit = 'tokens';
    settings.credits.grantedTotal = Math.max(
      Math.floor(Number(settings.credits.grantedTotal) || 0),
      next,
    );
  }

  if (settings.keyMode === AI_KEY_MODES.BYOK && !settings.apiKeyEncrypted && !patch.clearByokKey) {
    // Allow saving other fields without a key; resolveAiRequestConfig will fail until key is set.
  }

  organization.markModified('aiSettings');
  await organization.save();

  const piiCustomRules = normalizeCustomPiiRulesForDisplay(organization.aiSettings?.piiCustomRules);

  return {
    settings: toPublicAiSettings(organization.aiSettings),
    piiRedaction: getPiiRedactionCatalog(piiCustomRules),
    supported: listSupportedProviders(),
  };
}

function decryptByokApiKey(apiKeyEncrypted) {
  if (!apiKeyEncrypted) return null;
  const plain = decryptTenantSecret(apiKeyEncrypted);
  return plain || null;
}

module.exports = {
  getPublicAiSettings,
  updateAiSettings,
  toPublicAiSettings,
  decryptByokApiKey,
  listAvailableLlmModels,
};
