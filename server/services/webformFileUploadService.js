'use strict';

const { v4: uuidv4 } = require('uuid');
const WebformUpload = require('../models/WebformUpload');
const fileStorage = require('./fileStorageService');
const {
  isWebformFileFieldType,
  isFileFieldValueEmpty,
  sanitizeClientFileFieldValue,
  buildStoredFileFieldValue,
  MAX_WEBFORM_FILE_SIZE_BYTES
} = require('../constants/webformFileFields');
const { isWebformFileScanEnabled, scanWebformUploadBuffer } = require('./webformFileScanService');

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

function findFileField(webform, fieldId) {
  const fields = Array.isArray(webform?.fields) ? webform.fields : [];
  if (fieldId) {
    return fields.find((field) => String(field.fieldId) === String(fieldId)) || null;
  }
  return null;
}

async function uploadPublicWebformFile({ webform, file, fieldId, ipAddress }) {
  if (!webform?._id || !webform?.organizationId) {
    const error = new Error('Webform is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!file?.buffer) {
    const error = new Error('File is required.');
    error.statusCode = 400;
    throw error;
  }
  if (file.size > MAX_WEBFORM_FILE_SIZE_BYTES) {
    const error = new Error('File exceeds maximum allowed size (10 MB).');
    error.statusCode = 400;
    throw error;
  }

  const normalizedFieldId = String(fieldId || '').trim();
  if (normalizedFieldId) {
    const field = findFileField(webform, normalizedFieldId);
    if (!field || !isWebformFileFieldType(field.type)) {
      const error = new Error('Invalid file field.');
      error.statusCode = 400;
      throw error;
    }
  }

  const scanResult = isWebformFileScanEnabled()
    ? await scanWebformUploadBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname
    })
    : { status: 'skipped', provider: 'noop', detail: 'scan_disabled' };

  if (scanResult.status === 'infected') {
    const error = new Error('File failed security scan.');
    error.statusCode = 422;
    throw error;
  }
  if (scanResult.status === 'failed' && isWebformFileScanEnabled()) {
    const error = new Error('Unable to verify file safety.');
    error.statusCode = 422;
    throw error;
  }

  const uploadResult = await fileStorage.uploadMulterFile(file, {
    organizationId: webform.organizationId,
    category: `webforms/${String(webform._id)}`,
    metadata: {
      webformId: String(webform._id),
      fieldId: normalizedFieldId
    }
  });

  const uploadToken = uuidv4();
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  const scanStatus = scanResult.status === 'clean' ? 'clean' : 'skipped';

  await WebformUpload.create({
    organizationId: webform.organizationId,
    webformId: webform._id,
    uploadToken,
    fieldId: normalizedFieldId,
    storagePath: uploadResult.storagePath,
    downloadUrl: uploadResult.downloadUrl || uploadResult.url,
    fileName: uploadResult.fileName || file.originalname,
    mimeType: uploadResult.mimeType || file.mimetype,
    fileSize: uploadResult.fileSize || file.size,
    scanStatus,
    scanMeta: {
      provider: scanResult.provider,
      detail: scanResult.detail,
      scannedAt: new Date()
    },
    expiresAt,
    ipAddress: String(ipAddress || '').trim()
  });

  return {
    uploadToken,
    fileName: uploadResult.fileName || file.originalname,
    mimeType: uploadResult.mimeType || file.mimetype,
    fileSize: uploadResult.fileSize || file.size
  };
}

async function resolveUploadToken({ webformId, organizationId, uploadToken, fieldId }) {
  const row = await WebformUpload.findOne({
    webformId,
    organizationId,
    uploadToken: String(uploadToken || '').trim(),
    consumedAt: null
  });

  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  if (row.scanStatus === 'infected') return null;
  if (isWebformFileScanEnabled() && row.scanStatus === 'failed') return null;

  const normalizedFieldId = String(fieldId || '').trim();
  if (normalizedFieldId && row.fieldId && row.fieldId !== normalizedFieldId) {
    return null;
  }

  return row;
}

async function resolveWebformFileFieldValues(webform, fieldValues, organizationId) {
  const values = fieldValues && typeof fieldValues === 'object' && !Array.isArray(fieldValues)
    ? { ...fieldValues }
    : {};
  const fields = Array.isArray(webform?.fields) ? webform.fields : [];

  for (const field of fields) {
    if (!isWebformFileFieldType(field.type)) continue;

    const clientValue = sanitizeClientFileFieldValue(values[field.fieldId]);
    if (!clientValue) {
      values[field.fieldId] = clientValue;
      continue;
    }

    const upload = await resolveUploadToken({
      webformId: webform._id,
      organizationId,
      uploadToken: clientValue.uploadToken,
      fieldId: field.fieldId
    });

    if (!upload) {
      const error = new Error(`Uploaded file for "${field.label}" is invalid or expired.`);
      error.statusCode = 400;
      error.fieldId = field.fieldId;
      throw error;
    }

    values[field.fieldId] = buildStoredFileFieldValue(upload);
  }

  return values;
}

async function consumeWebformUploads({ webformId, organizationId, fieldValues, submissionId }) {
  const tokens = [];
  const values = fieldValues && typeof fieldValues === 'object' ? fieldValues : {};

  for (const value of Object.values(values)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const token = String(value.uploadToken || '').trim();
    if (token) tokens.push(token);
  }

  if (!tokens.length) return;

  await WebformUpload.updateMany(
    {
      webformId,
      organizationId,
      uploadToken: { $in: tokens },
      consumedAt: null
    },
    {
      $set: {
        consumedAt: new Date(),
        submissionId: submissionId || null
      }
    }
  );
}

module.exports = {
  uploadPublicWebformFile,
  resolveWebformFileFieldValues,
  consumeWebformUploads,
  isFileFieldValueEmpty
};
