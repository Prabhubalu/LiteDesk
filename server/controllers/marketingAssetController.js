'use strict';

const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const marketingAssetService = require('../services/marketing/marketingAssetService');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id
  };
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function sendError(res, error, fallbackMessage) {
  const status = error?.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error?.message || fallbackMessage
  });
}

exports.listAssets = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await runWithOrganizationTenantContext(ctx.organizationId, async () =>
      marketingAssetService.listAssets({
        organizationId: ctx.organizationId,
        page: req.query.page,
        limit: req.query.limit,
        type: req.query.type,
        search: req.query.search,
        tag: req.query.tag
      })
    );
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    return sendError(res, error, 'Failed to list assets');
  }
};

exports.getAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await runWithOrganizationTenantContext(ctx.organizationId, async () =>
      marketingAssetService.getAssetById({
        organizationId: ctx.organizationId,
        assetId: req.params.id
      })
    );
    return res.json({ success: true, data: asset });
  } catch (error) {
    return sendError(res, error, 'Failed to get asset');
  }
};

exports.uploadAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await runWithOrganizationTenantContext(ctx.organizationId, async () =>
      marketingAssetService.uploadAsset({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        file: req.file,
        type: req.body?.type,
        tags: parseTags(req.body?.tags),
        accessibilityAltText: req.body?.accessibilityAltText || ''
      })
    );
    return res.status(201).json({ success: true, data: asset });
  } catch (error) {
    return sendError(res, error, 'Failed to upload asset');
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const asset = await runWithOrganizationTenantContext(ctx.organizationId, async () =>
      marketingAssetService.updateAssetMetadata({
        organizationId: ctx.organizationId,
        assetId: req.params.id,
        payload: req.body
      })
    );
    return res.json({ success: true, data: asset });
  } catch (error) {
    return sendError(res, error, 'Failed to update asset');
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await runWithOrganizationTenantContext(ctx.organizationId, async () =>
      marketingAssetService.deleteAsset({
        organizationId: ctx.organizationId,
        assetId: req.params.id
      })
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error, 'Failed to delete asset');
  }
};
