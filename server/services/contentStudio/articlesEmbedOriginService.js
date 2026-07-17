'use strict';

const { ADDON_KEYS } = require('../../constants/addonKeys');
const { originMatchesAllowedPattern } = require('../../config/corsConfig');
const { normalizeWebsiteEmbedDomain } = require('../../utils/normalizeWebsiteEmbedDomain');

const CACHE_TTL_MS = 60 * 1000;

/** @type {Map<string, { origins: string[], expires: number }>} */
const cacheByOrgSlug = new Map();
/** @type {{ origins: Set<string>, expires: number } | null} */
let globalOriginCache = null;

function extractOrgSlugFromPublicContentPath(url) {
  const match = String(url || '').match(/^\/api\/public(?:\/v1)?\/content\/([^/?#]+)/);
  if (!match) return '';
  const segment = decodeURIComponent(match[1]).trim().toLowerCase();
  if (!segment || segment === 'render-blocks') return '';
  return segment;
}

function originMatchesRegistered(origin, registeredOrigins) {
  return registeredOrigins.some((registeredOrigin) => originMatchesAllowedPattern(origin, registeredOrigin));
}

function collectPublishingOrigins(config) {
  const publishing = config?.settings?.publishing || {};
  const headlessEnabled = publishing.headlessApiEnabled !== false && config?.enabled !== false;
  if (!headlessEnabled || !Array.isArray(publishing.embedWebsiteOrigins)) return [];
  return publishing.embedWebsiteOrigins.filter(Boolean);
}

async function loadEmbedOriginsForOrgSlug(orgSlug) {
  const normalizedKey = String(orgSlug || '').trim();
  if (!normalizedKey) return [];

  const cacheKey = normalizedKey.toLowerCase();
  const cached = cacheByOrgSlug.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.origins;
  }

  const Organization = require('../../models/Organization');
  const { getTenantAddonConfiguration } = require('../../utils/addonAccessUtils');
  const { isArticlesHeadlessPublicKey } = require('./articlesHeadlessPublicKeyService');
  const { isBlogHeadlessPublicKey } = require('./blogHeadlessPublicKeyService');

  let organizationQuery = { slug: cacheKey };
  if (isArticlesHeadlessPublicKey(normalizedKey)) {
    organizationQuery = { 'embed.articles.publicKey': normalizedKey };
  } else if (isBlogHeadlessPublicKey(normalizedKey)) {
    organizationQuery = { 'embed.blog.publicKey': normalizedKey };
  }

  const organization = await Organization.findOne(organizationQuery).select('_id').lean();
  if (!organization?._id) {
    cacheByOrgSlug.set(cacheKey, { origins: [], expires: Date.now() + CACHE_TTL_MS });
    return [];
  }

  const [articlesConfig, blogConfig] = await Promise.all([
    getTenantAddonConfiguration(organization._id, ADDON_KEYS.ARTICLES),
    getTenantAddonConfiguration(organization._id, ADDON_KEYS.BLOG),
  ]);

  const origins = [
    ...collectPublishingOrigins(articlesConfig),
    ...collectPublishingOrigins(blogConfig),
  ];
  const uniqueOrigins = [...new Set(origins.map(String))];

  cacheByOrgSlug.set(cacheKey, { origins: uniqueOrigins, expires: Date.now() + CACHE_TTL_MS });
  return uniqueOrigins;
}

async function loadAllRegisteredEmbedOrigins() {
  if (globalOriginCache && globalOriginCache.expires > Date.now()) {
    return globalOriginCache.origins;
  }

  const TenantAddonConfiguration = require('../../models/TenantAddonConfiguration');
  const rows = await TenantAddonConfiguration.find({
    addonKey: { $in: [ADDON_KEYS.ARTICLES, ADDON_KEYS.BLOG] },
    enabled: { $ne: false },
    'settings.publishing.headlessApiEnabled': { $ne: false },
    'settings.publishing.embedWebsiteOrigins.0': { $exists: true },
  })
    .select('settings.publishing.embedWebsiteOrigins')
    .lean();

  const origins = new Set();
  for (const row of rows) {
    const registered = row?.settings?.publishing?.embedWebsiteOrigins || [];
    for (const origin of registered) {
      if (origin) origins.add(String(origin));
    }
  }

  globalOriginCache = { origins, expires: Date.now() + CACHE_TTL_MS };
  return origins;
}

function invalidateArticlesEmbedOriginCache() {
  cacheByOrgSlug.clear();
  globalOriginCache = null;
}

async function isArticlesEmbedOriginAllowed(origin, orgSlug) {
  if (!origin) return true;

  if (orgSlug) {
    const registeredOrigins = await loadEmbedOriginsForOrgSlug(orgSlug);
    return originMatchesRegistered(origin, registeredOrigins);
  }

  const allOrigins = await loadAllRegisteredEmbedOrigins();
  return [...allOrigins].some((registeredOrigin) => originMatchesAllowedPattern(origin, registeredOrigin));
}

/** Content embed origins (articles + blog). Alias kept for call-site stability. */
const isContentEmbedOriginAllowed = isArticlesEmbedOriginAllowed;

function normalizeArticlesEmbedWebsiteDomain(raw) {
  const allowLocalhost = process.env.NODE_ENV !== 'production';
  return normalizeWebsiteEmbedDomain(raw, { allowLocalhost });
}

module.exports = {
  extractOrgSlugFromPublicContentPath,
  invalidateArticlesEmbedOriginCache,
  isArticlesEmbedOriginAllowed,
  isContentEmbedOriginAllowed,
  loadEmbedOriginsForOrgSlug,
  normalizeArticlesEmbedWebsiteDomain,
  originMatchesRegistered,
};
