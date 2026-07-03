'use strict';

const UserPreferences = require('../models/UserPreferences');
const Organization = require('../models/Organization');
const { getPlatformHomeSnapshot } = require('../services/platformHomeService');
const {
  normalizeStoredPlatformHomeLayout,
  sanitizePlatformHomeLayoutPayload
} = require('../constants/platformHomeLayout');

function isPlatformHomeLayoutAdmin(user) {
  if (!user) return false;
  if (user.isOwner || user.isPlatformAdmin) return true;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'owner' || role === 'admin';
}

function resolvePlatformHomeLayoutResponse(stored, source) {
  const layout = normalizeStoredPlatformHomeLayout(stored);
  if (!layout || !layout.items.length) {
    return {
      success: true,
      data: layout ? { items: [], widthMode: layout.widthMode } : null,
      source: source || null
    };
  }

  return {
    success: true,
    data: layout,
    source
  };
}

/**
 * GET /api/platform/home
 * Unified snapshot for platform landing (attention, shell counts, resume).
 */
exports.getPlatformHome = async (req, res) => {
  try {
    const data = await getPlatformHomeSnapshot(req);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[PlatformHome] getPlatformHome error:', error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to load platform home',
      error: error?.message || 'Unknown error',
      code: error?.code || 'PLATFORM_HOME_ERROR'
    });
  }
};

/**
 * GET /api/platform/home/layout
 * User layout first, then organization default for new users.
 */
exports.getPlatformHomeLayout = async (req, res) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const preferences = await UserPreferences.findOne({ organizationId, userId }).lean();

    const userLayout = preferences?.platformHomeLayout;
    if (userLayout?.items?.length) {
      return res.status(200).json(resolvePlatformHomeLayoutResponse(userLayout, 'user'));
    }

    const organization = await Organization.findById(organizationId)
      .select('settings.platformHomeDefaultLayout')
      .lean();
    const orgDefault = organization?.settings?.platformHomeDefaultLayout;
    if (orgDefault?.items?.length) {
      return res.status(200).json(resolvePlatformHomeLayoutResponse(orgDefault, 'organization'));
    }

    return res.status(200).json({
      success: true,
      data: null,
      source: null
    });
  } catch (error) {
    console.error('[PlatformHome] getPlatformHomeLayout error:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load platform home layout'
    });
  }
};

/**
 * PUT /api/platform/home/layout
 * Persist per-user layout in UserPreferences.
 */
exports.savePlatformHomeLayout = async (req, res) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const layout = sanitizePlatformHomeLayoutPayload(req.body);

    let preferences = await UserPreferences.findOne({ organizationId, userId });
    if (!preferences) {
      preferences = await UserPreferences.create({
        organizationId,
        userId,
        widgetLayouts: new Map(),
        platformHomeLayout: layout
      });
    } else {
      preferences.platformHomeLayout = layout;
      await preferences.save();
    }

    return res.status(200).json({
      success: true,
      data: layout,
      source: 'user'
    });
  } catch (error) {
    console.error('[PlatformHome] savePlatformHomeLayout error:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save platform home layout'
    });
  }
};

/**
 * PUT /api/platform/home/layout/default
 * Save organization default layout for new users (admin only).
 */
exports.savePlatformHomeDefaultLayout = async (req, res) => {
  try {
    if (!isPlatformHomeLayoutAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only organization admins can save the default home layout'
      });
    }

    const { organizationId } = req.user;
    const layout = sanitizePlatformHomeLayoutPayload(req.body);

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    organization.settings = organization.settings || {};
    organization.settings.platformHomeDefaultLayout = layout;
    organization.markModified('settings.platformHomeDefaultLayout');
    await organization.save();

    return res.status(200).json({
      success: true,
      data: layout,
      source: 'organization'
    });
  } catch (error) {
    console.error('[PlatformHome] savePlatformHomeDefaultLayout error:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save default platform home layout'
    });
  }
};
