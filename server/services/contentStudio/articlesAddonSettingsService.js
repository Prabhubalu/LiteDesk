'use strict';

const crypto = require('crypto');
const { ADDON_KEYS } = require('../../constants/addonKeys');
const { ADDON_DEFAULT_SETTINGS } = require('../../constants/contentStudioConstants');
const { getTenantAddonConfiguration } = require('../../utils/addonAccessUtils');
const { normalizeAppearance } = require('./articlesAppearanceService');
const {
  normalizeContentPublishing,
  resolveHeadlessApiBase,
  buildArticlesListApiUrl,
  buildArticleApiUrl,
  buildCollectionsApiUrl,
  buildRecentArticlesApiUrl,
  buildPopularArticlesApiUrl,
  buildSitemapApiUrl,
  buildManifestUrl,
  buildStaticSitemapUrl,
  buildHomeExportUrl,
  buildCollectionExportUrl,
} = require('./contentPublishingService');
const {
  invalidateArticlesEmbedOriginCache,
  normalizeArticlesEmbedWebsiteDomain,
} = require('./articlesEmbedOriginService');
const {
  ensureArticlesHeadlessPublicKey,
  resolveArticlesHeadlessPublicKey,
  resolveHeadlessContentOrgKey,
} = require('./articlesHeadlessPublicKeyService');
const { encryptTenantSecret, tryDecryptTenantSecret } = require('../../utils/tenantSecretCrypto');

function mergeStoredAppearance(stored = {}, organization = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES]?.appearance || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(stored, key);

  return normalizeAppearance({
    ...defaults,
    ...stored,
    logoUrl: has('logoUrl')
      ? String(stored.logoUrl || '').trim()
      : (organization?.settings?.logoUrl || ''),
    primaryColor: has('primaryColor')
      ? String(stored.primaryColor || defaults.primaryColor).trim()
      : (organization?.settings?.primaryColor || defaults.primaryColor),
  });
}

function normalizePublishing(raw = {}, legacy = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES]?.publishing || {};
  const merged = normalizeContentPublishing({
    ...defaults,
    ...legacy,
    ...(raw.publishing || {}),
    publishWebhookUrl: raw.publishWebhookUrl ?? raw.publishing?.publishWebhookUrl ?? legacy.publishWebhookUrl,
    headlessApiEnabled: raw.headlessApiEnabled ?? raw.publishing?.headlessApiEnabled ?? legacy.headlessApiEnabled,
  });

  const embedWebsiteDomain = String(
    raw.embedWebsiteDomain
    ?? raw.publishing?.embedWebsiteDomain
    ?? legacy.embedWebsiteDomain
    ?? '',
  ).trim();
  const storedOrigins = raw.publishing?.embedWebsiteOrigins ?? legacy.embedWebsiteOrigins;
  const normalizedEmbed = embedWebsiteDomain
    ? normalizeArticlesEmbedWebsiteDomain(embedWebsiteDomain)
    : { domain: '', origins: Array.isArray(storedOrigins) ? storedOrigins.filter(Boolean) : [] };
  const encryptedPublishWebhookSecret = String(
    raw.publishing?.encryptedPublishWebhookSecret
    ?? legacy.encryptedPublishWebhookSecret
    ?? '',
  ).trim();
  const allowedHostTypes = new Set(['embed', 'next', 'php', 'cli']);
  const rawHostType = String(
    raw.staticSyncHostType
    ?? raw.publishing?.staticSyncHostType
    ?? legacy.staticSyncHostType
    ?? '',
  ).trim().toLowerCase();
  let staticSyncHostType = allowedHostTypes.has(rawHostType) ? rawHostType : '';
  if (!staticSyncHostType) {
    const url = String(merged.publishWebhookUrl || '').trim();
    if (!url) staticSyncHostType = 'embed';
    else if (url.includes('arivu-help-sync.php')) staticSyncHostType = 'php';
    else if (url.includes('/api/arivu-webhook')) staticSyncHostType = 'next';
    else staticSyncHostType = 'next';
  }

  return {
    headlessApiEnabled: merged.headlessApiEnabled,
    publishWebhookUrl: merged.publishWebhookUrl,
    embedWebsiteDomain: normalizedEmbed.domain,
    embedWebsiteOrigins: normalizedEmbed.origins,
    staticSyncHostType,
    hasPublishWebhookSecret: Boolean(encryptedPublishWebhookSecret),
    publishWebhookSecretUnreadable: false,
  };
}

function normalizeSettings(raw = {}, { legacyPublishing = {} } = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES] || {};
  const staleDays = Number(raw.staleContentAlertDays);
  return {
    portalPublishing: raw.portalPublishing !== false,
    defaultCollectionId: raw.defaultCollectionId ? String(raw.defaultCollectionId) : null,
    caseDeflectionEnabled: raw.caseDeflectionEnabled !== false,
    staleContentAlertDays: Number.isFinite(staleDays) && staleDays > 0
      ? Math.min(Math.round(staleDays), 365)
      : (defaults.staleContentAlertDays || 90),
    publishing: normalizePublishing(raw, legacyPublishing),
    appearance: normalizeAppearance({
      ...(defaults.appearance || {}),
      ...(raw.appearance || {}),
    }),
  };
}

function resolveRequestPublicOrigin(req) {
  if (!req) return '';
  const forwardedHost = String(req.get('x-forwarded-host') || '').trim();
  const forwardedProto = String(req.get('x-forwarded-proto') || '').trim();
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = String(req.get('host') || '').trim();
  if (!host) return '';
  const protocol = String(req.protocol || 'http').trim();
  return `${protocol}://${host}`;
}

function buildArticlesIntegration(organization, options = {}) {
  const headlessApiBase = resolveHeadlessApiBase(organization, options);
  const headlessPublicKey = resolveArticlesHeadlessPublicKey(organization);
  return {
    headlessApiBase,
    headlessPublicKey,
    headlessOrgKey: resolveHeadlessContentOrgKey(organization),
    articlesListApiUrl: buildArticlesListApiUrl(organization, options),
    collectionsApiUrl: buildCollectionsApiUrl(organization, options),
    recentArticlesApiUrl: buildRecentArticlesApiUrl(organization, options),
    popularArticlesApiUrl: buildPopularArticlesApiUrl(organization, options),
    exampleArticleApiUrl: headlessApiBase ? `${headlessApiBase}/articles/{slug}` : '',
    exampleArticleExportUrl: headlessApiBase ? `${headlessApiBase}/articles/{slug}/export` : '',
    exampleHomeExportUrl: buildHomeExportUrl(organization, options),
    exampleCollectionExportUrl: headlessApiBase ? `${headlessApiBase}/export/collections/{slug}` : '',
    manifestUrl: buildManifestUrl(organization, options),
    sitemapUrl: buildSitemapApiUrl(organization, options),
    staticSitemapUrl: buildStaticSitemapUrl(organization, options),
  };
}

async function getArticlesAddonSettings(organizationId, options = {}) {
  const Organization = require('../../models/Organization');
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  const organization = await Organization.findById(organizationId)
    .select('slug embed.articles.publicKey settings.logoUrl settings.primaryColor contentPublishing')
    .lean();

  const legacyPublishing = normalizeContentPublishing(organization?.contentPublishing || {});
  const storedAppearance = config?.settings?.appearance || {};
  const settings = normalizeSettings(
    {
      ...(config?.settings || {}),
      appearance: mergeStoredAppearance(storedAppearance, organization),
    },
    { legacyPublishing },
  );

  let organizationForIntegration = organization;
  if (settings.publishing?.headlessApiEnabled !== false) {
    const headlessPublicKey = await ensureArticlesHeadlessPublicKey(organizationId);
    organizationForIntegration = {
      ...(organization || {}),
      embed: {
        ...(organization?.embed || {}),
        articles: {
          ...(organization?.embed?.articles || {}),
          publicKey: headlessPublicKey,
        },
      },
    };
  }

  const ContentCollection = require('../../models/ContentCollection');
  const collections = await ContentCollection.find({
    organizationId,
    addonKey: ADDON_KEYS.ARTICLES,
    deletedAt: null,
  })
    .select('_id name slug parentId')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const encryptedSecret = String(
    config?.settings?.publishing?.encryptedPublishWebhookSecret || '',
  ).trim();
  if (encryptedSecret) {
    const decrypted = tryDecryptTenantSecret(encryptedSecret);
    if (!decrypted.ok) {
      settings.publishing.publishWebhookSecretUnreadable = true;
    }
  }

  return {
    settings,
    integration: buildArticlesIntegration(organizationForIntegration, options),
    collections,
  };
}

async function updateArticlesAddonSettings(organizationId, payload = {}, options = {}) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  if (!config) {
    const error = new Error('Articles addon is not installed');
    error.statusCode = 404;
    error.code = 'ADDON_NOT_INSTALLED';
    throw error;
  }

  const existingPublishing = {
    ...(config.settings?.publishing || {}),
  };
  let oneTimePublishWebhookSecret = '';

  if (payload.clearPublishWebhookSecret === true) {
    delete existingPublishing.encryptedPublishWebhookSecret;
  } else if (payload.generatePublishWebhookSecret === true) {
    oneTimePublishWebhookSecret = crypto.randomBytes(24).toString('hex');
    existingPublishing.encryptedPublishWebhookSecret = encryptTenantSecret(oneTimePublishWebhookSecret);
  } else if (payload.publishWebhookSecret !== undefined) {
    const trimmed = String(payload.publishWebhookSecret || '').trim();
    if (trimmed) {
      oneTimePublishWebhookSecret = trimmed;
      existingPublishing.encryptedPublishWebhookSecret = encryptTenantSecret(trimmed);
    } else {
      delete existingPublishing.encryptedPublishWebhookSecret;
    }
  }

  const settings = normalizeSettings({
    ...(config.settings || {}),
    ...payload,
    publishing: {
      ...existingPublishing,
      ...(payload.publishing || {}),
      ...(payload.publishWebhookUrl !== undefined ? { publishWebhookUrl: payload.publishWebhookUrl } : {}),
      ...(payload.headlessApiEnabled !== undefined ? { headlessApiEnabled: payload.headlessApiEnabled } : {}),
      ...(payload.embedWebsiteDomain !== undefined ? { embedWebsiteDomain: payload.embedWebsiteDomain } : {}),
      ...(payload.staticSyncHostType !== undefined ? { staticSyncHostType: payload.staticSyncHostType } : {}),
    },
    appearance: normalizeAppearance({
      ...(ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES]?.appearance || {}),
      ...(config.settings?.appearance || {}),
      ...(payload.appearance || {}),
    }),
  });

  if (existingPublishing.encryptedPublishWebhookSecret) {
    settings.publishing = {
      ...settings.publishing,
      encryptedPublishWebhookSecret: existingPublishing.encryptedPublishWebhookSecret,
    };
  }

  if (settings.defaultCollectionId) {
    const ContentCollection = require('../../models/ContentCollection');
    const collection = await ContentCollection.findOne({
      _id: settings.defaultCollectionId,
      organizationId,
      addonKey: ADDON_KEYS.ARTICLES,
      deletedAt: null,
    })
      .select('_id')
      .lean();
    if (!collection) {
      settings.defaultCollectionId = null;
    }
  }

  const TenantAddonConfiguration = require('../../models/TenantAddonConfiguration');
  await TenantAddonConfiguration.updateOne(
    { organizationId, addonKey: ADDON_KEYS.ARTICLES },
    { $set: { settings } },
  );

  invalidateArticlesEmbedOriginCache();

  if (settings.publishing?.headlessApiEnabled !== false) {
    await ensureArticlesHeadlessPublicKey(organizationId);
  }

  const result = await getArticlesAddonSettings(organizationId, options);
  if (oneTimePublishWebhookSecret) {
    result.publishWebhookSecret = oneTimePublishWebhookSecret;
  }
  return result;
}

async function resolvePublishWebhookSecret(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  const encrypted = String(config?.settings?.publishing?.encryptedPublishWebhookSecret || '').trim();
  if (!encrypted) return '';
  const decrypted = tryDecryptTenantSecret(encrypted);
  if (!decrypted.ok) {
    const error = new Error(
      'Stored webhook secret cannot be decrypted. Regenerate the webhook secret and update ARIVU_WEBHOOK_SECRET on your site.',
    );
    error.code = 'WEBHOOK_SECRET_UNREADABLE';
    throw error;
  }
  return decrypted.value;
}

async function generateArticlesPublishWebhookSecret(organizationId, options = {}) {
  return updateArticlesAddonSettings(organizationId, { generatePublishWebhookSecret: true }, options);
}

async function getArticlesPublishingSettings(organizationId, options = {}) {
  const { settings } = await getArticlesAddonSettings(organizationId, options);
  return settings.publishing;
}

async function isArticlesPortalPublishingEnabled(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  if (!config || config.enabled === false) return false;
  return normalizeSettings(config.settings).portalPublishing !== false;
}

async function isArticlesAddonEnabled(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  return Boolean(config && config.enabled !== false);
}

function resolveArticlesPublicDeliveryAccessFromState({
  addonEnabled = false,
  headlessApiEnabled = true,
} = {}) {
  if (!addonEnabled) {
    return {
      addonEnabled: false,
      headlessEnabled: false,
      publicEnabled: false,
    };
  }

  const headlessEnabled = headlessApiEnabled !== false;
  return {
    addonEnabled: true,
    headlessEnabled,
    publicEnabled: headlessEnabled,
  };
}

async function resolveArticlesPublicDeliveryAccess(organizationId) {
  const addonEnabled = await isArticlesAddonEnabled(organizationId);
  if (!addonEnabled) {
    return resolveArticlesPublicDeliveryAccessFromState({ addonEnabled: false });
  }

  const { settings } = await getArticlesAddonSettings(organizationId);
  return resolveArticlesPublicDeliveryAccessFromState({
    addonEnabled: true,
    headlessApiEnabled: settings.publishing?.headlessApiEnabled,
  });
}

async function isArticlesCaseDeflectionEnabled(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  if (!config || config.enabled === false) return false;
  return normalizeSettings(config.settings).caseDeflectionEnabled !== false;
}

function evaluateStaleContent(doc, staleContentAlertDays = 90) {
  const threshold = Math.max(Number(staleContentAlertDays) || 90, 1);
  const referenceDate = doc?.publishedAt || doc?.updatedAt;
  if (!referenceDate) {
    return { isStale: false, daysSinceUpdate: 0, staleContentAlertDays: threshold };
  }
  const daysSinceUpdate = Math.floor((Date.now() - new Date(referenceDate).getTime()) / 86400000);
  return {
    isStale: daysSinceUpdate >= threshold,
    daysSinceUpdate,
    staleContentAlertDays: threshold,
  };
}

module.exports = {
  normalizeSettings,
  normalizePublishing,
  resolveRequestPublicOrigin,
  getArticlesAddonSettings,
  updateArticlesAddonSettings,
  getArticlesPublishingSettings,
  resolvePublishWebhookSecret,
  generateArticlesPublishWebhookSecret,
  isArticlesPortalPublishingEnabled,
  isArticlesAddonEnabled,
  resolveArticlesPublicDeliveryAccess,
  resolveArticlesPublicDeliveryAccessFromState,
  isArticlesCaseDeflectionEnabled,
  evaluateStaleContent,
  buildArticlesIntegration,
  getArticlesAppearance: async (organizationId) => {
    const { settings } = await getArticlesAddonSettings(organizationId);
    return settings.appearance;
  },
};
