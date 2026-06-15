'use strict';

const releaseNoteService = require('../services/releaseNoteService');
const { ReleaseNoteValidationError } = require('../middleware/releaseNoteValidation');

function handleError(res, error, label) {
  if (error instanceof ReleaseNoteValidationError) {
    return res.status(400).json({ success: false, message: error.message, code: error.code });
  }
  if (error instanceof releaseNoteService.ReleaseNoteServiceError) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }
  console.error(`[platformReleaseNoteController] ${label}:`, error);
  return res.status(500).json({ success: false, message: 'Release notes admin request failed' });
}

exports.list = async (req, res) => {
  try {
    const data = await releaseNoteService.listPlatformNotes({
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'list');
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await releaseNoteService.getReleaseWithItems(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Release note not found' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getById');
  }
};

exports.create = async (req, res) => {
  try {
    const data = await releaseNoteService.createReleaseNote(req.user._id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'create');
  }
};

exports.update = async (req, res) => {
  try {
    const data = await releaseNoteService.updateReleaseNote(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'update');
  }
};

exports.archive = async (req, res) => {
  try {
    const data = await releaseNoteService.archiveReleaseNote(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'archive');
  }
};

exports.publish = async (req, res) => {
  try {
    const data = await releaseNoteService.publishReleaseNote(req.params.id, req.user._id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'publish');
  }
};

exports.schedule = async (req, res) => {
  try {
    const data = await releaseNoteService.scheduleReleaseNote(
      req.params.id,
      req.body?.scheduledPublishAt
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'schedule');
  }
};

exports.audiencePreview = async (req, res) => {
  try {
    const data = await releaseNoteService.getAudiencePreview(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'audiencePreview');
  }
};

exports.stats = async (req, res) => {
  try {
    const data = await releaseNoteService.getReleaseStats(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'stats');
  }
};
