'use strict';

const announcementService = require('../services/announcementService');
const announcementAnalyticsService = require('../services/announcementAnalyticsService');

function handleError(res, error, label) {
  if (error instanceof announcementService.AnnouncementServiceError) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
  console.error(`[announcementController] ${label}:`, error);
  return res.status(500).json({ success: false, message: 'Announcements request failed' });
}

function orgId(req) {
  return req.user.organizationId;
}

function userId(req) {
  return req.user._id;
}

function runtimeMeta(req) {
  const surface = String(req.body?.surface || req.query?.surface || 'web_app').toLowerCase();
  return {
    surface: ['web_app', 'portal', 'mobile'].includes(surface) ? surface : 'web_app',
    deviceType: req.body?.deviceType || req.headers['x-device-type'] || null,
    platform: req.body?.platform || req.headers['x-platform'] || null,
  };
}

exports.list = async (req, res) => {
  try {
    const data = await announcementService.listAnnouncements(orgId(req), req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'list');
  }
};

exports.getOne = async (req, res) => {
  try {
    const data = await announcementService.getAnnouncement(orgId(req), req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getOne');
  }
};

exports.create = async (req, res) => {
  try {
    const data = await announcementService.createAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      payload: req.body,
      publish: req.body?.publish === true,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'create');
  }
};

exports.update = async (req, res) => {
  try {
    const data = await announcementService.updateAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
      payload: req.body,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'update');
  }
};

exports.publish = async (req, res) => {
  try {
    const data = await announcementService.publishAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'publish');
  }
};

exports.pause = async (req, res) => {
  try {
    const data = await announcementService.pauseAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'pause');
  }
};

exports.resume = async (req, res) => {
  try {
    const data = await announcementService.resumeAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'resume');
  }
};

exports.archive = async (req, res) => {
  try {
    const data = await announcementService.archiveAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'archive');
  }
};

exports.duplicate = async (req, res) => {
  try {
    const data = await announcementService.duplicateAnnouncement({
      organizationId: orgId(req),
      userId: userId(req),
      id: req.params.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'duplicate');
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await announcementService.deleteAnnouncement({
      organizationId: orgId(req),
      id: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'remove');
  }
};

exports.getActive = async (req, res) => {
  try {
    const surface = String(req.query.surface || 'web_app').toLowerCase();
    const data = await announcementService.getActiveForUser({
      organizationId: orgId(req),
      user: req.user,
      surface: ['web_app', 'portal', 'mobile'].includes(surface) ? surface : 'web_app',
    });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'getActive');
  }
};

exports.audienceOptions = async (req, res) => {
  try {
    const data = await announcementService.getAudienceOptions(orgId(req));
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'audienceOptions');
  }
};

exports.recordView = async (req, res) => {
  try {
    const data = await announcementService.recordView({
      organizationId: orgId(req),
      userId: userId(req),
      announcementId: req.params.id,
      meta: runtimeMeta(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'recordView');
  }
};

exports.recordDismiss = async (req, res) => {
  try {
    const data = await announcementService.recordDismiss({
      organizationId: orgId(req),
      userId: userId(req),
      announcementId: req.params.id,
      meta: runtimeMeta(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'recordDismiss');
  }
};

exports.recordAcknowledge = async (req, res) => {
  try {
    const data = await announcementService.recordAcknowledge({
      organizationId: orgId(req),
      userId: userId(req),
      announcementId: req.params.id,
      meta: runtimeMeta(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'recordAcknowledge');
  }
};

exports.recordCtaClick = async (req, res) => {
  try {
    const data = await announcementService.recordCtaClick({
      organizationId: orgId(req),
      userId: userId(req),
      announcementId: req.params.id,
      ctaId: req.params.ctaId,
      meta: runtimeMeta(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'recordCtaClick');
  }
};

exports.analyticsSummary = async (req, res) => {
  try {
    const data = await announcementAnalyticsService.getAnalyticsSummary(orgId(req));
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'analyticsSummary');
  }
};

exports.analyticsOne = async (req, res) => {
  try {
    const data = await announcementAnalyticsService.getAnnouncementAnalytics(
      orgId(req),
      req.params.id,
    );
    if (!data) {
      return res.status(404).json({ success: false, message: 'Announcement not found', code: 'NOT_FOUND' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'analyticsOne');
  }
};
