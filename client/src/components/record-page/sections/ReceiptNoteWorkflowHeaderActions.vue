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
import { canVerifyReceiptNote } from '@/constants/receiptNoteLifecycle';

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

function recordId() {
  return props.record?._id || props.record?.id || null;
}

const status = computed(() => String(props.record?.status || '').toLowerCase());

async function verify() {
  const id = recordId();
  if (!id || busy.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/inventory/receipt-notes/${id}/verify`);
    const data = res?.data ?? res;
    if (typeof emitSectionUpdated === 'function') {
      emitSectionUpdated({ payload: data });
    }
    notify('success', t('records.rnVerified'));
  } catch (err) {
    notify('error', err?.message || t('records.rnActionFailed'));
  } finally {
    busy.value = false;
  }
}

const workflowActions = computed(() => {
  const list = [];
  if (canVerifyReceiptNote(status.value)) {
    list.push({
      key: 'verify',
      label: t('records.rnVerify'),
      className:
        'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600',
      handler: verify
    });
  }
  return list;
});
</script>
