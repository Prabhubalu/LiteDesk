'use strict';

const path = require('path');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const ContentCollection = require('../../models/ContentCollection');
const { getAssetById } = require('../contentPlatform/contentAssetService');
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

function normalizeArticleSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
}

function normalizeExportPathPrefix(prefix) {
  const raw = String(prefix || '/help/').trim();
  if (!raw) return '/help/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPublicArticlesQuery(organizationId) {
  return {
    organizationId,
    addonKey: 'articles',
    contentType: 'knowledge_article',
    status: 'published',
    deletedAt: null,
    visibility: 'public',
  };
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
  const pathPrefix = options.pathPrefix || '/help/';
  if (page.type === 'home') {
    return {
      type: 'home',
      exportPath: buildHomeExportPath(pathPrefix),
      exportUrl: buildHomeExportUrl(org, options),
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
    exportUrl: buildCollectionExportUrl(org, slug, {
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

async function loadPublicCollectionsContext(organizationId) {
  const [collections, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId,
      addonKey: 'articles',
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    ContentDocument.aggregate([
      {
        $match: {
          ...buildPublicArticlesQuery(organizationId),
          collectionId: { $ne: null },
        },
      },
      { $group: { _id: '$collectionId', articleCount: { $sum: 1 } } },
    ]).then((rows) => Object.fromEntries(rows.map((row) => [String(row._id), row.articleCount]))),
  ]);
  const tree = buildPublicCollectionTree(collections, articleCountMap);
  return { collections, tree, articleCountMap };
}

function formatCollectionStats(node) {
  const articles = Number(node?.articleCount || 0);
  const sections = Number(node?.sectionCount || 0);
  const parts = [];
  if (articles) parts.push(`${articles} article${articles === 1 ? '' : 's'}`);
  if (sections) parts.push(`${sections} section${sections === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

async function listArticlesForCollection(organizationId, collectionId, deep = false) {
  const query = buildPublicArticlesQuery(organizationId);
  if (deep) {
    const allCollections = await ContentCollection.find({
      organizationId,
      addonKey: 'articles',
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

async function resolveAuthorName(authorId) {
  if (!authorId) return '';
  const User = require('../../models/User');
  const user = await User.findById(authorId).select('name email').lean();
  return user?.name || user?.email || '';
}

async function resolveExportAssets(organizationId, org, doc, blocks, requestOrigin = '') {
  const assetIds = collectAssetIdsFromDocument(doc, blocks);
  const assets = [];
  for (const assetId of assetIds) {
    try {
      const asset = await getAssetById({ organizationId, assetId });
      assets.push({
        assetId: String(asset.assetId || asset._id || assetId),
        url: buildPublicAssetDownloadUrl(org, asset.assetId || assetId, { requestOrigin }),
        filename: buildSuggestedAssetFilename(asset.assetId || assetId, asset.filename, asset.mimeType),
        contentType: asset.mimeType || 'application/octet-stream',
      });
    } catch {
      // Skip assets that cannot be resolved.
    }
  }
  return assets;
}

function buildManifestArticleEntry(org, doc, collectionPathSlugs, options = {}) {
  const slug = normalizeArticleSlug(doc.slug);
  const exportPath = buildArticleExportPath({
    slug,
    collectionPathSlugs,
    pathPrefix: options.pathPrefix,
  });
  return {
    id: String(doc._id),
    slug,
    title: doc.title,
    updatedAt: doc.updatedAt || null,
    publishedAt: doc.publishedAt || null,
    collectionPath: collectionPathSlugs,
    exportPath,
    apiUrl: buildArticleApiUrl(org, slug, options),
    exportUrl: buildArticleExportUrl(org, slug, options),
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

async function listPublishedArticlesWithCollectionPaths(organizationId) {
  const [docs, collections] = await Promise.all([
    ContentDocument.find(buildPublicArticlesQuery(organizationId))
      .sort({ publishedAt: -1, updatedAt: -1 })
      .lean(),
    ContentCollection.find({
      organizationId,
      addonKey: 'articles',
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

async function getPublicHelpManifest({
  orgSlug,
  pathPrefix = '/help/',
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const options = { requestOrigin };
  const rows = await listPublishedArticlesWithCollectionPaths(org._id);
  const articles = rows.map(({ doc, collectionPathSlugs }) => (
    buildManifestArticleEntry(org, doc, collectionPathSlugs, { pathPrefix, ...options })
  ));
  const { tree } = await loadPublicCollectionsContext(org._id);
  const pages = [
    buildManifestPageEntry(org, { type: 'home' }, { pathPrefix, ...options }),
    ...flattenCollectionTreeNodes(tree).map((node) => buildManifestPageEntry(org, {
      type: 'collection',
      slug: node.slug,
      name: node.name,
      collectionPath: node.collectionPath,
      parentSlug: node.parentSlug,
    }, { pathPrefix, ...options })),
  ];

  return buildPublicContentEnvelope(org, {
    data: {
      version: resolveManifestVersion([...articles, ...pages]),
      generatedAt: new Date().toISOString(),
      manifestUrl: buildManifestUrl(org, options),
      pathPrefix: normalizeExportPathPrefix(pathPrefix),
      pages,
      articles,
      sitemapEntries: buildSitemapEntriesFromManifest({ pages, articles, version: resolveManifestVersion(articles) }),
    },
  }, context.publishing);
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

async function getPublicHelpHomeExport({
  orgSlug,
  pathPrefix = '/help/',
  fragment = false,
  chrome = false,
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const { tree } = await loadPublicCollectionsContext(org._id);
  const items = (tree || []).map((node) => ({
    label: node.name,
    href: buildCustomerHref(buildCollectionExportPath({
      collectionPathSlugs: [node.slug],
      pathPrefix,
    })),
    meta: formatCollectionStats(node),
  }));
  const html = chrome
    ? buildHomeExportChrome({
      title: 'Help Center',
      description: 'Browse help topics',
      tree,
      pathPrefix,
    })
    : buildListingPageHtml({
      title: 'Help Center',
      description: 'Browse help topics',
      items,
      fragment,
    });
  const exportPath = buildHomeExportPath(pathPrefix);
  const options = { requestOrigin };

  return buildPublicContentEnvelope(org, {
    data: {
      type: 'home',
      exportPath,
      exportUrl: buildHomeExportUrl(org, options),
      html,
      meta: {
        title: 'Help Center',
        description: 'Browse help topics',
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
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const { collections, tree } = await loadPublicCollectionsContext(org._id);
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
        pathPrefix,
      })),
      meta: formatCollectionStats(child),
    }));
  } else {
    const articles = await listArticlesForCollection(org._id, collection._id, true);
    items = articles.map((article) => ({
      label: article.title,
      href: buildCustomerHref(buildArticleExportPath({
        slug: article.slug,
        collectionPathSlugs,
        pathPrefix,
      })),
      meta: article.summary || '',
    }));
  }

  const listingType = Array.isArray(treeNode.children) && treeNode.children.length
    ? 'sections'
    : 'articles';
  const sidebarWidgets = chrome
    ? await loadArticleSidebarWidgets(orgSlug, collectionPathSlugs, pathPrefix)
    : { recent: [], popular: [] };
  const html = chrome
    ? buildCollectionExportChrome({
      title: treeNode.name,
      description: treeNode.description || '',
      items,
      treeNode,
      collectionPathSlugs,
      tree,
      pathPrefix,
      recent: sidebarWidgets.recent,
      popular: sidebarWidgets.popular,
      listingType,
    })
    : buildListingPageHtml({
      title: treeNode.name,
      description: treeNode.description || '',
      items,
      fragment,
    });
  const exportPath = buildCollectionExportPath({ collectionPathSlugs, pathPrefix });
  const options = { requestOrigin, parentSlug: parentSlug || undefined };

  return buildPublicContentEnvelope(org, {
    data: {
      type: 'collection',
      slug: normalizeArticleSlug(collectionSlug),
      collectionPath: collectionPathSlugs,
      exportPath,
      exportUrl: buildCollectionExportUrl(org, collectionSlug, options),
      html,
      meta: {
        title: treeNode.name,
        description: treeNode.description || '',
      },
      assets: [],
    },
  }, context.publishing);
}

async function getPublicHelpStaticSitemap({
  orgSlug,
  pathPrefix = '/help/',
  siteOrigin = '',
  requestOrigin = '',
}) {
  const manifest = await getPublicHelpManifest({ orgSlug, pathPrefix, requestOrigin });
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

async function getPublicHelpArticleExport({
  orgSlug,
  articleSlug,
  pathPrefix = '/help/',
  fragment = false,
  chrome = false,
  articleLinkPrefix = '/help/',
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicArticlesQuery(org._id),
    slug: normalizeArticleSlug(articleSlug),
  }).lean();
  if (!doc) return null;

  const blocks = await loadPublishedBlocks(doc);
  const collections = await ContentCollection.find({
    organizationId: org._id,
    addonKey: 'articles',
    deletedAt: null,
  })
    .select('_id name slug parentId')
    .lean();
  const collectionById = buildCollectionByIdMap(collections);
  const collectionMeta = doc.collectionId ? collectionById.get(String(doc.collectionId)) : null;
  const collectionPathSlugs = resolveCollectionPathSlugs(doc.collectionId, collectionById);
  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const article = await shapeHeadlessArticleDetail(doc, {
    blocks,
    authorName: await resolveAuthorName(doc.authorId),
    collectionName: collectionMeta?.name || '',
    collectionMeta,
    publicAppBaseUrl,
  });

  const bodyHtml = absolutizePublicAssetUrlsInHtml(
    renderBlocksToHtml(blocks, {
      title: article.title,
      subtitle: article.subtitle || '',
      bodyOnly: true,
      articleLinkPrefix: normalizeExportPathPrefix(articleLinkPrefix),
    }),
    publicAppBaseUrl,
  );
  let html = buildExportPageHtml({ article, bodyHtml, fragment });
  if (chrome) {
    const { tree } = await loadPublicCollectionsContext(org._id);
    const sidebarWidgets = await loadArticleSidebarWidgets(orgSlug, collectionPathSlugs, pathPrefix);
    html = buildArticlePageChrome({
      article,
      bodyHtml,
      pathPrefix,
      collectionPathSlugs,
      tree,
      recent: sidebarWidgets.recent,
      popular: sidebarWidgets.popular,
    });
  }
  const exportPath = buildArticleExportPath({
    slug: article.slug,
    collectionPathSlugs,
    pathPrefix,
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
      apiUrl: buildArticleApiUrl(org, article.slug, options),
      exportUrl: buildArticleExportUrl(org, article.slug, options),
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

function blocksContainAssetId(blocks, assetId) {
  const ids = collectAssetIdsFromBlocks(blocks, new Set());
  return ids.has(String(assetId));
}

async function isAssetReferencedInPublicContent(organizationId, assetId) {
  const normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) return false;

  const docMatch = await ContentDocument.findOne({
    ...buildPublicArticlesQuery(organizationId),
    $or: [
      { coverAssetId: normalizedAssetId },
      { 'seo.ogImageAssetId': normalizedAssetId },
    ],
  }).select('_id').lean();
  if (docMatch) return true;

  const publishedDocs = await ContentDocument.find(buildPublicArticlesQuery(organizationId))
    .select('publishedVersionId')
    .lean();
  const versionIds = publishedDocs.map((row) => row.publishedVersionId).filter(Boolean);
  if (!versionIds.length) return false;

  const versions = await ContentDocumentVersion.find({
    _id: { $in: versionIds },
    organizationId,
  }).select('blocks').lean();

  return versions.some((version) => blocksContainAssetId(version.blocks, normalizedAssetId));
}

async function getPublicHelpAssetForDownload({
  orgSlug,
  assetId,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const referenced = await isAssetReferencedInPublicContent(org._id, assetId);
  if (!referenced) return null;

  try {
    const asset = await getAssetById({ organizationId: org._id, assetId });
    return {
      organization: context.organization,
      asset,
    };
  } catch {
    return null;
  }
}

module.exports = {
  normalizeArticleSlug,
  normalizeExportPathPrefix,
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
  getPublicHelpHomeExport,
  getPublicHelpCollectionExport,
  getPublicHelpStaticSitemap,
  getPublicHelpArticleExport,
  getPublicHelpAssetForDownload,
};
