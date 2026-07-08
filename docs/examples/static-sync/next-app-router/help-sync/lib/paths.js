'use strict';

function normalizeSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
}

function normalizePathPrefix(prefix) {
  const raw = String(prefix || '/help/').trim();
  if (!raw) return '/help/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function normalizeAssetsPrefix(prefix, pathPrefix) {
  const raw = String(prefix || '').trim();
  if (raw) return raw.endsWith('/') ? raw : `${raw}/`;
  return `${normalizePathPrefix(pathPrefix)}assets/`;
}

function buildExportPath({
  slug,
  collectionPath = [],
  pathPrefix = '/help/',
} = {}) {
  const prefix = normalizePathPrefix(pathPrefix);
  const segments = [
    ...collectionPath.map(normalizeSlug),
    normalizeSlug(slug),
  ].filter(Boolean);
  if (!segments.length) return `${prefix}index.html`;
  return `${prefix}${segments.map(encodeURIComponent).join('/')}/index.html`;
}

function resolveDestinationFile(destRoot, exportPath) {
  const root = String(destRoot || '').replace(/\/$/, '');
  const relative = String(exportPath || '').replace(/^\/+/, '');
  return `${root}/${relative}`;
}

function resolveAssetDestination(destRoot, assetsPrefix, filename) {
  const root = String(destRoot || '').replace(/\/$/, '');
  const prefix = normalizeAssetsPrefix(assetsPrefix);
  const relative = prefix.replace(/^\/+/, '');
  return `${root}/${relative}${filename}`;
}

function rewriteHtmlAssetUrls(html, urlMap) {
  let output = String(html || '');
  for (const [sourceUrl, targetPath] of urlMap.entries()) {
    if (!sourceUrl || !targetPath) continue;
    output = output.split(sourceUrl).join(targetPath);
  }
  return output;
}

module.exports = {
  normalizeSlug,
  normalizePathPrefix,
  normalizeAssetsPrefix,
  buildExportPath,
  resolveDestinationFile,
  resolveAssetDestination,
  rewriteHtmlAssetUrls,
};
