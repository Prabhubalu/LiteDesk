'use strict';

/**
 * Platform AI config — Control Plane managed defaults + encrypted platform keys.
 * Runtime resolution prefers DB keys, then env fallback.
 */

const PlatformAiConfig = require('../../models/PlatformAiConfig');
const { encryptTenantSecret, decryptTenantSecret } = require('../../utils/tenantSecretCrypto');
const {
  AI_PROVIDERS,
  AI_DEFAULTS,
  AI_PROVIDER_LLM_MODELS,
  AI_PROVIDER_MODEL_DEFAULTS,
} = require('../../constants/aiProviders');

const CONFIG_ID = 'default';

/** Providers that can hold a platform (Arivu) API key. */
const PLATFORM_KEY_PROVIDERS = [
  AI_PROVIDERS.ANTHROPIC,
  AI_PROVIDERS.OPENAI,
  AI_PROVIDERS.OPENROUTER,
  AI_PROVIDERS.NVIDIA,
  AI_PROVIDERS.GEMINI,
  AI_PROVIDERS.AZURE_OPENAI,
  AI_PROVIDERS.BEDROCK,
];

const PLATFORM_KEY_PROVIDER_SET = new Set(PLATFORM_KEY_PROVIDERS);

function maskLast4(plain) {
  const value = String(plain || '');
  if (!value) return null;
  return value.slice(-4);
}

function getEnvPlatformApiKey(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === AI_PROVIDERS.OPENAI) {
    return process.env.OPENAI_API_KEY || process.env.AI_OPENAI_API_KEY || null;
  }
  if (normalized === AI_PROVIDERS.AZURE_OPENAI) return process.env.AZURE_OPENAI_API_KEY || null;
  if (normalized === AI_PROVIDERS.ANTHROPIC) return process.env.ANTHROPIC_API_KEY || null;
  if (normalized === AI_PROVIDERS.GEMINI) {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
  }
  if (normalized === AI_PROVIDERS.OPENROUTER) {
    return process.env.OPENROUTER_API_KEY || process.env.AI_OPENROUTER_API_KEY || null;
  }
  if (normalized === AI_PROVIDERS.NVIDIA) {
    return process.env.NVIDIA_API_KEY || process.env.AI_NVIDIA_API_KEY || null;
  }
  if (normalized === AI_PROVIDERS.BEDROCK) return process.env.AWS_BEDROCK_API_KEY || null;
  return null;
}

async function loadConfigDoc() {
  let doc = await PlatformAiConfig.findById(CONFIG_ID);
  if (!doc) {
    doc = await PlatformAiConfig.create({
      _id: CONFIG_ID,
      defaultLlmProvider: AI_DEFAULTS.llmProvider,
      defaultLlmModel: null,
      encryptedApiKeys: {},
      apiKeyLast4: {},
    });
  }
  return doc;
}

function decryptProviderKey(doc, provider) {
  const encrypted = doc?.encryptedApiKeys?.[provider];
  if (!encrypted) return null;
  return decryptTenantSecret(encrypted) || null;
}

/**
 * Effective platform defaults + key lookup (DB then env).
 */
async function getEffectivePlatformAiConfig() {
  const doc = await loadConfigDoc();
  const lean = doc.toObject ? doc.toObject() : doc;

  const defaultLlmProvider = String(
    lean.defaultLlmProvider || process.env.AI_DEFAULT_LLM_PROVIDER || AI_DEFAULTS.llmProvider
  )
    .trim()
    .toLowerCase();

  const defaultLlmModel = String(lean.defaultLlmModel || '').trim() || null;

  const keysByProvider = {};
  const keySourceByProvider = {};
  const hasKeyByProvider = {};

  for (const provider of PLATFORM_KEY_PROVIDERS) {
    const dbKey = decryptProviderKey(lean, provider);
    const envKey = getEnvPlatformApiKey(provider);
    const key = dbKey || envKey || null;
    keysByProvider[provider] = key;
    hasKeyByProvider[provider] = Boolean(key);
    if (dbKey) keySourceByProvider[provider] = 'database';
    else if (envKey) keySourceByProvider[provider] = 'env';
    else keySourceByProvider[provider] = 'none';
  }

  return {
    defaultLlmProvider,
    defaultLlmModel,
    keysByProvider,
    hasKeyByProvider,
    keySourceByProvider,
    apiKeyLast4: lean.apiKeyLast4 || {},
  };
}

async function getPlatformApiKey(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!PLATFORM_KEY_PROVIDER_SET.has(normalized)) {
    return getEnvPlatformApiKey(normalized);
  }
  const effective = await getEffectivePlatformAiConfig();
  return effective.keysByProvider[normalized] || null;
}

async function getPlatformDefaults() {
  const effective = await getEffectivePlatformAiConfig();
  return {
    defaultLlmProvider: effective.defaultLlmProvider,
    defaultLlmModel: effective.defaultLlmModel,
  };
}

/**
 * Admin UI payload (never returns full keys).
 */
async function getAdminPlatformAiConfig() {
  const doc = await loadConfigDoc();
  const lean = doc.toObject ? doc.toObject() : doc;
  const effective = await getEffectivePlatformAiConfig();

  const providers = PLATFORM_KEY_PROVIDERS.map((provider) => ({
    provider,
    hasKey: Boolean(lean.apiKeyLast4?.[provider] || effective.hasKeyByProvider[provider]),
    last4: lean.apiKeyLast4?.[provider] || null,
    source: effective.keySourceByProvider[provider],
  }));

  return {
    defaultLlmProvider: effective.defaultLlmProvider,
    defaultLlmModel: effective.defaultLlmModel,
    providers,
    supported: {
      llmProviders: PLATFORM_KEY_PROVIDERS,
      llmModelsByProvider: AI_PROVIDER_LLM_MODELS,
      providerModelDefaults: AI_PROVIDER_MODEL_DEFAULTS,
    },
    updatedAt: lean.updatedAt || null,
  };
}

/**
 * @param {object} patch
 * @param {string} [patch.defaultLlmProvider]
 * @param {string|null} [patch.defaultLlmModel]
 * @param {Record<string, string|null>} [patch.apiKeys] — plain keys to set; null/'' clears; omit to keep
 * @param {string|null} [patch.updatedByUserId]
 */
async function updateAdminPlatformAiConfig(patch = {}) {
  const doc = await loadConfigDoc();

  if (patch.defaultLlmProvider !== undefined) {
    const provider = String(patch.defaultLlmProvider || '').trim().toLowerCase();
    if (!PLATFORM_KEY_PROVIDER_SET.has(provider)) {
      const err = new Error(`Unsupported default LLM provider: ${provider}`);
      err.code = 'AI_PROVIDER_INVALID';
      throw err;
    }
    doc.defaultLlmProvider = provider;
  }

  if (patch.defaultLlmModel !== undefined) {
    if (patch.defaultLlmModel === null || String(patch.defaultLlmModel).trim() === '') {
      doc.defaultLlmModel = null;
    } else {
      doc.defaultLlmModel = String(patch.defaultLlmModel).trim();
    }
  }

  if (patch.apiKeys && typeof patch.apiKeys === 'object') {
    if (!doc.encryptedApiKeys || typeof doc.encryptedApiKeys !== 'object') {
      doc.encryptedApiKeys = {};
    }
    if (!doc.apiKeyLast4 || typeof doc.apiKeyLast4 !== 'object') {
      doc.apiKeyLast4 = {};
    }

    for (const [provider, value] of Object.entries(patch.apiKeys)) {
      const normalized = String(provider || '').trim().toLowerCase();
      if (!PLATFORM_KEY_PROVIDER_SET.has(normalized)) continue;

      if (value === null || value === '') {
        delete doc.encryptedApiKeys[normalized];
        delete doc.apiKeyLast4[normalized];
        continue;
      }

      const plain = String(value).trim();
      if (!plain) continue;
      doc.encryptedApiKeys[normalized] = encryptTenantSecret(plain);
      doc.apiKeyLast4[normalized] = maskLast4(plain);
    }

    doc.markModified('encryptedApiKeys');
    doc.markModified('apiKeyLast4');
  }

  if (patch.updatedByUserId !== undefined) {
    doc.updatedByUserId = patch.updatedByUserId || null;
  }

  await doc.save();
  return getAdminPlatformAiConfig();
}

module.exports = {
  CONFIG_ID,
  PLATFORM_KEY_PROVIDERS,
  getEnvPlatformApiKey,
  getEffectivePlatformAiConfig,
  getPlatformApiKey,
  getPlatformDefaults,
  getAdminPlatformAiConfig,
  updateAdminPlatformAiConfig,
};
