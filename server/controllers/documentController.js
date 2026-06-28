const documentService = require('../services/documentService');
const coordinationService = require('../services/documentEditingCoordinationService');
const inlineCommentService = require('../services/documentInlineCommentService');
const signatureService = require('../services/documentSignatureService');
const draftService = require('../services/documentCollaborationDraftService');
const { semanticSearchDocuments } = require('../services/documentSemanticIndexService');
const { resolveReservationState } = require('../constants/documentEditingCoordination');
const { buildDownloadUrl } = require('../services/fileStorageService');
const { getUserGroupIds } = require('../utils/documentVisibility');
const { resolveRuntimePermission } = require('../services/runtimePermissionResolver');
const {
  UPLOAD_CAPABILITY,
  VERSION_UPLOAD_CAPABILITY,
  beginDocumentUploadIdempotency,
  completeDocumentUploadIdempotency
} = require('../utils/documentUploadIdempotency');
const mongoose = require('mongoose');

function resolveRequestUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function normalizeUploadFolderId(value) {
  if (value == null || value === '' || value === 'root') return null;
  const id = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(id) || id.length !== 24) return null;
  return id;
}

function parseDocumentLinkTo(body) {
  const linkModuleKey = body?.linkModuleKey ? String(body.linkModuleKey).trim() : '';
  const linkRecordId = body?.linkRecordId ? String(body.linkRecordId).trim() : '';
  if (!linkModuleKey || !linkRecordId) return undefined;
  if (!mongoose.Types.ObjectId.isValid(linkRecordId) || linkRecordId.length !== 24) {
    const error = new Error('Invalid record ID for document link');
    error.statusCode = 400;
    error.code = 'INVALID_LINK_RECORD_ID';
    throw error;
  }
  return {
    moduleKey: linkModuleKey,
    recordId: linkRecordId,
    appKey: body?.linkAppKey || null
  };
}

function handleDocumentMutationError(res, error, fallbackMessage) {
  const status = error?.statusCode || 400;
  const code = error?.code
    || (error?.name === 'DocumentReservationError' ? 'DOCUMENT_RESERVED' : undefined)
    || (error?.name === 'DocumentVersionConflictError' ? 'VERSION_CONFLICT' : undefined);

  return res.status(status).json({
    success: false,
    message: error?.message || fallbackMessage,
    code,
    reservedBy: error?.reservedBy ? String(error.reservedBy) : undefined,
    conflictId: error?.conflictId ? String(error.conflictId) : undefined,
    baseVersion: error?.baseVersion,
    currentVersion: error?.currentVersion
  });
}

async function buildVisibilityContext(req) {
  const userGroupIds = await getUserGroupIds(req.user.organizationId, req.user._id);
  const hasViewAll = resolveRuntimePermission(req.user, 'documents', 'viewAll', {
    organizationId: req.user.organizationId,
    appKey: 'platform'
  });

  return {
    hasViewAll: Boolean(hasViewAll),
    userId: req.user._id,
    userRoleId: req.user.roleId || null,
    userGroupIds
  };
}

function formatDocument(doc) {
  if (!doc) return doc;
  const folder = doc.folderId && typeof doc.folderId === 'object'
    ? doc.folderId
    : null;
  return {
    ...doc,
    folderName: folder?.name || null,
    folderPath: folder?.path || null,
    coordinationState: resolveReservationState(doc)
  };
}

exports.getDocumentsListMeta = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const visibilityContext = await buildVisibilityContext(req);
    const { sendListMetaResponse } = require('../utils/listMetaService');
    const meta = await documentService.getDocumentsListMeta({
      organizationId,
      filters: {
        search: req.query.search,
        filterQuery: req.query.filterQuery,
        status: req.query.status,
        documentType: req.query.documentType,
        folderId: req.query.folderId,
        assignedTo: req.query.assignedTo,
        fileType: req.query.fileType,
        tag: req.query.tag,
        linkedModuleKey: req.query.linkedModuleKey,
        linkedRecordId: req.query.linkedRecordId,
        linkedAppKey: req.query.linkedAppKey,
        relatedToDocumentId: req.query.relatedToDocumentId,
        favoritesOnly: req.query.favoritesOnly === '1' || req.query.favoritesOnly === 'true',
        recentOnly: req.query.recentOnly === '1' || req.query.recentOnly === 'true',
        sharedWithMe: req.query.sharedWithMe === '1' || req.query.sharedWithMe === 'true',
        expiringOnly: req.query.expiringOnly === '1' || req.query.expiringOnly === 'true',
        userId: req.user._id,
        userRoleId: req.user.roleId || null,
        userGroupIds: visibilityContext.userGroupIds,
      },
      visibilityContext,
    });
    sendListMetaResponse(res, meta);
  } catch (error) {
    console.error('[documents] getDocumentsListMeta error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents list meta', error: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const sort = req.query.sort || '-updatedAt';

    const visibilityContext = await buildVisibilityContext(req);

    const result = await documentService.listDocuments({
      organizationId,
      filters: {
        search: req.query.search,
        filterQuery: req.query.filterQuery,
        status: req.query.status,
        documentType: req.query.documentType,
        folderId: req.query.folderId,
        assignedTo: req.query.assignedTo,
        fileType: req.query.fileType,
        tag: req.query.tag,
        linkedModuleKey: req.query.linkedModuleKey,
        linkedRecordId: req.query.linkedRecordId,
        linkedAppKey: req.query.linkedAppKey,
        relatedToDocumentId: req.query.relatedToDocumentId,
        favoritesOnly: req.query.favoritesOnly === '1' || req.query.favoritesOnly === 'true',
        recentOnly: req.query.recentOnly === '1' || req.query.recentOnly === 'true',
        sharedWithMe: req.query.sharedWithMe === '1' || req.query.sharedWithMe === 'true',
        expiringOnly: req.query.expiringOnly === '1' || req.query.expiringOnly === 'true',
        userId: req.user._id,
        userRoleId: req.user.roleId || null,
        userGroupIds: visibilityContext.userGroupIds
      },
      page,
      limit,
      sort,
      visibilityContext
    });

    return res.json({
      success: true,
      data: result.data.map(formatDocument),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[documents] getDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list documents', error: error.message });
  }
};

exports.getKnowledgeBaseDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const sort = req.query.sort || '-updatedAt';
    const visibilityContext = await buildVisibilityContext(req);

    const result = await documentService.listKnowledgeBaseDocuments({
      organizationId,
      filters: {
        search: req.query.search,
        status: req.query.status,
        documentType: req.query.documentType,
        folderId: req.query.folderId,
        tag: req.query.tag
      },
      page,
      limit,
      sort,
      visibilityContext
    });

    return res.json({
      success: true,
      data: result.data.map(formatDocument),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[documents] getKnowledgeBaseDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list knowledge base documents', error: error.message });
  }
};

exports.getDocumentSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userId = req.user._id;
    const visibilityContext = await buildVisibilityContext(req);
    const summary = await documentService.getDocumentSummary(organizationId);
    const recentDocuments = await documentService.listRecentDocuments({
      organizationId,
      userId,
      limit: 8
    });
    const activity = await documentService.getRecentActivity(organizationId, 8);
    const includeAllFolders = req.query.folders === 'all';
    const [folders, folderCount] = await Promise.all([
      includeAllFolders
        ? documentService.listAllFolders({ organizationId })
        : documentService.listFolders({ organizationId, parentFolderId: null }),
      documentService.countFolders({ organizationId })
    ]);
    const favoriteDocumentIds = await documentService.getFavoriteDocumentIds({ organizationId, userId });
    const favoriteCount = await documentService.countFavoriteDocuments({ organizationId, userId });
    const recentCount = await documentService.countRecentDocuments({ organizationId, userId });
    const sharedCount = await documentService.countSharedWithUser({ organizationId, visibilityContext });

    return res.json({
      success: true,
      data: {
        summary: { ...summary, folderCount },
        recentDocuments: recentDocuments.map(formatDocument),
        recentActivity: activity,
        folders,
        favoriteDocumentIds: favoriteDocumentIds.map(String),
        favoriteCount,
        recentCount,
        sharedCount
      }
    });
  } catch (error) {
    console.error('[documents] getDocumentSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load summary', error: error.message });
  }
};

exports.getDocumentActivity = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const result = await documentService.listDocumentActivity({
      organizationId,
      page,
      limit,
      documentId: req.query.documentId || null
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[documents] getDocumentActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load activity', error: error.message });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    await documentService.trackDocumentView({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      documentId: req.params.id
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] getDocumentById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load document', error: error.message });
  }
};

exports.createDocument = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User context is required',
        code: 'USER_CONTEXT_REQUIRED'
      });
    }

    const doc = await documentService.createDocument({
      organizationId: req.user.organizationId,
      userId,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] createDocument error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create document' });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = resolveRequestUserId(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User context is required',
        code: 'USER_CONTEXT_REQUIRED'
      });
    }

    const { idempotencyKey, replay } = await beginDocumentUploadIdempotency(req, UPLOAD_CAPABILITY);
    if (replay?.body) {
      return res.status(replay.statusCode || 201).json(replay.body);
    }

    const doc = await documentService.createDocumentFromUpload({
      organizationId: req.user.organizationId,
      userId,
      req,
      payload: {
        title: req.body?.title,
        description: req.body?.description,
        folderId: normalizeUploadFolderId(req.body?.folderId),
        tags: req.body?.tags ? String(req.body.tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
        status: req.body?.status,
        linkTo: parseDocumentLinkTo(req.body),
        duplicateAction: req.body?.duplicateAction || null
      }
    });
    const body = { success: true, data: formatDocument(doc) };
    await completeDocumentUploadIdempotency(req, UPLOAD_CAPABILITY, idempotencyKey, body, 201);
    return res.status(201).json(body);
  } catch (error) {
    console.error('[documents] uploadDocument error:', error);
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to upload document',
      code: error.code || undefined,
      documentId: error.documentId || undefined,
      documentNumber: error.documentNumber || undefined,
      title: error.title || undefined
    });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const existing = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const doc = await documentService.updateDocument({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] updateDocument error:', error);
    return handleDocumentMutationError(res, error, 'Failed to update document');
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const result = await documentService.deleteDocument({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason
    });
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to delete document',
        blocked: result.blocked,
        dependencies: result.dependencies
      });
    }
    return res.json({ success: true, message: 'Document moved to trash' });
  } catch (error) {
    console.error('[documents] deleteDocument error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete document' });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (!doc.storagePath) {
      return res.status(400).json({ success: false, message: 'Document has no file attachment' });
    }

    await documentService.logAuditEvent({
      organizationId: req.user.organizationId,
      documentId: doc._id,
      action: 'download',
      actorId: req.user._id
    });

    const url = buildDownloadUrl(doc.storagePath, {
      disposition: 'attachment',
      fileName: doc.title,
      contentType: doc.mimeType
    });

    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('[documents] downloadDocument error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to download document' });
  }
};

exports.previewDocument = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (!doc.storagePath) {
      return res.status(400).json({ success: false, message: 'Document has no file attachment' });
    }

    await documentService.logAuditEvent({
      organizationId: req.user.organizationId,
      documentId: doc._id,
      action: 'preview',
      actorId: req.user._id
    });

    const url = buildDownloadUrl(doc.storagePath, {
      disposition: 'inline',
      fileName: doc.title,
      contentType: doc.mimeType
    });

    return res.json({ success: true, data: { url, mimeType: doc.mimeType } });
  } catch (error) {
    console.error('[documents] previewDocument error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to preview document' });
  }
};

exports.listFolders = async (req, res) => {
  try {
    const all = req.query.all === '1' || req.query.all === 'true';
    const folders = await documentService.listFolders({
      organizationId: req.user.organizationId,
      parentFolderId: req.query.parentFolderId || null,
      all
    });
    return res.json({ success: true, data: folders });
  } catch (error) {
    console.error('[documents] listFolders error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list folders' });
  }
};

exports.toggleDocumentFavorite = async (req, res) => {
  try {
    const result = await documentService.toggleDocumentFavorite({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      documentId: req.params.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[documents] toggleDocumentFavorite error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update favorite' });
  }
};

exports.getFavoriteDocumentIds = async (req, res) => {
  try {
    const ids = await documentService.getFavoriteDocumentIds({
      organizationId: req.user.organizationId,
      userId: req.user._id
    });
    return res.json({
      success: true,
      data: ids.map(String)
    });
  } catch (error) {
    console.error('[documents] getFavoriteDocumentIds error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load favorites' });
  }
};

exports.createFolder = async (req, res) => {
  try {
    const folder = await documentService.createFolder({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data: folder });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'A folder with this name already exists' });
    }
    console.error('[documents] createFolder error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create folder' });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const result = await documentService.deleteFolder({
      organizationId: req.user.organizationId,
      folderId: req.params.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[documents] deleteFolder error:', error);
    const status = error.message === 'Folder not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message || 'Failed to delete folder' });
  }
};

exports.listDocumentVersions = async (req, res) => {
  try {
    const versions = await documentService.listDocumentVersions({
      organizationId: req.user.organizationId,
      documentId: req.params.id
    });
    if (versions === null) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    return res.json({ success: true, data: versions });
  } catch (error) {
    console.error('[documents] listDocumentVersions error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list versions' });
  }
};

exports.listRichContentVersions = async (req, res) => {
  try {
    const data = await documentService.listRichContentVersions({
      organizationId: req.user.organizationId,
      documentId: req.params.id
    });
    if (data === null) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[documents] listRichContentVersions error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list rich content versions' });
  }
};

exports.restoreRichContentVersion = async (req, res) => {
  try {
    const { versionIndex } = req.body;
    if (typeof versionIndex !== 'number' || versionIndex < 0) {
      return res.status(400).json({ success: false, message: 'Invalid versionIndex' });
    }
    const doc = await documentService.restoreRichContentVersion({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      versionIndex,
      userId: req.user._id
    });
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error('[documents] restoreRichContentVersion error:', error);
    const status = error.message === 'Document not found' || error.message === 'Version not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message || 'Failed to restore rich content version' });
  }
};

exports.uploadNewVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { idempotencyKey, replay } = await beginDocumentUploadIdempotency(req, VERSION_UPLOAD_CAPABILITY);
    if (replay?.body) {
      return res.status(replay.statusCode || 200).json(replay.body);
    }

    const doc = await documentService.uploadNewVersion({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      req,
      changeSummary: req.body?.changeSummary,
      baseVersion: req.body?.baseVersion,
      forceUpload: req.body?.forceUpload === '1'
        || req.body?.forceUpload === 'true'
        || req.body?.forceUpload === true
    });
    const body = { success: true, data: formatDocument(doc) };
    await completeDocumentUploadIdempotency(req, VERSION_UPLOAD_CAPABILITY, idempotencyKey, body, 200);
    return res.json(body);
  } catch (error) {
    console.error('[documents] uploadNewVersion error:', error);
    return handleDocumentMutationError(res, error, 'Failed to upload version');
  }
};

exports.restoreDocumentVersion = async (req, res) => {
  try {
    const doc = await documentService.restoreDocumentVersion({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      versionNumber: req.params.versionNumber,
      userId: req.user._id
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] restoreDocumentVersion error:', error);
    return handleDocumentMutationError(res, error, 'Failed to restore version');
  }
};

exports.reserveDocument = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const existing = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    await coordinationService.reserveDocument({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason
    });
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] reserveDocument error:', error);
    return handleDocumentMutationError(res, error, 'Failed to reserve document');
  }
};

exports.releaseReservation = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const existing = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    await coordinationService.releaseReservation({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] releaseReservation error:', error);
    return handleDocumentMutationError(res, error, 'Failed to release reservation');
  }
};

exports.takeoverReservation = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const existing = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    await coordinationService.takeoverReservation({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason
    });
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    console.error('[documents] takeoverReservation error:', error);
    return handleDocumentMutationError(res, error, 'Failed to take over reservation');
  }
};

exports.notifyReservationHolder = async (req, res) => {
  try {
    const result = await coordinationService.notifyReservationHolder({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[documents] notifyReservationHolder error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to notify reserver' });
  }
};

exports.getDocumentPresence = async (req, res) => {
  try {
    const presence = await coordinationService.listDocumentPresence({
      organizationId: req.user.organizationId,
      documentId: req.params.id
    });
    return res.json({ success: true, data: presence });
  } catch (error) {
    console.error('[documents] getDocumentPresence error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load presence' });
  }
};

exports.heartbeatDocumentPresence = async (req, res) => {
  try {
    const session = await coordinationService.heartbeatPresence({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      activityType: req.body?.activityType
    });
    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('[documents] heartbeatDocumentPresence error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update presence' });
  }
};

exports.clearDocumentPresence = async (req, res) => {
  try {
    await coordinationService.clearPresence({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[documents] clearDocumentPresence error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to clear presence' });
  }
};

exports.listDocumentConflicts = async (req, res) => {
  try {
    const conflicts = await coordinationService.listVersionConflicts({
      organizationId: req.user.organizationId,
      documentId: req.params.id
    });
    return res.json({ success: true, data: conflicts });
  } catch (error) {
    console.error('[documents] listDocumentConflicts error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list conflicts' });
  }
};

exports.resolveDocumentConflict = async (req, res) => {
  try {
    const conflict = await coordinationService.resolveVersionConflict({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      conflictId: req.params.conflictId,
      userId: req.user._id,
      resolution: req.body?.resolution
    });
    return res.json({ success: true, data: conflict });
  } catch (error) {
    console.error('[documents] resolveDocumentConflict error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to resolve conflict' });
  }
};

exports.checkExternalLink = async (req, res) => {
  try {
    const visibilityContext = await buildVisibilityContext(req);
    const existing = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const { checkDocumentExternalLink } = require('../services/documentExternalLinkService');
    const result = await checkDocumentExternalLink({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    const doc = await documentService.getDocumentById({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      visibilityContext
    });

    return res.json({
      success: true,
      data: {
        ...formatDocument(doc),
        externalLinkCheck: result
      }
    });
  } catch (error) {
    console.error('[documents] checkExternalLink error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to check external link' });
  }
};

exports.linkDocument = async (req, res) => {
  try {
    const { moduleKey, recordId, appKey } = req.body || {};
    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }
    const result = await documentService.linkDocumentToRecord({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      documentId: req.params.id,
      moduleKey,
      recordId,
      appKey
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[documents] linkDocument error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to link document' });
  }
};

exports.unlinkDocument = async (req, res) => {
  try {
    await documentService.unlinkDocumentFromRecord({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      documentId: req.params.id,
      relationshipId: req.params.relationshipId
    });
    return res.json({ success: true, message: 'Document detached from record' });
  } catch (error) {
    console.error('[documents] unlinkDocument error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to unlink document' });
  }
};

exports.getRecordDocuments = async (req, res) => {
  try {
    const { moduleKey, recordId } = req.params;
    const data = await documentService.listDocumentsForRecord({
      organizationId: req.user.organizationId,
      moduleKey,
      recordId,
      appKey: req.query.appKey
    });
    return res.json({
      success: true,
      data: data.map(formatDocument)
    });
  } catch (error) {
    console.error('[documents] getRecordDocuments error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load record documents' });
  }
};

exports.semanticSearchDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const visibilityContext = await buildVisibilityContext(req);
    const result = await semanticSearchDocuments({
      organizationId,
      queryText: req.query.q || req.query.search,
      page,
      limit,
      visibilityContext
    });
    return res.json({
      success: true,
      data: result.data.map(formatDocument),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[documents] semanticSearchDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to semantic search documents' });
  }
};

exports.listDocumentInlineComments = async (req, res) => {
  try {
    const data = await inlineCommentService.listDocumentInlineComments({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      status: req.query.status || ''
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to list comments' });
  }
};

exports.createDocumentInlineComment = async (req, res) => {
  try {
    const data = await inlineCommentService.createDocumentInlineComment({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create comment' });
  }
};

exports.resolveDocumentInlineComment = async (req, res) => {
  try {
    const data = await inlineCommentService.resolveDocumentInlineComment({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      commentId: req.params.commentId,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to resolve comment' });
  }
};

exports.reopenDocumentInlineComment = async (req, res) => {
  try {
    const data = await inlineCommentService.reopenDocumentInlineComment({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      commentId: req.params.commentId,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to reopen comment' });
  }
};

exports.listDocumentSignatureRequests = async (req, res) => {
  try {
    const data = await signatureService.listDocumentSignatureRequests({
      organizationId: req.user.organizationId,
      documentId: req.params.id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to list signature requests' });
  }
};

exports.createDocumentSignatureRequest = async (req, res) => {
  try {
    const data = await signatureService.createDocumentSignatureRequest({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create signature request' });
  }
};

exports.signDocumentSignatureRequest = async (req, res) => {
  try {
    const data = await signatureService.signDocumentSignatureRequest({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      requestId: req.params.requestId,
      userId: req.user._id,
      userEmail: req.user.email,
      payload: req.body || {}
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to sign document' });
  }
};

exports.cancelDocumentSignatureRequest = async (req, res) => {
  try {
    const data = await signatureService.cancelDocumentSignatureRequest({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      requestId: req.params.requestId,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to cancel signature request' });
  }
};

exports.getDocumentEditDraft = async (req, res) => {
  try {
    const data = await draftService.getDocumentEditDraft({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to load draft' });
  }
};

exports.listDocumentEditDrafts = async (req, res) => {
  try {
    const data = await draftService.listDocumentEditDrafts({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      excludeUserId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to list drafts' });
  }
};

exports.saveDocumentEditDraft = async (req, res) => {
  try {
    const data = await draftService.saveDocumentEditDraft({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      richContent: req.body?.richContent,
      baseVersionNumber: req.body?.baseVersionNumber
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to save draft' });
  }
};

exports.deleteDocumentEditDraft = async (req, res) => {
  try {
    const data = await draftService.deleteDocumentEditDraft({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete draft' });
  }
};

exports.publishDocumentEditDraft = async (req, res) => {
  try {
    const doc = await draftService.publishDocumentEditDraft({
      organizationId: req.user.organizationId,
      documentId: req.params.id,
      userId: req.user._id,
      updateDocument: documentService.updateDocument
    });
    return res.json({ success: true, data: formatDocument(doc) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to publish draft' });
  }
};
