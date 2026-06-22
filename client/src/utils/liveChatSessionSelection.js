import {
  isLiveChatSessionDetailPath,
  LIVE_CHAT_MAIN_TAB_PATH,
  normalizeLiveChatPath,
} from '@/utils/liveChatTabPaths';

export const LIVE_CHAT_LAST_SESSION_KEY = 'arivu:live-chat-last-session-id';

export function persistLiveChatLastSessionId(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(LIVE_CHAT_LAST_SESSION_KEY, id);
  } catch {
    // ignore quota / privacy mode
  }
}

export function readLiveChatLastSessionId() {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    return String(sessionStorage.getItem(LIVE_CHAT_LAST_SESSION_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function clearLiveChatLastSessionId() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(LIVE_CHAT_LAST_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function liveChatSessionDetailPath(sessionId) {
  const id = String(sessionId || '').trim();
  return id ? `/live-chat/sessions/${id}` : '';
}

/** Prefer current session route, else last selected session, else sessions list. */
export function resolveLiveChatSessionsNavigationPath(currentPath) {
  const normalized = normalizeLiveChatPath(currentPath);
  if (isLiveChatSessionDetailPath(normalized)) return normalized;

  const lastSessionPath = liveChatSessionDetailPath(readLiveChatLastSessionId());
  if (lastSessionPath) return lastSessionPath;

  return LIVE_CHAT_MAIN_TAB_PATH;
}
