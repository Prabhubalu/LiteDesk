const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_ORG || '';
const PATH_PREFIX = process.env.BLOG_URL_PREFIX || '/blog/';

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

type ManifestArticle = {
  slug?: string;
  collectionPath?: string[];
};

type ManifestData = {
  pages?: Array<{ type?: string; collectionPath?: string[] }>;
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
  return fetchExportJson(`${contentBase()}/blog/export/home${buildQuery()}`);
}

export async function fetchPostExport(postSlug: string): Promise<ExportPayload | null> {
  return fetchExportJson(
    `${contentBase()}/blog/${encodeURIComponent(postSlug)}/export${buildQuery()}`,
  );
}

export async function fetchManifest(): Promise<ManifestData | null> {
  const params = new URLSearchParams({ pathPrefix: PATH_PREFIX });
  return fetchExportJson(`${contentBase()}/blog/manifest.json?${params.toString()}`);
}

export function pickPageHtml(data: ExportPayload | null): string {
  if (!data) return '';
  return data.html || data.bodyHtml || '';
}

export function buildBlogPathname(pathPrefix: string, slug: string[] = []): string {
  const normalized = String(pathPrefix || '/blog/').trim().replace(/\/$/, '') || '/blog';
  if (!slug.length) return normalized;
  return `${normalized}/${slug.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export async function resolveBlogPage(slug: string[] = []): Promise<{
  data: ExportPayload;
} | null> {
  if (slug.length === 0) {
    const data = await fetchHomeExport();
    const pageHtml = pickPageHtml(data);
    if (!pageHtml || !data) return null;
    return { data: { ...data, html: pageHtml } };
  }

  const postSlug = slug[slug.length - 1];
  const post = await fetchPostExport(postSlug);
  const postHtml = pickPageHtml(post);
  if (postHtml && post) {
    return { data: { ...post, html: postHtml } };
  }

  return null;
}

export async function buildStaticSlugParams(): Promise<Array<{ slug: string[] }>> {
  const manifest = await fetchManifest();
  if (!manifest) return [{ slug: [] }];

  const paths: Array<{ slug: string[] }> = [{ slug: [] }];
  const seen = new Set<string>();

  for (const article of manifest.articles || []) {
    const postSlug = String(article.slug || '').trim();
    if (!postSlug || seen.has(postSlug)) continue;
    seen.add(postSlug);
    paths.push({ slug: [postSlug] });
  }

  return paths;
}

export async function fetchStaticSitemapXml(): Promise<string | null> {
  const params = new URLSearchParams({
    pathPrefix: PATH_PREFIX,
    siteOrigin: process.env.SITE_ORIGIN || '',
  });
  const response = await fetch(`${contentBase()}/blog/export/sitemap.xml?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return response.text();
}
