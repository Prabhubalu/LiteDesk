'use strict';

const { resolveArticlesPublicDeliveryAccess, getArticlesAddonSettings } = require('./articlesAddonSettingsService');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const ContentCollection = require('../../models/ContentCollection');
const {
  shapeHeadlessArticleSummary,
  shapeHeadlessArticleDetail,
  resolveCoverImage,
  absolutizePublicAssetUrl,
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
  buildBlogListApiUrl,
  buildBlogPostApiUrl,
  buildBlogCollectionsApiUrl,
  buildBlogCollectionPostsApiUrl,
  getPublicAppBaseUrl,
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

async function resolveAuthor(authorId, storedAuthorName = '', organizationId = null) {
  const trimmed = String(storedAuthorName || '').trim();
  const isPlaceholder = !trimmed || /^author$/i.test(trimmed);

  async function loadUser() {
    if (!authorId) return null;
    const User = require('../../models/User');
    return User.findById(authorId).select('firstName lastName username email avatar').lean();
  }

  let user = null;
  if (organizationId) {
    const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
    user = await runWithOrganizationTenantContext(organizationId, loadUser);
  } else {
    user = await loadUser();
  }

  if (!user) return { name: isPlaceholder ? '' : trimmed, avatar: '' };
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const fromUser = fullName || user.username || user.email || '';
  return {
    name: isPlaceholder ? (fromUser || trimmed) : (trimmed || fromUser),
    avatar: String(user.avatar || '').trim(),
  };
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
    heroIconKey: row.heroIconKey || '',
    heroIconColor: row.heroIconColor || '',
    imageUrl: row.imageUrl || '',
    parentId: row.parentId ? String(row.parentId) : null,
    parentSlug,
    sortOrder: Number(row.sortOrder) || 0,
    articleCount,
    sectionCount: 0,
    children: [],
  };
}

function absolutizeCollectionTreeUrls(nodes, publicAppBaseUrl) {
  for (const node of nodes) {
    if (node.imageUrl) {
      node.imageUrl = absolutizePublicAssetUrl(node.imageUrl, publicAppBaseUrl);
    }
    if (node.children?.length) {
      absolutizeCollectionTreeUrls(node.children, publicAppBaseUrl);
    }
  }
  return nodes;
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
    query.title = pattern;
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

async function shapePublicBlogSummaries(org, rows, collectionMap, requestOrigin = '') {
  const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
  const { buildPublicAssetDownloadUrl } = require('./contentPublishingService');
  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const organizationId = org._id;

  return runWithOrganizationTenantContext(organizationId, async () => (
    Promise.all(rows.map(async (row) => {
      const collectionId = row.collectionId ? String(row.collectionId) : null;
      const meta = collectionId ? collectionMap[collectionId] : null;
      const author = await resolveAuthor(row.authorId, row.authorName, organizationId);
      let coverImage = await resolveCoverImage(row, publicAppBaseUrl);
      if (coverImage) {
        // Use the same id stored on the document so public ACL (coverAssetId match) succeeds.
        const coverRef = row.coverAssetId || coverImage.assetId || null;
        const publicUrl = coverRef
          ? buildPublicAssetDownloadUrl(org, coverRef, { requestOrigin })
          : '';
        if (publicUrl) {
          coverImage = { ...coverImage, url: publicUrl };
        } else if (coverImage.url && publicAppBaseUrl && coverImage.url.startsWith('/')) {
          coverImage = {
            ...coverImage,
            url: `${publicAppBaseUrl.replace(/\/$/, '')}${coverImage.url}`,
          };
        }
      }
      return {
        ...shapeHeadlessArticleSummary(row, meta),
        coverImage,
        authorName: author.name,
        authorAvatar: absolutizePublicAssetUrl(author.avatar, publicAppBaseUrl),
      };
    }))
  ));
}

function buildPublicContentEnvelope(org, payload, publishing = {}) {
  return {
    organization: { slug: org.slug, name: org.name },
    publishing: {
      headlessApiEnabled: publishing.headlessApiEnabled !== false,
      apiBase: resolveHeadlessApiBase(org),
      ...(publishing.commentsEnabled !== undefined
        ? { commentsEnabled: publishing.commentsEnabled === true }
        : {}),
      ...(publishing.rssEnabled !== undefined
        ? { rssEnabled: publishing.rssEnabled !== false }
        : {}),
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

async function listPublicHelpCollections({ orgSlug, requestOrigin = '' }) {
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

  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const tree = buildPublicCollectionTree(collections, articleCountMap);
  absolutizeCollectionTreeUrls(tree, publicAppBaseUrl);

  return buildPublicContentEnvelope(org, {
    data: tree,
  }, context.publishing);
}

async function getPublicHelpArticle({
  orgSlug,
  articleSlug,
  requestOrigin = '',
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
  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const author = await resolveAuthor(doc.authorId, doc.authorName);
  return buildPublicContentEnvelope(org, {
    data: await shapeHeadlessArticleDetail(doc, {
      blocks,
      authorName: author.name,
      authorAvatar: author.avatar,
      collectionName: collectionMeta?.name || '',
      collectionMeta,
      publicAppBaseUrl,
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

function buildPublicBlogQuery(organizationId) {
  return {
    organizationId,
    addonKey: 'blog',
    contentType: 'blog_post',
    status: 'published',
    deletedAt: null,
    visibility: 'public',
  };
}

async function getPublicBlogPublishingContext(org) {
  if (!org) return null;

  const {
    resolveBlogPublicDeliveryAccess,
    getBlogAddonSettings,
  } = require('./blogAddonSettingsService');

  const access = await resolveBlogPublicDeliveryAccess(org._id);
  let publishing = {
    headlessApiEnabled: false,
    publishWebhookUrl: '',
    rssEnabled: true,
    commentsEnabled: false,
  };
  if (access.addonEnabled) {
    const addonSettings = await getBlogAddonSettings(org._id);
    publishing = {
      ...addonSettings.settings.publishing,
      rssEnabled: addonSettings.settings.rssEnabled !== false,
      commentsEnabled: addonSettings.settings.commentsEnabled === true,
    };
  }

  return {
    allowed: access.headlessEnabled,
    organization: { slug: org.slug, name: org.name },
    publishing: {
      headlessApiEnabled: publishing.headlessApiEnabled !== false,
      rssEnabled: publishing.rssEnabled !== false,
      commentsEnabled: publishing.commentsEnabled === true,
      apiBase: resolveHeadlessApiBase(org),
    },
  };
}

async function resolveBlogCollectionScope(organizationId, collectionSlug, deep = false) {
  const normalizedSlug = normalizeCollectionSlug(collectionSlug);
  if (!normalizedSlug) return null;

  const collection = await ContentCollection.findOne({
    organizationId,
    addonKey: 'blog',
    slug: normalizedSlug,
    deletedAt: null,
  }).lean();

  if (!collection) return { notFound: true };

  if (!deep) {
    return { collectionIds: [collection._id] };
  }

  const allCollections = await ContentCollection.find({
    organizationId,
    addonKey: 'blog',
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

async function listPublicBlogPosts({
  orgSlug,
  page = 1,
  limit = 25,
  search = '',
  collection = '',
  deep = false,
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
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

  const query = buildPublicBlogQuery(org._id);
  const collectionScope = await resolveBlogCollectionScope(
    org._id,
    collection,
    deep === true || deep === '1' || deep === 'true',
  );
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
    ContentDocument.find(query).sort({ sticky: -1, publishedAt: -1, updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ContentDocument.countDocuments(query),
  ]);
  const collectionMap = await loadCollectionMap(org._id, rows);
  const data = await shapePublicBlogSummaries(org, rows, collectionMap, requestOrigin);

  return buildPublicContentEnvelope(org, {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  }, context.publishing);
}

async function getPublicBlogPost({
  orgSlug,
  postSlug,
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicBlogQuery(org._id),
    slug: String(postSlug || '').trim().replace(/^\/+/, '').toLowerCase(),
  }).lean();

  if (!doc) return null;

  const blocks = await loadPublishedBlocks(doc);
  const collectionMap = await loadCollectionMap(org._id, [doc]);
  const collectionMeta = doc.collectionId ? collectionMap[String(doc.collectionId)] : null;
  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const author = await resolveAuthor(doc.authorId, doc.authorName, org._id);
  const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
  const { buildPublicAssetDownloadUrl } = require('./contentPublishingService');
  const detail = await runWithOrganizationTenantContext(org._id, async () => (
    shapeHeadlessArticleDetail(doc, {
      blocks,
      authorName: author.name,
      authorAvatar: author.avatar,
      collectionName: collectionMeta?.name || '',
      collectionMeta,
      publicAppBaseUrl,
    })
  ));
  if (detail?.coverImage && doc.coverAssetId) {
    const publicUrl = buildPublicAssetDownloadUrl(org, doc.coverAssetId, { requestOrigin });
    if (publicUrl) detail.coverImage.url = publicUrl;
  }
  const articleAnalyticsService = require('./articleAnalyticsService');
  const engagement = await articleAnalyticsService.getArticleAnalytics({
    organizationId: org._id,
    contentDocumentId: doc._id,
  });
  detail.engagement = {
    claps: engagement.helpfulYes,
    shares: engagement.sharesTotal,
    comments: 0,
  };
  return buildPublicContentEnvelope(org, {
    data: detail,
  }, context.publishing);
}

const RSS_ITEM_SELECT = 'slug title subtitle summary searchText seo publishedAt coverAssetId addonKey organizationId publishedVersionId';
const RSS_INTRO_MAX_CHARS = 500;

function buildBlogChannelTitle(org) {
  const name = String(org?.name || '').trim();
  if (!name) return 'Blog';
  if (/\bblog\b/i.test(name)) return name;
  return `${name} Blog`;
}

function truncateRssIntro(text, max = RSS_INTRO_MAX_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const clipped = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
  return `${clipped}…`;
}

function resolveRssIntroText(post) {
  const candidates = [
    post.summary,
    post.subtitle,
    post.seo?.metaDescription,
    post.introExcerpt,
    post.searchText,
    post.title,
  ];
  for (const candidate of candidates) {
    const text = truncateRssIntro(candidate);
    if (text) return text;
  }
  return '';
}

function sanitizeRssHref(href) {
  const value = String(href || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '';
}

function sanitizeRssAllowedTag(tag) {
  const raw = String(tag || '');
  const lower = raw.toLowerCase();
  if (lower === '<strong>' || lower.startsWith('<strong ')) return '<strong>';
  if (lower === '</strong>') return '</strong>';
  if (lower === '<em>' || lower.startsWith('<em ')) return '<em>';
  if (lower === '</em>') return '</em>';
  if (lower === '<p>' || lower.startsWith('<p ')) return '<p>';
  if (lower === '</p>') return '</p>';
  if (lower === '</a>') return '</a>';
  if (lower.startsWith('<a ') || lower === '<a>') {
    const hrefMatch = raw.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = sanitizeRssHref(hrefMatch ? (hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '') : '');
    if (!href) return '';
    return `<a href="${escapeXml(href)}">`;
  }
  return '';
}

/** Plain text or limited HTML: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a href&gt;. */
function buildRssSummaryHtml(summary) {
  let html = String(summary || '').trim();
  if (!html) return '';

  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?b\b[^>]*>/gi, (match) => (match.toLowerCase().startsWith('</') ? '</strong>' : '<strong>'))
    .replace(/<\/?i\b[^>]*>/gi, (match) => (match.toLowerCase().startsWith('</') ? '</em>' : '<em>'));

  if (!/<[a-z]/i.test(html)) {
    return `<p>${escapeXml(html)}</p>`;
  }

  const tokens = [];
  html = html.replace(
    /<\/?(?:strong|em|p)(?:\s[^>]*)?>|<a\s[^>]*>|<\/a>/gi,
    (match) => {
      const key = `\u0000${tokens.length}\u0000`;
      tokens.push(sanitizeRssAllowedTag(match));
      return key;
    },
  );
  html = escapeXml(html).replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
  html = html.replace(/\s+/g, ' ').trim();
  if (!html) return '';
  if (!/<p[\s>]/i.test(html)) {
    html = `<p>${html}</p>`;
  }
  return html;
}

function wrapRssCdata(html) {
  return `<![CDATA[${String(html || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function buildRssItemDescriptionHtml(post) {
  const parts = [];
  const intro = resolveRssIntroText(post);
  const summaryHtml = buildRssSummaryHtml(intro);
  if (summaryHtml) parts.push(summaryHtml);
  const image = post.featuredImage;
  if (image?.url) {
    const alt = escapeXml(image.alt || post.title || '');
    parts.push(`<img src="${escapeXml(image.url)}" alt="${alt}" />`);
  }
  return parts.join('\n');
}

async function enrichBlogRssPosts(org, rows, requestOrigin = '') {
  const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
  const { buildPublicAssetDownloadUrl } = require('./contentPublishingService');
  const { resolveStudioAsset } = require('./resolveStudioAsset');
  const { blocksToPlainText } = require('./contentStudioBlockRenderer');

  return runWithOrganizationTenantContext(org._id, async () => (
    Promise.all((rows || []).map(async (row) => {
      let introExcerpt = '';
      const hasDirectIntro = Boolean(
        String(row.summary || '').trim()
        || String(row.subtitle || '').trim()
        || String(row.seo?.metaDescription || '').trim()
        || String(row.searchText || '').trim(),
      );
      if (!hasDirectIntro && row.publishedVersionId) {
        const blocks = await loadPublishedBlocks(row);
        introExcerpt = truncateRssIntro(blocksToPlainText(blocks));
      }

      let featuredImage = null;
      if (row?.coverAssetId) {
        const asset = await resolveStudioAsset({
          organizationId: org._id,
          assetId: row.coverAssetId,
          addonKey: row.addonKey || 'blog',
        });
        const url = buildPublicAssetDownloadUrl(org, row.coverAssetId, { requestOrigin });
        if (url) {
          featuredImage = {
            url,
            alt: String(asset?.accessibilityAltText || row.title || '').trim(),
            mimeType: String(asset?.mimeType || 'image/jpeg').trim() || 'image/jpeg',
          };
        }
      }

      return {
        ...row,
        introExcerpt,
        featuredImage,
      };
    }))
  ));
}

function buildPublicBlogRssXml({
  org,
  posts = [],
  feedTitle = '',
  channelLink = '',
  description = '',
}) {
  const { buildBlogListApiUrl, buildBlogPostApiUrl } = require('./contentPublishingService');
  const resolvedChannelLink = channelLink || buildBlogListApiUrl(org);
  const title = escapeXml(feedTitle || buildBlogChannelTitle(org));
  const channelDescription = escapeXml(
    description || `${buildBlogChannelTitle(org)} feed`,
  );
  const items = posts.map((post) => {
    const link = buildBlogPostApiUrl(org, post.slug);
    const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : '';
    const descriptionHtml = buildRssItemDescriptionHtml(post);
    const image = post.featuredImage;
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      link ? `      <link>${escapeXml(link)}</link>` : '',
      link ? `      <guid isPermaLink="true">${escapeXml(link)}</guid>` : '',
      descriptionHtml
        ? `      <description>${wrapRssCdata(descriptionHtml)}</description>`
        : '',
      image?.url
        ? `      <enclosure url="${escapeXml(image.url)}" type="${escapeXml(image.mimeType || 'image/jpeg')}" length="0" />`
        : '',
      pubDate ? `      <pubDate>${escapeXml(pubDate)}</pubDate>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${title}</title>`,
    resolvedChannelLink ? `    <link>${escapeXml(resolvedChannelLink)}</link>` : '',
    `    <description>${channelDescription}</description>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].filter((line) => line !== undefined).join('\n');
}

async function getPublicBlogRss({ orgSlug, requestOrigin = '' }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed || context.publishing.rssEnabled === false) return null;

  const rows = await ContentDocument.find(buildPublicBlogQuery(org._id))
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(50)
    .select(RSS_ITEM_SELECT)
    .lean();
  const posts = await enrichBlogRssPosts(org, rows, requestOrigin);

  return {
    organization: context.organization,
    xml: buildPublicBlogRssXml({
      org,
      posts,
      feedTitle: buildBlogChannelTitle(org),
      description: `${buildBlogChannelTitle(org)} feed`,
    }),
  };
}

async function getPublicBlogCollectionRss({ orgSlug, collectionSlug, requestOrigin = '' }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed || context.publishing.rssEnabled === false) return null;

  const scope = await resolveBlogCollectionScope(org._id, collectionSlug, true);
  if (!scope || scope.notFound) return null;

  const collection = await ContentCollection.findOne({
    organizationId: org._id,
    addonKey: 'blog',
    slug: normalizeCollectionSlug(collectionSlug),
    deletedAt: null,
  })
    .select('name slug')
    .lean();
  if (!collection) return null;

  const query = {
    ...buildPublicBlogQuery(org._id),
    collectionId: { $in: scope.collectionIds },
  };
  const rows = await ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(50)
    .select(RSS_ITEM_SELECT)
    .lean();
  const posts = await enrichBlogRssPosts(org, rows, requestOrigin);

  const {
    buildBlogCollectionRssApiUrl,
    buildBlogListApiUrl,
  } = require('./contentPublishingService');
  const listBase = buildBlogListApiUrl(org);
  const channelLink = listBase
    ? `${listBase}${listBase.includes('?') ? '&' : '?'}collection=${encodeURIComponent(collection.slug)}`
    : buildBlogCollectionRssApiUrl(org, collection.slug);

  return {
    organization: context.organization,
    collection: { name: collection.name, slug: collection.slug },
    xml: buildPublicBlogRssXml({
      org,
      posts,
      feedTitle: buildBlogChannelTitle(org),
      channelLink,
      description: `Posts in ${collection.name || collection.slug}`,
    }),
  };
}

async function getPublicBlogPostRss({ orgSlug, postSlug, requestOrigin = '' }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed || context.publishing.rssEnabled === false) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicBlogQuery(org._id),
    slug: String(postSlug || '').trim().replace(/^\/+/, '').toLowerCase(),
  })
    .select(RSS_ITEM_SELECT)
    .lean();
  if (!doc) return null;

  const posts = await enrichBlogRssPosts(org, [doc], requestOrigin);
  const { buildBlogListApiUrl } = require('./contentPublishingService');
  return {
    organization: context.organization,
    post: { slug: doc.slug, title: doc.title },
    xml: buildPublicBlogRssXml({
      org,
      posts,
      feedTitle: buildBlogChannelTitle(org),
      channelLink: buildBlogListApiUrl(org),
      description: `${buildBlogChannelTitle(org)} feed`,
    }),
  };
}

async function loadPublicBlogPostCountMap(organizationId) {
  const counts = await ContentDocument.aggregate([
    { $match: { ...buildPublicBlogQuery(organizationId), collectionId: { $ne: null } } },
    { $group: { _id: '$collectionId', articleCount: { $sum: 1 } } },
  ]);
  return Object.fromEntries(counts.map((row) => [String(row._id), row.articleCount]));
}

async function listPublicRecentBlogPosts({
  orgSlug,
  limit = 5,
  collection = '',
  deep = false,
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);

  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false, commentsEnabled: false });
  }

  const query = buildPublicBlogQuery(org._id);
  const collectionScope = await resolveBlogCollectionScope(
    org._id,
    collection,
    deep === true || deep === '1' || deep === 'true',
  );
  if (collectionScope?.notFound) {
    return buildPublicContentEnvelope(org, { data: [] }, context.publishing);
  }
  applyArticleListFilters(query, { collectionIds: collectionScope?.collectionIds || null });

  const rows = await ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();
  const collectionMap = await loadCollectionMap(org._id, rows);
  const data = await shapePublicBlogSummaries(org, rows, collectionMap, requestOrigin);

  return buildPublicContentEnvelope(org, { data }, context.publishing);
}

async function listPublicPopularBlogPosts({
  orgSlug,
  limit = 5,
  collection = '',
  deep = false,
  requestOrigin = '',
}) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);

  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false, commentsEnabled: false });
  }

  const query = buildPublicBlogQuery(org._id);
  query.featured = true;
  const collectionScope = await resolveBlogCollectionScope(
    org._id,
    collection,
    deep === true || deep === '1' || deep === 'true',
  );
  if (collectionScope?.notFound) {
    return buildPublicContentEnvelope(org, { data: [] }, context.publishing);
  }
  applyArticleListFilters(query, { collectionIds: collectionScope?.collectionIds || null });

  let rows = await ContentDocument.find(query)
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();

  // Fall back to latest posts when none are marked featured.
  if (!rows.length) {
    const latestQuery = buildPublicBlogQuery(org._id);
    applyArticleListFilters(latestQuery, { collectionIds: collectionScope?.collectionIds || null });
    rows = await ContentDocument.find(latestQuery)
      .sort({ sticky: -1, publishedAt: -1, updatedAt: -1 })
      .limit(safeLimit)
      .lean();
  }

  const collectionMap = await loadCollectionMap(org._id, rows);
  const data = await shapePublicBlogSummaries(org, rows, collectionMap, requestOrigin);

  return buildPublicContentEnvelope(org, { data }, context.publishing);
}

function stripPublicCollectionIcons(nodes) {
  for (const node of nodes || []) {
    delete node.emoji;
    delete node.heroIconKey;
    delete node.heroIconColor;
    delete node.imageUrl;
    if (node.children?.length) {
      stripPublicCollectionIcons(node.children);
    }
  }
  return nodes;
}

async function listPublicBlogCollections({ orgSlug, requestOrigin = '' }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed) {
    return buildPublicContentEnvelope(org, { data: [] }, { headlessApiEnabled: false, commentsEnabled: false });
  }

  const [collections, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId: org._id,
      addonKey: 'blog',
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    loadPublicBlogPostCountMap(org._id),
  ]);

  const publicAppBaseUrl = getPublicAppBaseUrl({ requestOrigin });
  const tree = buildPublicCollectionTree(collections, articleCountMap);
  absolutizeCollectionTreeUrls(tree, publicAppBaseUrl);
  stripPublicCollectionIcons(tree);

  return buildPublicContentEnvelope(org, {
    data: tree,
  }, context.publishing);
}

function buildPublicBlogSitemapXml({ org, posts = [], collections = [] }) {
  const urls = [];
  const listUrl = buildBlogListApiUrl(org);
  const collectionsUrl = buildBlogCollectionsApiUrl(org);
  if (listUrl) {
    urls.push({ loc: listUrl, lastmod: '' });
  }
  if (collectionsUrl) {
    urls.push({ loc: collectionsUrl, lastmod: '' });
  }

  for (const collection of collections) {
    const collectionUrl = buildBlogCollectionPostsApiUrl(org, collection.slug);
    if (collectionUrl) {
      urls.push({ loc: collectionUrl, lastmod: '' });
    }
  }

  for (const post of posts) {
    const loc = buildBlogPostApiUrl(org, post.slug);
    if (!loc) continue;
    urls.push({
      loc,
      lastmod: formatSitemapDate(post.updatedAt || post.publishedAt),
    });
  }

  const body = urls.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function getPublicBlogSitemap({ orgSlug }) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicBlogPublishingContext(org);
  if (!context.allowed) return null;

  const rows = await ContentDocument.find(buildPublicBlogQuery(org._id))
    .sort({ publishedAt: -1, updatedAt: -1 })
    .select('slug updatedAt publishedAt')
    .lean();

  const [collectionRows, articleCountMap] = await Promise.all([
    ContentCollection.find({
      organizationId: org._id,
      addonKey: 'blog',
      deletedAt: null,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    loadPublicBlogPostCountMap(org._id),
  ]);
  const collectionNodes = flattenPublicCollectionNodes(
    buildPublicCollectionTree(collectionRows, articleCountMap),
  );

  return {
    organization: context.organization,
    xml: buildPublicBlogSitemapXml({
      org,
      posts: rows,
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
  listPublicBlogPosts,
  listPublicRecentBlogPosts,
  listPublicPopularBlogPosts,
  listPublicBlogCollections,
  getPublicBlogPost,
  getPublicBlogRss,
  getPublicBlogCollectionRss,
  getPublicBlogPostRss,
  getPublicBlogSitemap,
  getPublicBlogPublishingContext,
  resolveOrganizationForPublic,
  buildPublicHelpSitemapXml,
  buildPublicContentEnvelope,
  buildPublicCollectionTree,
  normalizeCollectionSlug,
};
