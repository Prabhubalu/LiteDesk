/**
 * Module list data freshness: dirty flags, recheck-on-tab-close, and fingerprints.
 * Keeps keep-alive cache for tab switches; validates on reopen when data may have changed.
 */

import { resolveImportListModuleKey } from '@/utils/importListModuleMatch';

/** Tab closed/reopened within this window — trust cache unless dirty. */
export const MODULE_LIST_QUICK_TRUST_MS = 30_000;

/** Older than this on recheck → refetch without probing. */
export const MODULE_LIST_STALE_TTL_MS = 5 * 60_000;

const dirtyModules = new Set();
const recheckModules = new Set();
/** @type {Map<string, { totalRecords: number, maxUpdatedAt: number|null, fetchedAt: number }>} */
const fingerprints = new Map();

/** Known list routes → module identity (matches useTabs list-path whitelist). */
const LIST_MODULE_ROUTE_PATHS = {
  '/tasks': { moduleKey: 'tasks', appKey: 'PLATFORM' },
  '/deals': { moduleKey: 'deals', appKey: 'SALES' },
  '/events': { moduleKey: 'events', appKey: 'PLATFORM' },
  '/people': { moduleKey: 'people', appKey: 'PLATFORM' },
  '/organizations': { moduleKey: 'organizations', appKey: 'PLATFORM' },
  '/forms': { moduleKey: 'forms' },
  '/items': { moduleKey: 'items', appKey: 'PLATFORM' },
  '/imports': { moduleKey: 'imports' },
  '/documents': { moduleKey: 'documents' },
  '/trash': { moduleKey: 'trash' },
  '/quotes': { moduleKey: 'quotes', appKey: 'PLATFORM' },
  '/helpdesk/cases': { moduleKey: 'cases', appKey: 'HELPDESK' },
};

/**
 * List views often use an appKey (e.g. tasks → PLATFORM) while producers may omit it.
 * Alias so bare `tasks` and `PLATFORM:tasks` share dirty/recheck state.
 */
const MODULE_LIST_APP_KEY_ALIASES = {
  tasks: ['PLATFORM'],
  people: ['PLATFORM'],
  organizations: ['PLATFORM'],
  events: ['PLATFORM'],
  items: ['PLATFORM'],
  quotes: ['PLATFORM'],
  deals: ['SALES'],
  cases: ['HELPDESK'],
  campaigns: ['MARKETING'],
  dashboards: ['PLATFORM'],
  widgets: ['PLATFORM'],
  reports: ['PLATFORM'],
};

export function normalizeModuleListKey(moduleKey, appKey = '') {
  const mod = resolveImportListModuleKey(moduleKey) || String(moduleKey || '').toLowerCase();
  const app = String(appKey || '').toUpperCase();
  return app ? `${app}:${mod}` : mod;
}

/** @returns {string[]} */
function moduleListFreshnessKeys(moduleKey, appKey = '') {
  const mod = resolveImportListModuleKey(moduleKey) || String(moduleKey || '').toLowerCase();
  if (!mod) return [];
  const keys = new Set();
  const primary = normalizeModuleListKey(mod, appKey);
  if (primary) keys.add(primary);
  keys.add(mod);
  for (const alias of MODULE_LIST_APP_KEY_ALIASES[mod] || []) {
    keys.add(`${alias}:${mod}`);
  }
  return [...keys];
}

export function resolveListFreshnessFromRoutePath(routePath) {
  const pathBase = String(routePath || '').split('?')[0];
  return LIST_MODULE_ROUTE_PATHS[pathBase] ?? null;
}

export function markModuleListDirty(moduleKey, appKey = '') {
  const keys = moduleListFreshnessKeys(moduleKey, appKey);
  if (keys.length === 0) return;
  for (const key of keys) {
    dirtyModules.add(key);
    recheckModules.delete(key);
  }
}

/**
 * Notify list/board freshness that a record changed (keep-alive soft-refetch on next activate).
 * @param {{ moduleKey: string, record?: object|null, recordId?: string|null, appKey?: string }} detail
 */
export function dispatchRecordUpdated(detail = {}) {
  const moduleKey = detail.moduleKey;
  if (!moduleKey || typeof window === 'undefined') return;
  const aliases = MODULE_LIST_APP_KEY_ALIASES[
    resolveImportListModuleKey(moduleKey) || String(moduleKey || '').toLowerCase()
  ];
  const appKey = detail.appKey || aliases?.[0] || '';
  window.dispatchEvent(new CustomEvent('arivu:record-updated', {
    detail: {
      moduleKey,
      record: detail.record ?? null,
      recordId: detail.recordId ?? detail.record?._id ?? detail.record?.id ?? null,
      appKey
    }
  }));
}

export function markModuleListRecheck(moduleKey, appKey = '') {
  const keys = moduleListFreshnessKeys(moduleKey, appKey);
  for (const key of keys) {
    if (dirtyModules.has(key)) continue;
    recheckModules.add(key);
  }
}

export function markModuleListRecheckForRoutePath(routePath) {
  const resolved = resolveListFreshnessFromRoutePath(routePath);
  if (!resolved?.moduleKey) return;
  markModuleListRecheck(resolved.moduleKey, resolved.appKey || '');
}

export function consumeModuleListDirty(moduleKey, appKey = '') {
  const keys = moduleListFreshnessKeys(moduleKey, appKey);
  let hit = false;
  for (const key of keys) {
    if (dirtyModules.has(key)) {
      dirtyModules.delete(key);
      hit = true;
    }
    recheckModules.delete(key);
  }
  return hit;
}

export function peekModuleListRecheck(moduleKey, appKey = '') {
  return moduleListFreshnessKeys(moduleKey, appKey).some((key) => recheckModules.has(key));
}

export function clearModuleListRecheck(moduleKey, appKey = '') {
  for (const key of moduleListFreshnessKeys(moduleKey, appKey)) {
    recheckModules.delete(key);
  }
}

export function recordModuleListFingerprint(moduleKey, appKey, snapshot = {}) {
  const key = normalizeModuleListKey(moduleKey, appKey);
  if (!key) return;

  const totalRecords = Number(snapshot.totalRecords);
  const maxUpdatedAt = snapshot.maxUpdatedAt == null
    ? null
    : Number(snapshot.maxUpdatedAt);

  fingerprints.set(key, {
    totalRecords: Number.isFinite(totalRecords) ? totalRecords : 0,
    maxUpdatedAt: Number.isFinite(maxUpdatedAt) ? maxUpdatedAt : null,
    fetchedAt: Date.now(),
  });
}

export function getModuleListFingerprint(moduleKey, appKey = '') {
  const key = normalizeModuleListKey(moduleKey, appKey);
  return key ? fingerprints.get(key) ?? null : null;
}

export function extractMaxUpdatedAtMs(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let max = 0;
  for (const row of rows) {
    const raw = row?.updatedAt ?? row?.updated_at ?? row?.modifiedAt ?? row?.modified_at;
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms)) max = Math.max(max, ms);
  }
  return max > 0 ? max : null;
}

/**
 * Compare probe result with stored fingerprint.
 * @returns {'unchanged'|'changed'|'no-baseline'}
 */
export function compareModuleListProbe(fingerprint, probe = {}) {
  if (!fingerprint) return 'no-baseline';

  const probeTotal = Number(probe.totalRecords);
  const probeMax = probe.maxUpdatedAt == null ? null : Number(probe.maxUpdatedAt);

  if (Number.isFinite(probeTotal) && probeTotal !== fingerprint.totalRecords) {
    return 'changed';
  }

  if (
    probeMax != null
    && fingerprint.maxUpdatedAt != null
    && probeMax > fingerprint.maxUpdatedAt
  ) {
    return 'changed';
  }

  return 'unchanged';
}

export function resetModuleListFreshnessState() {
  dirtyModules.clear();
  recheckModules.clear();
  fingerprints.clear();
}
