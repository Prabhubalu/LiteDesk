'use strict';

const contentAssetService = require('../services/contentPlatform/contentAssetService');
const { ensureCompanyLogoAsset } = require('../services/contentPlatform/organizationLogoAssetService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    ipAddress: req.ip || null
  };
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

exports.getCompanyLogoAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await ensureCompanyLogoAsset({
      organizationId: ctx.organizationId,
      userId: ctx.userId
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load company logo asset');
  }
};

exports.listAssets = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentAssetService.listAssets({
      organizationId: ctx.organizationId,
      page: req.query.page,
      limit: req.query.limit,
      type: req.query.type,
      search: req.query.search,
      tag: req.query.tag
    });
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list assets');
  }
};

exports.getAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await contentAssetService.getAssetById({
      organizationId: ctx.organizationId,
      assetId: req.params.id
    });
    return res.json({ success: true, data: asset });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to get asset');
  }
};

exports.uploadAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await contentAssetService.uploadAsset({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      file: req.file,
      type: req.body?.type,
      tags: parseTags(req.body?.tags),
      accessibilityAltText: req.body?.accessibilityAltText || '',
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: asset });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to upload asset');
  }
};

exports.replaceAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await contentAssetService.replaceAssetFile({
      organizationId: ctx.organizationId,
      assetId: req.params.id,
      userId: ctx.userId,
      file: req.file,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: asset });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to replace asset');
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await contentAssetService.updateAssetMetadata({
      organizationId: ctx.organizationId,
      assetId: req.params.id,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: asset });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to update asset');
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentAssetService.deleteAsset({
      organizationId: ctx.organizationId,
      assetId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to delete asset');
  }
};
