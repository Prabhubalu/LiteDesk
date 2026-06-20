'use strict';

const DocumentInlineComment = require('../models/DocumentInlineComment');
const Document = require('../models/Document');
const { logAuditEvent } = require('./documentService');

const USER_POPULATE = 'firstName lastName email avatar username';

async function assertDocumentAccess({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id documentType')
    .lean();
  if (!doc) throw new Error('Document not found');
  return doc;
}

function shapeComment(row, replies = []) {
  return {
    ...row,
    _id: String(row._id),
    documentId: String(row.documentId),
    authorId: row.authorId,
    parentCommentId: row.parentCommentId ? String(row.parentCommentId) : null,
    replies
  };
}

async function listDocumentInlineComments({ organizationId, documentId, status = '' }) {
  await assertDocumentAccess({ organizationId, documentId });

  const query = { organizationId, documentId, parentCommentId: null };
  if (status) query.status = status;

  const roots = await DocumentInlineComment.find(query)
    .populate('authorId', USER_POPULATE)
    .populate('resolvedBy', USER_POPULATE)
    .sort({ createdAt: 1 })
    .lean();

  const rootIds = roots.map((row) => row._id);
  const replies = rootIds.length
    ? await DocumentInlineComment.find({
      organizationId,
      documentId,
      parentCommentId: { $in: rootIds }
    })
      .populate('authorId', USER_POPULATE)
      .sort({ createdAt: 1 })
      .lean()
    : [];

  const repliesByParent = new Map();
  for (const reply of replies) {
    const parentKey = String(reply.parentCommentId);
    if (!repliesByParent.has(parentKey)) repliesByParent.set(parentKey, []);
    repliesByParent.get(parentKey).push(shapeComment(reply));
  }

  return roots.map((row) => shapeComment(row, repliesByParent.get(String(row._id)) || []));
}

async function createDocumentInlineComment({
  organizationId,
  documentId,
  userId,
  payload = {}
}) {
  await assertDocumentAccess({ organizationId, documentId });

  const body = String(payload.body || '').trim();
  if (!body) throw new Error('Comment body is required');

  const commentType = payload.commentType === 'suggestion' ? 'suggestion' : 'comment';
  const parentCommentId = payload.parentCommentId || null;

  if (parentCommentId) {
    const parent = await DocumentInlineComment.findOne({
      _id: parentCommentId,
      organizationId,
      documentId
    }).lean();
    if (!parent) throw new Error('Parent comment not found');
  }

  const row = await DocumentInlineComment.create({
    organizationId,
    documentId,
    authorId: userId,
    parentCommentId,
    commentType,
    body,
    suggestedText: commentType === 'suggestion' ? String(payload.suggestedText || '').trim() || null : null,
    quotedText: String(payload.quotedText || '').trim() || null,
    anchorFrom: Number.isFinite(payload.anchorFrom) ? payload.anchorFrom : null,
    anchorTo: Number.isFinite(payload.anchorTo) ? payload.anchorTo : null
  });

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'inline_comment_create',
      commentId: String(row._id),
      commentType
    }
  });

  return DocumentInlineComment.findById(row._id)
    .populate('authorId', USER_POPULATE)
    .lean();
}

async function resolveDocumentInlineComment({
  organizationId,
  documentId,
  commentId,
  userId
}) {
  const row = await DocumentInlineComment.findOne({
    _id: commentId,
    organizationId,
    documentId
  });

  if (!row) throw new Error('Comment not found');
  if (row.status === 'resolved') return row.toObject();

  row.status = 'resolved';
  row.resolvedBy = userId;
  row.resolvedAt = new Date();
  await row.save();

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'inline_comment_resolve',
      commentId: String(commentId)
    }
  });

  return DocumentInlineComment.findById(row._id)
    .populate('authorId', USER_POPULATE)
    .populate('resolvedBy', USER_POPULATE)
    .lean();
}

async function reopenDocumentInlineComment({
  organizationId,
  documentId,
  commentId,
  userId
}) {
  const row = await DocumentInlineComment.findOne({
    _id: commentId,
    organizationId,
    documentId
  });

  if (!row) throw new Error('Comment not found');

  row.status = 'open';
  row.resolvedBy = null;
  row.resolvedAt = null;
  await row.save();

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'inline_comment_reopen',
      commentId: String(commentId)
    }
  });

  return DocumentInlineComment.findById(row._id)
    .populate('authorId', USER_POPULATE)
    .lean();
}

module.exports = {
  listDocumentInlineComments,
  createDocumentInlineComment,
  resolveDocumentInlineComment,
  reopenDocumentInlineComment
};
