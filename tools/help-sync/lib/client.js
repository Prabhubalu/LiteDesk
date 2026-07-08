'use strict';

function buildContentBase(apiOrigin, org) {
  const origin = String(apiOrigin || '').replace(/\/$/, '');
  const orgKey = String(org || '').trim();
  if (!origin || !orgKey) {
    throw new Error('apiOrigin and org are required');
  }
  return `${origin}/api/public/v1/content/${encodeURIComponent(orgKey)}`;
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
  const payload = await fetchJson(`${client.contentBase}/manifest.json${suffix}`);
  return payload.data;
}

async function fetchExport(client, slug, options = {}) {
  const params = new URLSearchParams();
  if (options.pathPrefix) params.set('pathPrefix', options.pathPrefix);
  if (options.articleLinkPrefix) params.set('articleLinkPrefix', options.articleLinkPrefix);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(
    `${client.contentBase}/articles/${encodeURIComponent(slug)}/export${suffix}`,
  );
  return payload.data;
}

async function fetchHomeExport(client, pathPrefix, options = {}) {
  const params = new URLSearchParams();
  if (pathPrefix) params.set('pathPrefix', pathPrefix);
  if (options.fragment) params.set('fragment', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(`${client.contentBase}/export/home${suffix}`);
  return payload.data;
}

async function fetchCollectionExport(client, slug, options = {}) {
  const params = new URLSearchParams();
  if (options.pathPrefix) params.set('pathPrefix', options.pathPrefix);
  if (options.parentSlug) params.set('parent', options.parentSlug);
  if (options.fragment) params.set('fragment', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJson(
    `${client.contentBase}/export/collections/${encodeURIComponent(slug)}${suffix}`,
  );
  return payload.data;
}

async function fetchStaticSitemap(client, pathPrefix, siteOrigin = '') {
  const params = new URLSearchParams();
  if (pathPrefix) params.set('pathPrefix', pathPrefix);
  if (siteOrigin) params.set('siteOrigin', siteOrigin);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchText(`${client.contentBase}/export/sitemap.xml${suffix}`);
}

function createClient({ apiOrigin, org }) {
  const contentBase = buildContentBase(apiOrigin, org);
  return {
    apiOrigin: String(apiOrigin || '').replace(/\/$/, ''),
    org: String(org || '').trim(),
    contentBase,
    fetchManifest: (pathPrefix) => fetchManifest({ contentBase }, pathPrefix),
    fetchExport: (slug, options) => fetchExport({ contentBase }, slug, options),
    fetchHomeExport: (pathPrefix, options) => fetchHomeExport({ contentBase }, pathPrefix, options),
    fetchCollectionExport: (slug, options) => fetchCollectionExport({ contentBase }, slug, options),
    fetchStaticSitemap: (pathPrefix, siteOrigin) => fetchStaticSitemap({ contentBase }, pathPrefix, siteOrigin),
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
};
