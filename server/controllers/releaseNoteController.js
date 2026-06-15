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
  console.error(`[releaseNoteController] ${label}:`, error);
  return res.status(500).json({ success: false, message: 'Release notes request failed' });
}

function setPrivateCache(res, maxAgeSeconds = 60) {
  res.set('Cache-Control', `private, max-age=${maxAgeSeconds}`);
}

exports.getUnseen = async (req, res) => {
  try {
    const data = await releaseNoteService.getUnseenForUser(req.user);
    setPrivateCache(res, 60);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getUnseen');
  }
};

exports.getBadge = async (req, res) => {
  try {
    const data = await releaseNoteService.getBadgeForUser(req.user);
    setPrivateCache(res, 60);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getBadge');
  }
};

exports.getHistory = async (req, res) => {
  try {
    const data = await releaseNoteService.getHistoryForUser(req.user, {
      page: req.query.page,
      limit: req.query.limit
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getHistory');
  }
};

exports.markViewed = async (req, res) => {
  try {
    const data = await releaseNoteService.markViewed(
      req.user._id,
      req.params.id,
      req.body?.source
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'markViewed');
  }
};

exports.markViewedBatch = async (req, res) => {
  try {
    const data = await releaseNoteService.markViewedBatch(
      req.user._id,
      req.body?.releaseNoteIds,
      req.body?.source
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'markViewedBatch');
  }
};

exports.snooze = async (req, res) => {
  try {
    const data = await releaseNoteService.snoozeUser(req.user._id, req.body?.hours);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'snooze');
  }
};
