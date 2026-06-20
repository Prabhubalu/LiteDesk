'use strict';

const DocumentSignatureRequest = require('../models/DocumentSignatureRequest');
const Document = require('../models/Document');
const { logAuditEvent } = require('./documentService');

const USER_POPULATE = 'firstName lastName email avatar username';

function normalizeSigners(signers = []) {
  if (!Array.isArray(signers)) return [];
  return signers
    .map((signer, index) => ({
      userId: signer.userId || null,
      email: String(signer.email || '').trim().toLowerCase(),
      name: String(signer.name || '').trim(),
      order: Number.isFinite(signer.order) ? signer.order : index + 1,
      status: 'pending',
      signatureText: null,
      signedAt: null,
      declinedAt: null,
      declineReason: null
    }))
    .filter((signer) => signer.email);
}

function resolveRequestStatus(signers) {
  if (!signers.length) return 'draft';
  if (signers.every((signer) => signer.status === 'signed')) return 'completed';
  if (signers.some((signer) => signer.status === 'declined')) return 'declined';
  if (signers.some((signer) => signer.status === 'signed')) return 'partially_signed';
  return 'sent';
}

async function assertDocument({ organizationId, documentId }) {
  const doc = await Document.findOne({ _id: documentId, organizationId, deletedAt: null })
    .select('_id title documentNumber')
    .lean();
  if (!doc) throw new Error('Document not found');
  return doc;
}

async function listDocumentSignatureRequests({ organizationId, documentId }) {
  await assertDocument({ organizationId, documentId });
  return DocumentSignatureRequest.find({ organizationId, documentId })
    .populate('createdBy', USER_POPULATE)
    .sort({ updatedAt: -1 })
    .lean();
}

async function createDocumentSignatureRequest({
  organizationId,
  documentId,
  userId,
  payload = {}
}) {
  await assertDocument({ organizationId, documentId });

  const signers = normalizeSigners(payload.signers);
  if (!signers.length) throw new Error('At least one signer is required');

  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  const status = payload.send === true ? resolveRequestStatus(signers) : 'draft';

  const row = await DocumentSignatureRequest.create({
    organizationId,
    documentId,
    createdBy: userId,
    status,
    provider: 'internal',
    message: String(payload.message || '').trim(),
    expiresAt,
    signers
  });

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'signature_request_create',
      requestId: String(row._id),
      signerCount: signers.length
    }
  });

  return DocumentSignatureRequest.findById(row._id)
    .populate('createdBy', USER_POPULATE)
    .lean();
}

async function signDocumentSignatureRequest({
  organizationId,
  documentId,
  requestId,
  userId,
  userEmail,
  payload = {}
}) {
  const row = await DocumentSignatureRequest.findOne({
    _id: requestId,
    organizationId,
    documentId
  });
  if (!row) throw new Error('Signature request not found');
  if (['completed', 'declined', 'cancelled', 'expired'].includes(row.status)) {
    throw new Error('Signature request is closed');
  }
  if (row.expiresAt && row.expiresAt < new Date()) {
    row.status = 'expired';
    await row.save();
    throw new Error('Signature request has expired');
  }

  const signatureText = String(payload.signatureText || '').trim().slice(0, 200);
  if (!signatureText) throw new Error('Signature text is required');

  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  const signer = row.signers.find((entry) => {
    if (entry.userId && String(entry.userId) === String(userId)) return true;
    return entry.email === normalizedEmail;
  });

  if (!signer) throw new Error('You are not a signer on this request');
  if (signer.status === 'signed') throw new Error('Already signed');

  signer.status = 'signed';
  signer.signatureText = signatureText;
  signer.signedAt = new Date();
  row.status = resolveRequestStatus(row.signers);
  if (row.status === 'completed') {
    row.completedAt = new Date();
  }
  await row.save();

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'signature_signed',
      requestId: String(requestId),
      signerEmail: signer.email
    }
  });

  return DocumentSignatureRequest.findById(row._id)
    .populate('createdBy', USER_POPULATE)
    .lean();
}

async function cancelDocumentSignatureRequest({
  organizationId,
  documentId,
  requestId,
  userId
}) {
  const row = await DocumentSignatureRequest.findOne({
    _id: requestId,
    organizationId,
    documentId
  });
  if (!row) throw new Error('Signature request not found');
  if (row.status === 'completed') throw new Error('Cannot cancel a completed request');

  row.status = 'cancelled';
  row.cancelledAt = new Date();
  await row.save();

  await logAuditEvent({
    organizationId,
    documentId,
    action: 'update',
    actorId: userId,
    metadata: {
      action: 'signature_request_cancel',
      requestId: String(requestId)
    }
  });

  return DocumentSignatureRequest.findById(row._id).lean();
}

module.exports = {
  listDocumentSignatureRequests,
  createDocumentSignatureRequest,
  signDocumentSignatureRequest,
  cancelDocumentSignatureRequest
};
