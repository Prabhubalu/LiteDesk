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
