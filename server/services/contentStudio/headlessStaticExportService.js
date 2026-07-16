'use strict';

const path = require('path');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const ContentCollection = require('../../models/ContentCollection');
const { getAssetById } = require('../contentPlatform/contentAssetService');
const { resolveStudioAsset } = require('./resolveStudioAsset');
const { renderBlocksToHtml } = require('./contentStudioBlockRenderer');
const {
  shapeHeadlessArticleDetail,
  absolutizePublicAssetUrlsInHtml,
} = require('./headlessContentShaper');
const {
  buildArticleApiUrl,
  buildArticleExportUrl,
  buildManifestUrl,
  buildPublicAssetDownloadUrl,
  buildHomeExportUrl,
  buildCollectionExportUrl,
  buildBlogPostApiUrl,
  buildBlogPostExportUrl,
  buildBlogManifestUrl,
  buildBlogHomeExportUrl,
  buildBlogCollectionExportUrl,
  getPublicAppBaseUrl,
} = require('./contentPublishingService');
const {
  getPublicPublishingContext,
  resolveOrganizationForPublic,
  buildPublicContentEnvelope,
  buildPublicCollectionTree,
  listPublicRecentHelpArticles,
  listPublicPopularHelpArticles,
} = require('./publicContentService');
const {
  buildArticlePageChrome,
  buildHomeExportChrome,
  buildCollectionExportChrome,
} = require('./headlessExportChromeBuilder');

const CONTENT_PROFILES = {
  articles: {
    addonKey: 'articles',
    contentType: 'knowledge_article',
    defaultPathPrefix: '/help/',
    itemLabel: 'article',
    homeTitle: 'Help Center',
    homeDescription: 'Browse help topics',
    homeEyebrow: 'Help Center',
    homeSectionTitle: 'Browse topics',
    resolvePublishingContext: getPublicPublishingContext,
    buildDocumentApiUrl: buildArticleApiUrl,
    buildDocumentExportUrl: buildArticleExportUrl,
    buildManifestUrl,
    buildHomeExportUrl,
    buildCollectionExportUrl,
  },
  blog: {
    addonKey: 'blog',
    contentType: 'blog_post',
    defaultPathPrefix: '/blog/',
    itemLabel: 'post',
    homeTitle: 'Blog',
    homeDescription: 'Latest posts',
    homeEyebrow: 'Blog',
    homeSectionTitle: 'Latest posts',
    resolvePublishingContext: async (org) => {
      const { getPublicBlogPublishingContext } = require('./publicContentService');
      return getPublicBlogPublishingContext(org);
    },
    buildDocumentApiUrl: buildBlogPostApiUrl,
    buildDocumentExportUrl: buildBlogPostExportUrl,
    buildManifestUrl: buildBlogManifestUrl,
    buildHomeExportUrl: buildBlogHomeExportUrl,
    buildCollectionExportUrl: buildBlogCollectionExportUrl,
  },
};

function resolveContentProfile(profileKey = 'articles') {
  return CONTENT_PROFILES[profileKey] || CONTENT_PROFILES.articles;
}

function normalizeArticleSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
}

function normalizeExportPathPrefix(prefix, fallback = '/help/') {
  const raw = String(prefix || fallback).trim();
  if (!raw) return fallback.endsWith('/') ? fallback : `${fallback}/`;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPublicContentQuery(organizationId, profile) {
  const resolved = typeof profile === 'string' ? resolveContentProfile(profile) : profile;
  return {
    organizationId,
    addonKey: resolved.addonKey,
    contentType: resolved.contentType,
    status: 'published',
    deletedAt: null,
    visibility: 'public',
  };
}

function buildPublicArticlesQuery(organizationId) {
  return buildPublicContentQuery(organizationId, CONTENT_PROFILES.articles);
}

function buildCollectionByIdMap(collections) {
  return new Map(collections.map((row) => [String(row._id), row]));
}

function resolveCollectionPathSlugs(collectionId, collectionById) {
  if (!collectionId) return [];
  const chain = [];
  let current = collectionById.get(String(collectionId));
  while (current) {
    chain.unshift(current.slug);
    current = current.parentId ? collectionById.get(String(current.parentId)) : null;
  }
  return chain;
}

function buildArticleExportPath({
  slug,
  collectionPathSlugs = [],
  pathPrefix = '/help/',
} = {}) {
  const prefix = normalizeExportPathPrefix(pathPrefix);
  const segments = [
    ...collectionPathSlugs.map((entry) => normalizeArticleSlug(entry)),
    normalizeArticleSlug(slug),
  ].filter(Boolean);
  if (!segments.length) return `${prefix}index.html`;
  return `${prefix}${segments.map(encodeURIComponent).join('/')}/index.html`;
}

function buildCollectionExportPath({
  collectionPathSlugs = [],
  pathPrefix = '/help/',
} = {}) {
  const prefix = normalizeExportPathPrefix(pathPrefix);
  const segments = collectionPathSlugs.map((entry) => normalizeArticleSlug(entry)).filter(Boolean);
  if (!segments.length) return `${prefix}index.html`;
  return `${prefix}${segments.map(encodeURIComponent).join('/')}/index.html`;
}

function buildHomeExportPath(pathPrefix = '/help/') {
  return buildCollectionExportPath({ collectionPathSlugs: [], pathPrefix });
}

function buildCustomerHref(exportPath) {
  return String(exportPath || '').replace(/\/index\.html$/i, '/');
}

function buildListingPageHtml({
  title,
  description = '',
  items = [],
  fragment = false,
} = {}) {
  const listItems = (items || []).map((item) => {
    const meta = item.meta ? `<span class="ld-help-page__meta">${escapeHtml(item.meta)}</span>` : '';
    return `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>${meta}</li>`;
  }).join('\n');
  const bodyHtml = [
    `<h1>${escapeHtml(title)}</h1>`,
    description ? `<p class="ld-help-page__desc">${escapeHtml(description)}</p>` : '',
    listItems ? `<ul class="ld-help-page__list">\n${listItems}\n</ul>` : '',
  ].filter(Boolean).join('\n');
  if (fragment) return bodyHtml;
  return buildExportPageHtml({
    article: {
      title,
      summary: description,
      seo: { metaTitle: title, metaDescription: description },
    },
    bodyHtml,
    fragment: false,
  });
}

function flattenCollectionTreeNodes(tree, parentPath = []) {
  const nodes = [];
  for (const node of tree || []) {
    const collectionPath = [...parentPath, node.slug];
    nodes.push({
      slug: node.slug,
      name: node.name,
      description: node.description || '',
      collectionPath,
      parentSlug: node.parentSlug || null,
      articleCount: node.articleCount || 0,
      sectionCount: node.sectionCount || 0,
      children: node.children || [],
    });
    if (Array.isArray(node.children) && node.children.length) {
      nodes.push(...flattenCollectionTreeNodes(node.children, collectionPath));
    }
  }
  return nodes;
}

function buildRefreshPages(collectionPathSlugs = [], pathPrefix = '/help/') {
  const pages = [{
    type: 'home',
    exportPath: buildHomeExportPath(pathPrefix),
  }];
  for (let index = 0; index < collectionPathSlugs.length; index += 1) {
    const path = collectionPathSlugs.slice(0, index + 1);
    pages.push({
      type: 'collection',
      slug: path[path.length - 1],
      collectionPath: path,
      parentSlug: index > 0 ? path[index - 1] : '',
      exportPath: buildCollectionExportPath({ collectionPathSlugs: path, pathPrefix }),
    });
  }
  return pages;
}

function buildManifestPageEntry(org, page, options = {}) {
  const profile = resolveContentProfile(options.profileKey || 'articles');
  const pathPrefix = options.pathPrefix || profile.defaultPathPrefix;
  if (page.type === 'home') {
    return {
      type: 'home',
      exportPath: buildHomeExportPath(pathPrefix),
      exportUrl: profile.buildHomeExportUrl(org, options),
    };
  }
  const slug = normalizeArticleSlug(page.slug);
  const collectionPath = page.collectionPath || [];
  return {
    type: 'collection',
    slug,
    name: page.name || slug,
    collectionPath,
    exportPath: buildCollectionExportPath({ collectionPathSlugs: collectionPath, pathPrefix }),
    exportUrl: profile.buildCollectionExportUrl(org, slug, {
      ...options,
      parentSlug: page.parentSlug || (collectionPath.length > 1
        ? collectionPath[collectionPath.length - 2]
        : ''),
    }),
  };
}

function buildCustomerSitemapXml({ siteOrigin = '', entries = [] } = {}) {
  const origin = String(siteOrigin || '').replace(/\/$/, '');
  const body = (entries || []).map((entry) => {
    const href = buildCustomerHref(entry.loc || entry.exportPath || '');
    const loc = origin ? `${origin}${href.startsWith('/') ? href : `/${href}`}` : href;
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeHtml(String(entry.lastmod).slice(0, 10))}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeHtml(loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildSitemapEntriesFromManifest(manifestData) {
  const entries = [];
  for (const page of manifestData.pages || []) {
    entries.push({
      exportPath: page.exportPath,
      loc: page.exportPath,
      lastmod: manifestData.version || '',
    });
  }
  for (const article of manifestData.articles || []) {
    entries.push({
      exportPath: article.exportPath,
      loc: article.exportPath,
      lastmod: article.updatedAt || article.publishedAt || '',
    });
  }
  return entries;
}

function findCollectionBySlugAndParent(collections, slug, parentSlug = '') {
  const normalizedSlug = normalizeArticleSlug(slug);
  const normalizedParent = parentSlug ? normalizeArticleSlug(parentSlug) : '';
  const matches = collections.filter((row) => normalizeArticleSlug(row.slug) === normalizedSlug);
  if (!matches.length) return null;
  if (!normalizedParent) {
    return matches.find((row) => !row.parentId) || matches[0];
  }
  const parent = collections.find((row) => normalizeArticleSlug(row.slug) === normalizedParent);
  if (!parent) return null;
  return matches.find((row) => String(row.parentId) === String(parent._id)) || null;
}

function findCollectionTreeNode(tree, collectionPathSlugs = []) {
  let nodes = tree || [];
  let current = null;
  for (const slug of collectionPathSlugs) {
    current = nodes.find((node) => normalizeArticleSlug(node.slug) === normalizeArticleSlug(slug)) || null;
    if (!current) return null;
    nodes = current.children || [];
  }
  return current;
}

async function loadPublicCollectionsContext(organizationId, addonKey = 'articles') {
  const profile = resolveContentProfile(addonKey === 'blog' ? 'blog' : 'articles');
  const [collections, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId,
      addonKey: profile.addonKey,
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    ContentDocument.aggregate([
      {
        $match: {
          ...buildPublicContentQuery(organizationId, profile),
          collectionId: { $ne: null },
        },
      },
      { $group: { _id: '$collectionId', articleCount: { $sum: 1 } } },
    ]).then((rows) => Object.fromEntries(rows.map((row) => [String(row._id), row.articleCount]))),
  ]);
  const tree = buildPublicCollectionTree(collections, articleCountMap);
  return { collections, tree, articleCountMap };
}

function formatCollectionStats(node, itemLabel = 'article') {
  const articles = Number(node?.articleCount || 0);
  const sections = Number(node?.sectionCount || 0);
  const parts = [];
  if (articles) parts.push(`${articles} ${itemLabel}${articles === 1 ? '' : 's'}`);
  if (sections) parts.push(`${sections} section${sections === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

async function listDocumentsForCollection(organizationId, collectionId, profile, deep = false) {
  const resolved = typeof profile === 'string' ? resolveContentProfile(profile) : profile;
  const query = buildPublicContentQuery(organizationId, resolved);
  if (deep) {
    const allCollections = await ContentCollection.find({
      organizationId,
      addonKey: resolved.addonKey,
      deletedAt: null,
    }).select('_id parentId').lean();
    const ids = [collectionId];
    function collectDescendants(parentId) {
      for (const row of allCollections) {
        if (row.parentId && String(row.parentId) === String(parentId)) {
          ids.push(row._id);
          collectDescendants(row._id);
        }
      }
    }
    collectDescendants(collectionId);
    query.collectionId = { $in: ids };
  } else {
    query.collectionId = collectionId;
  }
  return ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .select('title slug summary updatedAt publishedAt collectionId')
    .lean();
}

async function listArticlesForCollection(organizationId, collectionId, deep = false) {
  return listDocumentsForCollection(organizationId, collectionId, CONTENT_PROFILES.articles, deep);
}

function collectAssetIdsFromBlocks(blocks, ids = new Set()) {
  if (!blocks || typeof blocks !== 'object') return ids;
  if (Array.isArray(blocks)) {
    for (const entry of blocks) collectAssetIdsFromBlocks(entry, ids);
    return ids;
  }
  if (blocks.attrs && typeof blocks.attrs === 'object') {
    const assetId = blocks.attrs.assetId || blocks.attrs.contentAssetId;
    if (assetId) ids.add(String(assetId));
  }
  if (Array.isArray(blocks.content)) {
    for (const entry of blocks.content) collectAssetIdsFromBlocks(entry, ids);
  }
  return ids;
}

function collectAssetIdsFromDocument(doc, blocks) {
  const ids = collectAssetIdsFromBlocks(blocks, new Set());
  if (doc?.coverAssetId) ids.add(String(doc.coverAssetId));
  if (doc?.seo?.ogImageAssetId) ids.add(String(doc.seo.ogImageAssetId));
  return [...ids];
}

function inferAssetExtension(filename, mimeType) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext) return ext;
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
  };
  return map[String(mimeType || '').toLowerCase()] || '';
}

function buildSuggestedAssetFilename(assetId, filename, mimeType) {
  const ext = inferAssetExtension(filename, mimeType);
  const safeId = String(assetId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (ext) return `${safeId}${ext}`;
  return safeId || 'asset';
}

function buildExportPageHtml({
  article,
  bodyHtml,
  fragment = false,
} = {}) {
  const title = String(article?.seo?.metaTitle || article?.title || '').trim();
  const description = String(article?.seo?.metaDescription || article?.summary || '').trim();
  const canonical = String(article?.seo?.canonicalUrl || '').trim();
  const robots = String(article?.seo?.robots || '').trim();
  const ogImageUrl = String(article?.seo?.ogImageUrl || '').trim();

  if (fragment) {
    return bodyHtml || '';
  }

  const metaTags = [
    description ? `<meta name="description" content="${escapeHtml(description)}" />` : '',
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '',
    robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '',
    title ? `<meta property="og:title" content="${escapeHtml(title)}" />` : '',
    description ? `<meta property="og:description" content="${escapeHtml(description)}" />` : '',
    ogImageUrl ? `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />` : '',
  ].filter(Boolean).join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${metaTags}
</head>
<body>
  <article class="ld-article">
    <div class="ld-article__body">${bodyHtml || ''}</div>
  </article>
</body>
</html>`;
}

async function loadPublishedBlocks(doc) {
  if (!doc?.publishedVersionId) return null;
  const version = await ContentDocumentVersion.findOne({
    _id: doc.publishedVersionId,
    organizationId: doc.organizationId,
    contentDocumentId: doc._id,
  }).lean();
  return version?.blocks || null;
}

async function resolveAuthor(authorId, storedAuthorName = '') {
  const trimmed = String(storedAuthorName || '').trim();
  if (!authorId) return { name: trimmed, avatar: '' };
  const User = require('../../models/User');
  const user = await User.findById(authorId).select('firstName lastName username email avatar').lean();
  if (!user) return { name: trimmed, avatar: '' };
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return {
    name: trimmed || fullName || user.username || user.email || '',
    avatar: String(user.avatar || '').trim(),
  };
}

async function resolveExportAssets(organizationId, org, doc, blocks, requestOrigin = '') {
  const assetIds = collectAssetIdsFromDocument(doc, blocks);
  const assets = [];
  const addonKey = doc?.addonKey === 'blog' ? 'blog' : 'articles';
  for (const assetId of assetIds) {
    const asset = await resolveStudioAsset({ organizationId, assetId, addonKey });
    if (!asset) continue;
    assets.push({
      assetId: String(asset.assetId || asset._id || assetId),
      url: buildPublicAssetDownloadUrl(org, asset.assetId || assetId, { requestOrigin }),
      filename: buildSuggestedAssetFilename(asset.assetId || assetId, asset.filename, asset.mimeType),
      contentType: asset.mimeType || 'application/octet-stream',
    });
  }
  return assets;
}

function buildManifestArticleEntry(org, doc, collectionPathSlugs, options = {}) {
  const profile = resolveContentProfile(options.profileKey || 'articles');
  const slug = normalizeArticleSlug(doc.slug);
  const exportPath = buildArticleExportPath({
    slug,
    collectionPathSlugs,
    pathPrefix: options.pathPrefix || profile.defaultPathPrefix,
  });
  return {
    id: String(doc._id),
    slug,
    title: doc.title,
    updatedAt: doc.updatedAt || null,
    publishedAt: doc.publishedAt || null,
    collectionPath: collectionPathSlugs,
    exportPath,
    apiUrl: profile.buildDocumentApiUrl(org, slug, options),
    exportUrl: profile.buildDocumentExportUrl(org, slug, options),
  };
}

function resolveManifestVersion(articles) {
  let latest = null;
  for (const article of articles) {
    const candidate = article.updatedAt || article.publishedAt;
    if (!candidate) continue;
    const time = new Date(candidate).getTime();
    if (Number.isNaN(time)) continue;
    if (!latest || time > latest.getTime()) {
      latest = new Date(candidate);
    }
  }
  return latest ? latest.toISOString() : new Date().toISOString();
}

async function listPublishedDocumentsWithCollectionPaths(organizationId, profile) {
  const resolved = typeof profile === 'string' ? resolveContentProfile(profile) : profile;
  const [docs, collections] = await Promise.all([
    ContentDocument.find(buildPublicContentQuery(organizationId, resolved))
      .sort({ publishedAt: -1, updatedAt: -1 })
      .lean(),
    ContentCollection.find({
      organizationId,
      addonKey: resolved.addonKey,
      deletedAt: null,
    })
      .select('_id slug parentId')
      .lean(),
  ]);
  const collectionById = buildCollectionByIdMap(collections);
  return docs.map((doc) => ({
    doc,
    collectionPathSlugs: resolveCollectionPathSlugs(doc.collectionId, collectionById),
  }));
}

async function listPublishedArticlesWithCollectionPaths(organizationId) {
  return listPublishedDocumentsWithCollectionPaths(organizationId, CONTENT_PROFILES.articles);
}

async function getPublicContentManifest({
  orgSlug,
  profileKey = 'articles',
  pathPrefix,
  requestOrigin = '',
}) {
  const profile = resolveContentProfile(profileKey);
  const resolvedPathPrefix = normalizeExportPathPrefix(
    pathPrefix || profile.defaultPathPrefix,
    profile.defaultPathPrefix,
  );
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await profile.resolvePublishingContext(org);
  if (!context.allowed) return null;

  const options = { requestOrigin, profileKey, pathPrefix: resolvedPathPrefix };
  const rows = await listPublishedDocumentsWithCollectionPaths(org._id, profile);
  const articles = rows.map(({ doc, collectionPathSlugs }) => (
    buildManifestArticleEntry(org, doc, collectionPathSlugs, options)
  ));
  const { tree } = await loadPublicCollectionsContext(org._id, profile.addonKey);
  const pages = [
    buildManifestPageEntry(org, { type: 'home' }, options),
    ...flattenCollectionTreeNodes(tree).map((node) => buildManifestPageEntry(org, {
      type: 'collection',
      slug: node.slug,
      name: node.name,
      collectionPath: node.collectionPath,
      parentSlug: node.parentSlug,
    }, options)),
  ];

  return buildPublicContentEnvelope(org, {
    data: {
      version: resolveManifestVersion([...articles, ...pages]),
      generatedAt: new Date().toISOString(),
      manifestUrl: profile.buildManifestUrl(org, options),
      pathPrefix: resolvedPathPrefix,
      pages,
      articles,
      sitemapEntries: buildSitemapEntriesFromManifest({
        pages,
        articles,
        version: resolveManifestVersion(articles),
      }),
    },
  }, context.publishing);
}

async function getPublicHelpManifest({
  orgSlug,
  pathPrefix = '/help/',
  requestOrigin = '',
}) {
  return getPublicContentManifest({
    orgSlug,
    profileKey: 'articles',
    pathPrefix,
    requestOrigin,
  });
}

async function getPublicBlogManifest({
  orgSlug,
  pathPrefix = '/blog/',
  requestOrigin = '',
}) {
  return getPublicContentManifest({
    orgSlug,
    profileKey: 'blog',
    pathPrefix,
    requestOrigin,
  });
}

async function loadArticleSidebarWidgets(orgSlug, collectionPathSlugs = [], pathPrefix = '/help/') {
  const collectionSlug = collectionPathSlugs[collectionPathSlugs.length - 1] || '';
  const [recentResult, popularResult] = await Promise.all([
    listPublicRecentHelpArticles({
      orgSlug,
      limit: 5,
      collection: collectionSlug || undefined,
      deep: Boolean(collectionSlug),
    }),
    listPublicPopularHelpArticles({
      orgSlug,
      limit: 5,
      collection: collectionSlug || undefined,
      deep: Boolean(collectionSlug),
    }),
  ]);
  return {
    recent: recentResult?.data || [],
    popular: popularResult?.data || [],
  };
}

async function getPublicContentHomeExport({
  orgSlug,
  profileKey = 'articles',
  pathPrefix,
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  const profile = resolveContentProfile(profileKey);
  const resolvedPathPrefix = normalizeExportPathPrefix(
    pathPrefix || profile.defaultPathPrefix,
    profile.defaultPathPrefix,
  );
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await profile.resolvePublishingContext(org);
  if (!context.allowed) return null;

  const { tree } = await loadPublicCollectionsContext(org._id, profile.addonKey);
  const items = (tree || []).map((node) => ({
    label: node.name,
    href: buildCustomerHref(buildCollectionExportPath({
      collectionPathSlugs: [node.slug],
      pathPrefix: resolvedPathPrefix,
    })),
    meta: formatCollectionStats(node, profile.itemLabel),
  }));
  const html = chrome
    ? buildHomeExportChrome({
      title: profile.homeTitle,
      description: profile.homeDescription,
      tree,
      pathPrefix: resolvedPathPrefix,
      eyebrow: profile.homeEyebrow,
      sectionTitle: profile.homeSectionTitle,
    })
    : buildListingPageHtml({
      title: profile.homeTitle,
      description: profile.homeDescription,
      items,
      fragment,
    });
  const exportPath = buildHomeExportPath(resolvedPathPrefix);
  const options = { requestOrigin };

  return buildPublicContentEnvelope(org, {
    data: {
      type: 'home',
      exportPath,
      exportUrl: profile.buildHomeExportUrl(org, options),
      html,
      meta: {
        title: profile.homeTitle,
        description: profile.homeDescription,
      },
      assets: [],
    },
  }, context.publishing);
}

async function getPublicHelpHomeExport({
  orgSlug,
  pathPrefix = '/help/',
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  return getPublicContentHomeExport({
    orgSlug,
    profileKey: 'articles',
    pathPrefix,
    fragment,
    chrome,
    requestOrigin,
  });
}

async function getPublicBlogHomeExport({
  orgSlug,
  pathPrefix = '/blog/',
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  return getPublicContentHomeExport({
    orgSlug,
    profileKey: 'blog',
    pathPrefix,
    fragment,
    chrome,
    requestOrigin,
  });
}

async function getPublicContentCollectionExport({
  orgSlug,
  collectionSlug,
  parentSlug = '',
  profileKey = 'articles',
  pathPrefix,
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  const profile = resolveContentProfile(profileKey);
  const resolvedPathPrefix = normalizeExportPathPrefix(
    pathPrefix || profile.defaultPathPrefix,
    profile.defaultPathPrefix,
  );
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await profile.resolvePublishingContext(org);
  if (!context.allowed) return null;

  const { collections, tree } = await loadPublicCollectionsContext(org._id, profile.addonKey);
  const collection = findCollectionBySlugAndParent(collections, collectionSlug, parentSlug);
  if (!collection) return null;

  const collectionPathSlugs = resolveCollectionPathSlugs(collection._id, buildCollectionByIdMap(collections));
  const treeNode = findCollectionTreeNode(tree, collectionPathSlugs);
  if (!treeNode) return null;

  let items = [];
  if (Array.isArray(treeNode.children) && treeNode.children.length) {
    items = treeNode.children.map((child) => ({
      label: child.name,
      href: buildCustomerHref(buildCollectionExportPath({
        collectionPathSlugs: [...collectionPathSlugs, child.slug],
        pathPrefix: resolvedPathPrefix,
      })),
      meta: formatCollectionStats(child, profile.itemLabel),
    }));
  } else {
    const documents = await listDocumentsForCollection(org._id, collection._id, profile, true);
    items = documents.map((document) => ({
      label: document.title,
      href: buildCustomerHref(buildArticleExportPath({
        slug: document.slug,
        collectionPathSlugs,
        pathPrefix: resolvedPathPrefix,
      })),
      meta: document.summary || '',
    }));
  }

  const listingType = Array.isArray(treeNode.children) && treeNode.children.length
    ? 'sections'
    : 'articles';
  const showSidebarWidgets = profileKey === 'articles';
  const sidebarWidgets = chrome && showSidebarWidgets
    ? await loadArticleSidebarWidgets(orgSlug, collectionPathSlugs, resolvedPathPrefix)
    : { recent: [], popular: [] };
  const html = chrome
    ? buildCollectionExportChrome({
      title: treeNode.name,
      description: treeNode.description || '',
      items,
      treeNode,
      collectionPathSlugs,
      tree,
      pathPrefix: resolvedPathPrefix,
      recent: sidebarWidgets.recent,
      popular: sidebarWidgets.popular,
      listingType,
      showSidebarWidgets,
    })
    : buildListingPageHtml({
      title: treeNode.name,
      description: treeNode.description || '',
      items,
      fragment,
    });
  const exportPath = buildCollectionExportPath({ collectionPathSlugs, pathPrefix: resolvedPathPrefix });
  const options = { requestOrigin, parentSlug: parentSlug || undefined };

  return buildPublicContentEnvelope(org, {
    data: {
      type: 'collection',
      slug: normalizeArticleSlug(collectionSlug),
      collectionPath: collectionPathSlugs,
      exportPath,
      exportUrl: profile.buildCollectionExportUrl(org, collectionSlug, options),
      html,
      meta: {
        title: treeNode.name,
        description: treeNode.description || '',
      },
      assets: [],
    },
  }, context.publishing);
}

async function getPublicHelpCollectionExport({
  orgSlug,
  collectionSlug,
  parentSlug = '',
  pathPrefix = '/help/',
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  return getPublicContentCollectionExport({
    orgSlug,
    collectionSlug,
    parentSlug,
    profileKey: 'articles',
    pathPrefix,
    fragment,
    chrome,
    requestOrigin,
  });
}

async function getPublicBlogCollectionExport({
  orgSlug,
  collectionSlug,
  parentSlug = '',
  pathPrefix = '/blog/',
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  return getPublicContentCollectionExport({
    orgSlug,
    collectionSlug,
    parentSlug,
    profileKey: 'blog',
    pathPrefix,
    fragment,
    chrome,
    requestOrigin,
  });
}

async function getPublicContentStaticSitemap({
  orgSlug,
  profileKey = 'articles',
  pathPrefix,
  siteOrigin = '',
  requestOrigin = '',
}) {
  const profile = resolveContentProfile(profileKey);
  const manifest = await getPublicContentManifest({
    orgSlug,
    profileKey,
    pathPrefix: pathPrefix || profile.defaultPathPrefix,
    requestOrigin,
  });
  if (!manifest) return null;

  const xml = buildCustomerSitemapXml({
    siteOrigin,
    entries: buildSitemapEntriesFromManifest(manifest.data),
  });
  return {
    organization: manifest.organization,
    xml,
  };
}

async function getPublicHelpStaticSitemap({
  orgSlug,
  pathPrefix = '/help/',
  siteOrigin = '',
  requestOrigin = '',
}) {
  return getPublicContentStaticSitemap({
    orgSlug,
    profileKey: 'articles',
    pathPrefix,
    siteOrigin,
    requestOrigin,
  });
}

async function getPublicBlogStaticSitemap({
  orgSlug,
  pathPrefix = '/blog/',
  siteOrigin = '',
  requestOrigin = '',
}) {
  return getPublicContentStaticSitemap({
    orgSlug,
    profileKey: 'blog',
    pathPrefix,
    siteOrigin,
    requestOrigin,
  });
}

async function getPublicContentDocumentExport({
  orgSlug,
  documentSlug,
  profileKey = 'articles',
  pathPrefix,
  fragment = false,
  chrome = false,
  articleLinkPrefix,
  requestOrigin = '',
}) {
  const profile = resolveContentProfile(profileKey);
  const resolvedPathPrefix = normalizeExportPathPrefix(
    pathPrefix || profile.defaultPathPrefix,
    profile.defaultPathPrefix,
  );
  const resolvedLinkPrefix = normalizeExportPathPrefix(
    articleLinkPrefix || resolvedPathPrefix,
    profile.defaultPathPrefix,
  );
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await profile.resolvePublishingContext(org);
  if (!context.allowed) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicContentQuery(org._id, profile),
    slug: normalizeArticleSlug(documentSlug),
  }).lean();
  if (!doc) return null;

  const blocks = await loadPublishedBlocks(doc);
  const collections = await ContentCollection.find({
    organizationId: org._id,
    addonKey: profile.addonKey,
    deletedAt: null,
  })
    .select('_id name slug parentId')
    .lean();
  const collectionById = buildCollectionByIdMap(collections);
  const collectionMeta = doc.collectionId ? collectionById.get(String(doc.collectionId)) : null;
  const collectionPathSlugs = resolveCollectionPathSlugs(doc.collectionId, collectionById);
  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const author = await resolveAuthor(doc.authorId, doc.authorName);
  const article = await shapeHeadlessArticleDetail(doc, {
    blocks,
    authorName: author.name,
    authorAvatar: author.avatar,
    collectionName: collectionMeta?.name || '',
    collectionMeta,
    publicAppBaseUrl,
  });

  const bodyHtml = absolutizePublicAssetUrlsInHtml(
    renderBlocksToHtml(blocks, {
      title: article.title,
      subtitle: article.subtitle || '',
      bodyOnly: true,
      articleLinkPrefix: resolvedLinkPrefix,
    }),
    publicAppBaseUrl,
  );
  let html = buildExportPageHtml({ article, bodyHtml, fragment });
  if (chrome) {
    const { tree } = await loadPublicCollectionsContext(org._id, profile.addonKey);
    const showSidebarWidgets = profileKey === 'articles';
    const sidebarWidgets = showSidebarWidgets
      ? await loadArticleSidebarWidgets(orgSlug, collectionPathSlugs, resolvedPathPrefix)
      : { recent: [], popular: [] };
    html = buildArticlePageChrome({
      article,
      bodyHtml,
      pathPrefix: resolvedPathPrefix,
      collectionPathSlugs,
      tree,
      recent: sidebarWidgets.recent,
      popular: sidebarWidgets.popular,
      showSidebarWidgets,
    });
  }
  const exportPath = buildArticleExportPath({
    slug: article.slug,
    collectionPathSlugs,
    pathPrefix: resolvedPathPrefix,
  });
  const options = { requestOrigin };
  const assets = await resolveExportAssets(org._id, org, doc, blocks, requestOrigin);

  return buildPublicContentEnvelope(org, {
    data: {
      slug: article.slug,
      title: article.title,
      updatedAt: article.updatedAt || null,
      publishedAt: article.publishedAt || null,
      collectionPath: collectionPathSlugs,
      exportPath,
      apiUrl: profile.buildDocumentApiUrl(org, article.slug, options),
      exportUrl: profile.buildDocumentExportUrl(org, article.slug, options),
      html,
      bodyHtml,
      meta: {
        title: article.seo?.metaTitle || article.title || '',
        description: article.seo?.metaDescription || article.summary || '',
        canonical: article.seo?.canonicalUrl || '',
        robots: article.seo?.robots || '',
        ogImageUrl: article.seo?.ogImageUrl || '',
      },
      assets,
    },
  }, context.publishing);
}

async function getPublicHelpArticleExport({
  orgSlug,
  articleSlug,
  pathPrefix = '/help/',
  fragment = false,
  chrome = false,
  articleLinkPrefix = '/help/',
  requestOrigin = '',
}) {
  return getPublicContentDocumentExport({
    orgSlug,
    documentSlug: articleSlug,
    profileKey: 'articles',
    pathPrefix,
    fragment,
    chrome,
    articleLinkPrefix,
    requestOrigin,
  });
}

async function getPublicBlogPostExport({
  orgSlug,
  postSlug,
  pathPrefix = '/blog/',
  fragment = false,
  chrome = false,
  articleLinkPrefix = '/blog/',
  requestOrigin = '',
}) {
  return getPublicContentDocumentExport({
    orgSlug,
    documentSlug: postSlug,
    profileKey: 'blog',
    pathPrefix,
    fragment,
    chrome,
    articleLinkPrefix,
    requestOrigin,
  });
}

function blocksContainAssetId(blocks, assetId) {
  const ids = collectAssetIdsFromBlocks(blocks, new Set());
  return ids.has(String(assetId));
}

async function isAssetReferencedInPublicContent(organizationId, assetId) {
  const normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) return false;

  // Marketing assets may be requested by UUID (assetId) while coverAssetId stores ObjectId (or vice versa).
  const candidateIds = new Set([normalizedAssetId]);
  try {
    const { resolveStudioAsset } = require('./resolveStudioAsset');
    const asset = await resolveStudioAsset({
      organizationId,
      assetId: normalizedAssetId,
      addonKey: 'blog',
    });
    if (asset) {
      if (asset.assetId) candidateIds.add(String(asset.assetId));
      if (asset._id) candidateIds.add(String(asset._id));
      if (asset.id) candidateIds.add(String(asset.id));
    }
  } catch {
    /* ignore — fall through with request id only */
  }
  const idSet = candidateIds;

  const publicQuery = {
    organizationId,
    addonKey: { $in: ['articles', 'blog'] },
    contentType: { $in: ['knowledge_article', 'blog_post'] },
    status: 'published',
    deletedAt: null,
    visibility: 'public',
  };

  // Compare via String(): cover/og may be BSON ObjectId in DB while schema is String,
  // so Mongoose $in queries by type miss matches.
  const publishedDocs = await ContentDocument.find(publicQuery)
    .select('coverAssetId seo.ogImageAssetId publishedVersionId')
    .lean();

  for (const row of publishedDocs) {
    if (row.coverAssetId != null && idSet.has(String(row.coverAssetId))) return true;
    if (row.seo?.ogImageAssetId != null && idSet.has(String(row.seo.ogImageAssetId))) return true;
  }

  const versionIds = publishedDocs.map((row) => row.publishedVersionId).filter(Boolean);
  if (!versionIds.length) return false;

  const versions = await ContentDocumentVersion.find({
    _id: { $in: versionIds },
    organizationId,
  }).select('blocks').lean();

  return versions.some((version) =>
    [...idSet].some((id) => blocksContainAssetId(version.blocks, id)));
}

async function getPublicContentAssetForDownload({
  orgSlug,
  assetId,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const articlesContext = await getPublicPublishingContext(org);
  let blogContext = null;
  if (!articlesContext.allowed) {
    const { getPublicBlogPublishingContext } = require('./publicContentService');
    blogContext = await getPublicBlogPublishingContext(org);
    if (!blogContext.allowed) return null;
  } else {
    try {
      const { getPublicBlogPublishingContext } = require('./publicContentService');
      blogContext = await getPublicBlogPublishingContext(org);
    } catch {
      blogContext = null;
    }
  }

  const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
  return runWithOrganizationTenantContext(org._id, async () => {
    const referenced = await isAssetReferencedInPublicContent(org._id, assetId);
    if (!referenced) return null;

    const preferredKey = blogContext?.allowed && !articlesContext.allowed ? 'blog' : 'articles';
    let asset = await resolveStudioAsset({
      organizationId: org._id,
      assetId,
      addonKey: preferredKey,
    });
    if (!asset && preferredKey !== 'blog' && blogContext?.allowed) {
      asset = await resolveStudioAsset({
        organizationId: org._id,
        assetId,
        addonKey: 'blog',
      });
    }
    if (!asset) return null;
    return {
      organization: (articlesContext.allowed ? articlesContext : blogContext).organization,
      asset,
    };
  });
}

async function getPublicHelpAssetForDownload({
  orgSlug,
  assetId,
}) {
  return getPublicContentAssetForDownload({ orgSlug, assetId });
}

module.exports = {
  CONTENT_PROFILES,
  resolveContentProfile,
  normalizeArticleSlug,
  normalizeExportPathPrefix,
  buildPublicContentQuery,
  buildPublicArticlesQuery,
  buildArticleExportPath,
  buildCollectionExportPath,
  buildHomeExportPath,
  buildCustomerHref,
  buildExportPageHtml,
  buildListingPageHtml,
  buildRefreshPages,
  buildCustomerSitemapXml,
  buildSitemapEntriesFromManifest,
  collectAssetIdsFromBlocks,
  collectAssetIdsFromDocument,
  resolveCollectionPathSlugs,
  buildCollectionByIdMap,
  buildManifestArticleEntry,
  buildManifestPageEntry,
  resolveManifestVersion,
  isAssetReferencedInPublicContent,
  blocksContainAssetId,
  getPublicHelpManifest,
  getPublicBlogManifest,
  getPublicHelpHomeExport,
  getPublicBlogHomeExport,
  getPublicHelpCollectionExport,
  getPublicBlogCollectionExport,
  getPublicHelpStaticSitemap,
  getPublicBlogStaticSitemap,
  getPublicHelpArticleExport,
  getPublicBlogPostExport,
  getPublicHelpAssetForDownload,
  getPublicContentAssetForDownload,
};
