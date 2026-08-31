<script setup>
import { onMounted, onUnmounted } from 'vue';
import { markModuleListDirty } from '@/utils/moduleListFreshness';
import { markRecordDetailDirty } from '@/utils/recordDetailFreshness';
import { resolveImportListModuleKey } from '@/utils/importListModuleMatch';

function markDirtyFromModuleKey(moduleKey, appKey = '') {
  if (!moduleKey) return;
  markModuleListDirty(moduleKey, appKey);
}

function onImportComplete(event) {
  const module = event?.detail?.module;
  if (!module) return;
  markDirtyFromModuleKey(resolveImportListModuleKey(module));
}

function onBulkMutationComplete(event) {
  const moduleKey = event?.detail?.moduleKey;
  markDirtyFromModuleKey(moduleKey);
}

function onRecordCreated(event) {
  const moduleKey = event?.detail?.moduleKey;
  const record = event?.detail?.record;
  const recordId = record?._id || record?.id;
  markDirtyFromModuleKey(moduleKey);
  if (moduleKey && recordId) {
    markRecordDetailDirty(moduleKey, recordId);
  }
}

function onRecordUpdated(event) {
  const moduleKey = event?.detail?.moduleKey;
  const appKey = event?.detail?.appKey || '';
  const record = event?.detail?.record;
  const recordId = record?._id || record?.id || event?.detail?.recordId;
  markDirtyFromModuleKey(moduleKey, appKey);
  if (moduleKey && recordId) {
    markRecordDetailDirty(moduleKey, recordId);
  }
}

function onEventCreated() {
  markDirtyFromModuleKey('events');
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  window.addEventListener('arivu:import-complete', onImportComplete);
  window.addEventListener('arivu:bulk-delete-complete', onBulkMutationComplete);
  window.addEventListener('arivu:bulk-update-complete', onBulkMutationComplete);
  window.addEventListener('arivu:record-created', onRecordCreated);
  window.addEventListener('arivu:record-updated', onRecordUpdated);
  window.addEventListener('arivu:event-created', onEventCreated);
});

onUnmounted(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('arivu:import-complete', onImportComplete);
  window.removeEventListener('arivu:bulk-delete-complete', onBulkMutationComplete);
  window.removeEventListener('arivu:bulk-update-complete', onBulkMutationComplete);
  window.removeEventListener('arivu:record-created', onRecordCreated);
  window.removeEventListener('arivu:record-updated', onRecordUpdated);
  window.removeEventListener('arivu:event-created', onEventCreated);
});
</script>

<template><span class="hidden" aria-hidden="true" /></template>
