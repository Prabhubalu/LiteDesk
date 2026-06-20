'use strict';

const NATIVE_DOCUMENT_TYPES = new Set([
  'rich_document',
  'sop',
  'knowledge_article',
  'meeting_notes',
  'playbook',
  'checklist',
  'template',
  'generated_document'
]);

const EDITABLE_FILE_TYPES = new Set(['DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT']);

const PRESENCE_ACTIVITY_TYPES = new Set(['editing', 'viewing', 'idle']);

const PRESENCE_TTL_MS = Math.max(
  30_000,
  parseInt(process.env.DOCUMENT_PRESENCE_TTL_MS || '45000', 10)
);

const PRESENCE_HEARTBEAT_MS = Math.max(
  10_000,
  parseInt(process.env.DOCUMENT_PRESENCE_HEARTBEAT_MS || '20000', 10)
);

const DEFAULT_RESERVATION_HOURS = Math.min(
  72,
  Math.max(1, parseInt(process.env.DOCUMENT_RESERVATION_HOURS || '8', 10))
);

function isNativeDocument(doc) {
  if (!doc) return false;
  const type = String(doc.documentType || '').toLowerCase();
  if (type === 'external_link') return false;
  if (type === 'file') return false;
  return NATIVE_DOCUMENT_TYPES.has(type) || type === 'rich_document';
}

function isEditableUploadedFile(doc) {
  if (!doc) return false;
  if (String(doc.documentType || '') !== 'file') return false;
  const fileType = String(doc.fileType || '').toUpperCase();
  return EDITABLE_FILE_TYPES.has(fileType);
}

function supportsReservation(doc) {
  return isEditableUploadedFile(doc);
}

function resolveReservationState(doc, now = new Date()) {
  if (!doc?.reservedBy) {
    return 'available';
  }
  const expiresAt = doc.reservationExpiresAt ? new Date(doc.reservationExpiresAt) : null;
  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    return 'expired';
  }
  return 'reserved';
}

module.exports = {
  NATIVE_DOCUMENT_TYPES,
  EDITABLE_FILE_TYPES,
  PRESENCE_ACTIVITY_TYPES,
  PRESENCE_TTL_MS,
  PRESENCE_HEARTBEAT_MS,
  DEFAULT_RESERVATION_HOURS,
  isNativeDocument,
  isEditableUploadedFile,
  supportsReservation,
  resolveReservationState
};
