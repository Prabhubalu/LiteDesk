const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG =
  process.env.ARIVU_BLOG_ORG
  || process.env.ARIVU_ORG
  || process.env.ARIVU_HELP_ORG
  || '';
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

/** hybrid/static: prefer synced public HTML when the file exists on disk */
export function shouldPreferSyncedHtml(): boolean {
  const mode = process.env.ARIVU_SYNC_MODE || 'hybrid';
  return mode === 'hybrid' || mode === 'static';
}

function extractBodyFromSyncedHtml(fullHtml: string): string {
  const openMatch = fullHtml.match(
    /<div\s+class="[^"]*\b(?:ld-blog-(?:root|embed)|ld-help-(?:root|embed))\b[^"]*"[^>]*>/i,
  );
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
