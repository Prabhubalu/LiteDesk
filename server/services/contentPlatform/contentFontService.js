'use strict';

const ContentFont = require('../../models/ContentFont');
const { CONTENT_FONT_SOURCES } = require('../../constants/contentPlatformConstants');
const fileStorage = require('../fileStorageService');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { writeContentAuditLog } = require('./contentPlatformEventService');

const GOOGLE_FONT_ALLOWLIST = new Set([
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Inter',
  'Poppins',
  'Nunito',
  'Source Sans 3',
  'Merriweather',
  'Playfair Display'
]);

const SYSTEM_FONT_ALLOWLIST = new Set([
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma'
]);

function notDeletedFilter() {
  return { deletedAt: null };
}

function formatFont(font) {
  if (!font) return font;
  return typeof font.toObject === 'function' ? font.toObject() : font;
}

function normalizeFontName(value) {
  return String(value || '').trim();
}

function validateFontPayload(payload, { partial = false, requireSource = true } = {}) {
  const issues = [];

  if (!partial || payload.fontName != null) {
    if (!normalizeFontName(payload.fontName)) {
      issues.push({ path: 'fontName', message: 'Font name is required' });
    }
  }

  if (requireSource && (!partial || payload.source != null)) {
    if (!payload.source || !CONTENT_FONT_SOURCES.includes(payload.source)) {
      issues.push({ path: 'source', message: 'Valid font source is required' });
    }
  }

  if (!partial || payload.fallback != null) {
    if (payload.fallback != null && typeof payload.fallback !== 'string') {
      issues.push({ path: 'fallback', message: 'Fallback must be a string' });
    }
  }

  return { valid: issues.length === 0, errors: issues };
}

function assertAllowedCatalogFont(source, fontName) {
  if (source === 'google' && !GOOGLE_FONT_ALLOWLIST.has(fontName)) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Google font is not in the allowlist',
      {
        statusCode: 400,
        details: [{ path: 'fontName', message: `Unsupported Google font: ${fontName}` }]
      }
    );
  }

  if (source === 'system' && !SYSTEM_FONT_ALLOWLIST.has(fontName)) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'System font is not in the allowlist',
      {
        statusCode: 400,
        details: [{ path: 'fontName', message: `Unsupported system font: ${fontName}` }]
      }
    );
  }
}

async function listFonts(params) {
  const {
    organizationId,
    page = 1,
    limit = 20,
    source,
    search
  } = params;

  const query = {
    organizationId,
    ...notDeletedFilter()
  };

  if (source) query.source = source;
  if (search) {
    query.fontName = { $regex: search, $options: 'i' };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ContentFont.find(query).sort({ fontName: 1 }).skip(skip).limit(safeLimit).lean(),
    ContentFont.countDocuments(query)
  ]);

  return {
    items: items.map(formatFont),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

async function getFontById(params) {
  const { organizationId, fontId } = params;
  const font = await ContentFont.findOne({
    _id: fontId,
    organizationId,
    ...notDeletedFilter()
  }).lean();

  if (!font) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Font not found',
      { statusCode: 404 }
    );
  }

  return formatFont(font);
}

async function registerFont(params) {
  const {
    organizationId,
    userId,
    payload = {},
    ipAddress = null
  } = params;

  const fontName = normalizeFontName(payload.fontName);
  const source = payload.source;

  const validation = validateFontPayload({ ...payload, fontName, source });
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Font validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  if (source === 'upload') {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Uploaded fonts must use the upload endpoint',
      { statusCode: 400, details: [{ path: 'source', message: 'Use POST /content/fonts/upload' }] }
    );
  }

  assertAllowedCatalogFont(source, fontName);

  const existing = await ContentFont.findOne({
    organizationId,
    fontName,
    ...notDeletedFilter()
  }).lean();

  if (existing) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.CONFLICT,
      'Font already registered for this organization',
      { statusCode: 409 }
    );
  }

  const font = await ContentFont.create({
    organizationId,
    fontName,
    source,
    license: String(payload.license || '').trim(),
    fallback: String(payload.fallback || 'sans-serif').trim(),
    unicodeRanges: String(payload.unicodeRanges || '').trim(),
    createdBy: userId
  });

  await writeContentAuditLog({
    organizationId,
    action: 'asset.uploaded',
    entityType: 'content_font',
    entityId: font._id,
    userId,
    after: formatFont(font),
    ipAddress
  });

  return formatFont(font);
}

async function uploadFont(params) {
  const {
    organizationId,
    userId,
    file,
    fontName,
    fallback = 'sans-serif',
    license = '',
    ipAddress = null
  } = params;

  const normalizedName = normalizeFontName(fontName || file?.originalname?.replace(/\.[^.]+$/, ''));
  const validation = validateFontPayload({
    fontName: normalizedName,
    source: 'upload',
    fallback
  });

  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Font validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  if (!file?.buffer) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'File is required',
      { statusCode: 400, details: [{ path: 'file', message: 'Required' }] }
    );
  }

  fileStorage.validateFile(file);

  const uploadResult = await fileStorage.uploadMulterFile(file, {
    organizationId,
    category: 'content-fonts',
    metadata: { fontName: normalizedName }
  });

  let font = await ContentFont.findOne({
    organizationId,
    fontName: normalizedName,
    ...notDeletedFilter()
  });

  const before = font ? formatFont(font) : null;

  if (font) {
    font.source = 'upload';
    font.storageKey = uploadResult.storagePath;
    font.license = String(license || font.license || '').trim();
    font.fallback = String(fallback || font.fallback || 'sans-serif').trim();
    await font.save();
  } else {
    font = await ContentFont.create({
      organizationId,
      fontName: normalizedName,
      source: 'upload',
      license: String(license || '').trim(),
      fallback: String(fallback || 'sans-serif').trim(),
      storageKey: uploadResult.storagePath,
      createdBy: userId
    });
  }

  const after = formatFont(font);

  await writeContentAuditLog({
    organizationId,
    action: 'asset.uploaded',
    entityType: 'content_font',
    entityId: font._id,
    userId,
    before,
    after,
    metadata: { uploaded: true },
    ipAddress
  });

  return after;
}

async function deleteFont(params) {
  const { organizationId, fontId, userId, ipAddress = null } = params;

  const font = await ContentFont.findOne({
    _id: fontId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!font) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Font not found',
      { statusCode: 404 }
    );
  }

  const before = formatFont(font);
  font.deletedAt = new Date();
  await font.save();

  await writeContentAuditLog({
    organizationId,
    action: 'asset.deleted',
    entityType: 'content_font',
    entityId: font._id,
    userId,
    before,
    ipAddress
  });

  return { id: font._id, deleted: true };
}

function listCatalogFonts() {
  return {
    google: [...GOOGLE_FONT_ALLOWLIST].sort(),
    system: [...SYSTEM_FONT_ALLOWLIST].sort()
  };
}

module.exports = {
  GOOGLE_FONT_ALLOWLIST,
  SYSTEM_FONT_ALLOWLIST,
  validateFontPayload,
  assertAllowedCatalogFont,
  listFonts,
  getFontById,
  registerFont,
  uploadFont,
  deleteFont,
  listCatalogFonts
};
