'use strict';

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('./client');
const {
  syncArticleExport,
  syncPageExport,
  syncFull,
  deleteArticleExport,
  writeCustomerSitemap,
  handleWebhookPayload,
} = require('./sync');

function resolveSyncStatePath(customPath) {
  if (customPath) return customPath;
  if (process.env.ARIVU_SYNC_STATE_PATH) return process.env.ARIVU_SYNC_STATE_PATH;
  if (process.env.VERCEL) return path.join('.next/cache/arivu-sync-state.json');
  return '.arivu/sync-state.json';
}

async function readSyncState(statePath) {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { articles: {}, pagesSnapshot: '', manifestVersion: '', initialized: false };
  }
}

async function writeSyncState(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function articleStateKey(article) {
  return String(article.slug || '').trim().toLowerCase();
}

function buildArticleStateMap(manifestArticles) {
  const map = {};
  for (const article of manifestArticles || []) {
    const slug = articleStateKey(article);
    if (!slug) continue;
    map[slug] = {
      updatedAt: String(article.updatedAt || article.publishedAt || ''),
      exportPath: String(article.exportPath || ''),
    };
  }
  return map;
}

function serializePagesSnapshot(manifestPages) {
  return JSON.stringify((manifestPages || []).map((page) => ({
    type: page.type,
    slug: page.slug,
    exportPath: page.exportPath,
    collectionPath: page.collectionPath,
  })));
}

function pagesStructureChanged(stateSnapshot, manifestPages) {
  return String(stateSnapshot || '') !== serializePagesSnapshot(manifestPages);
}

function findManifestPage(manifestPages, collectionPathSlugs) {
  return (manifestPages || []).find((page) => {
    if (page.type === 'home') return false;
    const pagePath = Array.isArray(page.collectionPath) ? page.collectionPath : [];
    if (pagePath.length !== collectionPathSlugs.length) return false;
    return pagePath.every((segment, index) => segment === collectionPathSlugs[index]);
  }) || null;
}

function collectRefreshPages(manifestPages, changedArticles) {
  const refreshPageKeys = new Map();
  const addPage = (page) => {
    if (!page?.exportPath) return;
    refreshPageKeys.set(String(page.exportPath), page);
  };

  const homePage = (manifestPages || []).find((page) => page.type === 'home');
  if (homePage) addPage(homePage);

  for (const article of changedArticles) {
    const collectionPath = Array.isArray(article.collectionPath) ? article.collectionPath : [];
    for (let index = 0; index < collectionPath.length; index += 1) {
      const pathSlugs = collectionPath.slice(0, index + 1);
      const page = findManifestPage(manifestPages, pathSlugs);
      if (page) addPage(page);
    }
  }

  return [...refreshPageKeys.values()];
}

async function syncIncremental({
  apiOrigin,
  org,
  dest,
  pathPrefix = '/help/',
  siteOrigin = '',
  mirrorAssets = true,
  statePath,
}) {
  const resolvedStatePath = resolveSyncStatePath(statePath);
  const client = createClient({ apiOrigin, org });
  const manifest = await client.fetchManifest(pathPrefix);
  const state = await readSyncState(resolvedStatePath);
  const manifestArticles = manifest.articles || [];
  const manifestPages = manifest.pages || [];
  const nextArticleMap = buildArticleStateMap(manifestArticles);
  const pagesSnapshot = serializePagesSnapshot(manifestPages);

  if (!state.initialized) {
    return syncFullWithState({
      apiOrigin,
      org,
      dest,
      pathPrefix,
      siteOrigin,
      mirrorAssets,
      statePath: resolvedStatePath,
    });
  }

  const results = [];

  for (const [slug, entry] of Object.entries(state.articles || {})) {
    if (!nextArticleMap[slug] && entry.exportPath) {
      results.push(await deleteArticleExport({ dest, exportPath: entry.exportPath }));
    }
  }

  const changedArticles = manifestArticles.filter((article) => {
    const slug = articleStateKey(article);
    const prev = state.articles?.[slug];
    const updatedAt = String(article.updatedAt || article.publishedAt || '');
    return !prev || prev.updatedAt !== updatedAt;
  });

  const pagesToSync = pagesStructureChanged(state.pagesSnapshot, manifestPages)
    ? manifestPages
    : collectRefreshPages(manifestPages, changedArticles);

  for (const page of pagesToSync) {
    results.push(await syncPageExport({
      client,
      dest,
      page,
      pathPrefix,
      siteOrigin,
    }));
  }

  for (const article of changedArticles) {
    results.push(await syncArticleExport({
      apiOrigin,
      org,
      dest,
      slug: article.slug,
      pathPrefix,
      siteOrigin,
      mirrorAssets,
      client,
    }));
  }

  const sitemap = await writeCustomerSitemap({ client, dest, pathPrefix, siteOrigin });

  if (
    changedArticles.length
    || pagesStructureChanged(state.pagesSnapshot, manifestPages)
    || results.some((entry) => entry.removed)
  ) {
    await writeSyncState(resolvedStatePath, {
      initialized: true,
      manifestVersion: manifest.version || '',
      pagesSnapshot,
      articles: nextArticleMap,
    });
  }

  return {
    mode: 'incremental',
    version: manifest.version,
    changedArticles: changedArticles.length,
    refreshedPages: pagesToSync.length,
    count: results.length,
    results,
    sitemap,
    statePath: resolvedStatePath,
  };
}

async function syncFullWithState({
  apiOrigin,
  org,
  dest,
  pathPrefix = '/help/',
  siteOrigin = '',
  mirrorAssets = true,
  statePath,
}) {
  const resolvedStatePath = resolveSyncStatePath(statePath);
  const result = await syncFull({
    apiOrigin,
    org,
    dest,
    pathPrefix,
    siteOrigin,
    mirrorAssets,
  });

  const client = createClient({ apiOrigin, org });
  const manifest = await client.fetchManifest(pathPrefix);
  const manifestPages = manifest.pages || [];

  await writeSyncState(resolvedStatePath, {
    initialized: true,
    manifestVersion: manifest.version || '',
    pagesSnapshot: serializePagesSnapshot(manifestPages),
    articles: buildArticleStateMap(manifest.articles),
  });

  return {
    ...result,
    mode: 'full',
    statePath: resolvedStatePath,
  };
}

async function syncFromWebhookPayload({
  apiOrigin,
  org,
  dest,
  payload,
  pathPrefix = '/help/',
  siteOrigin = '',
  mirrorAssets = true,
  statePath,
}) {
  const resolvedStatePath = resolveSyncStatePath(statePath);
  const result = await handleWebhookPayload({
    apiOrigin,
    org,
    dest,
    payload,
    pathPrefix,
    siteOrigin,
    mirrorAssets,
  });

  const client = createClient({ apiOrigin, org });
  const manifest = await client.fetchManifest(pathPrefix);
  const manifestPages = manifest.pages || [];

  await writeSyncState(resolvedStatePath, {
    initialized: true,
    manifestVersion: manifest.version || '',
    pagesSnapshot: serializePagesSnapshot(manifestPages),
    articles: buildArticleStateMap(manifest.articles),
  });

  return {
    ...result,
    mode: 'webhook',
    statePath: resolvedStatePath,
  };
}

module.exports = {
  resolveSyncStatePath,
  readSyncState,
  writeSyncState,
  syncIncremental,
  syncFullWithState,
  syncFromWebhookPayload,
};
