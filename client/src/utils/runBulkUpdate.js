import { bulkUpdateRecords, BulkUpdateCancelledError } from '@/utils/bulkUpdateRecords';
import { useBulkDeleteProgressStore } from '@/stores/bulkDeleteProgress';
import { installBulkDeleteGuard, uninstallBulkDeleteGuard } from '@/composables/bulkDeleteGuard';
import { yieldToUi } from '@/utils/uiYield';

/**
 * Run bulk update with global progress (awaits completion).
 */
export async function runBulkUpdate(params) {
  const store = useBulkDeleteProgressStore();
  installBulkDeleteGuard(store);

  const selection = params.selection;
  const pageIds = params.pageIds || params.ids || [];
  const isSelectAll = selection?.mode === 'all';
  const pageSelectedIds = selection?.mode === 'page' ? (selection.selectedIds || []) : [];
  const ids = [...new Set(
    (pageSelectedIds.length ? pageSelectedIds : pageIds)
      .map((id) => String(id).trim())
      .filter(Boolean)
  )];

  const initialTotal = isSelectAll
    ? Number(selection?.selectionCount || 0)
    : ids.length;

  if (!store.isActive) {
    store.start({
      moduleKey: params.moduleKey,
      operation: 'update',
      phase: 'updating',
      total: initialTotal,
    });
  } else {
    store.updateProgress({ total: initialTotal, phase: 'updating', operation: 'update' });
  }
  await yieldToUi();

  try {
    if (store.cancelRequested) {
      throw new BulkUpdateCancelledError();
    }

    let outcome;

    if (isSelectAll) {
      outcome = await bulkUpdateRecords(params.moduleKey, [], params.updates, {
        ...params.options,
        updateMatching: true,
        listQuery: params.listQuery || {},
        excludedIds: selection?.excludedIds || [],
        expectedCount: initialTotal,
        onProgress: async ({ processed, total }) => {
          store.updateProgress({
            phase: 'updating',
            processed: processed ?? 0,
            total: total || initialTotal,
          });
          await yieldToUi();
        },
        shouldCancel: () => store.cancelRequested,
      });
    } else {
      if (!ids.length) {
        return {
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          requestedCount: 0,
          firstError: null,
          cancelled: false,
        };
      }

      outcome = await bulkUpdateRecords(params.moduleKey, ids, params.updates, {
        ...params.options,
        onProgress: async ({ processed, total }) => {
          store.updateProgress({ phase: 'updating', processed, total });
          await yieldToUi();
        },
        shouldCancel: () => store.cancelRequested,
      });
    }

    return {
      ...outcome,
      requestedCount: outcome.requestedCount || initialTotal,
      cancelled: false,
    };
  } catch (error) {
    if (error instanceof BulkUpdateCancelledError) {
      return {
        updatedCount: Number(store.processed || 0),
        skippedCount: 0,
        failedCount: 0,
        firstError: null,
        cancelled: true,
      };
    }
    throw error;
  } finally {
    const completedModuleKey = store.moduleKey;
    store.finish();
    uninstallBulkDeleteGuard();
    if (completedModuleKey && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arivu:bulk-update-complete', {
        detail: { moduleKey: completedModuleKey },
      }));
    }
  }
}

export function startBulkUpdate({ onComplete, onError, ...params }) {
  void runBulkUpdate(params)
    .then((outcome) => {
      onComplete?.(outcome);
    })
    .catch((error) => {
      if (onError) {
        onError(error);
      } else {
        console.error('[startBulkUpdate]', error);
      }
    });
}
