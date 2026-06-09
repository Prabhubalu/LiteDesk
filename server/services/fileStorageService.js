/**
 * Unified file storage — all product uploads go to OCI Object Storage (S3-compatible API).
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const objectStorage = require('./objectStorageService');

const uploadsDir = path.join(__dirname, '../uploads');

const OCI_PREFIX = 'oci:';
const UPLOADS_KEY_PREFIX = 'uploads/';

const MAX_FILE_SIZE = parseInt(process.env.MAX_EVIDENCE_FILE_SIZE || '10485760', 10);
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/x-pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/octet-stream'
];

function isOciStoragePath(storagePath) {
  return String(storagePath || '').startsWith(OCI_PREFIX);
}

function safeOrgId(orgId) {
  return String(orgId || 'public').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function safeCategory(category) {
  return String(category || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildObjectKey({ organizationId, category, fileName }) {
  const base = safeFileName(fileName);
  return `${UPLOADS_KEY_PREFIX}${safeOrgId(organizationId)}/${safeCategory(category)}/${Date.now()}-${uuidv4()}-${base}`;
}

function buildDownloadUrl(storagePath, { disposition = 'inline', fileName, contentType } = {}) {
  const q = new URLSearchParams({
    storagePath: String(storagePath),
    disposition: disposition === 'attachment' ? 'attachment' : 'inline'
  });
  if (fileName) q.set('fileName', String(fileName));
  if (contentType) q.set('contentType', String(contentType));
  return `/api/files/download?${q.toString()}`;
}

function parseStoragePath(storagePath) {
  const raw = String(storagePath || '').trim();
  if (!raw) return null;
  if (isOciStoragePath(raw)) {
    return { driver: 'oci', key: raw.slice(OCI_PREFIX.length) };
  }
  if (raw.startsWith('/api/files/download')) {
    try {
      const url = new URL(raw, 'http://local');
      const nested = url.searchParams.get('storagePath');
      if (nested) return parseStoragePath(nested);
    } catch {
      return null;
    }
  }
  if (raw.startsWith('/api/uploads/')) {
    const rel = raw.slice('/api/uploads/'.length);
    return { driver: 'local', relativePath: rel };
  }
  if (!raw.includes('://') && !raw.startsWith('/')) {
    return { driver: 'local', relativePath: raw };
  }
  return null;
}

function assertOrgAccessToKey(key, organizationId) {
  if (!organizationId) {
    const err = new Error('Organization context missing');
    err.statusCode = 403;
    throw err;
  }
  const safeOrg = safeOrgId(organizationId);
  const rawOrg = String(organizationId);
  const allowedPrefixes = [
    `${UPLOADS_KEY_PREFIX}${safeOrg}/`,
    `attachments/${safeOrg}/`,
    `${String(process.env.MAILROOM_ATTACHMENTS_PREFIX || 'mailroom').trim() || 'mailroom'}/${rawOrg}/`,
    `${String(process.env.MAILROOM_ATTACHMENTS_PREFIX || 'mailroom').trim() || 'mailroom'}/${safeOrg}/`
  ];
  if (!allowedPrefixes.some((prefix) => key.startsWith(prefix))) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function resolveLegacyLocalPath(storagePath) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed || parsed.driver !== 'local' || !parsed.relativePath) return null;
  const rel = parsed.relativePath.replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return null;
  const filePath = path.join(uploadsDir, rel);
  const normalizedUploads = path.resolve(uploadsDir);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedUploads + path.sep) && normalizedFile !== normalizedUploads) {
    return null;
  }
  if (!fs.existsSync(normalizedFile)) return null;
  return normalizedFile;
}

function validateFile(file) {
  if (!file) {
    throw new Error('File is required');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
  }
  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }
}

async function uploadBuffer({
  buffer,
  originalName,
  mimeType,
  organizationId,
  category = 'general',
  metadata = {}
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('File buffer is required');
  }
  const key = buildObjectKey({ organizationId, category, fileName: originalName });
  await objectStorage.putBuffer({
    key,
    buffer,
    contentType: mimeType || 'application/octet-stream',
    metadata: {
      originalname: safeFileName(originalName),
      ...metadata
    }
  });
  const storagePath = `${OCI_PREFIX}${key}`;
  return {
    storagePath,
    url: buildDownloadUrl(storagePath, {
      disposition: 'inline',
      fileName: originalName,
      contentType: mimeType
    }),
    downloadUrl: buildDownloadUrl(storagePath, {
      disposition: 'attachment',
      fileName: originalName,
      contentType: mimeType
    }),
    fileName: originalName,
    storedFileName: path.basename(key),
    fileSize: buffer.length,
    mimeType: mimeType || 'application/octet-stream',
    objectKey: key
  };
}

async function uploadMulterFile(file, context = {}) {
  if (!file?.buffer) {
    throw new Error('File buffer is required (use multer memory storage)');
  }
  validateFile(file);
  return uploadBuffer({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    organizationId: context.organizationId,
    category: context.category || 'general',
    metadata: context.metadata
  });
}

async function persistMulterUpload(req, category = 'general') {
  if (!req.file) {
    throw new Error('No file uploaded');
  }
  return uploadMulterFile(req.file, {
    organizationId: req.user?.organizationId,
    category
  });
}

async function getObjectBuffer(storagePath) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) return null;
  if (parsed.driver === 'oci') {
    return objectStorage.getBuffer({ key: parsed.key });
  }
  const localPath = resolveLegacyLocalPath(storagePath);
  if (!localPath) return null;
  return fs.promises.readFile(localPath);
}

function assertDeletableProductUploadKey(key, organizationId) {
  assertOrgAccessToKey(key, organizationId);
  const safeOrg = safeOrgId(organizationId);
  if (!key.startsWith(`${UPLOADS_KEY_PREFIX}${safeOrg}/`)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

async function deleteStoredUpload({ storagePath, organizationId }) {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) {
    const err = new Error('Invalid storage path');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.driver === 'oci') {
    assertDeletableProductUploadKey(parsed.key, organizationId);
    await objectStorage.deleteObject({ key: parsed.key });
    return { deleted: true, driver: 'oci' };
  }

  const localPath = resolveLegacyLocalPath(storagePath);
  if (!localPath) {
    return { deleted: false, driver: 'local', reason: 'not_found' };
  }
  await fs.promises.unlink(localPath);
  return { deleted: true, driver: 'local' };
}

function resolveStoragePathFromClientRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith(OCI_PREFIX)) return raw;
  const parsed = parseStoragePath(raw);
  if (parsed?.driver === 'oci') return `${OCI_PREFIX}${parsed.key}`;
  if (parsed?.driver === 'local' && parsed.relativePath) {
    return `/api/uploads/${parsed.relativePath}`;
  }
  return null;
}

module.exports = {
  OCI_PREFIX,
  UPLOADS_KEY_PREFIX,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  isOciStoragePath,
  safeOrgId,
  safeFileName,
  buildObjectKey,
  buildDownloadUrl,
  parseStoragePath,
  assertOrgAccessToKey,
  resolveLegacyLocalPath,
  validateFile,
  uploadBuffer,
  uploadMulterFile,
  persistMulterUpload,
  getObjectBuffer,
  deleteStoredUpload,
  resolveStoragePathFromClientRef
};
