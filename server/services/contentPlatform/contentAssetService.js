'use strict';

const crypto = require('crypto');
const ContentAsset = require('../../models/ContentAsset');
const { CONTENT_ASSET_TYPES } = require('../../constants/contentPlatformConstants');
const fileStorage = require('../fileStorageService');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { writeContentAuditLog } = require('./contentPlatformEventService');

const IMAGE_MIME_PREFIX = 'image/';

function notDeletedFilter() {
  return { deletedAt: null };
}

function formatAsset(asset) {
  if (!asset) return asset;
  return typeof asset.toObject === 'function' ? asset.toObject() : asset;
}

function withAssetUrls(asset) {
  const formatted = formatAsset(asset);
  if (!formatted?.storageKey) return formatted;
  return {
    ...formatted,
    downloadUrl: fileStorage.buildDownloadUrl(formatted.storageKey, {
      disposition: 'inline',
      fileName: formatted.filename,
      contentType: formatted.mimeType
    })
  };
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function generateAssetId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
function readImageDimensions(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return { width: null, height: null };

  if (mimeType === 'image/png' && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && buffer.length > 4) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }
      offset += 2 + length;
    }
  }

  return { width: null, height: null };
}

function inferAssetType(mimeType, requestedType) {
  if (requestedType && CONTENT_ASSET_TYPES.includes(requestedType)) {
    return requestedType;
  }
  if (mimeType === 'image/svg+xml') return 'svg';
  if (String(mimeType || '').startsWith(IMAGE_MIME_PREFIX)) return 'image';
  return 'image';
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function validateAssetPayload(payload, { partial = false } = {}) {
  const issues = [];

  if (!partial || payload.type != null) {
    if (!payload.type || !CONTENT_ASSET_TYPES.includes(payload.type)) {
      issues.push({ path: 'type', message: 'Valid asset type is required' });
    }
  }

  if (!partial || payload.accessibilityAltText != null) {
    if (payload.accessibilityAltText != null && typeof payload.accessibilityAltText !== 'string') {
      issues.push({ path: 'accessibilityAltText', message: 'Alt text must be a string' });
    }
  }

  return { valid: issues.length === 0, errors: issues };
}

async function listAssets(params) {
  const {
    organizationId,
    page = 1,
    limit = 20,
    type,
    search,
    tag
  } = params;

  const query = {
    organizationId,
    ...notDeletedFilter()
  };

  if (type) query.type = type;
  if (tag) query.tags = tag;
  if (search) {
    query.$or = [
      { filename: { $regex: search, $options: 'i' } },
      { assetId: { $regex: search, $options: 'i' } }
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ContentAsset.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ContentAsset.countDocuments(query)
  ]);

  return {
    items: items.map(withAssetUrls),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

async function getAssetById(params) {
  const { organizationId, assetId } = params;
  const asset = await ContentAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  }).lean();

  if (!asset) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Asset not found',
      { statusCode: 404 }
    );
  }

  return withAssetUrls(asset);
}

async function uploadAsset(params) {
  const {
    organizationId,
    userId,
    file,
    type,
    tags = [],
    accessibilityAltText = '',
    ipAddress = null
  } = params;

  if (!file?.buffer) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'File is required',
      { statusCode: 400, details: [{ path: 'file', message: 'Required' }] }
    );
  }

  fileStorage.validateFile(file);

  const assetType = inferAssetType(file.mimetype, type);
  const validation = validateAssetPayload({
    type: assetType,
    accessibilityAltText
  });
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Asset validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  const uploadResult = await fileStorage.uploadMulterFile(file, {
    organizationId,
    category: 'content-assets',
    metadata: { assetType }
  });

  const dimensions = readImageDimensions(file.buffer, file.mimetype);
  const checksum = computeChecksum(file.buffer);

  const asset = await ContentAsset.create({
    organizationId,
    assetId: generateAssetId(),
    type: assetType,
    mimeType: uploadResult.mimeType || file.mimetype,
    filename: uploadResult.fileName || file.originalname,
    storageKey: uploadResult.storagePath,
    width: dimensions.width,
    height: dimensions.height,
    checksum,
    accessibilityAltText: String(accessibilityAltText || '').trim(),
    tags: normalizeTags(tags),
    version: 1,
    createdBy: userId
  });

  await writeContentAuditLog({
    organizationId,
    action: 'asset.uploaded',
    entityType: 'content_asset',
    entityId: asset._id,
    userId,
    after: formatAsset(asset),
    ipAddress
  });

  return withAssetUrls(asset);
}

async function replaceAssetFile(params) {
  const {
    organizationId,
    assetId,
    userId,
    file,
    ipAddress = null
  } = params;

  const asset = await ContentAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  });

  if (!asset) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Asset not found',
      { statusCode: 404 }
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
    category: 'content-assets',
    metadata: { assetType: asset.type, replaced: true }
  });

  const before = formatAsset(asset);
  const dimensions = readImageDimensions(file.buffer, file.mimetype);

  asset.mimeType = uploadResult.mimeType || file.mimetype;
  asset.filename = uploadResult.fileName || file.originalname;
  asset.storageKey = uploadResult.storagePath;
  asset.width = dimensions.width;
  asset.height = dimensions.height;
  asset.checksum = computeChecksum(file.buffer);
  asset.version = (asset.version || 1) + 1;
  await asset.save();

  const after = formatAsset(asset);

  await writeContentAuditLog({
    organizationId,
    action: 'asset.uploaded',
    entityType: 'content_asset',
    entityId: asset._id,
    userId,
    before,
    after,
    metadata: { replaced: true },
    ipAddress
  });

  return withAssetUrls(asset);
}

async function updateAssetMetadata(params) {
  const {
    organizationId,
    assetId,
    userId,
    payload = {},
    ipAddress = null
  } = params;

  const asset = await ContentAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  });

  if (!asset) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Asset not found',
      { statusCode: 404 }
    );
  }

  const validation = validateAssetPayload(payload, { partial: true });
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Asset validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  const before = formatAsset(asset);

  if (payload.type !== undefined) asset.type = payload.type;
  if (payload.accessibilityAltText !== undefined) {
    asset.accessibilityAltText = String(payload.accessibilityAltText || '').trim();
  }
  if (payload.tags !== undefined) asset.tags = normalizeTags(payload.tags);

  await asset.save();

  await writeContentAuditLog({
    organizationId,
    action: 'asset.uploaded',
    entityType: 'content_asset',
    entityId: asset._id,
    userId,
    before,
    after: formatAsset(asset),
    metadata: { metadataUpdate: true },
    ipAddress
  });

  return withAssetUrls(asset);
}

async function deleteAsset(params) {
  const { organizationId, assetId, userId, ipAddress = null } = params;

  const asset = await ContentAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  });

  if (!asset) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Asset not found',
      { statusCode: 404 }
    );
  }

  const before = formatAsset(asset);
  asset.deletedAt = new Date();
  await asset.save();

  await writeContentAuditLog({
    organizationId,
    action: 'asset.deleted',
    entityType: 'content_asset',
    entityId: asset._id,
    userId,
    before,
    ipAddress
  });

  return { id: asset._id, deleted: true };
}

module.exports = {
  computeChecksum,
  readImageDimensions,
  inferAssetType,
  validateAssetPayload,
  listAssets,
  getAssetById,
  uploadAsset,
  replaceAssetFile,
  updateAssetMetadata,
  deleteAsset
};
