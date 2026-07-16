import { getApiUrlForFetch } from '@/config/apiBase';

export function buildHeadlessApiBase(orgSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  if (!safeOrg) return '';
  return getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(safeOrg)}`);
}

export function buildHeadlessIntegrationUrls(orgSlug: string) {
  const headlessApiBase = buildHeadlessApiBase(orgSlug);
  if (!headlessApiBase) return null;
  return {
    headlessApiBase,
    articlesListApiUrl: `${headlessApiBase}/articles`,
    collectionsApiUrl: `${headlessApiBase}/collections`,
    recentArticlesApiUrl: `${headlessApiBase}/articles/recent`,
    popularArticlesApiUrl: `${headlessApiBase}/articles/popular`,
    exampleArticleApiUrl: `${headlessApiBase}/articles/{slug}`,
    sitemapUrl: `${headlessApiBase}/sitemap.xml`,
  };
}

export function buildHeadlessArticleApiUrl(orgSlug: string, slug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  const safeSlug = String(slug || '').trim();
  if (!safeOrg || !safeSlug) return '';
  return getApiUrlForFetch(
    `/public/v1/content/${encodeURIComponent(safeOrg)}/articles/${encodeURIComponent(safeSlug)}`,
  );
}

export function buildHeadlessBlogPostApiUrl(orgSlug: string, slug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  const safeSlug = String(slug || '').trim();
  if (!safeOrg || !safeSlug) return '';
  return getApiUrlForFetch(
    `/public/v1/content/${encodeURIComponent(safeOrg)}/blog/${encodeURIComponent(safeSlug)}`,
  );
}

export function buildHeadlessBlogListApiUrl(orgSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  if (!safeOrg) return '';
  return getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(safeOrg)}/blog`);
}

export function buildHeadlessBlogRssApiUrl(orgSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  if (!safeOrg) return '';
  return getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(safeOrg)}/blog/rss.xml`);
}

export function buildHeadlessBlogCollectionRssApiUrl(orgSlug: string, collectionSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  const safeSlug = String(collectionSlug || '').trim();
  if (!safeOrg || !safeSlug) return '';
  return getApiUrlForFetch(
    `/public/v1/content/${encodeURIComponent(safeOrg)}/blog/collections/${encodeURIComponent(safeSlug)}/rss.xml`,
  );
}

export function buildHeadlessBlogPostRssApiUrl(orgSlug: string, postSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  const safeSlug = String(postSlug || '').trim();
  if (!safeOrg || !safeSlug) return '';
  return getApiUrlForFetch(
    `/public/v1/content/${encodeURIComponent(safeOrg)}/blog/${encodeURIComponent(safeSlug)}/rss.xml`,
  );
}

export function buildHeadlessArticlesListApiUrl(orgSlug: string): string {
  const safeOrg = String(orgSlug || '').trim();
  if (!safeOrg) return '';
  return getApiUrlForFetch(`/public/v1/content/${encodeURIComponent(safeOrg)}/articles`);
}

export function buildHeadlessArticleCustomerUrl(slug: string, canonicalUrl = ''): string {
  const canonical = String(canonicalUrl || '').trim();
  if (canonical) return canonical;
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return 'https://your-site.com/articles/your-slug';
  return `https://your-site.com/articles/${safeSlug}`;
}

export function buildHeadlessBlogCustomerUrl(
  slug: string,
  canonicalUrl = '',
  urlPrefix = '/blog',
): string {
  const canonical = String(canonicalUrl || '').trim();
  if (canonical) return canonical;
  const safeSlug = String(slug || '').trim();
  const prefixRaw = String(urlPrefix || '/blog').trim() || '/blog';
  const prefix = `/${prefixRaw.replace(/^\/+/, '').replace(/\/+$/, '')}`.replace(/^\/$/, '/blog');
  if (!safeSlug) return `https://your-site.com${prefix}/your-slug`;
  return `https://your-site.com${prefix}/${safeSlug}`;
}
