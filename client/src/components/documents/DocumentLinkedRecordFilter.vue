<template>
  <div class="flex min-w-[12rem] flex-1 items-center gap-2">
    <button
      v-if="!modelValue"
      type="button"
      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      @click="openPicker"
    >
      {{ t('documents.filterLinkedRecordSelect') }}
    </button>
    <div
      v-else
      class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <span class="truncate text-gray-900 dark:text-white">{{ selectedLabel }}</span>
      <button
        type="button"
        class="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        @click="clearSelection"
      >
        {{ t('documents.filterLinkedRecordClear') }}
      </button>
    </div>

    <Dialog :open="showPicker" class="relative z-50" @close="closePicker">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <DialogTitle class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('documents.filterLinkedRecordPickerTitle') }}
            </DialogTitle>
            <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="closePicker">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <input
              v-model="searchQuery"
              type="search"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              :placeholder="t('documents.filterLinkedRecordSearchPlaceholder')"
            />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div v-if="loading" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('documents.recordDocumentsLoading') }}
            </div>
            <div v-else-if="!records.length" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('documents.linkExistingNoResults') }}
            </div>
            <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <li
                v-for="record in records"
                :key="record._id"
                class="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                @click="selectRecord(record)"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ getRecordLabel(record) }}</p>
                  <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{{ record._id }}</p>
                </div>
              </li>
            </ul>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { getRecordLabel } from '@/utils/recordDisplay';

const props = defineProps({
  moduleKey: { type: String, required: true },
  modelValue: { type: String, default: '' },
  selectedLabel: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'update:selectedLabel']);

const { t } = useI18n();

const showPicker = ref(false);
const searchQuery = ref('');
const loading = ref(false);
const records = ref([]);

function endpointForModule(moduleKey) {
  const mk = String(moduleKey || '').toLowerCase().trim();
  const config = getModuleListConfig(mk);
  if (config?.apiEndpoint) {
    return config.apiEndpoint.startsWith('/') ? config.apiEndpoint : `/${config.apiEndpoint}`;
  }
  return getModuleRecordCrudPathBase(mk);
}

async function fetchRecords() {
  if (!props.moduleKey) {
    records.value = [];
    return;
  }
  loading.value = true;
  try {
    const params = { limit: 25, page: 1 };
    const q = searchQuery.value.trim();
    if (q) params.search = q;
    const endpoint = endpointForModule(props.moduleKey);
    const res = await apiClient.get(endpoint, { params });
    let rows = [];
    if (res?.success) {
      rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    } else if (Array.isArray(res)) {
      rows = res;
    }
    records.value = rows.filter((row) => row?._id);
  } catch {
    records.value = [];
  } finally {
    loading.value = false;
  }
}

function openPicker() {
  showPicker.value = true;
  searchQuery.value = '';
  fetchRecords();
}

function closePicker() {
  showPicker.value = false;
}

function selectRecord(record) {
  if (!record?._id) return;
  emit('update:modelValue', String(record._id));
  emit('update:selectedLabel', getRecordLabel(record));
  closePicker();
}

function clearSelection() {
  emit('update:modelValue', '');
  emit('update:selectedLabel', '');
}

let searchTimer = null;
watch(searchQuery, () => {
  if (!showPicker.value) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    fetchRecords();
  }, 300);
});

watch(() => props.moduleKey, () => {
  if (!props.modelValue) {
    emit('update:selectedLabel', '');
  }
});
</script>
