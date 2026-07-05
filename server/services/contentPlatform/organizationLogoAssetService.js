'use strict';

const fs = require('fs');
const path = require('path');
const Organization = require('../../models/Organization');
const ContentAsset = require('../../models/ContentAsset');
const fileStorage = require('../fileStorageService');
const { resolveUploadLogoSource } = require('../quoteBrandingService');
const {
  computeChecksum,
  readImageDimensions,
  inferAssetType
} = require('./contentAssetService');
const { writeContentAuditLog } = require('./contentPlatformEventService');

const COMPANY_LOGO_TAG = 'company-logo';
const SOURCE_TAG_PREFIX = 'source:';

function withAssetUrls(asset) {
  if (!asset?.storageKey) return asset;
  return {
    ...asset,
    downloadUrl: fileStorage.buildDownloadUrl(asset.storageKey, {
      disposition: 'inline',
      fileName: asset.filename,
      contentType: asset.mimeType
    })
  };
}

function sourceTagForUrl(url) {
  return `${SOURCE_TAG_PREFIX}${String(url || '').trim()}`;
}

function inferLogoFilename(logoUrl, mimeType) {
  const extFromMime = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  };
  const fromUrl = path.extname(String(logoUrl || '').split('?')[0]).toLowerCase();
  if (fromUrl && ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(fromUrl)) {
    return `company-logo${fromUrl}`;
  }
  const ext = extFromMime[String(mimeType || '').toLowerCase()] || '.png';
  return `company-logo${ext}`;
}

function mimeFromBuffer(buffer, filename) {
  const head = buffer.slice(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml';
  }
  const ext = path.extname(String(filename || '').split('?')[0]).toLowerCase();
  const byExt = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return byExt[ext] || 'image/png';
}

async function readOrganizationLogoBuffer(logoUrl, organizationId) {
  const trimmed = String(logoUrl || '').trim();
  if (!trimmed) return null;

  const parsed = fileStorage.parseStoragePath(trimmed);
  if (parsed) {
    const buffer = await fileStorage.getObjectBuffer(trimmed);
    if (buffer?.length) return buffer;
  }

  const source = await resolveUploadLogoSource(trimmed, organizationId);
  if (!source) return null;
  if (Buffer.isBuffer(source)) return source;
  if (typeof source === 'string' && fs.existsSync(source)) {
    return fs.promises.readFile(source);
  }
  return null;
}

async function storageObjectExists(storageKey) {
  if (!storageKey) return false;
  try {
    const buffer = await fileStorage.getObjectBuffer(storageKey);
    return Boolean(buffer?.length);
  } catch {
    return false;
  }
}

async function findCompanyLogoAsset(organizationId) {
  const byTag = await ContentAsset.findOne({
    organizationId,
    deletedAt: null,
    tags: COMPANY_LOGO_TAG
  }).lean();
  if (byTag) return byTag;

  return ContentAsset.findOne({
    organizationId,
    deletedAt: null,
    assetId: `company-logo-${organizationId}`
  }).lean();
}

/**
 * Sync tenant organization.settings.logoUrl into the content asset library.
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string|null} [params.userId]
 */
async function ensureCompanyLogoAsset(params) {
  const { organizationId, userId = null } = params;
  const org = await Organization.findById(organizationId)
    .select('name settings.logoUrl')
    .lean();

  const organizationLogoUrl = String(org?.settings?.logoUrl || '').trim();
  if (!organizationLogoUrl) {
    return {
      asset: null,
      organizationLogoUrl: null,
      organizationName: String(org?.name || '').trim()
    };
  }

  const expectedSourceTag = sourceTagForUrl(organizationLogoUrl);
  const existing = await findCompanyLogoAsset(organizationId);
  if (existing?.tags?.includes(expectedSourceTag)) {
    if (await storageObjectExists(existing.storageKey)) {
      return {
        asset: withAssetUrls(existing),
        organizationLogoUrl,
        organizationName: String(org?.name || '').trim()
      };
    }
  }

  const buffer = await readOrganizationLogoBuffer(organizationLogoUrl, organizationId);
  if (!buffer?.length) {
    if (existing && await storageObjectExists(existing.storageKey)) {
      return {
        asset: withAssetUrls(existing),
        organizationLogoUrl,
        organizationName: String(org?.name || '').trim()
      };
    }
    return {
      asset: null,
      organizationLogoUrl,
      organizationName: String(org?.name || '').trim()
    };
  }

  const logoFilename = inferLogoFilename(organizationLogoUrl, null);
  const mimeType = fileStorage.resolveUploadMimeType({
    originalname: logoFilename
  }) || mimeFromBuffer(buffer, logoFilename);

  const uploadResult = await fileStorage.uploadBuffer({
    buffer,
    originalName: inferLogoFilename(organizationLogoUrl, mimeType),
    mimeType,
    organizationId,
    category: 'content-assets',
    metadata: { assetType: 'logo', companyLogo: 'true' }
  });

  const dimensions = readImageDimensions(buffer, mimeType);
  const checksum = computeChecksum(buffer);
  const tags = [COMPANY_LOGO_TAG, expectedSourceTag];
  const altText = String(org?.name || 'Company logo').trim() || 'Company logo';

  let asset;
  if (existing) {
    const doc = await ContentAsset.findOne({ _id: existing._id, organizationId });
    if (!doc) {
      asset = null;
    } else {
      const before = doc.toObject();
      doc.type = inferAssetType(mimeType, 'image');
      doc.mimeType = uploadResult.mimeType || mimeType;
      doc.filename = uploadResult.fileName || inferLogoFilename(organizationLogoUrl, mimeType);
      doc.storageKey = uploadResult.storagePath;
      doc.width = dimensions.width;
      doc.height = dimensions.height;
      doc.checksum = checksum;
      doc.accessibilityAltText = altText;
      doc.tags = tags;
      doc.version = (doc.version || 1) + 1;
      await doc.save();
      asset = doc.toObject();
      await writeContentAuditLog({
        organizationId,
        action: 'asset.uploaded',
        entityType: 'content_asset',
        entityId: doc._id,
        userId,
        before,
        after: asset,
        metadata: { companyLogo: 'true', replaced: 'true' }
      });
    }
  } else {
    try {
      asset = await ContentAsset.create({
        organizationId,
        assetId: `company-logo-${organizationId}`,
        type: inferAssetType(mimeType, 'image'),
        mimeType: uploadResult.mimeType || mimeType,
        filename: uploadResult.fileName || inferLogoFilename(organizationLogoUrl, mimeType),
        storageKey: uploadResult.storagePath,
        width: dimensions.width,
        height: dimensions.height,
        checksum,
        accessibilityAltText: altText,
        tags,
        version: 1,
        createdBy: userId
      });
      asset = typeof asset.toObject === 'function' ? asset.toObject() : asset;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const doc = await ContentAsset.findOne({
        organizationId,
        assetId: `company-logo-${organizationId}`
      });
      if (!doc) throw error;
      doc.type = inferAssetType(mimeType, 'image');
      doc.mimeType = uploadResult.mimeType || mimeType;
      doc.filename = uploadResult.fileName || inferLogoFilename(organizationLogoUrl, mimeType);
      doc.storageKey = uploadResult.storagePath;
      doc.width = dimensions.width;
      doc.height = dimensions.height;
      doc.checksum = checksum;
      doc.accessibilityAltText = altText;
      doc.tags = tags;
      doc.deletedAt = null;
      doc.version = (doc.version || 1) + 1;
      await doc.save();
      asset = doc.toObject();
    }

    await writeContentAuditLog({
      organizationId,
      action: 'asset.uploaded',
      entityType: 'content_asset',
      entityId: asset._id,
      userId,
      after: asset,
      metadata: { companyLogo: 'true' }
    });
  }

  return {
    asset: asset ? withAssetUrls(asset) : null,
    organizationLogoUrl,
    organizationName: String(org?.name || '').trim()
  };
}

module.exports = {
  COMPANY_LOGO_TAG,
  ensureCompanyLogoAsset,
  withAssetUrls
};
