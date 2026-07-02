'use strict';

const { analyzeEmailHtml } = require('../services/contentPlatform/htmlAnalysisService');
const {
  getOrgEmailMergeTagMappings,
  saveOrgEmailMergeTagMappings
} = require('../services/contentPlatform/emailMergeTagMappingService');
const {
  getOrgEmailExternalCssAllowlist,
  saveOrgEmailExternalCssAllowlist
} = require('../services/contentPlatform/emailCssAllowlistService');
const {
  getClientPreviewStatus,
  createClientPreview,
  fetchPreviewImageResponse
} = require('../services/contentPlatform/litmusClientPreviewService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    ipAddress: req.ip || null
  };
}

exports.getMergeMappings = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const mappings = await getOrgEmailMergeTagMappings(ctx.organizationId);
    return res.json({ success: true, data: { mappings } });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load merge mappings');
  }
};

exports.saveMergeMappings = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const mappings = await saveOrgEmailMergeTagMappings({
      organizationId: ctx.organizationId,
      mappings: req.body?.mappings || {},
      replace: req.body?.replace === true
    });
    return res.json({ success: true, data: { mappings } });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to save merge mappings');
  }
};

exports.getCssAllowlist = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const allowlist = await getOrgEmailExternalCssAllowlist(ctx.organizationId);
    return res.json({ success: true, data: { allowlist } });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load CSS allowlist');
  }
};

exports.saveCssAllowlist = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const allowlist = await saveOrgEmailExternalCssAllowlist({
      organizationId: ctx.organizationId,
      allowlist: req.body?.allowlist || []
    });
    return res.json({ success: true, data: { allowlist } });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to save CSS allowlist');
  }
};

exports.getClientPreviewStatus = async (_req, res) => {
  try {
    return res.json({ success: true, data: getClientPreviewStatus() });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load client preview status');
  }
};

exports.createClientPreview = async (req, res) => {
  try {
    const html = req.body?.html;
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({
        success: false,
        code: 'HTML_REQUIRED',
        message: 'HTML content is required'
      });
    }

    const result = await createClientPreview({
      html,
      subject: req.body?.subject
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error?.code === 'LITMUS_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
    return sendContentPlatformError(res, error, 'Failed to create client preview');
  }
};

exports.getClientPreviewImage = async (req, res) => {
  try {
    const response = await fetchPreviewImageResponse({
      emailGuid: req.params.emailGuid,
      client: req.params.client
    });

    if (!response.ok) {
      return res.status(response.status >= 500 ? 502 : 404).json({
        success: false,
        code: 'LITMUS_PREVIEW_FAILED',
        message: `Litmus preview failed (${response.status})`
      });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    if (error?.code === 'LITMUS_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
    return sendContentPlatformError(res, error, 'Failed to load client preview image');
  }
};

exports.analyzeHtml = async (req, res) => {
  try {
    const html = req.body?.html;
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({
        success: false,
        code: 'HTML_REQUIRED',
        message: 'HTML content is required'
      });
    }

    const ctx = getRequestContext(req);
    const orgMappings = await getOrgEmailMergeTagMappings(ctx.organizationId);
    const cssAllowlist = await getOrgEmailExternalCssAllowlist(ctx.organizationId);
    const userMappings = req.body?.mergeMappings || {};
    const mergeMappings = { ...orgMappings, ...userMappings };

    const result = await analyzeEmailHtml({
      html,
      mergeMappings,
      hubspotConditionalMode: req.body?.hubspotConditionalMode === 'strip' ? 'strip' : 'keep',
      externalCssAllowlist: cssAllowlist,
      fetchExternalCss: req.body?.fetchExternalCss !== false
    });

    return res.json({
      success: true,
      data: {
        ...result,
        orgMergeMappings: orgMappings,
        externalCssAllowlist: cssAllowlist
      }
    });
  } catch (error) {
    if (error?.code === 'HTML_TOO_LARGE') {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message
      });
    }
    return sendContentPlatformError(res, error, 'Failed to analyze HTML');
  }
};
