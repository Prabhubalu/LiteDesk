<template>
  <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
    <div class="mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogCategoryTitle') }}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('platform.catalogCategoryDesc') }}</p>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('platform.catalogCategoryLabel') }}</label>
        <select
          v-model="selectedCategoryId"
          :disabled="!canEdit || loadingTree"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          @change="onCategoryChange"
        >
          <option value="">{{ t('platform.catalogCategoryNone') }}</option>
          <option v-for="row in flatCategories" :key="row._id" :value="row._id">
            {{ indentLabel(row.depth) }}{{ row.name }}
          </option>
        </select>
      </div>

      <div v-if="templates.length" class="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogAttributesTitle') }}</h4>
        <div v-for="template in templates" :key="template._id" class="space-y-1">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ template.label }}
            <span v-if="template.required" class="text-red-500">*</span>
            <span v-if="template.unit" class="text-gray-400 font-normal">({{ template.unit }})</span>
          </label>

          <input
            v-if="template.dataType === 'text' || template.dataType === 'number' || template.dataType === 'date'"
            v-model="localValues[template.key]"
            :type="template.dataType === 'number' ? 'number' : template.dataType === 'date' ? 'date' : 'text'"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />

          <select
            v-else-if="template.dataType === 'select'"
            v-model="localValues[template.key]"
            :disabled="!canEdit"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">{{ t('platform.catalogCategoryNone') }}</option>
            <option v-for="opt in template.options || []" :key="opt" :value="opt">{{ opt }}</option>
          </select>

          <label v-else-if="template.dataType === 'boolean'" class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="localValues[template.key]" :disabled="!canEdit" />
            <span>{{ template.label }}</span>
          </label>

          <input
            v-else-if="template.dataType === 'multi-select'"
            v-model="multiSelectDraft[template.key]"
            :disabled="!canEdit"
            :placeholder="t('platform.catalogMultiSelectHint')"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <div v-if="canEdit" class="flex justify-end">
        <button
          type="button"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg"
          @click="save"
        >
          {{ saving ? t('states.saving') : t('platform.catalogCategorySave') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  itemId: { type: String, required: true },
  categoryId: { type: String, default: '' },
  attributeValues: { type: Object, default: () => ({}) },
  templates: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();

const loadingTree = ref(false);
const flatCategories = ref([]);
const selectedCategoryId = ref('');
const localValues = reactive({});
const multiSelectDraft = reactive({});
const saving = ref(false);
const error = ref('');

function flattenTree(nodes, depth = 0) {
  const rows = [];
  for (const node of nodes || []) {
    rows.push({ ...node, depth });
    if (node.children?.length) {
      rows.push(...flattenTree(node.children, depth + 1));
    }
  }
  return rows;
}

const indentLabel = (depth) => `${'— '.repeat(depth)}`;

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
};

watch(
  () => [props.categoryId, props.attributeValues, props.templates],
  () => {
    selectedCategoryId.value = props.categoryId ? String(props.categoryId) : '';
    syncLocalValues();
  },
  { immediate: true, deep: true }
);

const onCategoryChange = async () => {
  if (!props.canEdit) return;
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
  try {
    const res = await apiClient.put(`/items/${props.itemId}`, {
      categoryId: selectedCategoryId.value || null,
      attributeValues: buildPayloadValues()
    });
    if (!res.success) {
      throw new Error(res.message || 'Save failed');
    }
    emit('updated');
  } catch (err) {
    error.value = err.message || t('platform.catalogCategorySaveFailed');
  } finally {
    saving.value = false;
  }
};

onMounted(loadTree);
</script>
