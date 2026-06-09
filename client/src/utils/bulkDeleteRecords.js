import apiClient from '@/utils/apiClient';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { allSettledWithConcurrency } from '@/utils/allSettledWithConcurrency';
import { yieldToUi } from '@/utils/uiYield';

export class BulkDeleteCancelledError extends Error {
  constructor() {
    super('Bulk delete cancelled');
    this.name = 'BulkDeleteCancelledError';
  }
}

/** Modules with POST /api/modules/:moduleKey/records/bulk-delete (batched moveToTrash). */
const BULK_DELETE_API_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'items',
  'cases',
  'quotes',
]);

/** Large selections: server batches with insertMany/bulkWrite (trash) like bulk-purge. */
const BULK_DELETE_REQUEST_CHUNK = 5000;
const BULK_DELETE_REQUEST_CONCURRENCY = 3;
/** Select-all: resolve IDs in lightweight batches, then delete with parallel chunks. */
const BULK_DELETE_RESOLVE_BATCH_SIZE = 5000;

function throwIfCancelled(shouldCancel) {
  if (typeof shouldCancel === 'function' && shouldCancel()) {
    throw new BulkDeleteCancelledError();
  }
}

function aggregateBulkDeleteOutcome(acc, chunkOutcome) {
  return {
    deletedCount: acc.deletedCount + chunkOutcome.deletedCount,
    failedCount: acc.failedCount + chunkOutcome.failedCount,
    requestedCount: acc.requestedCount + chunkOutcome.requestedCount,
    firstError: acc.firstError || chunkOutcome.firstError,
  };
}

async function postBulkDeleteChunk(moduleKey, body, options) {
  const response = await apiClient.post(`/modules/${moduleKey}/records/bulk-delete`, {
    ...body,
    appKey: options.appKey,
  });
  if (!response?.success) {
    throw new Error(response?.message || 'Bulk delete failed');
  }

  if (body.resolveOnly) {
    const ids = (response.data?.ids || []).map((id) => String(id));
    return {
      deletedCount: 0,
      failedCount: 0,
      requestedCount: 0,
      resolvedIds: ids,
      hasMore: Boolean(response.data?.hasMore),
      lastId: response.data?.lastId ? String(response.data.lastId) : null,
      firstError: null,
    };
  }

  const deletedCount = Number(response.data?.deletedCount ?? 0);
  const failedCount = Number(response.data?.failedCount ?? 0);
  const requestedCount = Number(
    response.data?.requestedCount ?? (body.ids?.length || 0)
  );
  const failures = response.data?.failures || [];
  const firstFailure = failures[0];
  return {
    deletedCount,
    failedCount,
    requestedCount,
    hasMore: Boolean(response.data?.hasMore),
    lastId: response.data?.lastId ? String(response.data.lastId) : null,
    firstError: failedCount > 0
      ? Object.assign(new Error(firstFailure?.message || response.message || 'Bulk delete failed'), {
        response: { data: { message: firstFailure?.message, blocked: firstFailure?.blocked } },
        status: firstFailure?.blocked ? 400 : undefined,
      })
      : null,
  };
}

/**
 * Select-all phase 1: paginate matching IDs only (no trash snapshots / dependency work).
 */
async function resolveMatchingIds(moduleKey, options) {
  const { onProgress, shouldCancel, listQuery, excludedIds, expectedCount } = options;
  const ids = [];
  let afterId = null;
  let resolved = 0;

  await onProgress?.({ processed: 0, total: expectedCount || 0, phase: 'resolving' });
  await yieldToUi();

  do {
    throwIfCancelled(shouldCancel);
    const chunkOutcome = await postBulkDeleteChunk(moduleKey, {
      deleteMatching: true,
      resolveOnly: true,
      listQuery: listQuery || {},
      excludedIds: excludedIds || [],
      batchSize: BULK_DELETE_RESOLVE_BATCH_SIZE,
      afterId,
    }, options);

    ids.push(...(chunkOutcome.resolvedIds || []));
    resolved = ids.length;
    await onProgress?.({
      processed: resolved,
      total: expectedCount || resolved,
      phase: 'resolving',
    });
    await yieldToUi();

    if (!chunkOutcome.hasMore) break;
    afterId = chunkOutcome.lastId;
  } while (afterId);

  return [...new Set(ids)];
}

async function bulkDeleteViaApi(moduleKey, uniqueIds, options) {
  const { onProgress, shouldCancel } = options;
  const total = uniqueIds.length;
  await onProgress?.({ processed: 0, total, phase: 'deleting' });
  await yieldToUi();

  if (options.deleteMatching) {
    const expectedTotal = Number(options.expectedCount || 0);
    const resolvedIds = await resolveMatchingIds(moduleKey, options);
    if (resolvedIds.length === 0) {
      return { deletedCount: 0, failedCount: 0, requestedCount: 0, firstError: null };
    }
    return bulkDeleteViaApi(moduleKey, resolvedIds, {
      ...options,
      deleteMatching: false,
      expectedCount: expectedTotal || resolvedIds.length,
    });
  }

  if (uniqueIds.length <= BULK_DELETE_REQUEST_CHUNK) {
    throwIfCancelled(shouldCancel);
    await yieldToUi();
    const outcome = await postBulkDeleteChunk(moduleKey, { ids: uniqueIds }, options);
    await onProgress?.({ processed: outcome.deletedCount, total, phase: 'deleting' });
    return outcome;
  }

  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += BULK_DELETE_REQUEST_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + BULK_DELETE_REQUEST_CHUNK));
  }

  let processedSoFar = 0;
  let outcome = { deletedCount: 0, failedCount: 0, requestedCount: 0, firstError: null };

  const chunkOutcomes = await allSettledWithConcurrency(
    chunks,
    async (chunkIds) => {
      throwIfCancelled(shouldCancel);
      const chunkOutcome = await postBulkDeleteChunk(moduleKey, { ids: chunkIds }, options);
      processedSoFar += chunkIds.length;
      await onProgress?.({ processed: Math.min(processedSoFar, total), total, phase: 'deleting' });
      return chunkOutcome;
    },
    BULK_DELETE_REQUEST_CONCURRENCY
  );

  for (let i = 0; i < chunkOutcomes.length; i += 1) {
    const result = chunkOutcomes[i];
    if (result.status === 'fulfilled') {
      outcome = aggregateBulkDeleteOutcome(outcome, result.value);
    } else {
      if (result.reason instanceof BulkDeleteCancelledError) {
        throw result.reason;
      }
      outcome.failedCount += chunks[i]?.length ?? 0;
      if (!outcome.firstError) outcome.firstError = result.reason;
    }
  }

  await onProgress?.({ processed: total, total, phase: 'deleting' });
  return outcome;
}

/**
 * @param {string} moduleKey
 * @param {string[]} ids
 * @param {object} [options]
 * @param {string} [options.appKey]
 * @param {string} [options.routePath]
 * @param {(payload: { processed: number, total: number, phase?: string }) => void} [options.onProgress]
 * @param {() => boolean} [options.shouldCancel]
 * @returns {Promise<{ deletedCount: number, failedCount: number, firstError: Error|null }>}
 */
export async function bulkDeleteRecords(moduleKey, ids, options = {}) {
  const { onProgress, shouldCancel } = options;
  const uniqueIds = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  const mk = String(moduleKey || '').toLowerCase().trim();

  if (options.deleteMatching && BULK_DELETE_API_MODULES.has(mk)) {
    try {
      return await bulkDeleteViaApi(mk, [], options);
    } catch (error) {
      if (error instanceof BulkDeleteCancelledError) {
        throw error;
      }
      if (error?.response?.data?.code !== 'MODULE_BULK_DELETE_UNSUPPORTED') {
        throw error;
      }
    }
  }

  if (uniqueIds.length === 0) {
    return { deletedCount: 0, failedCount: 0, requestedCount: 0, firstError: null };
  }

  const total = uniqueIds.length;

  if (BULK_DELETE_API_MODULES.has(mk)) {
    try {
      return await bulkDeleteViaApi(mk, uniqueIds, options);
    } catch (error) {
      if (error instanceof BulkDeleteCancelledError) {
        throw error;
      }
      if (error?.response?.data?.code !== 'MODULE_BULK_DELETE_UNSUPPORTED') {
        throw error;
      }
    }
  }

  const base = getModuleRecordCrudPathBase(mk, options);
  let processed = 0;
  await onProgress?.({ processed: 0, total, phase: 'deleting' });
  await yieldToUi();

  const results = await allSettledWithConcurrency(
    uniqueIds,
    async (id) => {
      throwIfCancelled(shouldCancel);
      await apiClient.delete(`${base}/${id}`);
      processed += 1;
      if (processed % 10 === 0 || processed === total) {
        await onProgress?.({ processed, total, phase: 'deleting' });
      }
    },
    80
  );
  await onProgress?.({ processed: total, total, phase: 'deleting' });

  const failures = results.filter((r) => r.status === 'rejected');
  const cancelledFailure = failures.find((r) => r.reason instanceof BulkDeleteCancelledError);
  if (cancelledFailure) {
    throw cancelledFailure.reason;
  }

  return {
    deletedCount: uniqueIds.length - failures.length,
    failedCount: failures.length,
    requestedCount: uniqueIds.length,
    firstError: failures.length > 0 ? failures[0].reason : null,
  };
}
