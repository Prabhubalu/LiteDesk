'use strict';

const contentFontService = require('../services/contentPlatform/contentFontService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    ipAddress: req.ip || null
  };
}

exports.listFonts = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentFontService.listFonts({
      organizationId: ctx.organizationId,
      page: req.query.page,
      limit: req.query.limit,
      source: req.query.source,
      search: req.query.search
    });
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list fonts');
  }
};

exports.listCatalogFonts = async (_req, res) => {
  try {
    return res.json({ success: true, data: contentFontService.listCatalogFonts() });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list font catalog');
  }
};

exports.getFont = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const font = await contentFontService.getFontById({
      organizationId: ctx.organizationId,
      fontId: req.params.id
    });
    return res.json({ success: true, data: font });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to get font');
  }
};

exports.registerFont = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const font = await contentFontService.registerFont({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: font });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to register font');
  }
};

exports.uploadFont = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const font = await contentFontService.uploadFont({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      file: req.file,
      fontName: req.body?.fontName,
      fallback: req.body?.fallback,
      license: req.body?.license,
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: font });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to upload font');
  }
};

exports.deleteFont = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentFontService.deleteFont({
      organizationId: ctx.organizationId,
      fontId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to delete font');
  }
};
