/**
 * Native mobile push via Firebase Cloud Messaging (FCM).
 * Uses FIREBASE_SERVICE_ACCOUNT_JSON env (stringified service account) when present.
 * Without config, registration still works; sends are skipped gracefully.
 */
const mobileDeviceController = require('../controllers/mobileDeviceController');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

let messaging = null;
let initAttempted = false;

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[nativePushService:${event}]`, JSON.stringify(data));
  }
}

function initialize() {
  if (initAttempted) return;
  initAttempted = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('[nativePushService] FIREBASE_SERVICE_ACCOUNT_JSON not set. Native push send disabled.');
    return;
  }

  try {
    // Lazy require so server boots without firebase-admin installed until needed.
    // eslint-disable-next-line global-require
    const admin = require('firebase-admin');
    const cred = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(cred)
      });
    }
    messaging = admin.messaging();
    console.log('[nativePushService] Initialized Firebase Admin messaging');
  } catch (error) {
    console.error('[nativePushService] Failed to initialize:', error.message);
    messaging = null;
  }
}

function initialized() {
  if (!initAttempted) initialize();
  return Boolean(messaging);
}

/**
 * Send FCM data+notification message to a registered device.
 */
async function sendToDevice(device, payload) {
  if (!initialized()) {
    return { success: false, error: 'Native push not configured', skipped: true };
  }

  try {
    const deepLink =
      payload?.data?.mobileUrl ||
      payload?.data?.url ||
      'arivu://inbox';

    const message = {
      token: device.token,
      notification: {
        title: payload.title || 'Arivu',
        body: payload.body || ''
      },
      data: {
        title: String(payload.title || ''),
        body: String(payload.body || ''),
        notificationId: String(payload.data?.notificationId || ''),
        eventType: String(payload.data?.eventType || ''),
        appKey: String(payload.data?.appKey || ''),
        url: String(deepLink),
        mobileUrl: String(deepLink)
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'litedesk_default',
          tag: payload.tag || undefined
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    await messaging.send(message);
    await mobileDeviceController.markDeviceSuccess(device);
    debugLog('Sent', { deviceId: String(device._id), platform: device.platform });
    return { success: true };
  } catch (error) {
    await mobileDeviceController.markDeviceFailure(device, error.message);
    debugLog('Failed', { deviceId: String(device._id), error: error.message });
    return { success: false, error: error.message };
  }
}

async function sendToUser(userId, appKey, payload) {
  const devices = await mobileDeviceController.getActiveDevices(userId, appKey);
  if (!devices.length) {
    return { success: false, skipped: true, reason: 'no_devices', devices: 0 };
  }

  if (!initialized()) {
    return { success: false, skipped: true, reason: 'native_push_not_configured', devices: devices.length };
  }

  const results = await Promise.allSettled(devices.map((d) => sendToDevice(d, payload)));
  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  return {
    success: successCount > 0,
    devices: devices.length,
    successCount,
    failedCount: results.length - successCount
  };
}

initialize();

module.exports = {
  initialize,
  initialized,
  sendToDevice,
  sendToUser
};
