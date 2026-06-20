'use strict';

const Document = require('../models/Document');
const DocumentEditDraft = require('../models/DocumentEditDraft');
const { logAuditEvent } = require('./documentService');

const USER_POPULATE = 'firstName lastName email avatar username';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function extractRichContentSearchText(richContent) {
  const html = typeof richContent === 'string'
    ? richContent
    : richContent?.html || '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function assertEditableDocument({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id documentType versionNumber')
    .lean();
  if (!doc) throw new Error('Document not found');
  return doc;
}

async function getDocumentEditDraft({ organizationId, documentId, userId }) {
  await assertEditableDocument({ organizationId, documentId });
  const row = await DocumentEditDraft.findOne({ organizationId, documentId, userId })
    .populate('userId', USER_POPULATE)
    .lean();
  return row;
}

async function listDocumentEditDrafts({ organizationId, documentId, excludeUserId = null }) {
  await assertEditableDocument({ organizationId, documentId });
  const query = { organizationId, documentId };
  if (excludeUserId) {
    query.userId = { $ne: excludeUserId };
  }

  return DocumentEditDraft.find(query)
    .populate('userId', USER_POPULATE)
    .sort({ lastSavedAt: -1 })
    .lean();
}

async function saveDocumentEditDraft({
  organizationId,
  documentId,
  userId,
  richContent,
  baseVersionNumber
}) {
  const doc = await assertEditableDocument({ organizationId, documentId });
  const parsedBaseVersion = parseInt(String(baseVersionNumber ?? doc.versionNumber), 10);
  const row = await DocumentEditDraft.findOneAndUpdate(
    { organizationId, documentId, userId },
    {
      $set: {
        richContent: richContent || null,
        richContentText: extractRichContentSearchText(richContent) || null,
        baseVersionNumber: Number.isFinite(parsedBaseVersion) ? parsedBaseVersion : doc.versionNumber,
        lastSavedAt: new Date()
      }
    },
    { upsert: true, new: true }
  )
    .populate('userId', USER_POPULATE)
    .lean();

  return row;
}

async function deleteDocumentEditDraft({ organizationId, documentId, userId }) {
  await DocumentEditDraft.deleteOne({ organizationId, documentId, userId });
  return { deleted: true };
}

async function publishDocumentEditDraft({
  organizationId,
  documentId,
  userId,
  updateDocument
}) {
  const draft = await DocumentEditDraft.findOne({ organizationId, documentId, userId }).lean();
  if (!draft) throw new Error('Draft not found');

  const doc = await updateDocument({
    organizationId,
    documentId,
    userId,
    payload: {
      richContent: draft.richContent
    }
  });

  await DocumentEditDraft.deleteOne({ _id: draft._id });

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'collaboration_draft_publish',
      baseVersionNumber: draft.baseVersionNumber
    }
  });

  return doc;
}

async function purgeExpiredDocumentEditDrafts({ organizationId = null } = {}) {
  const cutoff = new Date(Date.now() - DRAFT_TTL_MS);
  const query = { lastSavedAt: { $lt: cutoff } };
  if (organizationId) query.organizationId = organizationId;
  const result = await DocumentEditDraft.deleteMany(query);
  return { deleted: result.deletedCount || 0 };
}

module.exports = {
  getDocumentEditDraft,
  listDocumentEditDrafts,
  saveDocumentEditDraft,
  deleteDocumentEditDraft,
  publishDocumentEditDraft,
  purgeExpiredDocumentEditDrafts
};
