'use strict';

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('./client');
const { buildStaticPageHtml } = require('./pageShell');
const {
  normalizePathPrefix,
  normalizeAssetsPrefix,
  resolveDestinationFile,
  resolveAssetDestination,
  rewriteHtmlAssetUrls,
} = require('./paths');

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeFileAtomic(filePath, contents) {
  await ensureDir(filePath);
  await fs.writeFile(filePath, contents);
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function resolveSitemapDestination(destRoot, pathPrefix) {
  const prefix = normalizePathPrefix(pathPrefix);
  return resolveDestinationFile(destRoot, `${prefix}sitemap.xml`);
}

async function mirrorExportAssets({
  client,
  dest,
  assets = [],
  assetsPrefix,
  pathPrefix,
}) {
  const urlMap = new Map();
  const written = [];

  for (const asset of assets) {
    const sourceUrl = String(asset.url || '').trim();
    const filename = String(asset.filename || asset.assetId || 'asset').trim();
    if (!sourceUrl || !filename) continue;

    const targetPath = resolveAssetDestination(dest, assetsPrefix, filename);
    const publicPath = `${normalizeAssetsPrefix(assetsPrefix, pathPrefix)}${filename}`;
    const { buffer } = await client.fetchBuffer(sourceUrl);
    await writeFileAtomic(targetPath, buffer);
    urlMap.set(sourceUrl, publicPath);
    written.push({ assetId: asset.assetId, path: targetPath, publicPath });
  }

  return { urlMap, written };
}

async function syncPageExport({
  client,
  dest,
  page,
  pathPrefix = '/help/',
  siteOrigin = '',
  shell = true,
}) {
  let exportData;
  if (page?.type === 'home') {
    exportData = await client.fetchHomeExport(pathPrefix, { chrome: true });
  } else {
    const slug = String(page?.slug || page?.collectionPath?.[page.collectionPath.length - 1] || '').trim();
    const parentSlug = String(
      page?.parentSlug
      || (Array.isArray(page?.collectionPath) && page.collectionPath.length > 1
        ? page.collectionPath[page.collectionPath.length - 2]
        : ''),
    ).trim();
    exportData = await client.fetchCollectionExport(slug, { pathPrefix, parentSlug, chrome: true });
  }

  let html = exportData.html;
  if (shell) {
    html = buildStaticPageHtml({
      bodyHtml: html,
      meta: exportData.meta,
      apiOrigin: client.apiOrigin,
      siteOrigin,
      canonicalPath: exportData.exportPath,
    });
  }

  const destination = resolveDestinationFile(dest, exportData.exportPath);
  await writeFileAtomic(destination, html);
  return {
    type: exportData.type || page?.type || 'page',
    exportPath: exportData.exportPath,
    destination,
  };
}

async function syncRefreshPages({
  client,
  dest,
  pages = [],
  pathPrefix = '/help/',
  siteOrigin = '',
  shell = true,
}) {
  const results = [];
  for (const page of pages) {
    results.push(await syncPageExport({
      client,
      dest,
      page,
      pathPrefix,
      siteOrigin,
      shell,
    }));
  }
  return results;
}

async function syncArticleExport({
  apiOrigin,
  org,
  dest,
  slug,
  pathPrefix = '/help/',
  articleLinkPrefix,
  assetsPrefix,
  mirrorAssets = true,
  siteOrigin = '',
  shell = true,
  addon = 'articles',
  client = null,
}) {
  const syncClient = client || createClient({ apiOrigin, org, addon });
  const exportData = await syncClient.fetchExport(slug, {
    pathPrefix,
    articleLinkPrefix: articleLinkPrefix || pathPrefix,
    chrome: true,
  });

  let html = exportData.html;
  let assetsWritten = [];

  if (mirrorAssets && Array.isArray(exportData.assets) && exportData.assets.length) {
    const mirrored = await mirrorExportAssets({
      client: syncClient,
      dest,
      assets: exportData.assets,
      assetsPrefix,
      pathPrefix,
    });
    html = rewriteHtmlAssetUrls(html, mirrored.urlMap);
    assetsWritten = mirrored.written;
  }

  if (shell) {
    html = buildStaticPageHtml({
      bodyHtml: html,
      meta: exportData.meta,
      apiOrigin: syncClient.apiOrigin,
      siteOrigin,
      canonicalPath: exportData.exportPath,
    });
  }

  const destination = resolveDestinationFile(dest, exportData.exportPath);
  await writeFileAtomic(destination, html);

  return {
    slug: exportData.slug,
    exportPath: exportData.exportPath,
    destination,
    assetsWritten,
  };
}

async function writeCustomerSitemap({
  client,
  dest,
  pathPrefix = '/help/',
  siteOrigin = '',
}) {
  const xml = await client.fetchStaticSitemap(pathPrefix, siteOrigin);
  const destination = resolveSitemapDestination(dest, pathPrefix);
  await writeFileAtomic(destination, xml);
  return { destination, exportPath: `${normalizePathPrefix(pathPrefix)}sitemap.xml` };
}

async function syncFull({
  apiOrigin,
  org,
  dest,
  pathPrefix = '/help/',
  articleLinkPrefix,
  assetsPrefix,
  mirrorAssets = true,
  siteOrigin = '',
  addon = 'articles',
}) {
  const client = createClient({ apiOrigin, org, addon });
  const manifest = await client.fetchManifest(pathPrefix);
  const results = [];

  for (const page of manifest.pages || []) {
    results.push(await syncPageExport({ client, dest, page, pathPrefix, siteOrigin }));
  }

  for (const article of manifest.articles || []) {
    const result = await syncArticleExport({
      apiOrigin,
      org,
      dest,
      slug: article.slug,
      pathPrefix,
      articleLinkPrefix,
      assetsPrefix,
      mirrorAssets,
      siteOrigin,
      addon,
      client,
    });
    results.push(result);
  }

  const sitemap = await writeCustomerSitemap({ client, dest, pathPrefix, siteOrigin });

  return {
    version: manifest.version,
    count: results.length,
    results,
    sitemap,
  };
}

async function deleteArticleExport({
  dest,
  exportPath,
}) {
  const destination = resolveDestinationFile(dest, exportPath);
  const removed = await removeFileIfExists(destination);
  return { exportPath, destination, removed };
}

async function handleWebhookPayload({
  apiOrigin,
  org,
  dest,
  payload,
  pathPrefix = '/help/',
  articleLinkPrefix,
  assetsPrefix,
  mirrorAssets = true,
  siteOrigin = '',
  shell = true,
  addon,
}) {
  const event = String(payload?.event || '').trim();
  const content = payload?.content || {};
  const contentAddon = String(content.addonKey || '').trim();
  const resolvedAddon = addon
    || (contentAddon === 'blog' ? 'blog' : 'articles');
  const inferredBlogFromPayload = !addon && contentAddon === 'blog';
  const resolvedPathPrefix = inferredBlogFromPayload && (!pathPrefix || pathPrefix === '/help/')
    ? '/blog/'
    : (pathPrefix || (resolvedAddon === 'blog' ? '/blog/' : '/help/'));
  const client = createClient({ apiOrigin, org, addon: resolvedAddon });
  const refreshPages = Array.isArray(content.refreshPages) ? content.refreshPages : [];

  let result;

  if (event === 'content.unpublished') {
    const deleteResult = await deleteArticleExport({
      dest,
      exportPath: content.exportPath,
    });
    const refreshed = await syncRefreshPages({
      client,
      dest,
      pages: refreshPages,
      pathPrefix: resolvedPathPrefix,
      siteOrigin,
      shell,
    });
    result = { ...deleteResult, refreshPages: refreshed };
  } else if (event === 'content.published') {
    const articleResult = await syncArticleExport({
      apiOrigin,
      org,
      dest,
      slug: content.slug,
      pathPrefix: resolvedPathPrefix,
      articleLinkPrefix: articleLinkPrefix || resolvedPathPrefix,
      assetsPrefix,
      mirrorAssets,
      siteOrigin,
      shell,
      addon: resolvedAddon,
      client,
    });
    const refreshed = await syncRefreshPages({
      client,
      dest,
      pages: refreshPages,
      pathPrefix: resolvedPathPrefix,
      siteOrigin,
      shell,
    });
    result = { ...articleResult, refreshPages: refreshed };
  } else {
    const error = new Error(`Unsupported webhook event: ${event || 'unknown'}`);
    error.code = 'UNSUPPORTED_EVENT';
    throw error;
  }

  const sitemap = await writeCustomerSitemap({
    client,
    dest,
    pathPrefix: resolvedPathPrefix,
    siteOrigin,
  });
  return { ...result, sitemap };
}

module.exports = {
  syncArticleExport,
  syncPageExport,
  syncRefreshPages,
  syncFull,
  deleteArticleExport,
  handleWebhookPayload,
  writeCustomerSitemap,
  mirrorExportAssets,
  writeFileAtomic,
  removeFileIfExists,
  resolveSitemapDestination,
  buildStaticPageHtml,
};
