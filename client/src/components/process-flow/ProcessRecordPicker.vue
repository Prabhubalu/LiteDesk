<template>
  <div ref="rootEl" class="relative">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder || t('process.recordPickerSearchPh')"
      class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
      @input="onQueryInput"
      @focus="open = true"
    />
    <div
      v-if="open && (loading || options.length)"
      class="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
    >
      <p v-if="loading" class="px-3 py-2 text-xs text-gray-500">{{ t('process.recordPickerSearching') }}</p>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-900 dark:text-gray-100"
        @mousedown.prevent="selectRecord(opt)"
      >
        <span class="block truncate font-medium">{{ opt.label }}</span>
        <span v-if="opt.subtitle" class="block text-[10px] text-gray-500 truncate">{{ opt.subtitle }}</span>
      </button>
    </div>
    <p v-if="modelValue && selectedLabel" class="text-[10px] text-gray-500 mt-1 truncate">
      {{ t('process.recordPickerSelected', { name: selectedLabel }) }}
    </p>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { ENTITY_TYPE_TO_MODULE_KEY } from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  modelValue: { type: String, default: '' },
  entityType: { type: String, default: 'deal' },
  placeholder: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

const rootEl = ref(null);
const query = ref('');
const open = ref(false);
const loading = ref(false);
const options = ref([]);
const selectedLabel = ref('');
let debounceTimer = null;

const moduleEndpoint = computed(() => {
  const key = ENTITY_TYPE_TO_MODULE_KEY[props.entityType];
  if (key === 'organizations') return '/v2/organization';
  if (key === 'people') return '/people';
  if (key === 'deals') return '/deals';
  return null;
});

function recordLabel(rec) {
  if (!rec) return '';
  if (props.entityType === 'people') {
    return `${rec.first_name || ''} ${rec.last_name || ''}`.trim() || rec.email || rec._id;
  }
  return rec.name || rec.title || rec._id;
}

function recordSubtitle(rec) {
  if (props.entityType === 'deal' && rec.stage) return rec.stage;
  if (rec.email) return rec.email;
  return rec._id ? String(rec._id).slice(-8) : '';
}

async function searchRecords(q) {
  if (!moduleEndpoint.value) return;
  loading.value = true;
  try {
    const res = await apiClient.get(moduleEndpoint.value, {
      params: { search: q, limit: 8, page: 1 }
    });
    const rows = res.data?.data || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    options.value = list.map((rec) => ({
      value: String(rec._id),
      label: recordLabel(rec),
      subtitle: recordSubtitle(rec)
    }));
  } catch {
    options.value = [];
  } finally {
    loading.value = false;
  }
}

function onQueryInput() {
  open.value = true;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const q = query.value.trim();
    if (q.length >= 2) searchRecords(q);
    else options.value = [];
  }, 300);
}

function selectRecord(opt) {
  emit('update:modelValue', opt.value);
  selectedLabel.value = opt.label;
  query.value = opt.label;
  open.value = false;
}

async function loadSelectedLabel(id) {
  if (!id || !moduleEndpoint.value) return;
  try {
    const path =
      props.entityType === 'organization'
        ? `/v2/organization/${id}`
        : `${moduleEndpoint.value}/${id}`;
    const res = await apiClient.get(path);
    const rec = res.data || res;
    selectedLabel.value = recordLabel(rec);
    if (!query.value) query.value = selectedLabel.value;
  } catch {
    selectedLabel.value = id;
  }
}

watch(
  () => props.modelValue,
  (id) => {
    if (id) loadSelectedLabel(id);
    else {
      selectedLabel.value = '';
      query.value = '';
    }
  },
  { immediate: true }
);

watch(
  () => props.entityType,
  () => {
    options.value = [];
    query.value = '';
    selectedLabel.value = '';
    emit('update:modelValue', '');
  }
);

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false;
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  clearTimeout(debounceTimer);
});
</script>
