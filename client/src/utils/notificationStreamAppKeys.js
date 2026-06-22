import { canViewLiveChatSessions } from '@/utils/liveChatPermissions';

/**
 * Mirrors server notificationStreamController PLATFORM gate
 * (canViewLiveChatSessions + live_chat addon entitlement).
 */
export function canAccessPlatformNotificationStream(user) {
  if (!canViewLiveChatSessions(user)) return false;
  return user?.entitledAddons?.live_chat === true;
}

/**
 * App keys that support the notification SSE stream.
 * Keep in sync with server notificationStreamController APP_KEYS.
 */
export const NOTIFICATION_STREAM_APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'];

/**
 * All entitled app streams the user should stay subscribed to (not only the current route).
 * Ensures HELPDESK alerts arrive even when navigating within helpdesk or from sales.
 *
 * @param {{ allowedApps?: string[], entitledAddons?: { live_chat?: boolean } } | null | undefined} user
 * @returns {string[]}
 */
export function getNotificationStreamAppKeysForUser(user) {
  const allowed = new Set(
    (user?.allowedApps || []).map((app) => String(app).toUpperCase()),
  );
  const keys = NOTIFICATION_STREAM_APP_KEYS.filter((key) => {
    if (key === 'PLATFORM') {
      return canAccessPlatformNotificationStream(user);
    }
    return allowed.has(key);
  });
  return keys.length ? keys : ['SALES'];
}
