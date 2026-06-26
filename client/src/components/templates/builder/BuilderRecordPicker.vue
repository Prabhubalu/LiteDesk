<template>
  <div class="relative w-full">
    <button
      v-if="!modelValue"
      type="button"
      :class="[ui.btnGhost, 'w-full justify-start text-xs']"
      :disabled="!moduleKey"
      @click="openPicker"
    >
      <MagnifyingGlassIcon class="h-4 w-4" />
      {{ t('templates.builderSampleRecordSelect') }}
    </button>
    <div
      v-else
      class="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
      :class="ui.border"
    >
      <span class="min-w-0 flex-1 truncate" :class="ui.textSubtle">{{ selectedLabel || modelValue }}</span>
      <button type="button" class="shrink-0 text-primary-600 dark:text-primary-400" @click="clearSelection">
        {{ t('templates.builderSampleRecordClear') }}
      </button>
    </div>

    <Dialog :open="showPicker" class="relative z-50" @close="closePicker">
      <div class="fixed inset-0 bg-neutral-950/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl shadow-xl"
          :class="ui.panel"
        >
          <div class="flex items-center justify-between border-b px-4 py-3" :class="ui.border">
            <DialogTitle :class="ui.heading">{{ t('templates.builderSampleRecordTitle') }}</DialogTitle>
            <button type="button" :class="ui.btnIcon" @click="closePicker">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="border-b px-4 py-3" :class="ui.border">
            <input
              v-model="searchQuery"
              type="search"
              :class="ui.input"
              :placeholder="t('templates.builderSampleRecordSearch')"
            />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div v-if="loading" class="px-4 py-8 text-center text-sm" :class="ui.textMuted">
              {{ t('states.loading') }}
            </div>
            <div v-else-if="!records.length" class="px-4 py-8 text-center text-sm" :class="ui.textMuted">
              {{ t('templates.builderSampleRecordEmpty') }}
            </div>
            <ul v-else class="divide-y" :class="ui.border">
              <li
                v-for="record in records"
                :key="record._id"
                class="cursor-pointer px-4 py-3 transition-colors"
                :class="ui.hoverRow"
                @click="selectRecord(record)"
              >
                <p class="truncate text-sm font-medium">{{ getRecordLabel(record) }}</p>
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
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { getRecordLabel } from '@/utils/recordDisplay';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  moduleKey: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  selectedLabel: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'update:selectedLabel']);

const { t } = useI18n();
const ui = useBuilderUi();

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
    const res = await apiClient.get(endpointForModule(props.moduleKey), { params });
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
  void fetchRecords();
}

function closePicker() {
  showPicker.value = false;
}

function selectRecord(record) {
  if (!record?._id) return;
  const label = getRecordLabel(record);
  emit('update:modelValue', String(record._id));
  emit('update:selectedLabel', label);
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
    void fetchRecords();
  }, 300);
});
</script>
