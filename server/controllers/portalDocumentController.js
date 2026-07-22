'use strict';

const portalKnowledgeService = require('../services/portalKnowledgeService');
const documentService = require('../services/documentService');
const { buildDownloadUrl } = require('../services/fileStorageService');

function shapePortalSharedDocumentSummary(doc) {
  return {
    _id: doc._id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    description: doc.description || '',
    documentType: doc.documentType,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    updatedAt: doc.updatedAt,
    fileType: doc.fileType || null,
    mimeType: doc.mimeType || null,
    fileSizeBytes: doc.fileSizeBytes ?? null,
    externalUrl: doc.externalUrl || null,
    hasFile: Boolean(doc.storagePath) || Boolean(doc.externalUrl),
  };
}

function shapePortalSharedDocumentDetail(doc) {
  return {
    ...shapePortalSharedDocumentSummary(doc),
    richContent: doc.richContent || null,
    richContentText: doc.richContentText || '',
    hasFile: Boolean(doc.storagePath),
  };
}

async function listPortalSharedDocuments(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const search = String(req.query.search || '').trim();

    const result = await documentService.listPortalSharedDocuments({
      organizationId,
      page,
      limit,
      search,
    });

    return res.json({
      success: true,
      data: (result.data || []).map(shapePortalSharedDocumentSummary),
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[portalDocumentController] listPortalSharedDocuments', error);
    return res.status(500).json({ success: false, message: 'Failed to list portal documents' });
  }
}

async function getPortalSharedDocument(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const documentId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const doc = await documentService.getPortalSharedDocument({
      organizationId,
      documentId,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    return res.json({
      success: true,
      data: shapePortalSharedDocumentDetail(doc),
    });
  } catch (error) {
    console.error('[portalDocumentController] getPortalSharedDocument', error);
    return res.status(500).json({ success: false, message: 'Failed to load portal document' });
  }
}

async function downloadPortalSharedDocument(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const documentId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const doc = await documentService.getPortalSharedDocument({
      organizationId,
      documentId,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (doc.externalUrl) {
      return res.json({
        success: true,
        data: { url: doc.externalUrl, external: true },
      });
    }

    if (!doc.storagePath) {
      return res.status(400).json({
        success: false,
        message: 'Document has no downloadable file',
      });
    }

    await documentService.logAuditEvent({
      organizationId,
      documentId: doc._id,
      action: 'download',
      actorId: req.user?._id || null,
    });

    const url = buildDownloadUrl(doc.storagePath, {
      disposition: 'attachment',
      fileName: doc.title,
      contentType: doc.mimeType,
    });

    return res.json({ success: true, data: { url, external: false } });
  } catch (error) {
    console.error('[portalDocumentController] downloadPortalSharedDocument', error);
    return res.status(500).json({ success: false, message: 'Failed to download portal document' });
  }
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
  // Legacy portal AI knowledge (aiKnowledgeService.askPortalKnowledge) removed with Astra v2 cutover.
  return res.status(403).json({
    success: false,
    code: 'AI_NOT_CONFIGURED',
    message: 'Portal Ask is not available',
    notConfigured: true,
  });
}

module.exports = {
  listPortalKnowledgeArticles,
  listPortalKnowledgeCollections,
  getPortalKnowledgeArticle,
  askPortalKnowledgeHandler,
  listPortalSharedDocuments,
  getPortalSharedDocument,
  downloadPortalSharedDocument,
};
