export function normalizeLiveChatPath(path) {
  return String(path || '').split('?')[0].split('#')[0];
}

/** Tab bar path for the main Live Chat workspace (session detail is router-only). */
export const LIVE_CHAT_MAIN_TAB_PATH = '/live-chat/sessions';

export function isLiveChatSessionDetailPath(pathOnly) {
  return /^\/live-chat\/sessions\/[^/]+/.test(normalizeLiveChatPath(pathOnly));
}

export function isLiveChatSessionsRoute(pathOnly) {
  const p = normalizeLiveChatPath(pathOnly);
  return p === LIVE_CHAT_MAIN_TAB_PATH || isLiveChatSessionDetailPath(p);
}

/** Tab bar path for closed sessions workspace (session detail is router-only). */
export const LIVE_CHAT_CLOSED_TAB_PATH = '/live-chat/closed';

export function isLiveChatClosedSessionDetailPath(pathOnly) {
  return /^\/live-chat\/closed\/[^/]+/.test(normalizeLiveChatPath(pathOnly));
}

export function isLiveChatClosedSessionsRoute(pathOnly) {
  const p = normalizeLiveChatPath(pathOnly);
  return p === LIVE_CHAT_CLOSED_TAB_PATH || isLiveChatClosedSessionDetailPath(p);
}

export function isLiveChatVisitorDetailPath(pathOnly) {
  return /^\/live-chat\/visitors\/[^/]+/.test(normalizeLiveChatPath(pathOnly));
}

/** @deprecated Legacy visitors tab — migrated to closed sessions. */
export function isLiveChatVisitorsRoute(pathOnly) {
  const p = normalizeLiveChatPath(pathOnly);
  return p === '/live-chat/visitors' || isLiveChatVisitorDetailPath(p);
}

export function isLiveChatReportsRoute(pathOnly) {
  return normalizeLiveChatPath(pathOnly) === '/live-chat/reports';
}

export function isLiveChatRoute(pathOnly) {
  return (
    isLiveChatSessionsRoute(pathOnly)
    || isLiveChatClosedSessionsRoute(pathOnly)
    || isLiveChatVisitorsRoute(pathOnly)
    || isLiveChatReportsRoute(pathOnly)
  );
}

/** True when route is owned by the single Live Chat workspace tab (Sessions / Closed / Reports). */
export function liveChatMainTabOwnsRoute(routePath, tab) {
  const route = normalizeLiveChatPath(routePath);
  if (!isLiveChatRoute(route)) return false;
  if (!tab) return false;
  const tabPath = normalizeLiveChatPath(tab.path);
  if (tabPath === LIVE_CHAT_MAIN_TAB_PATH) return true;
  if (tab.titleKey === 'navigation.liveChat') return true;
  return isLiveChatRoute(tabPath);
}
