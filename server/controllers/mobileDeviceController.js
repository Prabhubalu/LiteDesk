const MobileDevice = require('../models/MobileDevice');
const NotificationPreference = require('../models/NotificationPreference');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL'];
const PLATFORMS = ['ios', 'android', 'web'];
const MAX_FAILURE_COUNT = 3;

function normalizeAppKey(req) {
  const appKey = req.body?.appKey || req.query?.appKey || req.appKey || req.appContext?.appKey;
  if (!appKey || !APP_KEYS.includes(appKey)) return null;
  return appKey;
}

/**
 * POST /api/push/device
 * Register or refresh a native device push token.
 */
exports.registerDevice = async (req, res) => {
  try {
    const appKey = normalizeAppKey(req);
    if (!appKey) {
      return res.status(400).json({ success: false, message: 'appKey is required' });
    }

    const { token, platform, deviceId, appVersion } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    if (!platform || !PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'platform must be ios, android, or web'
      });
    }

    let device = await MobileDevice.findOne({ token });
    if (device) {
      device.userId = req.user._id;
      device.organizationId = req.user.organizationId;
      device.appKey = appKey;
      device.platform = platform;
      device.deviceId = deviceId || device.deviceId;
      device.appVersion = appVersion || device.appVersion;
      device.disabled = false;
      device.failureCount = 0;
      device.lastFailureAt = null;
      device.lastSeenAt = new Date();
      await device.save();
    } else {
      device = await MobileDevice.create({
        userId: req.user._id,
        organizationId: req.user.organizationId,
        appKey,
        platform,
        token,
        deviceId: deviceId || null,
        appVersion: appVersion || null,
        lastSeenAt: new Date()
      });
    }

    let preference = await NotificationPreference.findOne({
      userId: req.user._id,
      appKey
    });
    if (preference?.events) {
      preference.events.forEach((eventPref) => {
        if (eventPref.push) {
          eventPref.push.enabled = true;
          eventPref.push.available = true;
        } else {
          eventPref.push = { enabled: true, available: true };
        }
      });
      await preference.save();
    }

    return res.json({
      success: true,
      deviceId: String(device._id)
    });
  } catch (error) {
    console.error('[mobileDeviceController] registerDevice failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to register device' });
  }
};

/**
 * POST /api/push/device/unregister
 * Disable a native device push token.
 */
exports.unregisterDevice = async (req, res) => {
  try {
    const appKey = normalizeAppKey(req);
    if (!appKey) {
      return res.status(400).json({ success: false, message: 'appKey is required' });
    }

    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    const device = await MobileDevice.findOne({
      token,
      userId: req.user._id,
      appKey
    });
    if (device) {
      device.disabled = true;
      await device.save();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[mobileDeviceController] unregisterDevice failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to unregister device' });
  }
};

async function getActiveDevices(userId, appKey) {
  try {
    return await MobileDevice.find({
      userId,
      appKey,
      disabled: false
    });
  } catch (error) {
    console.error('[mobileDeviceController] getActiveDevices failed:', error);
    return [];
  }
}

async function markDeviceFailure(device, errorMessage) {
  const newFailureCount = (device.failureCount || 0) + 1;
  const expired =
    typeof errorMessage === 'string' &&
    (/registration-token-not-registered/i.test(errorMessage) ||
      /invalid-registration-token/i.test(errorMessage) ||
      /not.?found/i.test(errorMessage));

  await MobileDevice.findByIdAndUpdate(device._id, {
    failureCount: expired ? MAX_FAILURE_COUNT : newFailureCount,
    lastFailureAt: new Date(),
    disabled: expired || newFailureCount >= MAX_FAILURE_COUNT
  });
}

async function markDeviceSuccess(device) {
  if (device.failureCount > 0) {
    await MobileDevice.findByIdAndUpdate(device._id, {
      failureCount: 0,
      lastFailureAt: null,
      lastSeenAt: new Date()
    });
  } else {
    await MobileDevice.findByIdAndUpdate(device._id, { lastSeenAt: new Date() });
  }
}

module.exports.getActiveDevices = getActiveDevices;
module.exports.markDeviceFailure = markDeviceFailure;
module.exports.markDeviceSuccess = markDeviceSuccess;
