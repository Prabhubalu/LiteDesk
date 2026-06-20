'use strict';

const OCR_STATUSES = ['pending', 'indexed', 'failed', 'skipped'];

const OCR_SUPPORTED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/pdf'
]);

const OCR_SUPPORTED_FILE_TYPES = new Set(['TXT', 'CSV', 'PDF']);

function isOcrSupportedDocument(doc) {
  if (!doc || doc.documentType !== 'file') return false;
  const mimeType = String(doc.mimeType || '').toLowerCase();
  if (mimeType && OCR_SUPPORTED_MIME_TYPES.has(mimeType)) return true;
  const fileType = String(doc.fileType || '').toUpperCase();
  return OCR_SUPPORTED_FILE_TYPES.has(fileType);
}

module.exports = {
  OCR_STATUSES,
  OCR_SUPPORTED_MIME_TYPES,
  OCR_SUPPORTED_FILE_TYPES,
  isOcrSupportedDocument
};
