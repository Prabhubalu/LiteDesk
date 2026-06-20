'use strict';

const Document = require('../models/Document');
const { getObjectBuffer } = require('./fileStorageService');
const { isOcrSupportedDocument, OCR_SUPPORTED_MIME_TYPES } = require('../constants/documentOcrIndex');
const { indexDocumentSemanticEmbedding } = require('./documentSemanticIndexService');

const MAX_OCR_TEXT_LENGTH = 500_000;

let pdfParseFn = null;
function getPdfParser() {
  if (pdfParseFn !== null) return pdfParseFn;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    pdfParseFn = require('pdf-parse');
  } catch {
    pdfParseFn = false;
  }
  return pdfParseFn;
}

function normalizeExtractedText(text) {
  const normalized = String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  return normalized.length > MAX_OCR_TEXT_LENGTH
    ? normalized.slice(0, MAX_OCR_TEXT_LENGTH)
    : normalized;
}

async function extractTextFromBuffer(buffer, mimeType = '', fileType = '') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  const normalizedMime = String(mimeType || '').toLowerCase();
  const normalizedFileType = String(fileType || '').toUpperCase();

  if (normalizedMime === 'text/plain' || normalizedMime === 'text/csv' || normalizedFileType === 'TXT' || normalizedFileType === 'CSV') {
    return normalizeExtractedText(buffer.toString('utf8'));
  }

  if (normalizedMime === 'application/pdf' || normalizedFileType === 'PDF') {
    const pdfParse = getPdfParser();
    if (!pdfParse) {
      throw new Error('PDF OCR parser is not available');
    }
    const parsed = await pdfParse(buffer);
    return normalizeExtractedText(parsed?.text);
  }

  return null;
}

async function applyOcrIndexResult({ organizationId, documentId, text, status }) {
  const update = {
    ocrStatus: status,
    ocrIndexedAt: new Date()
  };
  if (text) {
    update.ocrText = text;
  } else if (status === 'indexed') {
    update.ocrText = null;
  }

  await Document.updateOne(
    { _id: documentId, organizationId },
    { $set: update }
  );
  void indexDocumentSemanticEmbedding({ organizationId, documentId }).catch(() => {});
}

async function indexDocumentOcrFromBuffer({
  organizationId,
  documentId,
  buffer,
  mimeType,
  fileType
}) {
  const doc = await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!doc || !isOcrSupportedDocument(doc)) {
    await applyOcrIndexResult({
      organizationId,
      documentId,
      text: null,
      status: 'skipped'
    });
    return { status: 'skipped', textLength: 0 };
  }

  try {
    const text = await extractTextFromBuffer(buffer, mimeType || doc.mimeType, fileType || doc.fileType);
    if (!text) {
      await applyOcrIndexResult({
        organizationId,
        documentId,
        text: null,
        status: 'failed'
      });
      return { status: 'failed', textLength: 0 };
    }

    await applyOcrIndexResult({
      organizationId,
      documentId,
      text,
      status: 'indexed'
    });
    return { status: 'indexed', textLength: text.length };
  } catch (error) {
    await applyOcrIndexResult({
      organizationId,
      documentId,
      text: null,
      status: 'failed'
    });
    throw error;
  }
}

async function queueDocumentOcrIndex({ organizationId, documentId, mimeType, fileType }) {
  const doc = await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!doc || !isOcrSupportedDocument({ ...doc, mimeType, fileType })) {
    await Document.updateOne(
      { _id: documentId, organizationId },
      { $set: { ocrStatus: 'skipped', ocrIndexedAt: new Date() } }
    );
    return { status: 'skipped' };
  }

  await Document.updateOne(
    { _id: documentId, organizationId },
    { $set: { ocrStatus: 'pending', ocrIndexedAt: null } }
  );
  return { status: 'pending' };
}

async function indexDocumentOcrFromStorage({ organizationId, documentId }) {
  const doc = await Document.findOne({
    _id: documentId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!doc || !isOcrSupportedDocument(doc)) {
    await applyOcrIndexResult({
      organizationId,
      documentId,
      text: null,
      status: 'skipped'
    });
    return { status: 'skipped', textLength: 0 };
  }

  if (!doc.storagePath) {
    await applyOcrIndexResult({
      organizationId,
      documentId,
      text: null,
      status: 'failed'
    });
    return { status: 'failed', textLength: 0 };
  }

  const buffer = await getObjectBuffer(doc.storagePath);
  return indexDocumentOcrFromBuffer({
    organizationId,
    documentId,
    buffer,
    mimeType: doc.mimeType,
    fileType: doc.fileType
  });
}

module.exports = {
  OCR_SUPPORTED_MIME_TYPES,
  extractTextFromBuffer,
  queueDocumentOcrIndex,
  indexDocumentOcrFromBuffer,
  indexDocumentOcrFromStorage
};
