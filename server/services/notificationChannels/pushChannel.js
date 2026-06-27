const pushService = require('../pushService');
const NotificationPreference = require('../../models/NotificationPreference');
const User = require('../../models/User');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[pushChannel:${event}]`, JSON.stringify(data));
  }
}

/**
 * Push notification channel.
 * 
 * Phase 13: External Notification Channels
 * 
 * Rules:
 * - Only sends for HIGH priority events
 * - Respects user preferences (push.enabled && push.available)
 * - Auto-disables subscription if push fails repeatedly
 */
async function send({ notification, user, context }) {
  try {
    // Only send for HIGH priority events
    if (notification.priority !== 'HIGH') {
      debugLog('Skipped', {
        notificationId: String(notification._id),
        reason: 'not_high_priority',
        priority: notification.priority
      });
      return { success: false, skipped: true, reason: 'not_high_priority' };
    }

    // Load user if not provided
    if (!user) {
      user = await User.findById(notification.userId).select('email firstName lastName');
      if (!user) {
        debugLog('UserNotFound', { notificationId: String(notification._id) });
        return { success: false, skipped: true, reason: 'user_not_found' };
      }
    }

    // Check user preferences
    const preference = await NotificationPreference.findOne({
      userId: notification.userId,
      appKey: notification.appKey
    });

    if (preference && preference.events) {
      const eventPref = preference.events.get(notification.eventType);
      if (eventPref) {
        // Check if push is enabled and available
        if (!eventPref.push || !eventPref.push.enabled || !eventPref.push.available) {
          debugLog('Skipped', {
            notificationId: String(notification._id),
            reason: 'push_disabled_or_unavailable',
            enabled: eventPref.push?.enabled,
            available: eventPref.push?.available
          });
          return { success: false, skipped: true, reason: 'push_disabled_or_unavailable' };
        }
      }
    }

    // Check if push service is initialized
    if (!pushService.initialized()) {
      debugLog('ServiceNotInitialized', { notificationId: String(notification._id) });
      return { success: false, skipped: true, reason: 'service_not_initialized' };
    }

    // Get active subscriptions for this user and app
    const subscriptions = await pushService.getActiveSubscriptions(
      notification.userId,
      notification.appKey
    );

    if (!subscriptions || subscriptions.length === 0) {
      debugLog('NoSubscriptions', {
        notificationId: String(notification._id),
        userId: String(notification.userId),
        appKey: notification.appKey
      });
      return { success: false, skipped: true, reason: 'no_subscriptions' };
    }

    // Build push payload
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        notificationId: String(notification._id),
        eventType: notification.eventType,
        appKey: notification.appKey,
        entity: notification.entity,
        url: getAppDeepLink(notification.appKey, notification.entity)
      },
      tag: `${notification.eventType}_${notification.entity?.id || 'none'}` // Prevent duplicate notifications
    };

    // Send to all active subscriptions (user may have multiple devices)
    const results = await Promise.allSettled(
      subscriptions.map(sub => pushService.sendPushNotification(sub, payload))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - successCount;

    debugLog('PushSent', {
      notificationId: String(notification._id),
      subscriptions: subscriptions.length,
      successCount,
      failedCount
    });

    return {
      success: successCount > 0,
      subscriptions: subscriptions.length,
      successCount,
      failedCount
    };
  } catch (err) {
    // Never throw - channel failures must not block execution
    console.error('[pushChannel] Failed to send push notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get deep link URL for app with entity context.
 */
function getAppDeepLink(appKey, entity) {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  
  if (!entity || !entity.id) {
    switch (appKey) {
      case 'CRM':
        return `${baseUrl}/dashboard`;
      case 'AUDIT':
        return `${baseUrl}/audit/dashboard`;
      case 'PORTAL':
        return `${baseUrl}/portal/actions`;
      default:
        return baseUrl;
    }
  }

  // Entity-specific deep links
  switch (entity.type) {
    case 'Event':
      return `${baseUrl}/audit/audits/${entity.id}`;
    case 'CorrectiveAction':
      return `${baseUrl}/portal/actions/${entity.id}`;
    default:
      return getAppDeepLink(appKey, null);
  }
}

module.exports = { send };
