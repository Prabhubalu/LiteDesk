/**
 * Resolve notification appKey from the current route.
 * Must stay in sync with server notification stream APP_KEYS.
 */
export function resolveNotificationAppKeyFromPath(pathname = '') {
  const path = String(pathname || window.location?.pathname || '');
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  if (path.startsWith('/helpdesk/')) return 'HELPDESK';
  return 'SALES';
}
