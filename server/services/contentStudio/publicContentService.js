'use strict';

const { resolveArticlesPublicDeliveryAccess, getArticlesAddonSettings } = require('./articlesAddonSettingsService');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const ContentCollection = require('../../models/ContentCollection');
const {
  shapeHeadlessArticleSummary,
  shapeHeadlessArticleDetail,
} = require('./headlessContentShaper');
const {
  resolveOrganizationForPublic,
} = require('./publicPublishingResolver');
const {
  resolveHeadlessApiBase,
  buildArticleApiUrl,
  buildArticlesListApiUrl,
  buildCollectionsApiUrl,
  buildCollectionArticlesApiUrl,
} = require('./contentPublishingService');

function normalizeCollectionSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
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

async function resolveCollectionName(doc) {
  if (!doc?.collectionId) return '';
  const collection = await ContentCollection.findOne({
    _id: doc.collectionId,
    organizationId: doc.organizationId,
    deletedAt: null,
  })
    .select('name')
    .lean();
  return collection?.name || '';
}

async function loadCollectionMap(organizationId, docs) {
  const ids = [...new Set(docs.map((doc) => doc.collectionId).filter(Boolean).map(String))];
  if (!ids.length) return {};
  const rows = await ContentCollection.find({
    _id: { $in: ids },
    organizationId,
    deletedAt: null,
  })
    .select('_id name slug')
    .lean();
  return Object.fromEntries(rows.map((row) => [String(row._id), row]));
}

function shapePublicCollectionNode(row, { articleCount = 0, parentSlug = null } = {}) {
  return {
    id: String(row._id),
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    emoji: row.emoji || '',
    parentId: row.parentId ? String(row.parentId) : null,
    parentSlug,
    sortOrder: Number(row.sortOrder) || 0,
    articleCount,
    sectionCount: 0,
    children: [],
  };
}

function buildPublicCollectionTree(collections, articleCountMap = {}) {
  const byId = new Map();
  const byParent = new Map();

  for (const row of collections) {
    const id = String(row._id);
    const node = shapePublicCollectionNode(row, {
      articleCount: articleCountMap[id] || 0,
    });
    byId.set(id, node);
    const parentKey = row.parentId ? String(row.parentId) : '';
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(node);
  }

  for (const node of byId.values()) {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) node.parentSlug = parent.slug;
    }
  }

  function attachChildren(parentId) {
    const children = (byParent.get(parentId || '') || [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const child of children) {
      child.children = attachChildren(child.id);
      child.sectionCount = child.children.length;
    }
    return children;
  }

  function pruneEmpty(nodes) {
    return nodes.filter((node) => {
      node.children = pruneEmpty(node.children);
      return node.articleCount > 0 || node.children.length > 0;
    });
  }

  function refreshSectionCounts(nodes) {
    for (const node of nodes) {
      node.children = refreshSectionCounts(node.children);
      node.sectionCount = node.children.length;
    }
    return nodes;
  }

  return refreshSectionCounts(pruneEmpty(attachChildren('')));
}

async function loadPublicArticleCountMap(organizationId) {
  const counts = await ContentDocument.aggregate([
    { $match: { ...buildPublicArticlesQuery(organizationId), collectionId: { $ne: null } } },
    { $group: { _id: '$collectionId', articleCount: { $sum: 1 } } },
  ]);
  return Object.fromEntries(counts.map((row) => [String(row._id), row.articleCount]));
}

async function resolveCollectionScope(organizationId, collectionSlug, deep = false) {
  const normalizedSlug = normalizeCollectionSlug(collectionSlug);
  if (!normalizedSlug) return null;

  const collection = await ContentCollection.findOne({
    organizationId,
    addonKey: 'articles',
    slug: normalizedSlug,
    deletedAt: null,
  }).lean();

  if (!collection) return { notFound: true };

  if (!deep) {
    return { collectionIds: [collection._id] };
  }

  const allCollections = await ContentCollection.find({
    organizationId,
    addonKey: 'articles',
    deletedAt: null,
  })
    .select('_id parentId')
    .lean();

  const ids = [collection._id];
  function collectDescendants(parentId) {
    for (const row of allCollections) {
      if (row.parentId && String(row.parentId) === String(parentId)) {
        ids.push(row._id);
        collectDescendants(row._id);
      }
    }
  }
  collectDescendants(collection._id);
  return { collectionIds: ids };
}

function applyArticleListFilters(query, { search = '', collectionIds = null } = {}) {
  const searchTerm = String(search || '').trim();
  if (searchTerm) {
    const pattern = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: pattern }, { summary: pattern }, { subtitle: pattern }, { searchText: pattern }];
  }
  if (Array.isArray(collectionIds) && collectionIds.length) {
    query.collectionId = { $in: collectionIds };
  }
  return query;
}

async function queryPublicArticleSummaries(organizationId, {
  query,
  limit,
  skip = 0,
}) {
  const rows = await ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const collectionMap = await loadCollectionMap(organizationId, rows);
  return rows.map((row) => {
    const collectionId = row.collectionId ? String(row.collectionId) : null;
    const meta = collectionId ? collectionMap[collectionId] : null;
    return shapeHeadlessArticleSummary(row, meta);
  });
}

function buildPublicContentEnvelope(org, payload, publishing = {}) {
  return {
    organization: { slug: org.slug, name: org.name },
    publishing: {
      headlessApiEnabled: publishing.headlessApiEnabled !== false,
      apiBase: resolveHeadlessApiBase(org),
    },
    ...payload,
  };
}

async function getPublicPublishingContext(org) {
  if (!org) return null;

  const access = await resolveArticlesPublicDeliveryAccess(org._id);
  let publishing = { headlessApiEnabled: false, publishWebhookUrl: '' };
  if (access.addonEnabled) {
    const addonSettings = await getArticlesAddonSettings(org._id);
    publishing = addonSettings.settings.publishing;
  }

  return {
    allowed: access.headlessEnabled,
    organization: { slug: org.slug, name: org.name },
    publishing: {
      headlessApiEnabled: publishing.headlessApiEnabled !== false,
      apiBase: resolveHeadlessApiBase(org),
    },
  };
}

async function listPublicHelpArticles({
  orgSlug,
  page = 1,
  limit = 25,
  search = '',
  collection = '',
  deep = false,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  if (!context.allowed) {
    return buildPublicContentEnvelope(org, {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      },
    }, { headlessApiEnabled: false });
  }

  const query = buildPublicArticlesQuery(org._id);
  const collectionScope = await resolveCollectionScope(org._id, collection, deep === true || deep === '1' || deep === 'true');
  if (collectionScope?.notFound) {
    return buildPublicContentEnvelope(org, {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      },
    }, context.publishing);
  }
  applyArticleListFilters(query, {
    search,
    collectionIds: collectionScope?.collectionIds || null,
  });

  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    ContentDocument.find(query).sort({ publishedAt: -1, updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ContentDocument.countDocuments(query),
  ]);
  const collectionMap = await loadCollectionMap(org._id, rows);

  return buildPublicContentEnvelope(org, {
    data: rows.map((row) => {
      const collectionId = row.collectionId ? String(row.collectionId) : null;
      const meta = collectionId ? collectionMap[collectionId] : null;
      return shapeHeadlessArticleSummary(row, meta);
    }),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  }, context.publishing);
}

async function listPublicRecentHelpArticles({
  orgSlug,
  limit = 5,
  collection = '',
  deep = false,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);

  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false });
  }

  const query = buildPublicArticlesQuery(org._id);
  const collectionScope = await resolveCollectionScope(org._id, collection, deep === true || deep === '1' || deep === 'true');
  if (collectionScope?.notFound) {
    return buildPublicContentEnvelope(org, { data: [] }, context.publishing);
  }
  applyArticleListFilters(query, { collectionIds: collectionScope?.collectionIds || null });

  const data = await queryPublicArticleSummaries(org._id, {
    query,
    limit: safeLimit,
    skip: 0,
  });

  return buildPublicContentEnvelope(org, { data }, context.publishing);
}

async function listPublicPopularHelpArticles({
  orgSlug,
  limit = 5,
  collection = '',
  deep = false,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);

  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false });
  }

  const query = buildPublicArticlesQuery(org._id);
  query.featured = true;
  const collectionScope = await resolveCollectionScope(org._id, collection, deep === true || deep === '1' || deep === 'true');
  if (collectionScope?.notFound) {
    return buildPublicContentEnvelope(org, { data: [] }, context.publishing);
  }
  applyArticleListFilters(query, { collectionIds: collectionScope?.collectionIds || null });

  const rows = await ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();
  const collectionMap = await loadCollectionMap(org._id, rows);
  const data = rows.map((row) => {
    const collectionId = row.collectionId ? String(row.collectionId) : null;
    const meta = collectionId ? collectionMap[collectionId] : null;
    return shapeHeadlessArticleSummary(row, meta);
  });

  return buildPublicContentEnvelope(org, { data }, context.publishing);
}

async function listPublicHelpCollections({ orgSlug }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false });
  }

  const [collections, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId: org._id,
      addonKey: 'articles',
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    loadPublicArticleCountMap(org._id),
  ]);

  return buildPublicContentEnvelope(org, {
    data: buildPublicCollectionTree(collections, articleCountMap),
  }, context.publishing);
}

async function getPublicHelpArticle({
  orgSlug,
  articleSlug,
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicArticlesQuery(org._id),
    slug: String(articleSlug || '').trim().replace(/^\/+/, '').toLowerCase(),
  }).lean();

  if (!doc) return null;

  const blocks = await loadPublishedBlocks(doc);
  const collectionMap = await loadCollectionMap(org._id, [doc]);
  const collectionMeta = doc.collectionId ? collectionMap[String(doc.collectionId)] : null;
  return buildPublicContentEnvelope(org, {
    data: await shapeHeadlessArticleDetail(doc, {
      blocks,
      authorName: await resolveAuthorName(doc.authorId),
      collectionName: collectionMeta?.name || '',
      collectionMeta,
    }),
  }, context.publishing);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSitemapDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function flattenPublicCollectionNodes(tree) {
  const nodes = [];
  function walk(list) {
    for (const node of list || []) {
      nodes.push({ slug: node.slug });
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children);
      }
    }
  }
  walk(tree);
  return nodes;
}

function buildPublicHelpSitemapXml({ org, articles = [], collections = [] }) {
  const urls = [];
  const listUrl = buildArticlesListApiUrl(org);
  const collectionsUrl = buildCollectionsApiUrl(org);
  if (listUrl) {
    urls.push({ loc: listUrl, lastmod: '' });
  }
  if (collectionsUrl) {
    urls.push({ loc: collectionsUrl, lastmod: '' });
  }

  for (const collection of collections) {
    const collectionUrl = buildCollectionArticlesApiUrl(org, collection.slug);
    if (collectionUrl) {
      urls.push({ loc: collectionUrl, lastmod: '' });
    }
  }

  for (const article of articles) {
    const loc = buildArticleApiUrl(org, article.slug);
    if (!loc) continue;
    urls.push({
      loc,
      lastmod: formatSitemapDate(article.updatedAt || article.publishedAt),
    });
  }

  const body = urls.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function getPublicHelpSitemap({ orgSlug }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context.allowed) return null;

  const rows = await ContentDocument.find(buildPublicArticlesQuery(org._id))
    .sort({ publishedAt: -1, updatedAt: -1 })
    .select('slug updatedAt publishedAt')
    .lean();

  const [collectionRows, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId: org._id,
      addonKey: 'articles',
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    loadPublicArticleCountMap(org._id),
  ]);
  const collectionNodes = flattenPublicCollectionNodes(
    buildPublicCollectionTree(collectionRows, articleCountMap),
  );

  return {
    organization: context.organization,
    xml: buildPublicHelpSitemapXml({
      org,
      articles: rows,
      collections: collectionNodes,
    }),
  };
}

module.exports = {
  listPublicHelpArticles,
  listPublicRecentHelpArticles,
  listPublicPopularHelpArticles,
  listPublicHelpCollections,
  getPublicHelpArticle,
  getPublicHelpSitemap,
  getPublicPublishingContext,
  resolveOrganizationForPublic,
  buildPublicHelpSitemapXml,
  buildPublicContentEnvelope,
  buildPublicCollectionTree,
  normalizeCollectionSlug,
};
