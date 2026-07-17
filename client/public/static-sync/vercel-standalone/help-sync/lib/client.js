'use strict';

function buildContentBase(apiOrigin, org) {
  const origin = String(apiOrigin || '').replace(/\/$/, '');
  const orgKey = String(org || '').trim();
  if (!origin || !orgKey) {
    throw new Error('apiOrigin and org are required');
  }
  return `${origin}/api/public/v1/content/${encodeURIComponent(orgKey)}`;
}

function normalizeAddon(addon) {
  return String(addon || 'articles').trim().toLowerCase() === 'blog' ? 'blog' : 'articles';
}

function resolveExportBase(contentBase, addon) {
  return addon === 'blog' ? `${contentBase}/blog` : contentBase;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Asset download failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.text();
}

async function fetchManifest(client, pathPrefix) {
  const params = new URLSearchParams();
  if (pathPrefix) params.set('pathPrefix', pathPrefix);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(`${client.exportBase}/manifest.json${suffix}`);
  return payload.data;
}

async function fetchExport(client, slug, options = {}) {
  const params = new URLSearchParams();
  if (options.pathPrefix) params.set('pathPrefix', options.pathPrefix);
  if (options.articleLinkPrefix) params.set('articleLinkPrefix', options.articleLinkPrefix);
  if (options.fragment) params.set('fragment', '1');
  if (options.chrome) params.set('chrome', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const exportPath = client.addon === 'blog'
    ? `${client.exportBase}/${encodeURIComponent(slug)}/export${suffix}`
    : `${client.exportBase}/articles/${encodeURIComponent(slug)}/export${suffix}`;
  const payload = await fetchJson(exportPath);
  return payload.data;
}

async function fetchHomeExport(client, pathPrefix, options = {}) {
  const params = new URLSearchParams();
  if (pathPrefix) params.set('pathPrefix', pathPrefix);
  if (options.fragment) params.set('fragment', '1');
  if (options.chrome) params.set('chrome', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(`${client.exportBase}/export/home${suffix}`);
  return payload.data;
}

async function fetchCollectionExport(client, slug, options = {}) {
  const params = new URLSearchParams();
  if (options.pathPrefix) params.set('pathPrefix', options.pathPrefix);
  if (options.parentSlug) params.set('parent', options.parentSlug);
  if (options.fragment) params.set('fragment', '1');
  if (options.chrome) params.set('chrome', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(
    `${client.exportBase}/export/collections/${encodeURIComponent(slug)}${suffix}`,
  );
  return payload.data;
}

async function fetchStaticSitemap(client, pathPrefix, siteOrigin = '') {
  const params = new URLSearchParams();
  if (pathPrefix) params.set('pathPrefix', pathPrefix);
  if (siteOrigin) params.set('siteOrigin', siteOrigin);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchText(`${client.exportBase}/export/sitemap.xml${suffix}`);
}

function createClient(apiOriginOrOptions, orgArg, options = {}) {
  let resolvedOrigin;
  let resolvedOrg;
  let resolvedAddon = 'articles';

  if (apiOriginOrOptions && typeof apiOriginOrOptions === 'object') {
    resolvedOrigin = apiOriginOrOptions.apiOrigin;
    resolvedOrg = apiOriginOrOptions.org;
    resolvedAddon = apiOriginOrOptions.addon || 'articles';
  } else {
    resolvedOrigin = apiOriginOrOptions;
    resolvedOrg = orgArg;
    resolvedAddon = options.addon || 'articles';
  }

  const contentBase = buildContentBase(resolvedOrigin, resolvedOrg);
  const normalizedAddon = normalizeAddon(resolvedAddon);
  const exportBase = resolveExportBase(contentBase, normalizedAddon);
  const client = {
    apiOrigin: String(resolvedOrigin || '').replace(/\/$/, ''),
    org: String(resolvedOrg || '').trim(),
    addon: normalizedAddon,
    contentBase,
    exportBase,
  };
  return {
    ...client,
    fetchManifest: (pathPrefix) => fetchManifest(client, pathPrefix),
    fetchExport: (slug, opts) => fetchExport(client, slug, opts),
    fetchHomeExport: (pathPrefix, opts) => fetchHomeExport(client, pathPrefix, opts),
    fetchCollectionExport: (slug, opts) => fetchCollectionExport(client, slug, opts),
    fetchStaticSitemap: (pathPrefix, siteOrigin) => fetchStaticSitemap(client, pathPrefix, siteOrigin),
    fetchBuffer,
  };
}

module.exports = {
  buildContentBase,
  createClient,
  fetchJson,
  fetchBuffer,
  fetchText,
  fetchManifest,
  fetchExport,
  fetchHomeExport,
  fetchCollectionExport,
  fetchStaticSitemap,
  normalizeAddon,
};
