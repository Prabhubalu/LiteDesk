/**
 * Per-list scroll + pagination session (tab switches / keep-alive).
 * Uses memory + sessionStorage so state survives keep-alive eviction within the tab session.
 */

/** Vue provide/inject: bump to tell TableView to restore scroll after pages are loaded */
export const LIST_SESSION_RESTORE_KEY = Symbol('listSessionRestore');

/** ModuleList sets true during tab-return restore; TableView clears after scroll is applied. */
export const LIST_SESSION_SCROLL_CONCEAL_KEY = Symbol('listSessionScrollConceal');

/** False while lazy pages are still being re-fetched for a saved session. */
export const LIST_SESSION_PAGES_READY_KEY = Symbol('listSessionPagesReady');

const memory = new Map();

export function getListSessionKey(moduleKey, appKey, path, scope = '') {
  const mod = String(moduleKey || 'module').toLowerCase();
  const app = String(appKey || 'app').toUpperCase();
  const p = String(path || '/');
  const scopeSuffix = scope ? `:scope=${scope}` : '';
  return `arivu:list-session:${app}:${mod}:${p}${scopeSuffix}`;
}

export function getListSession(key) {
  if (!key) return null;
  if (memory.has(key)) {
    return memory.get(key);
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function patchListSession(key, patch) {
  if (!key || !patch || typeof patch !== 'object') return;
  const next = {
    ...(getListSession(key) || {}),
    ...patch,
    savedAt: Date.now()
  };
  memory.set(key, next);
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function clearListSession(key) {
  if (!key) return;
  memory.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function sessionKeyMatchesRoutePath(key, routePath) {
  const p = String(routePath || '').split('?')[0];
  if (!p || !key || !key.startsWith('arivu:list-session:')) return false;
  return key.endsWith(`:${p}`) || key.includes(`:${p}:scope=`);
}

/** Drop cached scroll/page state when a list tab is closed (memory + sessionStorage). */
export function clearListSessionsForRoutePath(routePath) {
  const p = String(routePath || '').split('?')[0];
  if (!p) return;

  for (const key of [...memory.keys()]) {
    if (sessionKeyMatchesRoutePath(key, p)) {
      memory.delete(key);
    }
  }

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (sessionKeyMatchesRoutePath(key, p)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
