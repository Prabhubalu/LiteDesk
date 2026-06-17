'use strict';

const { normalizeWebformFieldType } = require('./moduleFieldTypes');

const WEBFORM_FILE_SCAN_STATUSES = ['skipped', 'clean', 'infected', 'failed'];
const MAX_WEBFORM_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isWebformFileFieldType(type) {
  return normalizeWebformFieldType(type) === 'File';
}

function isFileFieldValueEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  return !String(value.uploadToken || '').trim();
}

function sanitizeClientFileFieldValue(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const uploadToken = String(raw.uploadToken || '').trim();
  if (!uploadToken) return null;
  return {
    uploadToken,
    fileName: String(raw.fileName || '').trim(),
    mimeType: String(raw.mimeType || '').trim(),
    fileSize: Number.isFinite(Number(raw.fileSize)) ? Math.max(0, Number(raw.fileSize)) : 0
  };
}

function buildStoredFileFieldValue(uploadDoc) {
  return {
    uploadToken: uploadDoc.uploadToken,
    fileName: uploadDoc.fileName,
    mimeType: uploadDoc.mimeType,
    fileSize: uploadDoc.fileSize,
    storagePath: uploadDoc.storagePath,
    downloadUrl: uploadDoc.downloadUrl || ''
  };
}

function formatFileFieldDisplayValue(value) {
  if (!value || typeof value !== 'object') return '';
  return String(value.fileName || value.uploadToken || '').trim();
}

module.exports = {
  WEBFORM_FILE_SCAN_STATUSES,
  MAX_WEBFORM_FILE_SIZE_BYTES,
  isWebformFileFieldType,
  isFileFieldValueEmpty,
  sanitizeClientFileFieldValue,
  buildStoredFileFieldValue,
  formatFileFieldDisplayValue
};
