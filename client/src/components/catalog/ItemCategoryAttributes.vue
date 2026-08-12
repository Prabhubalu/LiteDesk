<template>
  <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogCategoryTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('platform.catalogCategoryDesc') }}</p>
      </div>
      <span
        v-if="selectedCategoryId && templates.length"
        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/60 dark:text-gray-300"
      >
        {{ t('platform.catalogSpecsFilled', { filled: filledCount, total: templates.length }) }}
      </span>
    </div>

    <div class="space-y-5">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {{ t('platform.catalogCategoryLabel') }}
        </label>
        <HeadlessSelect
          :model-value="selectedCategoryId"
          :options="categoryOptions"
          :disabled="!canEdit || loadingTree"
          allow-empty
          empty-value=""
          :empty-label="t('platform.catalogCategoryNone')"
          :placeholder="t('platform.catalogCategoryNone')"
          wrapper-class="w-full max-w-xl"
          teleport
          :searchable="true"
          @update:model-value="onCategorySelect"
        />
        <p v-if="categoryPathLabel" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {{ categoryPathLabel }}
        </p>
      </div>

      <!-- No category -->
      <div
        v-if="!selectedCategoryId"
        class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-4 py-8 text-center"
      >
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('platform.catalogSpecsNeedCategory') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('platform.catalogSpecsNeedCategoryHint') }}</p>
      </div>

      <!-- Category with no templates -->
      <div
        v-else-if="!templates.length"
        class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-4 py-8 text-center"
      >
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('platform.catalogSpecsEmpty') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('platform.catalogSpecsEmptyHint') }}</p>
      </div>

      <!-- Spec fields -->
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('platform.catalogAttributesTitle') }}
          </h4>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="template in templates"
            :key="template._id"
            :class="template.dataType === 'boolean' || template.dataType === 'multi-select' ? 'sm:col-span-2' : ''"
            class="space-y-1.5"
          >
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ template.label }}
              <span v-if="template.required" class="text-red-500">*</span>
              <span v-if="template.unit" class="text-gray-400 font-normal"> ({{ template.unit }})</span>
            </label>

            <input
              v-if="template.dataType === 'text' || template.dataType === 'number'"
              v-model="localValues[template.key]"
              :type="template.dataType === 'number' ? 'number' : 'text'"
              :disabled="!canEdit"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
              @input="markDirty"
            >

            <DatePicker
              v-else-if="template.dataType === 'date'"
              :model-value="localValues[template.key] || ''"
              :disabled="!canEdit"
              :input-class="dateInputClass"
              panel-class="z-[60]"
              @update:model-value="(v) => { localValues[template.key] = v || ''; markDirty(); }"
            />

            <HeadlessSelect
              v-else-if="template.dataType === 'select'"
              :model-value="localValues[template.key] || ''"
              :options="selectOptionsFor(template)"
              :disabled="!canEdit"
              allow-empty
              empty-value=""
              :empty-label="t('platform.catalogSpecSelectPlaceholder')"
              :placeholder="t('platform.catalogSpecSelectPlaceholder')"
              teleport
              @update:model-value="(v) => { localValues[template.key] = v || ''; markDirty(); }"
            />

            <label
              v-else-if="template.dataType === 'boolean'"
              class="inline-flex items-center gap-2.5 text-sm text-gray-800 dark:text-gray-200 min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
            >
              <input
                v-model="localValues[template.key]"
                type="checkbox"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                :disabled="!canEdit"
                @change="markDirty"
              >
              <span>{{ template.label }}</span>
            </label>

            <input
              v-else-if="template.dataType === 'multi-select'"
              v-model="multiSelectDraft[template.key]"
              :disabled="!canEdit"
              :placeholder="t('platform.catalogMultiSelectHint')"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60"
              @input="markDirty"
            >
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-else-if="saveOk" class="text-sm text-emerald-600 dark:text-emerald-400">{{ t('platform.catalogSpecsSaved') }}</p>

      <div
        v-if="canEdit && templates.length"
        class="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/80"
      >
        <button
          v-if="dirty"
          type="button"
          class="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg"
          :disabled="saving"
          @click="resetLocal"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          :disabled="saving || !dirty"
          class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          @click="save"
        >
          {{ saving ? t('states.saving') : t('platform.catalogCategorySave') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import DatePicker from '@/components/common/DatePicker.vue';

const props = defineProps({
  itemId: { type: String, required: true },
  categoryId: { type: String, default: '' },
  attributeValues: { type: Object, default: () => ({}) },
  templates: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();

const dateInputClass =
  'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 cursor-pointer';

const loadingTree = ref(false);
const flatCategories = ref([]);
const selectedCategoryId = ref('');
const localValues = reactive({});
const multiSelectDraft = reactive({});
const saving = ref(false);
const dirty = ref(false);
const saveOk = ref(false);
const error = ref('');

function flattenTree(nodes, depth = 0, trail = []) {
  const rows = [];
  for (const node of nodes || []) {
    const nextTrail = [...trail, node.name];
    rows.push({ ...node, depth, pathLabel: nextTrail.join(' › ') });
    if (node.children?.length) {
      rows.push(...flattenTree(node.children, depth + 1, nextTrail));
    }
  }
  return rows;
}

const indentLabel = (depth) => `${'— '.repeat(depth)}`;

const categoryOptions = computed(() =>
  flatCategories.value.map((row) => ({
    value: String(row._id),
    label: `${indentLabel(row.depth)}${row.name}`
  }))
);

const categoryPathLabel = computed(() => {
  const row = flatCategories.value.find((r) => String(r._id) === String(selectedCategoryId.value));
  return row?.pathLabel || '';
});

function selectOptionsFor(template) {
  return (template.options || []).map((opt) => ({ value: opt, label: opt }));
}

const filledCount = computed(() => {
  let n = 0;
  for (const template of props.templates) {
    if (template.dataType === 'multi-select') {
      if (String(multiSelectDraft[template.key] || '').trim()) n += 1;
    } else if (template.dataType === 'boolean') {
      if (localValues[template.key]) n += 1;
    } else if (localValues[template.key] !== '' && localValues[template.key] != null) {
      n += 1;
    }
  }
  return n;
});

const loadTree = async () => {
  loadingTree.value = true;
  try {
    const res = await apiClient('/catalog/categories/tree');
    if (res.success) {
      flatCategories.value = flattenTree(res.data || []);
    }
  } finally {
    loadingTree.value = false;
  }
};

const syncLocalValues = () => {
  Object.keys(localValues).forEach((k) => delete localValues[k]);
  Object.keys(multiSelectDraft).forEach((k) => delete multiSelectDraft[k]);

  for (const template of props.templates) {
    const val = props.attributeValues?.[template.key];
    if (template.dataType === 'multi-select') {
      multiSelectDraft[template.key] = Array.isArray(val) ? val.join(', ') : '';
      localValues[template.key] = Array.isArray(val) ? val : [];
    } else if (template.dataType === 'boolean') {
      localValues[template.key] = !!val;
    } else {
      localValues[template.key] = val ?? '';
    }
  }
  dirty.value = false;
};

const markDirty = () => {
  dirty.value = true;
  saveOk.value = false;
};

const resetLocal = () => {
  syncLocalValues();
  error.value = '';
  saveOk.value = false;
};

watch(
  () => [props.categoryId, props.attributeValues, props.templates],
  () => {
    selectedCategoryId.value = props.categoryId ? String(props.categoryId) : '';
    syncLocalValues();
  },
  { immediate: true, deep: true }
);

const onCategorySelect = async (value) => {
  selectedCategoryId.value = value ? String(value) : '';
  await onCategoryChange();
};

const onCategoryChange = async () => {
  if (!props.canEdit) return;
  error.value = '';
  saveOk.value = false;
  try {
    await apiClient.put(`/items/${props.itemId}`, {
      categoryId: selectedCategoryId.value || null
    });
    emit('updated');
  } catch (err) {
    error.value = err.message || t('platform.catalogCategorySaveFailed');
  }
};

const buildPayloadValues = () => {
  const payload = {};
  for (const template of props.templates) {
    if (template.dataType === 'multi-select') {
      payload[template.key] = String(multiSelectDraft[template.key] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      payload[template.key] = localValues[template.key];
    }
  }
  return payload;
};

const save = async () => {
  saving.value = true;
  error.value = '';
  saveOk.value = false;
  try {
    const res = await apiClient.put(`/items/${props.itemId}`, {
      categoryId: selectedCategoryId.value || null,
      attributeValues: buildPayloadValues()
    });
    if (!res.success) {
      throw new Error(res.message || 'Save failed');
    }
    dirty.value = false;
    saveOk.value = true;
    emit('updated');
  } catch (err) {
    error.value = err.message || t('platform.catalogCategorySaveFailed');
  } finally {
    saving.value = false;
  }
};

onMounted(loadTree);
</script>
