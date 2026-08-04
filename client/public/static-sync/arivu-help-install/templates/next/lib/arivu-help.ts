const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
// Prefer articles key; fall back so dual Help+Blog installs still resolve when only one org env is set.
const ORG =
  process.env.ARIVU_HELP_ORG
  || process.env.ARIVU_ORG
  || process.env.ARIVU_BLOG_ORG
  || '';
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

/** hybrid/static: prefer synced public HTML when the file exists on disk */
export function shouldPreferSyncedHtml(): boolean {
  const mode = process.env.ARIVU_SYNC_MODE || 'hybrid';
  return mode === 'hybrid' || mode === 'static';
}

function extractBodyFromSyncedHtml(fullHtml: string): string {
  const openMatch = fullHtml.match(/<div\s+class="[^"]*\bld-help-(?:root|embed)\b[^"]*"[^>]*>/i);
  if (openMatch && openMatch.index != null) {
    const contentStart = openMatch.index + openMatch[0].length;
    let depth = 1;
    let i = contentStart;
    while (i < fullHtml.length && depth > 0) {
      const nextOpen = fullHtml.indexOf('<div', i);
      const nextClose = fullHtml.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        if (depth === 0) {
          return fullHtml.slice(contentStart, nextClose).trim();
        }
        i = nextClose + 6;
      }
    }
  }

  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch?.[1]) return '';
  return bodyMatch[1]
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .trim();
}

export async function readSyncedPageHtml(pathname: string): Promise<string | null> {
  if (!shouldPreferSyncedHtml()) return null;

  const destRoot = process.env.ARIVU_SYNC_DEST || './public';
  const relative = String(pathname || '')
    .replace(/^\//, '')
    .replace(/\/$/, '');
  if (!relative) return null;

  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const candidates = [
    path.join(process.cwd(), destRoot, relative, 'index.html'),
    path.join(process.cwd(), destRoot, `${relative}.html`),
  ];

  for (const filePath of candidates) {
    try {
      const fullHtml = await fs.readFile(filePath, 'utf8');
      const body = extractBodyFromSyncedHtml(fullHtml);
      if (body) return body;
    } catch {
      // try next candidate
    }
  }
  return null;
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
