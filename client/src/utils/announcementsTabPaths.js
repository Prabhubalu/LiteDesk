export function normalizeAnnouncementsPath(path) {
  return String(path || '').split('?')[0].split('#')[0];
}

/** Single TabBar path for the Announcements workspace (list / analytics / editor). */
export const ANNOUNCEMENTS_MAIN_TAB_PATH = '/announcements';

export function isAnnouncementsRoute(pathOnly) {
  const p = normalizeAnnouncementsPath(pathOnly);
  return p === ANNOUNCEMENTS_MAIN_TAB_PATH || p.startsWith(`${ANNOUNCEMENTS_MAIN_TAB_PATH}/`);
}

export function announcementsTabOwnsRoute(routePath, tab) {
  const route = normalizeAnnouncementsPath(routePath);
  if (!isAnnouncementsRoute(route)) return false;
  if (!tab) return false;
  const tabPath = normalizeAnnouncementsPath(tab.path);
  if (tabPath === ANNOUNCEMENTS_MAIN_TAB_PATH) return true;
  if (tab.titleKey === 'navigation.announcements') return true;
  return isAnnouncementsRoute(tabPath);
}
