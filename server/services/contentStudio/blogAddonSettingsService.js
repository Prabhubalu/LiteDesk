'use strict';

const crypto = require('crypto');
const { ADDON_KEYS } = require('../../constants/addonKeys');
const { ADDON_DEFAULT_SETTINGS } = require('../../constants/contentStudioConstants');
const { getTenantAddonConfiguration } = require('../../utils/addonAccessUtils');
const {
  normalizeContentPublishing,
  resolveHeadlessBlogApiBase,
  buildBlogListApiUrl,
  buildBlogPostApiUrl,
  buildBlogRssApiUrl,
  buildBlogCollectionsApiUrl,
  buildBlogRecentApiUrl,
  buildBlogPopularApiUrl,
  buildBlogSitemapApiUrl,
  buildBlogManifestUrl,
  buildBlogPostExportUrl,
  buildBlogHomeExportUrl,
  buildBlogStaticSitemapUrl,
} = require('./contentPublishingService');
const {
  invalidateArticlesEmbedOriginCache,
  normalizeArticlesEmbedWebsiteDomain,
} = require('./articlesEmbedOriginService');
const {
  ensureBlogHeadlessPublicKey,
  resolveBlogHeadlessPublicKey,
  resolveHeadlessBlogOrgKey,
} = require('./blogHeadlessPublicKeyService');
const { encryptTenantSecret, decryptTenantSecret } = require('../../utils/tenantSecretCrypto');

function normalizeUrlPrefix(value, fallback = '/blog') {
  const raw = String(value || fallback).trim() || fallback;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/blog';
}

function normalizeStaticSyncHostType(value, webhookUrl = '') {
  const allowed = new Set(['embed', 'next', 'php', 'cli']);
  const raw = String(value || '').trim().toLowerCase();
  if (allowed.has(raw)) return raw;
  const url = String(webhookUrl || '').trim();
  if (!url) return 'embed';
  if (url.includes('arivu-blog-sync.php') || url.includes('arivu-help-sync.php')) return 'php';
  if (url.includes('/api/arivu-webhook')) return 'next';
  return 'next';
}

function normalizePublishing(raw = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.BLOG]?.publishing || {};
  const merged = normalizeContentPublishing({
    ...defaults,
    ...(raw.publishing || {}),
    publishWebhookUrl: raw.publishWebhookUrl ?? raw.publishing?.publishWebhookUrl,
    headlessApiEnabled: raw.headlessApiEnabled ?? raw.publishing?.headlessApiEnabled,
  });

  const embedWebsiteDomain = String(
    raw.embedWebsiteDomain
    ?? raw.publishing?.embedWebsiteDomain
    ?? '',
  ).trim();
  const storedOrigins = raw.publishing?.embedWebsiteOrigins;
  const normalizedEmbed = embedWebsiteDomain
    ? normalizeArticlesEmbedWebsiteDomain(embedWebsiteDomain)
    : { domain: '', origins: Array.isArray(storedOrigins) ? storedOrigins.filter(Boolean) : [] };
  const encryptedPublishWebhookSecret = String(
    raw.publishing?.encryptedPublishWebhookSecret || '',
  ).trim();
  const staticSyncHostType = normalizeStaticSyncHostType(
    raw.staticSyncHostType ?? raw.publishing?.staticSyncHostType,
    merged.publishWebhookUrl,
  );

  return {
    headlessApiEnabled: merged.headlessApiEnabled,
    publishWebhookUrl: merged.publishWebhookUrl,
    embedWebsiteDomain: normalizedEmbed.domain,
    embedWebsiteOrigins: normalizedEmbed.origins,
    staticSyncHostType,
    hasPublishWebhookSecret: Boolean(encryptedPublishWebhookSecret),
  };
}

function normalizeSettings(raw = {}) {
  const defaults = ADDON_DEFAULT_SETTINGS[ADDON_KEYS.BLOG] || {};
  return {
    urlPrefix: normalizeUrlPrefix(raw.urlPrefix, defaults.urlPrefix),
    rssEnabled: raw.rssEnabled !== false,
    commentsEnabled: raw.commentsEnabled === true,
    defaultCollectionId: raw.defaultCollectionId ? String(raw.defaultCollectionId) : null,
    publishing: normalizePublishing(raw),
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

function buildBlogIntegration(organization, settings = {}, options = {}) {
  const headlessApiBase = resolveHeadlessBlogApiBase(organization, options);
  const urlPrefix = normalizeUrlPrefix(settings.urlPrefix, '/blog');
  const pathPrefix = `${urlPrefix}/`;
  const headlessPublicKey = resolveBlogHeadlessPublicKey(organization);
  const examplePostSlug = String(options.examplePostSlug || '').trim();
  return {
    headlessApiBase,
    headlessPublicKey,
    headlessOrgKey: resolveHeadlessBlogOrgKey(organization),
    customerUrlPrefix: urlPrefix,
    customerBlogListUrl: `https://your-site.com${urlPrefix}`,
    customerBlogPostUrlTemplate: `https://your-site.com${urlPrefix}/{slug}`,
    blogListUrl: buildBlogListApiUrl(organization, options),
    blogPostUrlTemplate: headlessApiBase ? `${headlessApiBase}/blog/{slug}` : '',
    blogRssUrl: buildBlogRssApiUrl(organization, options),
    blogCollectionRssUrlTemplate: headlessApiBase
      ? `${headlessApiBase}/blog/collections/{slug}/rss.xml`
      : '',
    blogPostRssUrlTemplate: headlessApiBase
      ? `${headlessApiBase}/blog/{slug}/rss.xml`
      : '',
    blogCollectionsUrl: buildBlogCollectionsApiUrl(organization, options),
    blogRecentUrl: buildBlogRecentApiUrl(organization, options),
    blogPopularUrl: buildBlogPopularApiUrl(organization, options),
    blogSitemapUrl: buildBlogSitemapApiUrl(organization, options),
    manifestUrl: buildBlogManifestUrl(organization, options),
    examplePostSlug,
    exampleBlogPostExportUrl: examplePostSlug
      ? buildBlogPostExportUrl(organization, examplePostSlug, options)
      : buildBlogPostExportUrl(organization, 'example-post', options),
    homeExportUrl: buildBlogHomeExportUrl(organization, options),
    staticSitemapUrl: buildBlogStaticSitemapUrl(organization, options),
    exportPathPrefix: pathPrefix,
  };
}

async function isBlogAddonEnabled(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.BLOG);
  return Boolean(config && config.enabled !== false);
}

async function getBlogAddonSettings(organizationId, options = {}) {
  const Organization = require('../../models/Organization');
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.BLOG);
  const organization = await Organization.findById(organizationId)
    .select('slug embed.blog.publicKey')
    .lean();
  const settings = normalizeSettings(config?.settings || {});

  let organizationForIntegration = organization;
  if (settings.publishing?.headlessApiEnabled !== false) {
    const headlessPublicKey = await ensureBlogHeadlessPublicKey(organizationId);
    organizationForIntegration = {
      ...(organization || {}),
      embed: {
        ...(organization?.embed || {}),
        blog: {
          ...(organization?.embed?.blog || {}),
          publicKey: headlessPublicKey,
        },
      },
    };
  }

  const ContentCollection = require('../../models/ContentCollection');
  const ContentDocument = require('../../models/ContentDocument');
  const collections = await ContentCollection.find({
    organizationId,
    addonKey: ADDON_KEYS.BLOG,
    deletedAt: null,
  })
    .select('_id name slug parentId')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const examplePost = await ContentDocument.findOne({
    organizationId,
    addonKey: ADDON_KEYS.BLOG,
    contentType: 'blog_post',
    status: 'published',
    visibility: 'public',
    deletedAt: null,
  })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .select('slug')
    .lean();

  return {
    settings,
    integration: buildBlogIntegration(organizationForIntegration, settings, {
      ...options,
      examplePostSlug: examplePost?.slug || '',
    }),
    collections,
  };
}

async function updateBlogAddonSettings(organizationId, payload = {}, options = {}) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.BLOG);
  if (!config) {
    const error = new Error('Blog addon is not installed');
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
      addonKey: ADDON_KEYS.BLOG,
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
    { organizationId, addonKey: ADDON_KEYS.BLOG },
    { $set: { settings } },
  );

  invalidateArticlesEmbedOriginCache();

  if (settings.publishing?.headlessApiEnabled !== false) {
    await ensureBlogHeadlessPublicKey(organizationId);
  }

  const result = await getBlogAddonSettings(organizationId, options);
  if (oneTimePublishWebhookSecret) {
    result.publishWebhookSecret = oneTimePublishWebhookSecret;
  }
  return result;
}

async function getBlogPublishingSettings(organizationId) {
  const { settings } = await getBlogAddonSettings(organizationId);
  return {
    ...settings.publishing,
    commentsEnabled: settings.commentsEnabled === true,
    rssEnabled: settings.rssEnabled !== false,
    urlPrefix: settings.urlPrefix,
  };
}

async function resolvePublishWebhookSecret(organizationId) {
  const config = await getTenantAddonConfiguration(organizationId, ADDON_KEYS.BLOG);
  const encrypted = config?.settings?.publishing?.encryptedPublishWebhookSecret;
  if (!encrypted) return '';
  return decryptTenantSecret(encrypted) || '';
}

async function generateBlogPublishWebhookSecret(organizationId, options = {}) {
  return updateBlogAddonSettings(organizationId, { generatePublishWebhookSecret: true }, options);
}

function resolveBlogPublicDeliveryAccessFromState({
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

async function resolveBlogPublicDeliveryAccess(organizationId) {
  const addonEnabled = await isBlogAddonEnabled(organizationId);
  if (!addonEnabled) {
    return resolveBlogPublicDeliveryAccessFromState({ addonEnabled: false });
  }

  const { settings } = await getBlogAddonSettings(organizationId);
  return resolveBlogPublicDeliveryAccessFromState({
    addonEnabled: true,
    headlessApiEnabled: settings.publishing?.headlessApiEnabled,
  });
}

module.exports = {
  normalizeSettings,
  normalizePublishing,
  resolveRequestPublicOrigin,
  getBlogAddonSettings,
  updateBlogAddonSettings,
  getBlogPublishingSettings,
  resolvePublishWebhookSecret,
  generateBlogPublishWebhookSecret,
  isBlogAddonEnabled,
  resolveBlogPublicDeliveryAccess,
  resolveBlogPublicDeliveryAccessFromState,
  buildBlogIntegration,
};
