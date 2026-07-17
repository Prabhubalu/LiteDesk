'use strict';

const portalKnowledgeService = require('../services/portalKnowledgeService');
const { askPortalKnowledge } = require('../services/ai/aiKnowledgeService');
const { AiConfigurationError, AiProviderError } = require('../services/ai/errors');

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

async function askPortalKnowledgeHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({
        success: false,
        code: 'AI_QUESTION_REQUIRED',
        message: 'question is required',
      });
    }

    const result = await askPortalKnowledge({
      organizationId,
      userId: req.user?._id,
      question,
      topK: req.body?.topK,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[portalDocumentController] askPortalKnowledge', error);
    const isConfig = error instanceof AiConfigurationError;
    const isProvider = error instanceof AiProviderError;
    const status = isConfig ? 403 : isProvider ? 502 : 500;
    return res.status(status).json({
      success: false,
      code: error.code || 'AI_PORTAL_ASK_FAILED',
      message: error.message || 'Portal Ask failed',
      notConfigured: isConfig,
    });
  }
}

module.exports = {
  listPortalKnowledgeArticles,
  listPortalKnowledgeCollections,
  getPortalKnowledgeArticle,
  askPortalKnowledgeHandler,
};
