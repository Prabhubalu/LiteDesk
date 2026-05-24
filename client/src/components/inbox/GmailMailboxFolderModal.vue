<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-folders-title"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[min(90vh,620px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        @click.stop
      >
        <div class="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 id="gmail-folders-title" class="text-lg font-semibold text-gray-900 dark:text-white">
              Mailbox folders
            </h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Choose which Gmail labels Arivu imports. Sync runs on a schedule and when you use Sync now.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
            @click="close"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
          <div v-else-if="loading" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading folders from Gmail…
          </div>
          <template v-else>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              System labels (Inbox, Sent, categories) and your custom labels are listed. Select at least one.
            </p>
            <div
              class="mt-3 grid max-h-[min(52vh,360px)] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
            >
              <label
                v-for="row in labels"
                :key="row.id"
                class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              >
                <input
                  v-model="selectedSet"
                  type="checkbox"
                  class="mt-0.5 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  :value="row.id"
                >
                <span class="min-w-0">
                  <span class="font-medium text-gray-900 dark:text-white">{{ row.name }}</span>
                  <span class="mt-0.5 block font-mono text-[10px] text-gray-400 dark:text-gray-500">{{ row.id }}</span>
                </span>
              </label>
            </div>
          </template>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            :disabled="saving"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            :disabled="loading || !!loadError || saving || selectedSet.length === 0"
            @click="save"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mailboxId: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'saved']);

const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const labels = ref([]);
const selectedSet = ref([]);

async function loadLabels() {
  loadError.value = '';
  labels.value = [];
  selectedSet.value = [];
  if (!props.mailboxId) {
    loadError.value = 'No mailbox selected.';
    return;
  }
  loading.value = true;
  try {
    const res = await apiClient.get(`/mailboxes/${encodeURIComponent(props.mailboxId)}/inbox-sync/google/labels`);
    if (!res?.success) {
      loadError.value = res?.message || 'Could not load folders';
      return;
    }
    labels.value = Array.isArray(res.data?.labels) ? res.data.labels : [];
    const sel = Array.isArray(res.data?.selectedLabelIds) ? res.data.selectedLabelIds.map(String) : [];
    selectedSet.value = sel.length ? [...sel] : ['INBOX'];
  } catch (err) {
    loadError.value = err?.response?.data?.message || err?.message || 'Could not load folders';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.mailboxId) {
      loadLabels();
    }
  }
);

watch(
  () => props.mailboxId,
  (id) => {
    if (props.modelValue && id) {
      loadLabels();
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

async function save() {
  if (!props.mailboxId || selectedSet.value.length === 0) return;
  saving.value = true;
  try {
    const res = await apiClient.patch(
      `/mailboxes/${encodeURIComponent(props.mailboxId)}/inbox-sync/google/sync-labels`,
      { labelIds: [...selectedSet.value] }
    );
    if (!res?.success) {
      loadError.value = res?.message || 'Save failed';
      return;
    }
    emit('saved', res.data);
    emit('update:modelValue', false);
  } catch (err) {
    loadError.value = err?.response?.data?.message || err?.message || 'Save failed';
  } finally {
    saving.value = false;
  }
}
</script>
