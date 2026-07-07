'use strict';

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
} = require('./contentPublishingService');

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

  return {
    headlessApiEnabled: merged.headlessApiEnabled,
    publishWebhookUrl: merged.publishWebhookUrl,
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
  return {
    headlessApiBase,
    articlesListApiUrl: buildArticlesListApiUrl(organization, options),
    collectionsApiUrl: buildCollectionsApiUrl(organization, options),
    recentArticlesApiUrl: buildRecentArticlesApiUrl(organization, options),
    popularArticlesApiUrl: buildPopularArticlesApiUrl(organization, options),
    exampleArticleApiUrl: headlessApiBase ? `${headlessApiBase}/articles/{slug}` : '',
    sitemapUrl: buildSitemapApiUrl(organization, options),
  };
}

async function getArticlesAddonSettings(organizationId, options = {}) {
  const Organization = require('../../models/Organization');
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.ARTICLES);
  const organization = await Organization.findById(organizationId)
    .select('slug settings.logoUrl settings.primaryColor contentPublishing')
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

  const ContentCollection = require('../../models/ContentCollection');
  const collections = await ContentCollection.find({
    organizationId,
    addonKey: ADDON_KEYS.ARTICLES,
    deletedAt: null,
  })
    .select('_id name slug parentId')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return {
    settings,
    integration: buildArticlesIntegration(organization, options),
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

  const settings = normalizeSettings({
    ...(config.settings || {}),
    ...payload,
    publishing: {
      ...(config.settings?.publishing || {}),
      ...(payload.publishing || {}),
      ...(payload.publishWebhookUrl !== undefined ? { publishWebhookUrl: payload.publishWebhookUrl } : {}),
      ...(payload.headlessApiEnabled !== undefined ? { headlessApiEnabled: payload.headlessApiEnabled } : {}),
    },
    appearance: normalizeAppearance({
      ...(ADDON_DEFAULT_SETTINGS[ADDON_KEYS.ARTICLES]?.appearance || {}),
      ...(config.settings?.appearance || {}),
      ...(payload.appearance || {}),
    }),
  });

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

  return getArticlesAddonSettings(organizationId, options);
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
