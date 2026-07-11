const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_ORG || '';
const PATH_PREFIX = process.env.HELP_URL_PREFIX || '/help/';

export type ExportMeta = {
  title?: string;
  description?: string;
  canonical?: string;
};

export type ExportPayload = {
  html?: string;
  bodyHtml?: string;
  meta?: ExportMeta;
  type?: string;
};

type ManifestPage = {
  type?: string;
  collectionPath?: string[];
};

type ManifestArticle = {
  slug?: string;
  collectionPath?: string[];
};

type ManifestData = {
  pages?: ManifestPage[];
  articles?: ManifestArticle[];
};

function contentBase(): string {
  return `${API_ORIGIN.replace(/\/$/, '')}/api/public/v1/content/${encodeURIComponent(ORG)}`;
}

function buildQuery(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    pathPrefix: PATH_PREFIX,
    fragment: '1',
    chrome: '1',
    ...extra,
  });
  return `?${params.toString()}`;
}

async function fetchExportJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: T } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    return null;
  }
  return payload.data;
}

export async function fetchHomeExport(): Promise<ExportPayload | null> {
  return fetchExportJson(`${contentBase()}/export/home${buildQuery()}`);
}

export async function fetchCollectionExport(
  slug: string,
  parentSlug = '',
): Promise<ExportPayload | null> {
  const parent = parentSlug ? { parent: parentSlug } : {};
  return fetchExportJson(
    `${contentBase()}/export/collections/${encodeURIComponent(slug)}${buildQuery(parent)}`,
  );
}

export async function fetchArticleExport(articleSlug: string): Promise<ExportPayload | null> {
  return fetchExportJson(
    `${contentBase()}/articles/${encodeURIComponent(articleSlug)}/export${buildQuery()}`,
  );
}

export async function fetchManifest(): Promise<ManifestData | null> {
  const params = new URLSearchParams({ pathPrefix: PATH_PREFIX });
  return fetchExportJson(`${contentBase()}/manifest.json?${params.toString()}`);
}

export function pickPageHtml(data: ExportPayload | null): string {
  if (!data) return '';
  return data.html || data.bodyHtml || '';
}

export function buildHelpPathname(pathPrefix: string, slug: string[] = []): string {
  const normalized = String(pathPrefix || '/help/').trim().replace(/\/$/, '') || '/help';
  if (!slug.length) return normalized;
  return `${normalized}/${slug.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export async function resolveHelpPage(slug: string[] = []): Promise<{
  data: ExportPayload;
} | null> {
  if (slug.length === 0) {
    const data = await fetchHomeExport();
    const pageHtml = pickPageHtml(data);
    if (!pageHtml || !data) return null;
    return { data: { ...data, html: pageHtml } };
  }

  const articleSlug = slug[slug.length - 1];
  const article = await fetchArticleExport(articleSlug);
  const articleHtml = pickPageHtml(article);
  if (articleHtml && article) {
    return { data: { ...article, html: articleHtml } };
  }

  const collectionSlug = slug[slug.length - 1];
  const parentSlug = slug.length > 1 ? slug[slug.length - 2] : '';
  const collection = await fetchCollectionExport(collectionSlug, parentSlug);
  const collectionHtml = pickPageHtml(collection);
  if (collectionHtml && collection) {
    return { data: { ...collection, html: collectionHtml } };
  }

  return null;
}

export async function buildStaticSlugParams(): Promise<Array<{ slug: string[] }>> {
  const manifest = await fetchManifest();
  if (!manifest) return [{ slug: [] }];

  const paths: Array<{ slug: string[] }> = [{ slug: [] }];

  for (const page of manifest.pages || []) {
    if (page.type === 'home' || !Array.isArray(page.collectionPath) || !page.collectionPath.length) {
      continue;
    }
    paths.push({ slug: page.collectionPath });
  }

  for (const article of manifest.articles || []) {
    const collectionPath = Array.isArray(article.collectionPath) ? article.collectionPath : [];
    const slug = String(article.slug || '').trim();
    if (!slug) continue;
    paths.push({ slug: [...collectionPath, slug] });
  }

  return paths;
}

export async function fetchStaticSitemapXml(): Promise<string | null> {
  const params = new URLSearchParams({
    pathPrefix: PATH_PREFIX,
    siteOrigin: process.env.SITE_ORIGIN || '',
  });
  const response = await fetch(`${contentBase()}/export/sitemap.xml?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return response.text();
}
