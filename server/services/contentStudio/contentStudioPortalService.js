'use strict';

const { isArticlesPortalPublishingEnabled } = require('./articlesAddonSettingsService');
const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const ContentCollection = require('../../models/ContentCollection');
const { renderBlocksToHtml, blocksToPlainText } = require('./contentStudioBlockRenderer');

function buildPortalArticlesQuery(organizationId, { collectionId } = {}) {
  const query = {
    organizationId,
    addonKey: 'articles',
    contentType: 'knowledge_article',
    status: 'published',
    deletedAt: null,
    visibility: { $in: ['portal', 'public'] },
  };
  if (collectionId) {
    query.collectionId = collectionId;
  }
  return query;
}

function shapePortalArticleSummary(doc, collectionMap = {}) {
  const collectionId = doc.collectionId ? String(doc.collectionId) : null;
  const collection = collectionId ? collectionMap[collectionId] : null;
  return {
    _id: doc._id,
    documentNumber: `ART-${String(doc._id).slice(-6).toUpperCase()}`,
    title: doc.title,
    description: doc.summary || doc.subtitle || '',
    documentType: 'knowledge_article',
    tags: [],
    updatedAt: doc.updatedAt,
    source: 'content_studio',
    collectionId,
    collectionName: collection?.name || null,
    collectionSlug: collection?.slug || null,
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

async function shapePortalArticleDetail(doc, collectionMap = {}) {
  const { getArticlesAppearance } = require('./articlesAddonSettingsService');
  const { wrapRenderedArticleHtml } = require('./articlesAppearanceService');
  const appearance = await getArticlesAppearance(doc.organizationId);
  const blocks = await loadPublishedBlocks(doc);
  const bodyHtml = blocks
    ? renderBlocksToHtml(blocks, {
      title: '',
      subtitle: doc.subtitle || '',
      articleLinkPrefix: '/portal/knowledge/',
    })
    : '';
  const html = wrapRenderedArticleHtml(bodyHtml, appearance);
  const text = blocks ? blocksToPlainText(blocks) : String(doc.searchText || doc.summary || '');

  return {
    ...shapePortalArticleSummary(doc, collectionMap),
    richContent: html ? { html } : null,
    richContentText: text,
    subtitle: doc.subtitle || '',
    slug: doc.slug,
  };
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

async function listPortalArticles({ organizationId, page = 1, limit = 25, search = '', collectionId = null }) {
  const portalEnabled = await isArticlesPortalPublishingEnabled(organizationId);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  if (!portalEnabled) {
    return {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const query = buildPortalArticlesQuery(organizationId, { collectionId });
  const searchTerm = String(search || '').trim();
  if (searchTerm) {
    const pattern = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { title: pattern },
      { summary: pattern },
      { subtitle: pattern },
      { slug: pattern },
      { searchText: pattern },
    ];
  }

  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    ContentDocument.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ContentDocument.countDocuments(query),
  ]);

  const collectionMap = await loadCollectionMap(organizationId, rows);

  return {
    data: rows.map((row) => shapePortalArticleSummary(row, collectionMap)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
}

async function getPortalArticle({ organizationId, documentId }) {
  const portalEnabled = await isArticlesPortalPublishingEnabled(organizationId);
  if (!portalEnabled) return null;

  const doc = await ContentDocument.findOne({
    ...buildPortalArticlesQuery(organizationId),
    _id: documentId,
  }).lean();

  if (!doc) return null;
  const collectionMap = await loadCollectionMap(organizationId, [doc]);
  return shapePortalArticleDetail(doc, collectionMap);
}

async function listPortalCollections({ organizationId }) {
  const portalEnabled = await isArticlesPortalPublishingEnabled(organizationId);
  if (!portalEnabled) return [];

  const collections = await ContentCollection.find({
    organizationId,
    addonKey: 'articles',
    deletedAt: null,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  if (!collections.length) return [];

  const counts = await ContentDocument.aggregate([
    { $match: buildPortalArticlesQuery(organizationId) },
    { $match: { collectionId: { $ne: null } } },
    { $group: { _id: '$collectionId', articleCount: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.articleCount]));

  return collections
    .map((collection) => ({
      _id: collection._id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description || '',
      articleCount: countMap[String(collection._id)] || 0,
    }))
    .filter((collection) => collection.articleCount > 0);
}

module.exports = {
  listPortalArticles,
  getPortalArticle,
  listPortalCollections,
  shapePortalArticleSummary,
  shapePortalArticleDetail,
};
