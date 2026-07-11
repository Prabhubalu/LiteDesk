import { getApiUrlForFetch } from '@/config/apiBase';

export async function fetchPublicArticles(orgKey, { page = 1, limit = 25, search = '', collection = '', deep = false } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.set('search', search);
  if (collection) params.set('collection', collection);
  if (deep) params.set('deep', '1');

  const response = await fetch(
    getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(orgKey)}/articles?${params.toString()}`),
    { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to load articles');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchPublicCollections(orgKey) {
  const response = await fetch(
    getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(orgKey)}/collections`),
    { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to load collections');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchPublicRecentArticles(orgKey, { limit = 5, collection = '', deep = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (collection) params.set('collection', collection);
  if (deep) params.set('deep', '1');

  const response = await fetch(
    getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(orgKey)}/articles/recent?${params.toString()}`),
    { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to load recent articles');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchPublicPopularArticles(orgKey, { limit = 5, collection = '', deep = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (collection) params.set('collection', collection);
  if (deep) params.set('deep', '1');

  const response = await fetch(
    getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(orgKey)}/articles/popular?${params.toString()}`),
    { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to load popular articles');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchPublicArticle(orgKey, slug) {
  const response = await fetch(
    getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(orgKey)}/articles/${encodeURIComponent(slug)}`),
    { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to load article');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function renderPublicContentBlocks(blocks, {
  title = '',
  subtitle = '',
  bodyOnly = true,
  articleLinkPrefix = '/help/',
} = {}) {
  const response = await fetch(getApiUrlForFetch('/public/v1/content/render-blocks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      blocks,
      title,
      subtitle,
      bodyOnly,
      articleLinkPrefix,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || 'Failed to render article blocks');
    error.status = response.status;
    throw error;
  }
  return data.html;
}

/** @deprecated Use fetchPublicArticles */
export const fetchPublicHelpArticlesHeadless = fetchPublicArticles;

/** @deprecated Use fetchPublicArticle */
export const fetchPublicHelpArticleHeadless = fetchPublicArticle;

/** @deprecated Hosted delivery removed — use fetchPublicArticles */
export const fetchPublicHelpArticles = fetchPublicArticles;

/** @deprecated Hosted delivery removed — use fetchPublicArticle */
export const fetchPublicHelpArticle = fetchPublicArticle;

export function resolvePublicArticlePath(_delivery, slug) {
  return slug ? `/articles/${slug}` : '';
}

export function resolvePublicListPath() {
  return '/articles';
}

function normalizeLinkPrefix(value, fallback = '/help/') {
  const prefix = String(value || fallback).trim();
  if (!prefix) return fallback;
  if (prefix.includes('?')) return prefix;
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

export function buildPublicHelpCollectionPath(linkPrefix, slug) {
  const safeSlug = String(slug || '').trim().replace(/^\/+/, '').toLowerCase();
  if (!safeSlug) return normalizeLinkPrefix(linkPrefix);
  const prefix = normalizeLinkPrefix(linkPrefix);
  if (prefix.includes('?')) return `${prefix}${encodeURIComponent(safeSlug)}`;
  return `${prefix}${encodeURIComponent(safeSlug)}`;
}

export function buildPublicHelpArticlePath(
  linkPrefix,
  article,
  sectionContext = null,
) {
  const slug = String(article?.slug || '').trim().replace(/^\/+/, '').toLowerCase();
  if (!slug) return normalizeLinkPrefix(linkPrefix);
  const prefix = normalizeLinkPrefix(linkPrefix);
  if (prefix.includes('?')) return `${prefix}${encodeURIComponent(slug)}`;

  const collectionSlug = String(sectionContext?.slug || article?.collectionSlug || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
  const parentSlug = String(sectionContext?.parentSlug || '').trim().replace(/^\/+/, '').toLowerCase();

  if (parentSlug && collectionSlug) {
    return `${prefix}${encodeURIComponent(parentSlug)}/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(slug)}`;
  }
  if (collectionSlug) {
    return `${prefix}${encodeURIComponent(collectionSlug)}/${encodeURIComponent(slug)}`;
  }
  return `${prefix}${encodeURIComponent(slug)}`;
}

export function usePublicHelp(orgKey) {
  const org = String(orgKey || '').trim();
  return {
    org,
    fetchArticles: (options = {}) => fetchPublicArticles(org, options),
    fetchCollections: () => fetchPublicCollections(org),
    fetchRecentArticles: (options = {}) => fetchPublicRecentArticles(org, options),
    fetchPopularArticles: (options = {}) => fetchPublicPopularArticles(org, options),
    fetchArticle: (slug) => fetchPublicArticle(org, slug),
    renderBlocks: renderPublicContentBlocks,
    buildCollectionPath: (linkPrefix, slug) => buildPublicHelpCollectionPath(linkPrefix, slug),
    buildArticlePath: (linkPrefix, article, sectionContext) => buildPublicHelpArticlePath(
      linkPrefix,
      article,
      sectionContext,
    ),
  };
}
