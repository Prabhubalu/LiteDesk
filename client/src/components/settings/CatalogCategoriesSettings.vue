<template>
  <div class="space-y-8 max-w-5xl">
    <div class="flex items-center justify-between gap-4">
      <div>
        <template v-if="!embedded">
          <button type="button" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2" @click="$emit('back')">
            {{ t('actions.back') }}
          </button>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.catalogCategoriesTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('settings.catalogCategoriesDesc') }}</p>
        </template>
      </div>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
        @click="openCreateCategory(null)"
      >
        {{ t('settings.catalogAddRootCategory') }}
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Category tree list -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.catalogCategoryTree') }}</h3>
        <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
        <ul v-else class="space-y-1">
          <li
            v-for="row in flatCategories"
            :key="row._id"
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
            :class="selectedCategoryId === row._id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'"
            @click="selectCategory(row._id)"
          >
            <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ indent(row.depth) }}{{ row.name }}</span>
            <button type="button" class="text-xs text-indigo-600" @click.stop="openCreateCategory(row._id)">+</button>
            <button type="button" class="text-xs text-red-600" @click.stop="removeCategory(row._id)">×</button>
          </li>
        </ul>
      </div>

      <!-- Attribute templates -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogAttributeTemplates') }}</h3>
          <button
            v-if="selectedCategoryId"
            type="button"
            class="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
            @click="addAttribute"
          >
            {{ t('settings.catalogAddAttribute') }}
          </button>
        </div>

        <p v-if="!selectedCategoryId" class="text-sm text-gray-500">{{ t('settings.catalogSelectCategoryHint') }}</p>

        <div v-else-if="attributesLoading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>

        <div v-else class="space-y-3">
          <div
            v-for="attr in attributes"
            :key="attr._id"
            class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <input v-model="attr.label" class="flex-1 text-sm px-2 py-1 rounded border dark:bg-gray-900 dark:border-gray-600" />
              <button type="button" class="text-xs text-red-600" @click="removeAttribute(attr._id)">×</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <select v-model="attr.dataType" class="text-sm px-2 py-1 rounded border dark:bg-gray-900 dark:border-gray-600">
                <option v-for="type in attributeTypes" :key="type" :value="type">{{ attributeTypeLabel(type) }}</option>
              </select>
              <label class="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" v-model="attr.required" />
                {{ t('settings.catalogRequired') }}
              </label>
            </div>
            <input
              v-if="attr.dataType === 'select' || attr.dataType === 'multi-select'"
              v-model="attr.optionsText"
              :placeholder="t('settings.catalogOptionsPlaceholder')"
              class="w-full text-sm px-2 py-1 rounded border dark:bg-gray-900 dark:border-gray-600"
            />
            <input v-model="attr.unit" :placeholder="t('settings.catalogUnitPlaceholder')" class="w-full text-sm px-2 py-1 rounded border dark:bg-gray-900 dark:border-gray-600" />
            <button type="button" class="text-xs text-indigo-600" @click="saveAttribute(attr)">{{ t('actions.save') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create category modal (inline simple prompt) -->
    <div v-if="showCategoryForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogNewCategory') }}</h4>
        <input v-model="newCategoryName" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-600" :placeholder="t('settings.catalogCategoryNamePlaceholder')" />
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-2 text-sm" @click="showCategoryForm = false">{{ t('actions.cancel') }}</button>
          <button type="button" class="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg" @click="saveNewCategory">{{ t('actions.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { CATALOG_ATTRIBUTE_DATA_TYPES, CATALOG_ATTRIBUTE_TYPE_LABEL_KEYS } from '@/constants/catalogAttributeTypes';

defineProps({
  embedded: { type: Boolean, default: false }
});

defineEmits(['back']);

const { t } = useI18n();

const loading = ref(false);
const flatCategories = ref([]);
const selectedCategoryId = ref('');
const attributes = ref([]);
const attributesLoading = ref(false);
const attributeTypes = CATALOG_ATTRIBUTE_DATA_TYPES;

const showCategoryForm = ref(false);
const newCategoryName = ref('');
const newCategoryParentId = ref(null);

function flattenTree(nodes, depth = 0) {
  const rows = [];
  for (const node of nodes || []) {
    rows.push({ ...node, depth });
    if (node.children?.length) rows.push(...flattenTree(node.children, depth + 1));
  }
  return rows;
}

const indent = (depth) => `${'— '.repeat(depth)}`;

const attributeTypeLabel = (type) => {
  const key = CATALOG_ATTRIBUTE_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
};

const loadTree = async () => {
  loading.value = true;
  try {
    const res = await apiClient('/catalog/categories/tree?includeInactive=true');
    if (res.success) {
      flatCategories.value = flattenTree(res.data || []);
    }
  } finally {
    loading.value = false;
  }
};

const loadAttributes = async () => {
  if (!selectedCategoryId.value) {
    attributes.value = [];
    return;
  }
  attributesLoading.value = true;
  try {
    const res = await apiClient(`/catalog/categories/${selectedCategoryId.value}/attributes?includeInactive=true`);
    if (res.success) {
      attributes.value = (res.data || []).map((attr) => ({
        ...attr,
        optionsText: (attr.options || []).join(', ')
      }));
    }
  } finally {
    attributesLoading.value = false;
  }
};

const selectCategory = async (id) => {
  selectedCategoryId.value = id;
  await loadAttributes();
};

const openCreateCategory = (parentId) => {
  newCategoryParentId.value = parentId;
  newCategoryName.value = '';
  showCategoryForm.value = true;
};

const saveNewCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  await apiClient.post('/catalog/categories', {
    name: newCategoryName.value.trim(),
    parentId: newCategoryParentId.value
  });
  showCategoryForm.value = false;
  await loadTree();
};

const removeCategory = async (id) => {
  if (!confirm(t('settings.catalogConfirmDeleteCategory'))) return;
  await apiClient.delete(`/catalog/categories/${id}`);
  if (selectedCategoryId.value === id) {
    selectedCategoryId.value = '';
    attributes.value = [];
  }
  await loadTree();
};

function nextAttributeLabel() {
  const base = t('settings.catalogNewAttributeDefault');
  const used = new Set(
    attributes.value.map((a) => String(a.label || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

const addAttribute = async () => {
  if (!selectedCategoryId.value) return;
  try {
    const res = await apiClient.post(`/catalog/categories/${selectedCategoryId.value}/attributes`, {
      label: nextAttributeLabel(),
      dataType: 'text'
    });
    if (res.success) await loadAttributes();
  } catch (err) {
    console.error('addAttribute error:', err);
    alert(err?.message || t('settings.catalogAddAttributeFailed'));
  }
};

const saveAttribute = async (attr) => {
  const options = String(attr.optionsText || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await apiClient.put(`/catalog/categories/${selectedCategoryId.value}/attributes/${attr._id}`, {
    label: attr.label,
    dataType: attr.dataType,
    required: attr.required,
    options,
    unit: attr.unit
  });
  await loadAttributes();
};

const removeAttribute = async (attrId) => {
  if (!confirm(t('settings.catalogConfirmDeleteAttribute'))) return;
  await apiClient.delete(`/catalog/categories/${selectedCategoryId.value}/attributes/${attrId}`);
  await loadAttributes();
};

onMounted(loadTree);
</script>
