'use strict';

const service = require('../services/platformAnnouncementAdminService');

function handleError(res, error, label) {
  if (error instanceof service.PlatformAnnouncementAdminError) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
  console.error(`[platformAnnouncementController] ${label}:`, error);
  return res.status(500).json({ success: false, message: 'Platform announcement request failed' });
}

exports.listPresets = async (_req, res) => {
  try {
    return res.json({ success: true, data: { presets: service.listPresets() } });
  } catch (error) {
    return handleError(res, error, 'listPresets');
  }
};

exports.list = async (req, res) => {
  try {
    const data = await service.listPlatformAnnouncements({
      status: req.query.status,
      category: req.query.category,
      includeSystem: req.query.includeSystem === 'true',
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'list');
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await service.getPlatformAnnouncement(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getById');
  }
};

exports.create = async (req, res) => {
  try {
    const data = await service.createPlatformAnnouncement(req.user._id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'create');
  }
};

exports.update = async (req, res) => {
  try {
    const data = await service.updatePlatformAnnouncement(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'update');
  }
};

exports.publish = async (req, res) => {
  try {
    const data = await service.publishPlatformAnnouncement(req.params.id, req.user._id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'publish');
  }
};

exports.pause = async (req, res) => {
  try {
    const data = await service.pausePlatformAnnouncement(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'pause');
  }
};

exports.archive = async (req, res) => {
  try {
    const data = await service.archivePlatformAnnouncement(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'archive');
  }
};
