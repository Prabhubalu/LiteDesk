<template>
  <div class="flex flex-wrap items-center justify-end gap-1.5">
    <button
      v-for="action in workflowActions"
      :key="action.key"
      type="button"
      class="inline-flex items-center rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
      :class="action.className"
      :disabled="busy"
      @click="action.handler"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  record: { type: Object, default: null },
  section: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const busy = ref(false);
const emitSectionUpdated = inject('emitSectionUpdated', null);
const recordPageNotify = inject('recordPageNotify', null);

function notify(type, message) {
  if (typeof recordPageNotify === 'function') {
    recordPageNotify({ type, message });
    return;
  }
  if (type === 'error') console.error(message);
}

function adjustmentId() {
  return (
    props.record?.inventoryAdjustmentId ||
    props.record?._id ||
    props.record?.id ||
    null
  );
}

const status = computed(() => String(props.record?.status || '').toLowerCase());

async function post() {
  const id = adjustmentId();
  if (!id || busy.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/inventory/adjustments/${id}/post`);
    const data = res?.data?.adjustment ?? res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') {
      emitSectionUpdated({ payload: data });
    }
    notify('success', t('records.adjPosted'));
  } catch (err) {
    notify('error', err?.message || t('records.adjActionFailed'));
  } finally {
    busy.value = false;
  }
}

const workflowActions = computed(() => {
  const list = [];
  if (status.value === 'draft') {
    list.push({
      key: 'post',
      label: t('records.adjPost'),
      className:
        'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600',
      handler: post
    });
  }
  return list;
});
</script>
