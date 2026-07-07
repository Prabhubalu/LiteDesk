'use strict';

const documentService = require('./documentService');
const contentStudioPortalService = require('./contentStudio/contentStudioPortalService');
const { mergePortalKnowledgeRows } = require('./portalKnowledgeMerge');

function shapePortalKnowledgeSummary(doc) {
  return {
    _id: doc._id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    description: doc.description || '',
    documentType: doc.documentType,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    updatedAt: doc.updatedAt,
    source: doc.source || 'legacy',
    collectionId: doc.collectionId || null,
    collectionName: doc.collectionName || null,
    collectionSlug: doc.collectionSlug || null,
  };
}

function shapePortalKnowledgeDetail(doc) {
  return {
    ...shapePortalKnowledgeSummary(doc),
    richContent: doc.richContent || null,
    richContentText: doc.richContentText || '',
    subtitle: doc.subtitle || '',
    slug: doc.slug || '',
  };
}

async function listPortalKnowledgeArticles({
  organizationId,
  page = 1,
  limit = 25,
  search = '',
  collectionId = null,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const fetchSize = safePage * safeLimit;
  const safeCollectionId = collectionId ? String(collectionId).trim() : '';

  const legacyPromise = safeCollectionId
    ? Promise.resolve({ data: [], pagination: { total: 0 } })
    : documentService.listPortalKnowledgeDocuments({
        organizationId,
        page: 1,
        limit: fetchSize,
        search,
      });

  const [legacyResult, studioResult] = await Promise.all([
    legacyPromise,
    contentStudioPortalService.listPortalArticles({
      organizationId,
      page: 1,
      limit: fetchSize,
      search,
      collectionId: safeCollectionId || null,
    }),
  ]);

  const merged = mergePortalKnowledgeRows(legacyResult.data, studioResult.data);
  const skip = (safePage - 1) * safeLimit;
  const pageRows = merged.slice(skip, skip + safeLimit);
  const total = legacyResult.pagination.total + studioResult.pagination.total;

  return {
    data: pageRows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
}

async function getPortalKnowledgeArticle({ organizationId, documentId }) {
  const legacyDoc = await documentService.getPortalKnowledgeDocument({
    organizationId,
    documentId,
  });
  if (legacyDoc) return legacyDoc;

  return contentStudioPortalService.getPortalArticle({
    organizationId,
    documentId,
  });
}

async function listPortalKnowledgeCollections({ organizationId }) {
  return contentStudioPortalService.listPortalCollections({ organizationId });
}

module.exports = {
  shapePortalKnowledgeSummary,
  shapePortalKnowledgeDetail,
  mergePortalKnowledgeRows,
  listPortalKnowledgeArticles,
  listPortalKnowledgeCollections,
  getPortalKnowledgeArticle,
};
