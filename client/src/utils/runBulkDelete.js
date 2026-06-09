import { bulkDeleteRecords, BulkDeleteCancelledError } from '@/utils/bulkDeleteRecords';
import { useBulkDeleteProgressStore } from '@/stores/bulkDeleteProgress';
import { installBulkDeleteGuard, uninstallBulkDeleteGuard } from '@/composables/bulkDeleteGuard';
import { yieldToUi } from '@/utils/uiYield';

/**
 * Run bulk delete with global progress + navigation guards (awaits completion).
 */
export async function runBulkDelete(params) {
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
    store.start({ moduleKey: params.moduleKey, phase: 'deleting', total: initialTotal });
  } else {
    store.updateProgress({ total: initialTotal, phase: 'deleting' });
  }
  await yieldToUi();

  try {
    if (store.cancelRequested) {
      throw new BulkDeleteCancelledError();
    }

    let outcome;

    if (isSelectAll) {
      outcome = await bulkDeleteRecords(params.moduleKey, [], {
        ...params.options,
        deleteMatching: true,
        listQuery: params.listQuery || {},
        excludedIds: selection?.excludedIds || [],
        expectedCount: initialTotal,
        onProgress: async ({ processed, total, phase }) => {
          store.updateProgress({
            phase: phase || 'deleting',
            processed: processed ?? 0,
            total: total || initialTotal
          });
          await yieldToUi();
        },
        shouldCancel: () => store.cancelRequested,
      });
    } else {
      if (!ids.length) {
        return {
          deletedCount: 0,
          failedCount: 0,
          requestedCount: 0,
          firstError: null,
          cancelled: false
        };
      }

      outcome = await bulkDeleteRecords(params.moduleKey, ids, {
        ...params.options,
        onProgress: async ({ processed, total, phase }) => {
          store.updateProgress({ phase: phase || 'deleting', processed, total });
          await yieldToUi();
        },
        shouldCancel: () => store.cancelRequested,
      });
    }

    return {
      ...outcome,
      requestedCount: outcome.requestedCount || initialTotal,
      cancelled: false
    };
  } catch (error) {
    if (error instanceof BulkDeleteCancelledError) {
      return {
        deletedCount: Number(store.processed || 0),
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
      window.dispatchEvent(new CustomEvent('litedesk:bulk-delete-complete', {
        detail: { moduleKey: completedModuleKey },
      }));
    }
  }
}

/**
 * Start bulk delete without blocking the caller; optional onComplete / onError.
 */
export function startBulkDelete({ onComplete, onError, ...params }) {
  void runBulkDelete(params)
    .then((outcome) => {
      onComplete?.(outcome);
    })
    .catch((error) => {
      if (onError) {
        onError(error);
      } else {
        console.error('[startBulkDelete]', error);
      }
    });
}
