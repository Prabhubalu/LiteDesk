import { computed, ref, shallowRef, triggerRef } from 'vue';

/**
 * List selection: loaded page vs all records matching the current query.
 * Uses ID sets only (no full row copies) to keep memory and render cost low.
 */
export function useListSelection({ getRowId, getTotalMatching, getLoadedCount }) {
  /** @type {import('vue').Ref<'none' | 'page' | 'all'>} */
  const mode = ref('none');
  const selectedIds = shallowRef(new Set());
  const excludedIds = shallowRef(new Set());

  const totalMatching = computed(() => Number(getTotalMatching?.() ?? 0) || 0);
  const loadedCount = computed(() => Number(getLoadedCount?.() ?? 0) || 0);

  const selectionCount = computed(() => {
    if (mode.value === 'all') {
      return Math.max(0, totalMatching.value - excludedIds.value.size);
    }
    return selectedIds.value.size;
  });

  const selectAllMatching = computed(() => mode.value === 'all');

  const showSelectAllMatchingLink = computed(() => {
    if (mode.value === 'all') return false;
    const total = totalMatching.value;
    const loaded = loadedCount.value;
    if (total <= loaded || loaded === 0) return false;
    if (mode.value !== 'page') return false;
    return selectedIds.value.size >= loaded;
  });

  const hasSelection = computed(() => selectionCount.value > 0);

  function syncSet(targetRef, mutator) {
    const next = new Set(targetRef.value);
    mutator(next);
    targetRef.value = next;
    triggerRef(targetRef);
  }

  function clear() {
    mode.value = 'none';
    selectedIds.value = new Set();
    excludedIds.value = new Set();
    triggerRef(selectedIds);
    triggerRef(excludedIds);
  }

  function isRowSelected(row) {
    const id = getRowId(row);
    if (!id) return false;
    if (mode.value === 'all') {
      return !excludedIds.value.has(id);
    }
    return selectedIds.value.has(id);
  }

  function toggleRow(row) {
    const id = getRowId(row);
    if (!id) return;

    if (mode.value === 'all') {
      syncSet(excludedIds, (set) => {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      });
      if (excludedIds.value.size >= totalMatching.value) {
        clear();
      }
      return;
    }

    syncSet(selectedIds, (set) => {
      if (set.has(id)) set.delete(id);
      else set.add(id);
    });
    if (selectedIds.value.size === 0) {
      mode.value = 'none';
    } else {
      mode.value = 'page';
    }
  }

  function selectLoadedRows(rows) {
    const ids = rows.map(getRowId).filter(Boolean);
    if (!ids.length) return;
    mode.value = 'page';
    selectedIds.value = new Set(ids);
    excludedIds.value = new Set();
    triggerRef(selectedIds);
    triggerRef(excludedIds);
  }

  function selectAllMatchingRecords() {
    if (totalMatching.value <= 0) return;
    mode.value = 'all';
    selectedIds.value = new Set();
    excludedIds.value = new Set();
    triggerRef(selectedIds);
    triggerRef(excludedIds);
  }

  function toggleSelectAllLoaded(rows) {
    const allLoadedSelected =
      mode.value === 'all' ||
      (rows.length > 0 && rows.every((row) => isRowSelected(row)));

    if (allLoadedSelected) {
      clear();
      return;
    }
    selectLoadedRows(rows);
  }

  function pruneToLoadedRows(rows) {
    const loadedIdSet = new Set(rows.map(getRowId).filter(Boolean));
    if (mode.value === 'all') {
      syncSet(excludedIds, (set) => {
        for (const id of [...set]) {
          if (!loadedIdSet.has(id)) set.delete(id);
        }
      });
      return;
    }
    syncSet(selectedIds, (set) => {
      for (const id of [...set]) {
        if (!loadedIdSet.has(id)) set.delete(id);
      }
    });
    if (selectedIds.value.size === 0 && mode.value === 'page') {
      mode.value = 'none';
    }
  }

  /** Rows from the loaded dataset for UI that still expects row objects. */
  function getSelectedRowsFromLoaded(rows) {
    if (mode.value === 'all') {
      return rows.filter((row) => isRowSelected(row));
    }
    return rows.filter((row) => selectedIds.value.has(getRowId(row)));
  }

  function getBulkPayload() {
    return {
      mode: mode.value,
      selectedIds: [...selectedIds.value],
      excludedIds: [...excludedIds.value],
      totalMatching: totalMatching.value,
      selectionCount: selectionCount.value
    };
  }

  return {
    mode,
    selectedIds,
    excludedIds,
    totalMatching,
    loadedCount,
    selectionCount,
    selectAllMatching,
    showSelectAllMatchingLink,
    hasSelection,
    clear,
    isRowSelected,
    toggleRow,
    selectLoadedRows,
    selectAllMatchingRecords,
    toggleSelectAllLoaded,
    pruneToLoadedRows,
    getSelectedRowsFromLoaded,
    getBulkPayload
  };
}
