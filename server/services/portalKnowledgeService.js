'use strict';

const contentStudioPortalService = require('./contentStudio/contentStudioPortalService');

function shapePortalKnowledgeSummary(doc) {
  return {
    _id: doc._id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    description: doc.description || '',
    documentType: doc.documentType,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    updatedAt: doc.updatedAt,
    source: doc.source || 'content_studio',
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

/**
 * Help Center articles — Content Studio published portal content only.
 * Customer file library lives at /portal/documents (visibility.portalVisible).
 */
async function listPortalKnowledgeArticles({
  organizationId,
  page = 1,
  limit = 25,
  search = '',
  collectionId = null,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const safeCollectionId = collectionId ? String(collectionId).trim() : '';

  const studioResult = await contentStudioPortalService.listPortalArticles({
    organizationId,
    page: safePage,
    limit: safeLimit,
    search,
    collectionId: safeCollectionId || null,
  });

  return {
    data: studioResult.data || [],
    pagination: studioResult.pagination || {
      page: safePage,
      limit: safeLimit,
      total: 0,
      totalPages: 1,
    },
  };
}

async function getPortalKnowledgeArticle({ organizationId, documentId }) {
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
  listPortalKnowledgeArticles,
  listPortalKnowledgeCollections,
  getPortalKnowledgeArticle,
};
