/**
 * App keys that support the notification SSE stream.
 * Keep in sync with server notificationStreamController APP_KEYS.
 */
export const NOTIFICATION_STREAM_APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK'];

/**
 * All entitled app streams the user should stay subscribed to (not only the current route).
 * Ensures HELPDESK alerts arrive even when navigating within helpdesk or from sales.
 *
 * @param {{ allowedApps?: string[] } | null | undefined} user
 * @returns {string[]}
 */
export function getNotificationStreamAppKeysForUser(user) {
  const allowed = new Set(
    (user?.allowedApps || []).map((app) => String(app).toUpperCase())
  );
  const keys = NOTIFICATION_STREAM_APP_KEYS.filter((key) => allowed.has(key));
  return keys.length ? keys : ['SALES'];
}
