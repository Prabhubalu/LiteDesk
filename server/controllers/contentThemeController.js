'use strict';

const contentThemeService = require('../services/contentPlatform/contentThemeService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    ipAddress: req.ip || null
  };
}

exports.listThemes = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentThemeService.listThemes({
      organizationId: ctx.organizationId,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      search: req.query.search
    });
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list themes');
  }
};

exports.getTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const theme = await contentThemeService.getThemeById({
      organizationId: ctx.organizationId,
      themeId: req.params.id
    });
    return res.json({ success: true, data: theme });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to get theme');
  }
};

exports.createTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const theme = await contentThemeService.createTheme({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: theme });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to create theme');
  }
};

exports.updateTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const theme = await contentThemeService.updateTheme({
      organizationId: ctx.organizationId,
      themeId: req.params.id,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: theme });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to update theme');
  }
};

exports.publishTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const theme = await contentThemeService.publishTheme({
      organizationId: ctx.organizationId,
      themeId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: theme });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to publish theme');
  }
};

exports.archiveTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const theme = await contentThemeService.archiveTheme({
      organizationId: ctx.organizationId,
      themeId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: theme });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to archive theme');
  }
};

exports.deleteTheme = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentThemeService.deleteTheme({
      organizationId: ctx.organizationId,
      themeId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to delete theme');
  }
};
