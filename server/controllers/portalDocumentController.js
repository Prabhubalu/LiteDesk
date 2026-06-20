'use strict';

const documentService = require('../services/documentService');

function shapePortalKnowledgeSummary(doc) {
  return {
    _id: doc._id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    description: doc.description || '',
    documentType: doc.documentType,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    updatedAt: doc.updatedAt
  };
}

function shapePortalKnowledgeDetail(doc) {
  return {
    ...shapePortalKnowledgeSummary(doc),
    richContent: doc.richContent || null,
    richContentText: doc.richContentText || ''
  };
}

async function listPortalKnowledgeArticles(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const search = String(req.query.search || '').trim();

    const result = await documentService.listPortalKnowledgeDocuments({
      organizationId,
      page,
      limit,
      search
    });

    return res.json({
      success: true,
      data: result.data.map(shapePortalKnowledgeSummary),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[portalDocumentController] listPortalKnowledgeArticles', error);
    return res.status(500).json({ success: false, message: 'Failed to list knowledge articles' });
  }
}

async function getPortalKnowledgeArticle(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const documentId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const doc = await documentService.getPortalKnowledgeDocument({
      organizationId,
      documentId
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    return res.json({
      success: true,
      data: shapePortalKnowledgeDetail(doc)
    });
  } catch (error) {
    console.error('[portalDocumentController] getPortalKnowledgeArticle', error);
    return res.status(500).json({ success: false, message: 'Failed to load knowledge article' });
  }
}

module.exports = {
  listPortalKnowledgeArticles,
  getPortalKnowledgeArticle
};
