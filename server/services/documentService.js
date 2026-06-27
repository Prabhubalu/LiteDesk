const crypto = require('crypto');
const path = require('path');
const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentFolder = require('../models/DocumentFolder');
const DocumentAuditEvent = require('../models/DocumentAuditEvent');
const DocumentFavorite = require('../models/DocumentFavorite');
const DocumentRecent = require('../models/DocumentRecent');
const RelationshipInstance = require('../models/RelationshipInstance');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const deletionService = require('./deletionService');
const {
  RELATIONSHIP_KEY_BY_MODULE,
  SOURCE_APP_BY_MODULE,
  DOCUMENT_ATTACHMENT_MODULES,
  DOCUMENT_RELATED_RELATIONSHIP_KEY
} = require('../constants/defaultDocumentRelationships');
const {
  applyDocumentVisibilityFilter,
  userCanAccessDocument
} = require('../utils/documentVisibility');
const {
  assertNoVersionConflict,
  recordVersionConflict,
  DocumentVersionConflictError,
  formatCoordinationAuditMessage
} = require('./documentEditingCoordinationService');
const {
  resolveExternalProvider,
  validateExternalProviderUrl
} = require('../constants/documentExternalProviders');
const {
  queueDocumentOcrIndex,
  indexDocumentOcrFromBuffer
} = require('./documentOcrIndexService');
const { indexDocumentSemanticEmbedding } = require('./documentSemanticIndexService');
const {
  listContentVersions
} = require('../utils/descriptionVersionHelper');
const User = require('../models/User');

const USER_POPULATE = 'firstName lastName email avatar username';
const MAX_RECENT_DOCUMENTS_PER_USER = 100;

class DocumentUploadConflictError extends Error {
  constructor(message, { code, statusCode = 409, documentId, documentNumber, title } = {}) {
    super(message);
    this.name = 'DocumentUploadConflictError';
    this.code = code;
    this.statusCode = statusCode;
    this.documentId = documentId;
    this.documentNumber = documentNumber;
    this.title = title;
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRichContentSearchText(richContent) {
  const html = typeof richContent === 'string'
    ? richContent
    : richContent?.html || '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStoredRichContentHtml(richContent) {
  if (!richContent) return '';
  if (typeof richContent === 'string') return richContent.trim();
  if (typeof richContent === 'object' && richContent.html) return String(richContent.html).trim();
  return '';
}

function buildRichContentVersionRecordId(documentId) {
  return `${String(documentId)}::richContent`;
}

const RICH_CONTENT_VERSION_RETENTION_DAYS = 365;

function trimRichContentVersionEntries(versions) {
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RICH_CONTENT_VERSION_RETENTION_DAYS);
  return (Array.isArray(versions) ? versions : []).filter(
    (entry) => entry?.createdAt && new Date(entry.createdAt) >= retentionCutoff
  );
}

async function pushRichContentVersionSnapshot({ organizationId, documentId, previousHtml, userId }) {
  if (typeof previousHtml !== 'string') return;

  await Document.findOneAndUpdate(
    { _id: documentId, organizationId, deletedAt: null },
    {
      $push: {
        richContentVersions: {
          content: previousHtml,
          createdAt: new Date(),
          createdBy: userId
        }
      }
    }
  );

  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RICH_CONTENT_VERSION_RETENTION_DAYS);
  await Document.updateOne(
    { _id: documentId, organizationId, deletedAt: null },
    { $pull: { richContentVersions: { createdAt: { $lt: retentionCutoff } } } }
  );
}

function normalizeRecordObjectId(recordId) {
  const mongoose = require('mongoose');
  if (recordId == null) return recordId;
  const id = String(recordId);
  if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
    return new mongoose.Types.ObjectId(id);
  }
  return recordId;
}

async function findTrashedUploadMatch({ organizationId, checksum, title }) {
  if (checksum) {
    const byChecksum = await Document.findOne({
      organizationId,
      checksum,
      deletedAt: { $ne: null }
    })
      .select('_id documentNumber title')
      .lean();
    if (byChecksum) return byChecksum;
  }

  const normalizedTitle = String(title || '').trim();
  if (normalizedTitle) {
    const byTitle = await Document.findOne({
      organizationId,
      deletedAt: { $ne: null },
      title: { $regex: new RegExp(`^${escapeRegex(normalizedTitle)}$`, 'i') }
    })
      .select('_id documentNumber title')
      .lean();
    if (byTitle) return byTitle;
  }

  return null;
}

async function findActiveUploadMatch({ organizationId, checksum }) {
  if (!checksum) return null;
  return Document.findOne({
    organizationId,
    checksum,
    deletedAt: null
  })
    .select('_id documentNumber title')
    .lean();
}

function assertUploadAllowed({ organizationId, checksum, title }) {
  return (async () => {
    const trashed = await findTrashedUploadMatch({ organizationId, checksum, title });
    if (trashed) {
      const label = trashed.title || title || 'This document';
      throw new DocumentUploadConflictError(
        `"${label}" is already in Trash (${trashed.documentNumber}). Restore it from Trash to use it again.`,
        {
          code: 'DOCUMENT_IN_TRASH',
          statusCode: 409,
          documentId: String(trashed._id),
          documentNumber: trashed.documentNumber,
          title: trashed.title || title
        }
      );
    }

    const active = await findActiveUploadMatch({ organizationId, checksum });
    if (active) {
      const label = active.title || title || 'This document';
      throw new DocumentUploadConflictError(
        `"${label}" already exists (${active.documentNumber}). Open the existing document or upload a different file.`,
        {
          code: 'DOCUMENT_ALREADY_EXISTS',
          statusCode: 409,
          documentId: String(active._id),
          documentNumber: active.documentNumber,
          title: active.title || title
        }
      );
    }
  })();
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function inferFileType(fileName, mimeType) {
  const ext = path.extname(String(fileName || '')).replace('.', '').toLowerCase();
  if (ext) return ext.toUpperCase();
  if (!mimeType) return null;
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word')) return 'DOCX';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLSX';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  return null;
}

async function generateDocumentNumber(organizationId) {
  const prefix = 'DOC-';
  // Include soft-deleted rows: documentNumber unique index spans trash, numbers are never reused.
  const latest = await Document.findOne({
    organizationId,
    documentNumber: { $regex: `^${prefix}\\d+$` }
  })
    .sort({ documentNumber: -1 })
    .select('documentNumber')
    .lean();

  let next = 1;
  if (latest?.documentNumber?.startsWith(prefix)) {
    const parsed = parseInt(String(latest.documentNumber).slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(6, '0')}`;
}

async function logAuditEvent({ organizationId, documentId, action, actorId, metadata = {} }) {
  await DocumentAuditEvent.create({
    organizationId,
    documentId,
    action,
    actorId,
    metadata,
    timestamp: new Date()
  });
}

function buildListQuery(organizationId, filters = {}) {
  const query = {
    organizationId,
    deletedAt: null
  };

  if (filters.status) query.status = filters.status;
  if (filters.documentType) query.documentType = filters.documentType;
  if (filters.ownerId) query.ownerId = filters.ownerId;
  if (filters.fileType) query.fileType = filters.fileType;
  if (filters.tag) {
    const tag = String(filters.tag).trim();
    if (tag) {
      query.tags = new RegExp(`^${escapeRegex(tag)}$`, 'i');
    }
  }
  if (filters.knowledgeBaseOnly) {
    query['visibility.knowledgeBase'] = true;
    if (!filters.status) {
      query.status = 'published';
    }
  }

  return query;
}

function buildPortalKnowledgeQuery(organizationId) {
  return {
    organizationId,
    deletedAt: null,
    status: 'published',
    'visibility.portalVisible': true,
    $or: [
      { portalAccessRevokedAt: null },
      { portalAccessRevokedAt: { $exists: false } }
    ]
  };
}

function buildRegexSearchClause(term) {
  const searchRegex = new RegExp(escapeRegex(term), 'i');
  return {
    $or: [
      { title: searchRegex },
      { documentNumber: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { richContentText: searchRegex },
      { ocrText: searchRegex },
      { 'richContent.html': searchRegex }
    ]
  };
}

async function scheduleDocumentOcrIndex({
  organizationId,
  documentId,
  buffer = null,
  mimeType = null,
  fileType = null
}) {
  if (buffer) {
    void indexDocumentOcrFromBuffer({
      organizationId,
      documentId,
      buffer,
      mimeType,
      fileType
    }).catch((error) => {
      console.error(`[documents] OCR index failed for ${documentId}:`, error.message);
      void queueDocumentOcrIndex({ organizationId, documentId, mimeType, fileType });
    });
    return;
  }

  void queueDocumentOcrIndex({ organizationId, documentId, mimeType, fileType }).catch((error) => {
    console.error(`[documents] OCR queue failed for ${documentId}:`, error.message);
  });
}

async function scheduleDocumentSemanticIndex({ organizationId, documentId, doc = null }) {
  void indexDocumentSemanticEmbedding({ organizationId, documentId, doc }).catch((error) => {
    console.error(`[documents] Semantic index failed for ${documentId}:`, error.message);
  });
}

function buildSharedWithMeClause(userId, userRoleId, userGroupIds = []) {
  const accessConditions = [];
  if (userRoleId) {
    accessConditions.push({ 'visibility.roleIds': userRoleId });
  }
  const groupIds = (userGroupIds || []).filter(Boolean);
  if (groupIds.length) {
    accessConditions.push({ 'visibility.teamIds': { $in: groupIds } });
  }
  if (!accessConditions.length) return null;

  return {
    'visibility.private': true,
    ownerId: { $ne: userId },
    createdBy: { $ne: userId },
    $or: accessConditions
  };
}

async function getDescendantFolderIds(organizationId, folderId) {
  const rootId = String(folderId);
  const allFolders = await DocumentFolder.find({ organizationId })
    .select('_id parentFolderId')
    .lean();

  const childrenByParent = new Map();
  for (const folder of allFolders) {
    const parentKey = folder.parentFolderId ? String(folder.parentFolderId) : 'root';
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey).push(String(folder._id));
  }

  const result = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    for (const childId of childrenByParent.get(current) || []) {
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

async function getRelatedDocumentIds(organizationId, documentId) {
  const docId = normalizeRecordObjectId(documentId);
  const instances = await RelationshipInstance.find({
    organizationId,
    relationshipKey: DOCUMENT_RELATED_RELATIONSHIP_KEY,
    $or: [
      { 'source.moduleKey': 'documents', 'source.recordId': docId },
      { 'target.moduleKey': 'documents', 'target.recordId': docId }
    ]
  }).lean();

  const relatedIds = [];
  const docIdStr = String(docId);
  for (const row of instances) {
    const sourceId = String(row.source?.recordId || '');
    const targetId = String(row.target?.recordId || '');
    if (sourceId === docIdStr && targetId) relatedIds.push(targetId);
    else if (targetId === docIdStr && sourceId) relatedIds.push(sourceId);
  }
  return [...new Set(relatedIds)];
}

async function resolveDocumentsListQuery({
  organizationId,
  filters = {},
  visibilityContext = null,
}) {
  let query = buildListQuery(organizationId, filters);
  let searchTerm = String(filters.search || '').trim();

  const { extractSearchTermFromFilterQuery } = require('../utils/searchRelevance');
  const columnTitleTerm = extractSearchTermFromFilterQuery(filters.filterQuery, ['title']);
  if (searchTerm && columnTitleTerm && searchTerm.toLowerCase() === columnTitleTerm.toLowerCase()) {
    searchTerm = '';
  }

  if (filters.folderId) {
    const folderIds = await getDescendantFolderIds(organizationId, filters.folderId);
    query.folderId = { $in: folderIds };
  }

  if (filters.expiringOnly) {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 30);
    query.expiryDate = { $gte: now, $lte: soon };
  }

  if (filters.sharedWithMe && filters.userId) {
    const sharedClause = buildSharedWithMeClause(
      filters.userId,
      filters.userRoleId,
      filters.userGroupIds
    );
    if (!sharedClause) {
      query._id = { $in: [] };
    } else {
      query.$and = query.$and || [];
      query.$and.push(sharedClause);
    }
  }

  if (visibilityContext) {
    applyDocumentVisibilityFilter(query, visibilityContext);
  }

  if (filters.filterQuery) {
    const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
    query = applyListFilterQueryParam(query, { filterQuery: filters.filterQuery }, 'documents', {
      userId: filters.userId,
    });
  }

  if (searchTerm) {
    const useTextSearch = searchTerm.length >= 2 && !/["\\]/.test(searchTerm);
    if (useTextSearch) {
      query.$text = { $search: searchTerm };
    } else {
      const searchClause = buildRegexSearchClause(searchTerm);
      if (query.$and) {
        query.$and.push(searchClause);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }
  }

  if (filters.favoritesOnly && filters.userId) {
    const favoriteIds = await DocumentFavorite.find({
      organizationId,
      userId: filters.userId,
    }).distinct('documentId');
    query._id = favoriteIds.length ? { $in: favoriteIds } : { $in: [] };
  }

  if (filters.recentOnly && filters.userId) {
    const recentRows = await DocumentRecent.find({
      organizationId,
      userId: filters.userId,
    })
      .sort({ lastViewedAt: -1 })
      .limit(MAX_RECENT_DOCUMENTS_PER_USER)
      .select('documentId')
      .lean();
    const recentIds = recentRows.map((row) => row.documentId).filter(Boolean);
    query._id = recentIds.length ? { $in: recentIds } : { $in: [] };
  }

  if (filters.linkedModuleKey && filters.linkedRecordId) {
    const linkedDocs = await listDocumentsForRecord({
      organizationId,
      moduleKey: filters.linkedModuleKey,
      recordId: filters.linkedRecordId,
      appKey: filters.linkedAppKey,
    });
    const ids = linkedDocs.map((doc) => doc._id).filter(Boolean);
    query._id = ids.length ? { $in: ids } : { $in: [] };
  }

  if (filters.relatedToDocumentId) {
    const relatedIds = await getRelatedDocumentIds(organizationId, filters.relatedToDocumentId);
    query._id = relatedIds.length ? { $in: relatedIds } : { $in: [] };
  }

  return query;
}

async function getDocumentsListMeta({
  organizationId,
  filters = {},
  visibilityContext = null,
}) {
  const { fetchListMeta } = require('../utils/listMetaService');
  const query = await resolveDocumentsListQuery({ organizationId, filters, visibilityContext });
  return fetchListMeta(Document, query);
}

async function listDocuments({
  organizationId,
  filters = {},
  page = 1,
  limit = 20,
  sort = '-updatedAt',
  visibilityContext = null
}) {
  let query = await resolveDocumentsListQuery({ organizationId, filters, visibilityContext });
  let effectiveSort = sort;
  const searchTerm = String(filters.search || '').trim();
  if (searchTerm.length >= 2 && !/["\\]/.test(searchTerm) && query.$text && effectiveSort === '-updatedAt') {
    effectiveSort = { score: { $meta: 'textScore' }, updatedAt: -1 };
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const runQuery = async (activeQuery, activeSort) => Promise.all([
    Document.find(activeQuery)
      .populate('ownerId', USER_POPULATE)
      .populate('createdBy', USER_POPULATE)
      .populate('modifiedBy', USER_POPULATE)
      .populate('reservedBy', USER_POPULATE)
      .populate('folderId', 'name path')
      .sort(activeSort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Document.countDocuments(activeQuery)
  ]);

  let data;
  let total;
  try {
    [data, total] = await runQuery(query, effectiveSort);
  } catch (error) {
    if (query.$text) {
      delete query.$text;
      const searchClause = buildRegexSearchClause(searchTerm);
      if (query.$and) {
        query.$and.push(searchClause);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
      effectiveSort = sort;
      [data, total] = await runQuery(query, effectiveSort);
    } else {
      throw error;
    }
  }

  return {
    data,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

async function getDocumentById({ organizationId, documentId, visibilityContext = null }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .populate('ownerId', USER_POPULATE)
    .populate('createdBy', USER_POPULATE)
    .populate('modifiedBy', USER_POPULATE)
    .populate('reservedBy', USER_POPULATE)
    .populate('folderId', 'name path')
    .populate('currentVersionId')
    .lean();

  if (!doc) return null;
  if (visibilityContext && !userCanAccessDocument(doc, visibilityContext)) {
    return null;
  }
  return doc;
}

async function createDocument({
  organizationId,
  userId,
  payload = {}
}) {
  const documentNumber = await generateDocumentNumber(organizationId);
  const title = String(payload.title || '').trim();
  if (!title) {
    throw new Error('Title is required');
  }

  const isExternalLink = payload.documentType === 'external_link' || payload.sourceType === 'external';
  const externalUrl = String(payload.externalUrl || '').trim();
  if (isExternalLink && !externalUrl) {
    throw new Error('External URL is required');
  }
  const sourceProvider = isExternalLink
    ? validateExternalProviderUrl(
      resolveExternalProvider(payload.sourceProvider, externalUrl),
      externalUrl
    )
    : (payload.sourceProvider || null);

  const doc = await Document.create({
    organizationId,
    documentNumber,
    title,
    description: payload.description || '',
    documentType: isExternalLink ? 'external_link' : (payload.documentType || 'rich_document'),
    category: payload.category || null,
    folderId: payload.folderId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    sourceType: isExternalLink ? 'external' : (payload.sourceType || 'internal'),
    sourceProvider: isExternalLink ? sourceProvider : (payload.sourceProvider || null),
    externalUrl: isExternalLink ? externalUrl : (payload.externalUrl || null),
    externalLinkStatus: isExternalLink ? 'available' : null,
    richContent: payload.richContent || null,
    richContentText: extractRichContentSearchText(payload.richContent) || null,
    ownerId: payload.ownerId || userId,
    createdBy: userId,
    modifiedBy: userId,
    status: payload.status || 'draft'
  });

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'create',
    actorId: userId,
    metadata: { documentNumber: doc.documentNumber }
  });

  await scheduleDocumentSemanticIndex({ organizationId, documentId: doc._id, doc: doc.toObject() });

  return getDocumentById({ organizationId, documentId: doc._id });
}

async function createDocumentFromUpload({
  organizationId,
  userId,
  req,
  payload = {}
}) {
  const file = req.file;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const title = String(payload.title || file?.originalname || 'Untitled').trim();
  const checksum = file?.buffer ? computeChecksum(file.buffer) : null;

  if (payload.duplicateAction === 'new_version' && checksum) {
    const existing = await findActiveUploadMatch({ organizationId, checksum });
    if (existing) {
      return uploadNewVersion({
        organizationId,
        documentId: existing._id,
        userId,
        req,
        changeSummary: payload.changeSummary || 'Uploaded duplicate file as new version'
      });
    }
  }

  await assertUploadAllowed({ organizationId, checksum, title });

  const uploadResult = await persistMulterUpload(req, 'documents');
  const documentNumber = await generateDocumentNumber(organizationId);

  const doc = await Document.create({
    organizationId,
    documentNumber,
    title,
    description: payload.description || '',
    documentType: 'file',
    category: payload.category || null,
    folderId: payload.folderId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    sourceType: 'internal',
    fileType: inferFileType(file?.originalname, file?.mimetype),
    fileSizeBytes: uploadResult.fileSize || file?.size || null,
    mimeType: uploadResult.mimeType || file?.mimetype || null,
    checksum,
    storageProvider: 'oci',
    storagePath: uploadResult.storagePath,
    versionNumber: 1,
    ownerId: payload.ownerId || userId,
    createdBy: userId,
    modifiedBy: userId,
    status: payload.status || 'published'
  });

  const version = await DocumentVersion.create({
    organizationId,
    documentId: doc._id,
    versionNumber: 1,
    checksum,
    storagePath: uploadResult.storagePath,
    fileSizeBytes: uploadResult.fileSize || file?.size || null,
    mimeType: uploadResult.mimeType || file?.mimetype || null,
    fileType: doc.fileType,
    createdBy: userId,
    changeSummary: 'Initial upload'
  });

  await Document.updateOne(
    { _id: doc._id },
    { currentVersionId: version._id }
  );

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'upload',
    actorId: userId,
    metadata: {
      documentNumber: doc.documentNumber,
      versionNumber: 1,
      fileName: file?.originalname || null
    }
  });

  if (payload.linkTo?.moduleKey && payload.linkTo?.recordId) {
    await linkDocumentToRecord({
      organizationId,
      userId,
      documentId: doc._id,
      moduleKey: payload.linkTo.moduleKey,
      recordId: payload.linkTo.recordId,
      appKey: payload.linkTo.appKey
    });
  }

  await scheduleDocumentOcrIndex({
    organizationId,
    documentId: doc._id,
    buffer: file?.buffer || null,
    mimeType: uploadResult.mimeType || file?.mimetype || null,
    fileType: doc.fileType
  });
  await scheduleDocumentSemanticIndex({ organizationId, documentId: doc._id });

  return getDocumentById({ organizationId, documentId: doc._id });
}

async function registerStoredFileAsDocument({
  organizationId,
  userId,
  moduleKey,
  recordId,
  appKey,
  storagePath,
  fileName,
  mimeType = null,
  fileSizeBytes = null,
  legacyCommentAttachmentKey = null,
  changeSummary = 'Registered from stored file'
}) {
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  if (!storagePath) {
    throw new Error('storagePath is required');
  }

  if (legacyCommentAttachmentKey) {
    const existing = await Document.findOne({
      organizationId,
      legacyCommentAttachmentKey: String(legacyCommentAttachmentKey)
    }).lean();
    if (existing) {
      return { document: existing, created: false };
    }
  }

  const title = String(fileName || 'Attachment').trim() || 'Attachment';
  const documentNumber = await generateDocumentNumber(organizationId);
  const fileType = inferFileType(fileName, mimeType);

  const doc = await Document.create({
    organizationId,
    documentNumber,
    title,
    documentType: 'file',
    sourceType: 'internal',
    fileType,
    fileSizeBytes: fileSizeBytes || null,
    mimeType: mimeType || null,
    storageProvider: 'oci',
    storagePath,
    versionNumber: 1,
    ownerId: userId,
    createdBy: userId,
    modifiedBy: userId,
    status: 'published',
    legacyCommentAttachmentKey: legacyCommentAttachmentKey || null
  });

  const version = await DocumentVersion.create({
    organizationId,
    documentId: doc._id,
    versionNumber: 1,
    storagePath,
    fileSizeBytes: fileSizeBytes || null,
    mimeType: mimeType || null,
    fileType,
    createdBy: userId,
    changeSummary
  });

  await Document.updateOne({ _id: doc._id }, { currentVersionId: version._id });

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'upload',
    actorId: userId,
    metadata: {
      documentNumber: doc.documentNumber,
      versionNumber: 1,
      fileName: title,
      source: 'comment_attachment'
    }
  });

  if (isDocumentAttachmentModule(normalizedModuleKey) && recordId) {
    await linkDocumentToRecord({
      organizationId,
      userId,
      documentId: doc._id,
      moduleKey: normalizedModuleKey,
      recordId,
      appKey
    });
  }

  await scheduleDocumentOcrIndex({
    organizationId,
    documentId: doc._id,
    mimeType: mimeType || null,
    fileType
  });

  const populated = await getDocumentById({ organizationId, documentId: doc._id });
  return { document: populated || doc.toObject(), created: true };
}

async function registerCommentAttachmentAsDocument({
  organizationId,
  userId,
  moduleKey,
  recordId,
  appKey,
  uploadResult,
  file,
  legacyCommentAttachmentKey = null
}) {
  if (!uploadResult?.storagePath) return null;
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  if (!isDocumentAttachmentModule(normalizedModuleKey)) return null;

  return registerStoredFileAsDocument({
    organizationId,
    userId,
    moduleKey: normalizedModuleKey,
    recordId,
    appKey,
    storagePath: uploadResult.storagePath,
    fileName: file?.originalname || uploadResult.storedFileName,
    mimeType: file?.mimetype || uploadResult.mimeType,
    fileSizeBytes: file?.size || uploadResult.fileSize,
    legacyCommentAttachmentKey
  });
}

async function updateDocument({ organizationId, documentId, userId, payload = {} }) {
  const existing = await Document.findOne({ _id: documentId, organizationId, deletedAt: null }).lean();
  if (!existing) return null;

  const allowed = [
    'title',
    'description',
    'documentType',
    'category',
    'folderId',
    'tags',
    'status',
    'effectiveDate',
    'expiryDate',
    'renewalDate',
    'retentionPolicy',
    'ownerId',
    'richContent',
    'visibility'
  ];

  const update = { modifiedBy: userId };
  for (const key of allowed) {
    if (payload[key] !== undefined) update[key] = payload[key];
  }
  if (payload.richContent !== undefined) {
    update.richContentText = extractRichContentSearchText(payload.richContent) || null;
    const previousHtml = getStoredRichContentHtml(existing.richContent);
    const nextHtml = getStoredRichContentHtml(payload.richContent);
    if (previousHtml !== nextHtml) {
      await pushRichContentVersionSnapshot({
        organizationId,
        documentId,
        previousHtml,
        userId
      });
    }
  }
  if (payload.expiryDate !== undefined) {
    const previousExpiry = existing.expiryDate ? new Date(existing.expiryDate).getTime() : null;
    const nextExpiry = payload.expiryDate ? new Date(payload.expiryDate).getTime() : null;
    if (previousExpiry !== nextExpiry) {
      update.expiryNotifiedAt = null;
    }
  }

  const previousVisibility = existing.visibility || {};
  const nextVisibility = payload.visibility;
  if (nextVisibility && typeof nextVisibility === 'object') {
    const portalRevoked = (
      (previousVisibility.portalVisible === true && nextVisibility.portalVisible === false)
      || (previousVisibility.knowledgeBase === true && nextVisibility.knowledgeBase === false)
    );
    if (portalRevoked) {
      update.portalAccessRevokedAt = new Date();
    }
    if (
      (previousVisibility.portalVisible === false && nextVisibility.portalVisible === true)
      || (previousVisibility.knowledgeBase === false && nextVisibility.knowledgeBase === true)
    ) {
      update.portalAccessRevokedAt = null;
    }
  }

  const ownerChanged = payload.ownerId !== undefined
    && String(payload.ownerId || '') !== String(existing.ownerId || '');

  const doc = await Document.findOneAndUpdate(
    { _id: documentId, organizationId, deletedAt: null },
    update,
    { new: true }
  )
    .populate('ownerId', USER_POPULATE)
    .populate('createdBy', USER_POPULATE)
    .populate('modifiedBy', USER_POPULATE)
    .populate('folderId', 'name path')
    .lean();

  if (!doc) return null;

  if (ownerChanged) {
    await logAuditEvent({
      organizationId,
      documentId,
      action: 'ownership_change',
      actorId: userId,
      metadata: {
        previousOwnerId: existing.ownerId ? String(existing.ownerId) : null,
        nextOwnerId: payload.ownerId ? String(payload.ownerId) : null
      }
    });
  }

  if (update.portalAccessRevokedAt) {
    await logAuditEvent({
      organizationId,
      documentId,
      action: 'portal_access_revoked',
      actorId: userId,
      metadata: {
        previousPortalVisible: Boolean(previousVisibility.portalVisible),
        previousKnowledgeBase: Boolean(previousVisibility.knowledgeBase),
        nextPortalVisible: nextVisibility?.portalVisible ?? previousVisibility.portalVisible,
        nextKnowledgeBase: nextVisibility?.knowledgeBase ?? previousVisibility.knowledgeBase
      }
    });
  }

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId
  });

  const semanticFieldsChanged = ['title', 'description', 'tags', 'richContent', 'status', 'documentType']
    .some((key) => payload[key] !== undefined);
  if (semanticFieldsChanged) {
    await scheduleDocumentSemanticIndex({ organizationId, documentId, doc });
  }

  return doc;
}

async function deleteDocument({ organizationId, documentId, userId, reason }) {
  return deletionService.moveToTrash({
    moduleKey: 'documents',
    recordId: documentId,
    organizationId,
    userId,
    appKey: 'platform',
    reason
  });
}

async function countSharedWithUser({ organizationId, visibilityContext }) {
  if (!visibilityContext?.userId) return 0;
  const sharedClause = buildSharedWithMeClause(
    visibilityContext.userId,
    visibilityContext.userRoleId,
    visibilityContext.userGroupIds
  );
  if (!sharedClause) return 0;

  const query = {
    organizationId,
    deletedAt: null,
    ...sharedClause
  };
  applyDocumentVisibilityFilter(query, visibilityContext);
  return Document.countDocuments(query);
}

async function getDocumentSummary(organizationId) {
  const baseQuery = { organizationId, deletedAt: null };
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);

  const [total, published, drafts, pendingReview, expiringSoon, byType] = await Promise.all([
    Document.countDocuments(baseQuery),
    Document.countDocuments({ ...baseQuery, status: 'published' }),
    Document.countDocuments({ ...baseQuery, status: 'draft' }),
    Document.countDocuments({ ...baseQuery, status: 'pending_review' }),
    Document.countDocuments({
      ...baseQuery,
      expiryDate: { $gte: now, $lte: soon }
    }),
    Document.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$documentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    total,
    published,
    drafts,
    pendingReview,
    expiringSoon,
    trashed: await Document.countDocuments({ organizationId, deletedAt: { $ne: null } }),
    byType: byType.map((row) => ({ type: row._id, count: row.count }))
  };
}

async function listFolders({ organizationId, parentFolderId = null, all = false }) {
  const query = { organizationId };
  if (!all) {
    query.parentFolderId = parentFolderId || null;
  }
  return DocumentFolder.find(query).sort({ path: 1, sortOrder: 1, name: 1 }).lean();
}

async function countFolders({ organizationId }) {
  return DocumentFolder.countDocuments({ organizationId });
}

async function getFavoriteDocumentIds({ organizationId, userId }) {
  return DocumentFavorite.find({ organizationId, userId }).distinct('documentId');
}

async function countFavoriteDocuments({ organizationId, userId }) {
  return DocumentFavorite.countDocuments({ organizationId, userId });
}

async function toggleDocumentFavorite({ organizationId, userId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id')
    .lean();
  if (!doc) throw new Error('Document not found');

  const existing = await DocumentFavorite.findOne({ organizationId, userId, documentId });
  if (existing) {
    await DocumentFavorite.deleteOne({ _id: existing._id });
    return { favorited: false };
  }

  await DocumentFavorite.create({ organizationId, userId, documentId });
  return { favorited: true };
}

async function trackDocumentView({ organizationId, userId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id')
    .lean();
  if (!doc) return;

  await DocumentRecent.findOneAndUpdate(
    { organizationId, userId, documentId },
    { $set: { lastViewedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const overflow = await DocumentRecent.find({ organizationId, userId })
    .sort({ lastViewedAt: -1 })
    .skip(MAX_RECENT_DOCUMENTS_PER_USER)
    .select('_id')
    .lean();
  if (overflow.length) {
    await DocumentRecent.deleteMany({ _id: { $in: overflow.map((row) => row._id) } });
  }
}

async function countRecentDocuments({ organizationId, userId }) {
  return DocumentRecent.countDocuments({ organizationId, userId });
}

async function listRecentDocuments({ organizationId, userId, limit = 8 }) {
  const recentRows = await DocumentRecent.find({ organizationId, userId })
    .sort({ lastViewedAt: -1 })
    .limit(limit)
    .lean();
  if (!recentRows.length) return [];

  const docIds = recentRows.map((row) => row.documentId).filter(Boolean);
  const docs = await Document.find({
    _id: { $in: docIds },
    organizationId,
    deletedAt: null
  })
    .populate('ownerId', USER_POPULATE)
    .populate('folderId', 'name path')
    .lean();

  const docById = new Map(docs.map((doc) => [String(doc._id), doc]));
  return recentRows
    .map((row) => docById.get(String(row.documentId)))
    .filter(Boolean);
}

async function createFolder({ organizationId, userId, payload = {} }) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Folder name is required');

  const duplicate = await DocumentFolder.findOne({
    organizationId,
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }
  })
    .select('_id name path')
    .lean();
  if (duplicate) {
    throw new Error('A folder with this name already exists');
  }

  let parentPath = '/';
  if (payload.parentFolderId) {
    const parent = await DocumentFolder.findOne({
      _id: payload.parentFolderId,
      organizationId
    }).lean();
    if (!parent) throw new Error('Parent folder not found');
    parentPath = parent.path || '/';
  }

  const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

  return DocumentFolder.create({
    organizationId,
    name,
    parentFolderId: payload.parentFolderId || null,
    path,
    ownerId: payload.ownerId || userId,
    sortOrder: payload.sortOrder || 0
  });
}

async function deleteFolder({ organizationId, folderId }) {
  const folder = await DocumentFolder.findOne({
    _id: folderId,
    organizationId
  }).lean();
  if (!folder) throw new Error('Folder not found');

  const folderIds = await getDescendantFolderIds(organizationId, folderId);
  const unfiledResult = await Document.updateMany(
    {
      organizationId,
      folderId: { $in: folderIds },
      deletedAt: null
    },
    { $set: { folderId: null } }
  );

  await DocumentFolder.deleteMany({
    organizationId,
    _id: { $in: folderIds }
  });

  return {
    deletedFolderIds: folderIds,
    unfiledDocumentCount: unfiledResult.modifiedCount || 0
  };
}

async function getRecentActivity(organizationId, limit = 10) {
  return DocumentAuditEvent.find({ organizationId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', USER_POPULATE)
    .populate('documentId', 'title documentNumber')
    .lean();
}

async function listDocumentActivity({
  organizationId,
  page = 1,
  limit = 30,
  documentId = null
}) {
  const query = { organizationId };
  if (documentId) {
    query.documentId = documentId;
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [data, total] = await Promise.all([
    DocumentAuditEvent.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actorId', USER_POPULATE)
      .populate('documentId', 'title documentNumber documentType status')
      .lean(),
    DocumentAuditEvent.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function formatAuditActorName(actor) {
  if (!actor || typeof actor !== 'object') return 'System';
  return [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim()
    || actor.username
    || actor.email
    || 'System';
}

function formatDocumentAuditMessage(audit) {
  const action = String(audit?.action || '').trim();
  const meta = audit?.metadata || {};
  const title = meta.title || meta.documentNumber || '';
  const map = {
    upload: title ? `Uploaded ${title}` : 'Uploaded document',
    preview: 'Previewed document',
    download: 'Downloaded document',
    share: 'Shared document',
    delete: 'Moved document to trash',
    restore: 'Restored document',
    version_change: meta.versionNumber ? `Uploaded version ${meta.versionNumber}` : 'Changed document version',
    ownership_change: 'Changed document owner',
    create: title ? `Created ${title}` : 'Created document',
    update: title ? `Updated ${title}` : 'Updated document',
    portal_access_revoked: 'Portal access revoked'
  };
  const coordination = formatCoordinationAuditMessage(audit);
  if (map[action]) return map[action];
  if (coordination && !coordination.startsWith('Document ')) return coordination;
  return map[action] || coordination || `Document ${action || 'updated'}`;
}

async function mergeDocumentAuditActivity(events, documentId, organizationId) {
  const audits = await DocumentAuditEvent.find({ organizationId, documentId })
    .sort({ timestamp: 1 })
    .populate('actorId', USER_POPULATE)
    .lean();

  for (const audit of audits) {
    events.push({
      id: `audit-${audit._id}`,
      type: 'system',
      actor: formatAuditActorName(audit.actorId),
      actorProfile: audit.actorId && typeof audit.actorId === 'object'
        ? {
            _id: audit.actorId._id?.toString(),
            firstName: audit.actorId.firstName,
            lastName: audit.actorId.lastName,
            email: audit.actorId.email,
            username: audit.actorId.username
          }
        : null,
      createdAt: audit.timestamp ? new Date(audit.timestamp).toISOString() : null,
      payload: {
        action: audit.action,
        message: formatDocumentAuditMessage(audit),
        details: audit.metadata || {}
      }
    });
  }
}

async function listDocumentVersions({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id')
    .lean();
  if (!doc) return null;

  return DocumentVersion.find({ organizationId, documentId })
    .sort({ versionNumber: -1 })
    .populate('createdBy', USER_POPULATE)
    .lean();
}

async function uploadNewVersion({
  organizationId,
  documentId,
  userId,
  req,
  changeSummary = '',
  baseVersion = null,
  forceUpload = false
}) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');
  if (!req.file) throw new Error('No file uploaded');

  const currentVersion = doc.versionNumber || 1;
  const parsedBaseVersion = baseVersion != null ? parseInt(String(baseVersion), 10) : currentVersion;

  try {
    assertNoVersionConflict({
      baseVersion: parsedBaseVersion,
      currentVersion,
      forceUpload
    });
  } catch (error) {
    if (error.name === 'DocumentVersionConflictError') {
      const conflict = await recordVersionConflict({
        organizationId,
        documentId: doc._id,
        userId,
        baseVersion: parsedBaseVersion,
        currentVersion
      });
      throw new DocumentVersionConflictError(error.message, {
        statusCode: 409,
        conflictId: String(conflict._id),
        baseVersion: parsedBaseVersion,
        currentVersion
      });
    }
    throw error;
  }

  const uploadResult = await persistMulterUpload(req, 'documents');
  const file = req.file;
  const checksum = file?.buffer ? computeChecksum(file.buffer) : null;
  const nextVersion = currentVersion + 1;
  const conflictDetected = parsedBaseVersion !== currentVersion;

  const version = await DocumentVersion.create({
    organizationId,
    documentId: doc._id,
    versionNumber: nextVersion,
    parentVersionId: doc.currentVersionId || null,
    checksum,
    storagePath: uploadResult.storagePath,
    fileSizeBytes: uploadResult.fileSize || file?.size || null,
    mimeType: uploadResult.mimeType || file?.mimetype || null,
    fileType: inferFileType(file?.originalname, file?.mimetype),
    createdBy: userId,
    changeSummary: changeSummary || `Version ${nextVersion}`,
    basedOnVersion: parsedBaseVersion,
    resultingVersion: nextVersion,
    conflictDetected
  });

  await Document.updateOne(
    { _id: doc._id },
    {
      versionNumber: nextVersion,
      currentVersionId: version._id,
      storagePath: uploadResult.storagePath,
      fileSizeBytes: uploadResult.fileSize || file?.size || null,
      mimeType: uploadResult.mimeType || file?.mimetype || null,
      fileType: inferFileType(file?.originalname, file?.mimetype),
      checksum,
      modifiedBy: userId
    }
  );

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'version_change',
    actorId: userId,
    metadata: {
      versionNumber: nextVersion,
      fileName: file?.originalname || null
    }
  });

  await scheduleDocumentOcrIndex({
    organizationId,
    documentId: doc._id,
    buffer: file?.buffer || null,
    mimeType: uploadResult.mimeType || file?.mimetype || null,
    fileType: inferFileType(file?.originalname, file?.mimetype)
  });

  return getDocumentById({ organizationId, documentId: doc._id });
}

async function restoreDocumentVersion({
  organizationId,
  documentId,
  versionNumber,
  userId
}) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');

  const parsedVersion = parseInt(String(versionNumber), 10);
  if (Number.isNaN(parsedVersion) || parsedVersion < 1) {
    throw new Error('Invalid version number');
  }

  const version = await DocumentVersion.findOne({
    organizationId,
    documentId,
    versionNumber: parsedVersion
  }).lean();
  if (!version) throw new Error('Version not found');

  await Document.updateOne(
    { _id: doc._id },
    {
      currentVersionId: version._id,
      storagePath: version.storagePath,
      fileSizeBytes: version.fileSizeBytes,
      mimeType: version.mimeType,
      fileType: version.fileType,
      checksum: version.checksum,
      versionNumber: version.versionNumber,
      modifiedBy: userId
    }
  );

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'version_change',
    actorId: userId,
    metadata: {
      restoredVersion: version.versionNumber,
      action: 'restore'
    }
  });

  return getDocumentById({ organizationId, documentId: doc._id });
}

async function loadRichContentVersionEntries({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('richContentVersions')
    .lean();

  const versionRecordId = buildRichContentVersionRecordId(documentId);
  const merged = [
    ...(Array.isArray(doc?.richContentVersions) ? doc.richContentVersions : []),
    ...(await listContentVersions({
      organizationId,
      moduleKey: 'documents',
      recordId: versionRecordId,
      contentField: 'richContent'
    })),
    ...(await listContentVersions({
      organizationId,
      moduleKey: 'documents',
      recordId: String(documentId),
      contentField: 'richContent'
    }))
  ];
  const seen = new Set();
  return merged
    .filter((entry) => {
      const key = `${entry.createdAt?.toISOString?.() || entry.createdAt || ''}:${entry.content || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function listRichContentVersions({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('richContent')
    .lean();
  if (!doc) return null;

  const rawVersions = await loadRichContentVersionEntries({ organizationId, documentId });

  const versions = rawVersions
    .map((v) => ({ content: v.content, createdAt: v.createdAt, createdBy: v.createdBy }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const createdByIds = [...new Set(versions.map((v) => v.createdBy).filter(Boolean))];
  let createdByMap = {};
  if (createdByIds.length > 0) {
    const users = await User.find({ _id: { $in: createdByIds }, organizationId })
      .select('firstName lastName')
      .lean();
    users.forEach((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      createdByMap[String(u._id)] = name || 'Unknown';
    });
  }

  const list = versions.map((v) => ({
    content: v.content,
    createdAt: v.createdAt,
    createdBy: v.createdBy ? createdByMap[String(v.createdBy)] || 'Unknown' : 'Unknown',
    createdById: v.createdBy
  }));

  return {
    currentContent: getStoredRichContentHtml(doc.richContent),
    versions: list
  };
}

async function restoreRichContentVersion({ organizationId, documentId, versionIndex, userId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null });
  if (!doc) throw new Error('Document not found');

  const versions = (await loadRichContentVersionEntries({ organizationId, documentId }));

  const version = versions[versionIndex];
  if (!version) throw new Error('Version not found');

  const previousHtml = getStoredRichContentHtml(doc.richContent);
  if (!Array.isArray(doc.richContentVersions)) {
    doc.richContentVersions = [];
  }
  doc.richContentVersions.push({
    content: previousHtml,
    createdAt: new Date(),
    createdBy: userId
  });
  doc.richContentVersions = trimRichContentVersionEntries(doc.richContentVersions);
  doc.markModified('richContentVersions');

  doc.richContent = version.content
    ? { format: 'tiptap_html', html: version.content }
    : null;
  doc.richContentText = extractRichContentSearchText(doc.richContent) || null;
  doc.modifiedBy = userId;
  await doc.save();

  await logAuditEvent({
    organizationId,
    documentId: doc._id,
    action: 'update',
    actorId: userId,
    metadata: { action: 'rich_content_restore', versionIndex }
  });

  return getDocumentById({ organizationId, documentId: doc._id });
}

function resolveDocumentRelationshipKey(moduleKey) {
  const key = String(moduleKey || '').toLowerCase().trim();
  return RELATIONSHIP_KEY_BY_MODULE[key] || null;
}

function resolveSourceAppKey(moduleKey, appKey) {
  const key = String(moduleKey || '').toLowerCase().trim();
  const canonical = SOURCE_APP_BY_MODULE[key];
  if (canonical) return canonical;
  if (appKey) return String(appKey).toLowerCase().trim();
  return 'platform';
}

function isDocumentAttachmentModule(moduleKey) {
  return DOCUMENT_ATTACHMENT_MODULES.includes(String(moduleKey || '').toLowerCase().trim());
}

async function linkDocumentToRecord({
  organizationId,
  userId,
  documentId,
  moduleKey,
  recordId,
  appKey
}) {
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  if (!isDocumentAttachmentModule(normalizedModuleKey)) {
    throw new Error(`Module '${moduleKey}' does not support document attachments`);
  }

  const relationshipKey = resolveDocumentRelationshipKey(normalizedModuleKey);
  if (!relationshipKey) {
    throw new Error(`No document relationship configured for module '${moduleKey}'`);
  }

  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id title documentNumber')
    .lean();
  if (!doc) {
    throw new Error('Document not found');
  }

  const relDef = await RelationshipDefinition.findOne({
    relationshipKey,
    enabled: true
  }).lean();
  if (!relDef) {
    const { registerDefaultDocumentRelationships } = require('./documentRelationshipInitializer');
    await registerDefaultDocumentRelationships();
    const retryRelDef = await RelationshipDefinition.findOne({
      relationshipKey,
      enabled: true
    }).lean();
    if (!retryRelDef) {
      throw new Error(`Relationship '${relationshipKey}' is not available`);
    }
  }

  const normalizedSource = {
    appKey: resolveSourceAppKey(normalizedModuleKey, appKey),
    moduleKey: normalizedModuleKey,
    recordId: normalizeRecordObjectId(recordId)
  };
  const normalizedTarget = {
    appKey: 'platform',
    moduleKey: 'documents',
    recordId: normalizeRecordObjectId(documentId)
  };

  const existing = await RelationshipInstance.findOne({
    organizationId,
    relationshipKey,
    'source.appKey': normalizedSource.appKey,
    'source.moduleKey': normalizedSource.moduleKey,
    'source.recordId': normalizedSource.recordId,
    'target.appKey': normalizedTarget.appKey,
    'target.moduleKey': normalizedTarget.moduleKey,
    'target.recordId': normalizedTarget.recordId
  }).lean();

  if (existing) {
    return { relationshipId: String(existing._id), alreadyLinked: true };
  }

  const instance = await RelationshipInstance.create({
    organizationId,
    relationshipKey,
    source: normalizedSource,
    target: normalizedTarget,
    createdBy: userId
  });

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'share',
    actorId: userId,
    metadata: {
      moduleKey: normalizedModuleKey,
      recordId: String(recordId),
      relationshipId: String(instance._id)
    }
  });

  return { relationshipId: String(instance._id), alreadyLinked: false };
}

async function unlinkDocumentFromRecord({
  organizationId,
  userId,
  documentId,
  relationshipId
}) {
  const instance = await RelationshipInstance.findOne({
    _id: relationshipId,
    organizationId,
    'target.moduleKey': 'documents',
    'target.recordId': normalizeRecordObjectId(documentId)
  }).lean();

  if (!instance) {
    throw new Error('Attachment link not found');
  }

  await RelationshipInstance.deleteOne({ _id: instance._id });

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'unlink',
      relationshipId: String(relationshipId),
      moduleKey: instance.source?.moduleKey,
      recordId: String(instance.source?.recordId || '')
    }
  });

  return { unlinked: true };
}

async function listDocumentsForRecord({
  organizationId,
  moduleKey,
  recordId,
  appKey
}) {
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  if (!isDocumentAttachmentModule(normalizedModuleKey)) {
    return [];
  }

  const relationshipKey = resolveDocumentRelationshipKey(normalizedModuleKey);
  if (!relationshipKey) return [];

  const normalizedSource = {
    appKey: resolveSourceAppKey(normalizedModuleKey, appKey),
    moduleKey: normalizedModuleKey,
    recordId: normalizeRecordObjectId(recordId)
  };

  const instances = await RelationshipInstance.find({
    organizationId,
    relationshipKey,
    'source.appKey': normalizedSource.appKey,
    'source.moduleKey': normalizedSource.moduleKey,
    'source.recordId': normalizedSource.recordId,
    'target.moduleKey': 'documents'
  }).lean();

  if (!instances.length) return [];

  const documentIds = instances.map((row) => row.target?.recordId).filter(Boolean);
  const docs = await Document.find({
    _id: { $in: documentIds },
    organizationId,
    deletedAt: null
  })
    .populate('ownerId', USER_POPULATE)
    .populate('folderId', 'name path')
    .sort('-updatedAt')
    .lean();

  const instanceByDocId = new Map(
    instances.map((row) => [String(row.target.recordId), row])
  );

  return docs.map((doc) => {
    const instance = instanceByDocId.get(String(doc._id));
    const folder = doc.folderId && typeof doc.folderId === 'object' ? doc.folderId : null;
    return {
      ...doc,
      folderName: folder?.name || null,
      relationshipId: instance ? String(instance._id) : null,
      linkedModuleKey: normalizedModuleKey,
      linkedRecordId: String(recordId)
    };
  });
}

async function listKnowledgeBaseDocuments({
  organizationId,
  filters = {},
  page = 1,
  limit = 20,
  sort = '-updatedAt',
  visibilityContext = null
}) {
  return listDocuments({
    organizationId,
    filters: {
      ...filters,
      knowledgeBaseOnly: true
    },
    page,
    limit,
    sort,
    visibilityContext
  });
}

async function listPortalKnowledgeDocuments({
  organizationId,
  page = 1,
  limit = 25,
  search = ''
}) {
  const query = buildPortalKnowledgeQuery(organizationId);
  let effectiveSort = { updatedAt: -1 };
  const searchTerm = String(search || '').trim();

  if (searchTerm) {
    const useTextSearch = searchTerm.length >= 2 && !/["\\]/.test(searchTerm);
    if (useTextSearch) {
      query.$text = { $search: searchTerm };
      effectiveSort = { score: { $meta: 'textScore' }, updatedAt: -1 };
    } else {
      const searchClause = buildRegexSearchClause(searchTerm);
      query.$and = query.$and || [];
      query.$and.push(searchClause);
    }
  }

  const skip = Math.max((page - 1) * limit, 0);
  const [rows, total] = await Promise.all([
    Document.find(query)
      .select('documentNumber title description documentType tags updatedAt')
      .sort(effectiveSort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Document.countDocuments(query)
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

async function getPortalKnowledgeDocument({ organizationId, documentId }) {
  const query = {
    ...buildPortalKnowledgeQuery(organizationId),
    _id: documentId
  };

  return Document.findOne(query)
    .select('documentNumber title description documentType tags richContent richContentText updatedAt')
    .lean();
}

module.exports = {
  DocumentUploadConflictError,
  DocumentVersionConflictError,
  computeChecksum,
  generateDocumentNumber,
  logAuditEvent,
  listDocuments,
  getDocumentsListMeta,
  listKnowledgeBaseDocuments,
  listPortalKnowledgeDocuments,
  getPortalKnowledgeDocument,
  getDocumentById,
  createDocument,
  createDocumentFromUpload,
  registerStoredFileAsDocument,
  registerCommentAttachmentAsDocument,
  updateDocument,
  deleteDocument,
  getDocumentSummary,
  countSharedWithUser,
  getRelatedDocumentIds,
  listFolders,
  countFolders,
  listAllFolders: ({ organizationId }) => listFolders({ organizationId, all: true }),
  createFolder,
  deleteFolder,
  getFavoriteDocumentIds,
  countFavoriteDocuments,
  toggleDocumentFavorite,
  trackDocumentView,
  countRecentDocuments,
  listRecentDocuments,
  mergeDocumentAuditActivity,
  formatDocumentAuditMessage,
  getRecentActivity,
  listDocumentActivity,
  listDocumentVersions,
  uploadNewVersion,
  restoreDocumentVersion,
  listRichContentVersions,
  restoreRichContentVersion,
  linkDocumentToRecord,
  unlinkDocumentFromRecord,
  listDocumentsForRecord,
  isDocumentAttachmentModule,
  resolveDocumentRelationshipKey,
  resolveSourceAppKey
};
