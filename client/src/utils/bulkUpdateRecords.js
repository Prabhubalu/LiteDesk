import apiClient from '@/utils/apiClient';
import { allSettledWithConcurrency } from '@/utils/allSettledWithConcurrency';
import { yieldToUi } from '@/utils/uiYield';
import { BULK_UPDATE_API_MODULES } from '@/utils/massEditFieldPolicy';

export class BulkUpdateCancelledError extends Error {
  constructor() {
    super('Bulk update cancelled');
    this.name = 'BulkUpdateCancelledError';
  }
}

const BULK_UPDATE_REQUEST_CHUNK = 5000;
const BULK_UPDATE_REQUEST_CONCURRENCY = 3;
const BULK_UPDATE_MATCHING_BATCH_SIZE = 500;

function throwIfCancelled(shouldCancel) {
  if (typeof shouldCancel === 'function' && shouldCancel()) {
    throw new BulkUpdateCancelledError();
  }
}

function aggregateBulkUpdateOutcome(acc, chunkOutcome) {
  return {
    updatedCount: acc.updatedCount + chunkOutcome.updatedCount,
    skippedCount: acc.skippedCount + chunkOutcome.skippedCount,
    failedCount: acc.failedCount + chunkOutcome.failedCount,
    requestedCount: acc.requestedCount + chunkOutcome.requestedCount,
    firstError: acc.firstError || chunkOutcome.firstError,
    failures: [...(acc.failures || []), ...(chunkOutcome.failures || [])],
  };
}

async function patchBulkUpdateChunk(moduleKey, body, options) {
  const response = await apiClient.patch(`/modules/${moduleKey}/records/bulk-update`, {
    ...body,
    appKey: options.appKey,
  });
  if (!response?.success) {
    throw new Error(response?.message || 'Bulk update failed');
  }
  const updatedCount = Number(response.data?.updatedCount ?? 0);
  const skippedCount = Number(response.data?.skippedCount ?? 0);
  const failedCount = Number(response.data?.failedCount ?? 0);
  const requestedCount = Number(
    response.data?.requestedCount ?? (body.ids?.length || 0)
  );
  const failures = response.data?.failures || [];
  const firstFailure = failures[0];
  return {
    updatedCount,
    skippedCount,
    failedCount,
    requestedCount,
    failures,
    hasMore: Boolean(response.data?.hasMore),
    lastId: response.data?.lastId ? String(response.data.lastId) : null,
    firstError: failedCount > 0
      ? Object.assign(new Error(firstFailure?.message || response.message || 'Bulk update failed'), {
        response: { data: { message: firstFailure?.message, code: firstFailure?.code } },
      })
      : null,
  };
}

async function bulkUpdateViaApi(moduleKey, uniqueIds, updates, options) {
  const { onProgress, shouldCancel } = options;
  const total = uniqueIds.length;
  await onProgress?.({ processed: 0, total, phase: 'updating' });
  await yieldToUi();

  if (options.updateMatching) {
    const expectedTotal = Number(options.expectedCount || 0);
    let processed = 0;
    let afterId = null;
    let outcome = {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      requestedCount: 0,
      firstError: null,
      failures: [],
    };

    await onProgress?.({ processed: 0, total: expectedTotal, phase: 'updating' });
    await yieldToUi();

    do {
      throwIfCancelled(shouldCancel);
      const chunkOutcome = await patchBulkUpdateChunk(moduleKey, {
        updateMatching: true,
        updates,
        listQuery: options.listQuery || {},
        excludedIds: options.excludedIds || [],
        batchSize: BULK_UPDATE_MATCHING_BATCH_SIZE,
        afterId,
      }, options);

      outcome = aggregateBulkUpdateOutcome(outcome, chunkOutcome);
      processed = outcome.updatedCount + outcome.skippedCount;
      await onProgress?.({
        processed,
        total: expectedTotal || processed,
        phase: 'updating',
      });
      await yieldToUi();

      if (chunkOutcome.firstError) {
        return outcome;
      }
      if (!chunkOutcome.hasMore) break;
      afterId = chunkOutcome.lastId;
    } while (afterId);

    await onProgress?.({
      processed,
      total: expectedTotal || processed,
      phase: 'updating',
    });
    return outcome;
  }

  if (uniqueIds.length <= BULK_UPDATE_REQUEST_CHUNK) {
    throwIfCancelled(shouldCancel);
    await yieldToUi();
    const outcome = await patchBulkUpdateChunk(moduleKey, { ids: uniqueIds, updates }, options);
    await onProgress?.({
      processed: outcome.updatedCount + outcome.skippedCount,
      total,
      phase: 'updating',
    });
    return outcome;
  }

  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += BULK_UPDATE_REQUEST_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + BULK_UPDATE_REQUEST_CHUNK));
  }

  let processedSoFar = 0;
  let outcome = {
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    requestedCount: 0,
    firstError: null,
    failures: [],
  };

  const chunkOutcomes = await allSettledWithConcurrency(
    chunks,
    async (chunkIds) => {
      throwIfCancelled(shouldCancel);
      const chunkOutcome = await patchBulkUpdateChunk(moduleKey, { ids: chunkIds, updates }, options);
      processedSoFar += chunkIds.length;
      await onProgress?.({ processed: Math.min(processedSoFar, total), total, phase: 'updating' });
      return chunkOutcome;
    },
    BULK_UPDATE_REQUEST_CONCURRENCY
  );

  for (let i = 0; i < chunkOutcomes.length; i += 1) {
    const result = chunkOutcomes[i];
    if (result.status === 'fulfilled') {
      outcome = aggregateBulkUpdateOutcome(outcome, result.value);
    } else {
      if (result.reason instanceof BulkUpdateCancelledError) {
        throw result.reason;
      }
      outcome.failedCount += chunks[i]?.length ?? 0;
      if (!outcome.firstError) outcome.firstError = result.reason;
    }
  }

  await onProgress?.({ processed: total, total, phase: 'updating' });
  return outcome;
}

/**
 * @param {string} moduleKey
 * @param {string[]} ids
 * @param {object} updates
 * @param {object} [options]
 */
export async function bulkUpdateRecords(moduleKey, ids, updates, options = {}) {
  const { onProgress, shouldCancel } = options;
  const uniqueIds = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  const mk = String(moduleKey || '').toLowerCase().trim();

  if (!BULK_UPDATE_API_MODULES.has(mk)) {
    const error = new Error(`Bulk update is not supported for module: ${mk}`);
    error.code = 'MODULE_BULK_UPDATE_UNSUPPORTED';
    throw error;
  }

  if (options.updateMatching) {
    return bulkUpdateViaApi(mk, [], updates, options);
  }

  if (uniqueIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      requestedCount: 0,
      firstError: null,
      failures: [],
    };
  }

  return bulkUpdateViaApi(mk, uniqueIds, updates, { ...options, onProgress, shouldCancel });
}
