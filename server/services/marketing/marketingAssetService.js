'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const MarketingAsset = require('../../models/MarketingAsset');
const { MARKETING_ASSET_TYPES } = require('../../constants/marketingAssetConstants');
const fileStorage = require('../fileStorageService');
const {
  computeChecksum,
  readImageDimensions
} = require('../contentPlatform/contentAssetService');

const IMAGE_MIME_PREFIX = 'image/';

class MarketingAssetError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'MarketingAssetError';
    this.statusCode = statusCode;
  }
}

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

function generateAssetId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function inferAssetType(mimeType, requestedType) {
  if (requestedType && MARKETING_ASSET_TYPES.includes(requestedType)) {
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
    if (!payload.type || !MARKETING_ASSET_TYPES.includes(payload.type)) {
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
    MarketingAsset.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    MarketingAsset.countDocuments(query)
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

function buildAssetLookupFilter(organizationId, assetId) {
  const id = String(assetId || '').trim();
  const filter = {
    organizationId,
    ...notDeletedFilter(),
  };
  const or = [{ assetId: id }];
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    or.unshift({ _id: id });
  }
  filter.$or = or;
  return filter;
}

async function getAssetById(params) {
  const { organizationId, assetId } = params;
  const asset = await MarketingAsset.findOne(buildAssetLookupFilter(organizationId, assetId)).lean();

  if (!asset) {
    throw new MarketingAssetError('Asset not found', 404);
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
    accessibilityAltText = ''
  } = params;

  if (!file?.buffer) {
    throw new MarketingAssetError('File is required', 400);
  }

  fileStorage.validateFile(file);

  const mimeType = String(file.mimetype || '');
  if (!mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new MarketingAssetError('Only image uploads are supported', 400);
  }

  const assetType = inferAssetType(file.mimetype, type);
  const validation = validateAssetPayload({
    type: assetType,
    accessibilityAltText
  });
  if (!validation.valid) {
    throw new MarketingAssetError('Asset validation failed', 400);
  }

  const uploadResult = await fileStorage.uploadMulterFile(file, {
    organizationId,
    category: 'marketing-assets',
    metadata: { assetType }
  });

  const dimensions = readImageDimensions(file.buffer, file.mimetype);
  const checksum = computeChecksum(file.buffer);

  const asset = await MarketingAsset.create({
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

  return withAssetUrls(asset);
}

async function updateAssetMetadata(params) {
  const {
    organizationId,
    assetId,
    payload = {}
  } = params;

  const asset = await MarketingAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  });

  if (!asset) {
    throw new MarketingAssetError('Asset not found', 404);
  }

  const validation = validateAssetPayload(payload, { partial: true });
  if (!validation.valid) {
    throw new MarketingAssetError('Asset validation failed', 400);
  }

  if (payload.type !== undefined) asset.type = payload.type;
  if (payload.accessibilityAltText !== undefined) {
    asset.accessibilityAltText = String(payload.accessibilityAltText || '').trim();
  }
  if (payload.tags !== undefined) asset.tags = normalizeTags(payload.tags);

  await asset.save();
  return withAssetUrls(asset);
}

async function deleteAsset(params) {
  const { organizationId, assetId } = params;

  const asset = await MarketingAsset.findOne({
    organizationId,
    ...notDeletedFilter(),
    $or: [{ _id: assetId }, { assetId }]
  });

  if (!asset) {
    throw new MarketingAssetError('Asset not found', 404);
  }

  asset.deletedAt = new Date();
  await asset.save();

  return { id: asset._id, deleted: true };
}

module.exports = {
  MarketingAssetError,
  withAssetUrls,
  inferAssetType,
  validateAssetPayload,
  listAssets,
  getAssetById,
  uploadAsset,
  updateAssetMetadata,
  deleteAsset
};
