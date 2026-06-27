import {
  RECORD_DETAIL_QUICK_TRUST_MS,
  RECORD_DETAIL_STALE_TTL_MS,
  clearRecordDetailRecheck,
  consumeRecordDetailDirty,
  getRecordDetailFingerprint,
  peekRecordDetailRecheck,
} from '@/utils/recordDetailFreshness';
import { fetchRecordUpdatedAtMs, supportsServerRecordMeta } from '@/utils/recordDetailMetaApi';

/**
 * Decide whether a keep-alive record page should refetch on activate.
 * @returns {Promise<'skip'|'refresh'>}
 */
export async function resolveRecordDetailRefreshOnActivate(freshness, recordId) {
  if (!freshness || !recordId) return 'skip';

  const moduleKey = freshness.moduleKey;
  const appKey = freshness.appKey || '';

  if (consumeRecordDetailDirty(moduleKey, recordId, appKey)) {
    return 'refresh';
  }

  if (!peekRecordDetailRecheck(moduleKey, recordId, appKey)) {
    return 'skip';
  }

  const fingerprint = getRecordDetailFingerprint(moduleKey, recordId, appKey);
  const cachedMs = typeof freshness.getUpdatedAtMs === 'function'
    ? freshness.getUpdatedAtMs()
    : null;
  const age = Date.now() - (fingerprint?.fetchedAt ?? 0);

  if (age < RECORD_DETAIL_QUICK_TRUST_MS) {
    clearRecordDetailRecheck(moduleKey, recordId, appKey);
    return 'skip';
  }

  let serverMs = null;
  if (supportsServerRecordMeta(moduleKey)) {
    serverMs = await fetchRecordUpdatedAtMs(moduleKey, recordId);
  }

  clearRecordDetailRecheck(moduleKey, recordId, appKey);

  const baselineMs = fingerprint?.updatedAtMs ?? cachedMs;
  if (serverMs != null && baselineMs != null && serverMs <= baselineMs) {
    return 'skip';
  }

  if (!fingerprint && cachedMs == null) {
    return 'refresh';
  }

  if (age >= RECORD_DETAIL_STALE_TTL_MS) {
    return 'refresh';
  }

  if (serverMs != null && baselineMs != null && serverMs > baselineMs) {
    return 'refresh';
  }

  return 'skip';
}
