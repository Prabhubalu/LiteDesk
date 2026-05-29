/**
 * Per-list scroll + pagination session (tab switches / keep-alive).
 * Uses memory + sessionStorage so state survives keep-alive eviction within the tab session.
 */

/** Vue provide/inject: bump to tell TableView to restore scroll after pages are loaded */
export const LIST_SESSION_RESTORE_KEY = Symbol('listSessionRestore');

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
