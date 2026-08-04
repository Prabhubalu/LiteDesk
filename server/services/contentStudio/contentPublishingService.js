'use strict';

const DEFAULT_CONTENT_PUBLISHING = {
  publishWebhookUrl: '',
  headlessApiEnabled: true,
};

const { resolveHeadlessContentOrgKey } = require('./articlesHeadlessPublicKeyService');
const { resolveHeadlessBlogOrgKey } = require('./blogHeadlessPublicKeyService');

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

/**
 * Marketing hosts (e.g. www) do not proxy /api/files/* — Vercel serves a static 404.
 * Prefer app/API origins that rewrite or host the file download controller.
 */
const NON_FILE_SERVING_HOSTS = new Set([
  'www.arivusystems.com',
  'arivusystems.com',
]);

const DEFAULT_ARIVU_FILE_ORIGIN = 'https://api.arivusystems.com';

function isNonFileServingOrigin(raw) {
  const origin = normalizePublicOrigin(raw);
  if (!origin) return false;
  try {
    return NON_FILE_SERVING_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function getPublicAppBaseUrl(options = {}) {
  const fromEnv = normalizePublicOrigin(process.env.PUBLIC_APP_URL)
    || normalizePublicOrigin(process.env.CLIENT_URL);
  if (fromEnv) return fromEnv;
  return normalizePublicOrigin(options.requestOrigin);
}

/**
 * Base origin used for /api/files/download and /api/uploads assets on public surfaces
 * (blog avatars, headless HTML). Never uses bare marketing hosts.
 */
function getPublicFileBaseUrl(options = {}) {
  const candidates = [
    process.env.PUBLIC_FILE_BASE_URL,
    process.env.PUBLIC_API_URL,
    process.env.PUBLIC_APP_URL,
    process.env.CLIENT_URL,
    options.requestOrigin,
  ];
  for (const candidate of candidates) {
    const origin = normalizePublicOrigin(candidate);
    if (!origin || isNonFileServingOrigin(origin)) continue;
    return origin;
  }
  // known marketing-only config fallback (Arivu production)
  if (candidates.some((c) => isNonFileServingOrigin(c))) {
    return DEFAULT_ARIVU_FILE_ORIGIN;
  }
  return '';
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

function resolveHeadlessBlogApiBase(organization, options = {}) {
  const orgKey = resolveHeadlessBlogOrgKey(organization);
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

function buildBlogListApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog` : '';
}

function buildBlogPostApiUrl(organization, slug, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  const postSlug = String(slug || '').trim();
  if (!base || !postSlug) return '';
  return `${base}/blog/${encodeURIComponent(postSlug)}`;
}

function buildBlogRssApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/rss.xml` : '';
}

function buildBlogCollectionRssApiUrl(organization, collectionSlug, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  const slug = String(collectionSlug || '').trim();
  if (!base || !slug) return '';
  return `${base}/blog/collections/${encodeURIComponent(slug)}/rss.xml`;
}

function buildBlogPostRssApiUrl(organization, postSlug, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  const slug = String(postSlug || '').trim();
  if (!base || !slug) return '';
  return `${base}/blog/${encodeURIComponent(slug)}/rss.xml`;
}

function buildBlogCollectionsApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/collections` : '';
}

function buildBlogRecentApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/recent` : '';
}

function buildBlogPopularApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/popular` : '';
}

function buildBlogSitemapApiUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/sitemap.xml` : '';
}

function buildBlogCollectionPostsApiUrl(organization, collectionSlug, options = {}) {
  const listUrl = buildBlogListApiUrl(organization, options);
  const slug = String(collectionSlug || '').trim();
  if (!listUrl || !slug) return '';
  return `${listUrl}?collection=${encodeURIComponent(slug)}`;
}

function buildBlogPostExportUrl(organization, slug, options = {}) {
  const postUrl = buildBlogPostApiUrl(organization, slug, options);
  if (!postUrl) return '';
  return `${postUrl}/export`;
}

function buildBlogManifestUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/manifest.json` : '';
}

function buildBlogHomeExportUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/export/home` : '';
}

function buildBlogCollectionExportUrl(organization, slug, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  const collectionSlug = String(slug || '').trim();
  if (!base || !collectionSlug) return '';
  const params = new URLSearchParams();
  if (options.parentSlug) params.set('parent', String(options.parentSlug));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `${base}/blog/export/collections/${encodeURIComponent(collectionSlug)}${suffix}`;
}

function buildBlogStaticSitemapUrl(organization, options = {}) {
  const base = resolveHeadlessBlogApiBase(organization, options);
  return base ? `${base}/blog/export/sitemap.xml` : '';
}

module.exports = {
  DEFAULT_CONTENT_PUBLISHING,
  normalizeContentPublishing,
  normalizeWebhookUrl,
  getPublicAppBaseUrl,
  getPublicFileBaseUrl,
  isNonFileServingOrigin,
  resolveRequestOrigin,
  resolveHeadlessApiBase,
  resolveHeadlessBlogApiBase,
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
  buildBlogListApiUrl,
  buildBlogPostApiUrl,
  buildBlogRssApiUrl,
  buildBlogCollectionRssApiUrl,
  buildBlogPostRssApiUrl,
  buildBlogCollectionsApiUrl,
  buildBlogRecentApiUrl,
  buildBlogPopularApiUrl,
  buildBlogSitemapApiUrl,
  buildBlogCollectionPostsApiUrl,
  buildBlogPostExportUrl,
  buildBlogManifestUrl,
  buildBlogHomeExportUrl,
  buildBlogCollectionExportUrl,
  buildBlogStaticSitemapUrl,
};
