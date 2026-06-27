import { isRecordDetailTabPath } from '@/utils/navigationLabels';

/** Tab closed/reopened within this window — trust cache unless dirty. */
export const RECORD_DETAIL_QUICK_TRUST_MS = 30_000;

/** Older than this on recheck → refetch without probing. */
export const RECORD_DETAIL_STALE_TTL_MS = 5 * 60_000;

const dirtyRecords = new Set();
const recheckRecords = new Set();
/** @type {Map<string, { updatedAtMs: number|null, fetchedAt: number }>} */
const fingerprints = new Map();

export function recordDetailFreshnessKey(moduleKey, recordId, appKey = '') {
  const mod = String(moduleKey || '').toLowerCase();
  const id = String(recordId || '').trim();
  const app = String(appKey || '').toUpperCase();
  if (!mod || !id) return '';
  return app ? `${app}:${mod}:${id}` : `${mod}:${id}`;
}

export function resolveRecordFreshnessFromRoutePath(routePath) {
  const pathOnly = String(routePath || '').split('?')[0];
  if (!isRecordDetailTabPath(pathOnly)) return null;

  const segments = pathOnly.split('/').filter(Boolean);
  if (segments[0] === 'helpdesk' && segments[1] === 'cases' && segments[2]) {
    return { moduleKey: 'cases', appKey: 'HELPDESK', recordId: segments[2] };
  }
  if (segments.length >= 2) {
    return { moduleKey: segments[0], recordId: segments[1] };
  }
  return null;
}

export function markRecordDetailDirty(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  if (!key) return;
  dirtyRecords.add(key);
  recheckRecords.delete(key);
}

export function markRecordDetailRecheck(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  if (!key || dirtyRecords.has(key)) return;
  recheckRecords.add(key);
}

export function markRecordDetailRecheckForRoutePath(routePath) {
  const resolved = resolveRecordFreshnessFromRoutePath(routePath);
  if (!resolved?.moduleKey || !resolved.recordId) return;
  markRecordDetailRecheck(resolved.moduleKey, resolved.recordId, resolved.appKey || '');
}

export function consumeRecordDetailDirty(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  if (!key || !dirtyRecords.has(key)) return false;
  dirtyRecords.delete(key);
  recheckRecords.delete(key);
  return true;
}

export function peekRecordDetailRecheck(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  return Boolean(key && recheckRecords.has(key));
}

export function clearRecordDetailRecheck(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  if (key) recheckRecords.delete(key);
}

export function recordRecordDetailFingerprint(moduleKey, recordId, appKey, snapshot = {}) {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  if (!key) return;

  const updatedAtMs = snapshot.updatedAtMs == null ? null : Number(snapshot.updatedAtMs);
  fingerprints.set(key, {
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
    fetchedAt: Date.now(),
  });
}

export function getRecordDetailFingerprint(moduleKey, recordId, appKey = '') {
  const key = recordDetailFreshnessKey(moduleKey, recordId, appKey);
  return key ? fingerprints.get(key) ?? null : null;
}

export function resetRecordDetailFreshnessState() {
  dirtyRecords.clear();
  recheckRecords.clear();
  fingerprints.clear();
}

export function extractRecordUpdatedAtMs(record) {
  if (!record || typeof record !== 'object') return null;
  const raw = record.updatedAt ?? record.modifiedTime ?? record.updated_at ?? record.modified_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}
