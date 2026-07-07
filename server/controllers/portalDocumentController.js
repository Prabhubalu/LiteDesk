'use strict';

const portalKnowledgeService = require('../services/portalKnowledgeService');

async function listPortalKnowledgeArticles(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const search = String(req.query.search || '').trim();
    const collectionId = String(req.query.collectionId || '').trim() || null;

    const result = await portalKnowledgeService.listPortalKnowledgeArticles({
      organizationId,
      page,
      limit,
      search,
      collectionId,
    });

    return res.json({
      success: true,
      data: result.data.map(portalKnowledgeService.shapePortalKnowledgeSummary),
      pagination: result.pagination,
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

    const doc = await portalKnowledgeService.getPortalKnowledgeArticle({
      organizationId,
      documentId,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    return res.json({
      success: true,
      data: portalKnowledgeService.shapePortalKnowledgeDetail(doc),
    });
  } catch (error) {
    console.error('[portalDocumentController] getPortalKnowledgeArticle', error);
    return res.status(500).json({ success: false, message: 'Failed to load knowledge article' });
  }
}

async function listPortalKnowledgeCollections(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const data = await portalKnowledgeService.listPortalKnowledgeCollections({ organizationId });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[portalDocumentController] listPortalKnowledgeCollections', error);
    return res.status(500).json({ success: false, message: 'Failed to list knowledge collections' });
  }
}

module.exports = {
  listPortalKnowledgeArticles,
  listPortalKnowledgeCollections,
  getPortalKnowledgeArticle
};
