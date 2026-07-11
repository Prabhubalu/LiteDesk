'use strict';

const DEFAULT_CONTENT_PUBLISHING = {
  publishWebhookUrl: '',
  headlessApiEnabled: true,
};

const { resolveHeadlessContentOrgKey } = require('./articlesHeadlessPublicKeyService');

function normalizeWebhookUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeContentPublishing(raw = {}) {
  return {
    publishWebhookUrl: normalizeWebhookUrl(raw.publishWebhookUrl),
    headlessApiEnabled: raw.headlessApiEnabled !== false,
  };
}

function normalizePublicOrigin(raw) {
  const value = String(raw || '').trim().replace(/\/$/, '');
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

function getPublicAppBaseUrl(options = {}) {
  const fromEnv = normalizePublicOrigin(process.env.PUBLIC_APP_URL)
    || normalizePublicOrigin(process.env.CLIENT_URL);
  if (fromEnv) return fromEnv;
  return normalizePublicOrigin(options.requestOrigin);
}

function resolveRequestOrigin(req) {
  if (!req) return '';
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host') || '';
  if (!host) return '';
  return `${proto}://${host}`;
}

function resolveHeadlessApiBase(organization, options = {}) {
  const orgKey = resolveHeadlessContentOrgKey(organization);
  const appBase = getPublicAppBaseUrl(options);
  if (!orgKey || !appBase) return '';
  return `${appBase}/api/public/v1/content/${encodeURIComponent(orgKey)}`;
}

function buildArticleApiUrl(organization, slug, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  const articleSlug = String(slug || '').trim();
  if (!base || !articleSlug) return '';
  return `${base}/articles/${encodeURIComponent(articleSlug)}`;
}

function buildArticlesListApiUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/articles` : '';
}

function buildCollectionsApiUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/collections` : '';
}

function buildRecentArticlesApiUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/articles/recent` : '';
}

function buildPopularArticlesApiUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/articles/popular` : '';
}

function buildCollectionArticlesApiUrl(organization, collectionSlug, options = {}) {
  const listUrl = buildArticlesListApiUrl(organization, options);
  const slug = String(collectionSlug || '').trim();
  if (!listUrl || !slug) return '';
  return `${listUrl}?collection=${encodeURIComponent(slug)}`;
}

function buildSitemapApiUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/sitemap.xml` : '';
}

function buildArticleExportUrl(organization, slug, options = {}) {
  const articleUrl = buildArticleApiUrl(organization, slug, options);
  if (!articleUrl) return '';
  return `${articleUrl}/export`;
}

function buildManifestUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/manifest.json` : '';
}

function buildPublicAssetDownloadUrl(organization, assetId, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  const id = String(assetId || '').trim();
  if (!base || !id) return '';
  return `${base}/assets/${encodeURIComponent(id)}`;
}

function buildHomeExportUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/export/home` : '';
}

function buildCollectionExportUrl(organization, slug, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  const collectionSlug = String(slug || '').trim();
  if (!base || !collectionSlug) return '';
  const params = new URLSearchParams();
  if (options.parentSlug) params.set('parent', String(options.parentSlug));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `${base}/export/collections/${encodeURIComponent(collectionSlug)}${suffix}`;
}

function buildStaticSitemapUrl(organization, options = {}) {
  const base = resolveHeadlessApiBase(organization, options);
  return base ? `${base}/export/sitemap.xml` : '';
}

module.exports = {
  DEFAULT_CONTENT_PUBLISHING,
  normalizeContentPublishing,
  normalizeWebhookUrl,
  getPublicAppBaseUrl,
  resolveRequestOrigin,
  resolveHeadlessApiBase,
  buildArticleApiUrl,
  buildArticlesListApiUrl,
  buildCollectionsApiUrl,
  buildRecentArticlesApiUrl,
  buildPopularArticlesApiUrl,
  buildCollectionArticlesApiUrl,
  buildSitemapApiUrl,
  buildArticleExportUrl,
  buildManifestUrl,
  buildPublicAssetDownloadUrl,
  buildHomeExportUrl,
  buildCollectionExportUrl,
  buildStaticSitemapUrl,
};
