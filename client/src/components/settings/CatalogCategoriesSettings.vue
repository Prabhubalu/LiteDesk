<template>
  <div class="space-y-4">
    <template v-if="!embedded">
      <button type="button" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline" @click="$emit('back')">
        {{ t('actions.back') }}
      </button>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.catalogCategoriesTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.catalogCategoriesDesc') }}</p>
      </div>
    </template>
    <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.catalogCategoriesDesc') }}</p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Category tree -->
      <section class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogCategoryTree') }}</h3>
            <p v-if="!loading && flatCategories.length" class="mt-0.5 text-xs text-gray-400">
              {{ t('settings.catalogCategoryCount', { count: flatCategories.length }) }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            @click="openCreateCategory(null)"
          >
            <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('settings.catalogAddRootCategory') }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <div
            v-else-if="!flatCategories.length"
            class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              <FolderIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogCategoriesEmpty') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogCategoriesEmptyHint') }}</p>
            <button
              type="button"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="openCreateCategory(null)"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('settings.catalogAddRootCategory') }}
            </button>
          </div>

          <ul v-else class="space-y-0.5" role="tree">
            <li
              v-for="row in flatCategories"
              :key="row._id"
              role="treeitem"
              class="group/row flex items-center gap-1 rounded-lg px-1.5 py-1 cursor-pointer transition-colors"
              :class="selectedCategoryId === row._id
                ? 'bg-indigo-50 dark:bg-indigo-900/25'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'"
              :style="{ paddingLeft: `${0.375 + row.depth * 1.125}rem` }"
              @click="selectCategory(row._id)"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                :class="selectedCategoryId === row._id
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
                aria-hidden="true"
              >
                <FolderIcon class="h-3.5 w-3.5" />
              </span>
              <span
                class="min-w-0 flex-1 truncate text-sm"
                :class="selectedCategoryId === row._id
                  ? 'font-medium text-indigo-900 dark:text-indigo-100'
                  : 'text-gray-900 dark:text-white'"
              >
                {{ row.name }}
              </span>
              <div
                class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100"
                :class="{ 'opacity-100': selectedCategoryId === row._id }"
              >
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
                  :title="t('settings.catalogAddChildCategory')"
                  :aria-label="t('settings.catalogAddChildCategory')"
                  @click.stop="openCreateCategory(row._id)"
                >
                  <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  :title="t('actions.delete')"
                  :aria-label="t('actions.delete')"
                  @click.stop="removeCategory(row._id)"
                >
                  <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Specification templates -->
      <section class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.catalogAttributeTemplates') }}</h3>
            <p v-if="selectedCategory" class="mt-0.5 truncate text-xs text-gray-400">
              {{ t('settings.catalogSpecsForCategory', { name: selectedCategory.name }) }}
            </p>
          </div>
          <button
            v-if="selectedCategoryId"
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            @click="addAttribute"
          >
            <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('settings.catalogAddAttribute') }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="!selectedCategoryId"
            class="flex h-full flex-col items-center justify-center px-4 py-12 text-center"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              <RectangleStackIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogSelectCategoryTitle') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogSelectCategoryHint') }}</p>
          </div>

          <div v-else-if="attributesLoading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <div
            v-else-if="!attributes.length"
            class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
          >
            <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              <RectangleStackIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.catalogNoAttributes') }}</p>
            <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.catalogNoAttributesHint') }}</p>
            <button
              type="button"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="addAttribute"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('settings.catalogAddAttribute') }}
            </button>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="attr in attributes"
              :key="attr._id"
              class="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="attr.label"
                  class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  :placeholder="t('settings.catalogNewAttributeDefault')"
                  :aria-label="t('settings.catalogAttributeLabel')"
                />
                <button
                  type="button"
                  class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  :title="t('actions.delete')"
                  :aria-label="t('actions.delete')"
                  @click="removeAttribute(attr._id)"
                >
                  <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <HeadlessSelect
                  v-model="attr.dataType"
                  :options="attributeTypeOptions"
                  teleport
                  :searchable="false"
                  button-class="!px-2.5 !py-1.5"
                />
                <label class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300">
                  <HeadlessCheckbox v-model="attr.required" size="sm" />
                  {{ t('settings.catalogRequired') }}
                </label>
              </div>
              <input
                v-if="attr.dataType === 'select' || attr.dataType === 'multi-select'"
                v-model="attr.optionsText"
                :placeholder="t('settings.catalogOptionsPlaceholder')"
                class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <input
                v-model="attr.unit"
                :placeholder="t('settings.catalogUnitPlaceholder')"
                class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div class="flex justify-end">
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!String(attr.label || '').trim()"
                  @click="saveAttribute(attr)"
                >
                  {{ t('actions.save') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="showCategoryForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showCategoryForm = false"
    >
      <div
        class="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="categoryDialogTitleId"
      >
        <h4 :id="categoryDialogTitleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ newCategoryParentId ? t('settings.catalogNewChildCategory') : t('settings.catalogNewCategory') }}
        </h4>
        <p v-if="newCategoryParentName" class="text-xs text-gray-500">
          {{ t('settings.catalogChildOfCategory', { name: newCategoryParentName }) }}
        </p>
        <input
          ref="categoryNameInput"
          v-model="newCategoryName"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          :placeholder="t('settings.catalogCategoryNamePlaceholder')"
          @keydown.enter.prevent="saveNewCategory"
          @keydown.esc.prevent="showCategoryForm = false"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showCategoryForm = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!newCategoryName.trim()"
            @click="saveNewCategory"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon, PlusIcon, TrashIcon, RectangleStackIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { CATALOG_ATTRIBUTE_DATA_TYPES, CATALOG_ATTRIBUTE_TYPE_LABEL_KEYS } from '@/constants/catalogAttributeTypes';
import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

defineProps({
  embedded: { type: Boolean, default: false }
});

defineEmits(['back']);

const { t } = useI18n();
const notifications = useNotifications();

const categoryDialogTitleId = 'catalog-category-dialog-title';
const categoryNameInput = ref(null);
const loading = ref(false);
const flatCategories = ref([]);
const selectedCategoryId = ref('');
const attributes = ref([]);
const attributesLoading = ref(false);
const attributeTypes = CATALOG_ATTRIBUTE_DATA_TYPES;
let draftSeq = 0;

const attributeTypeOptions = computed(() =>
  attributeTypes.map((type) => ({
    value: type,
    label: attributeTypeLabel(type)
  }))
);

const showCategoryForm = ref(false);
const newCategoryName = ref('');
const newCategoryParentId = ref(null);

const selectedCategory = computed(() =>
  flatCategories.value.find((row) => row._id === selectedCategoryId.value) || null
);

const newCategoryParentName = computed(() => {
  if (!newCategoryParentId.value) return '';
  return flatCategories.value.find((row) => row._id === newCategoryParentId.value)?.name || '';
});

function flattenTree(nodes, depth = 0) {
  const rows = [];
  for (const node of nodes || []) {
    rows.push({ ...node, depth });
    if (node.children?.length) rows.push(...flattenTree(node.children, depth + 1));
  }
  return rows;
}

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

watch(showCategoryForm, async (open) => {
  if (!open) return;
  await nextTick();
  categoryNameInput.value?.focus?.();
});

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
  if (!await confirmAction(t('settings.catalogConfirmDeleteCategory'))) return;
  await apiClient.delete(`/catalog/categories/${id}`);
  if (selectedCategoryId.value === id) {
    selectedCategoryId.value = '';
    attributes.value = [];
  }
  await loadTree();
};

function nextDraftId() {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

const addAttribute = () => {
  if (!selectedCategoryId.value) return;
  attributes.value.unshift({
    _id: nextDraftId(),
    isDraft: true,
    label: '',
    dataType: 'text',
    required: false,
    optionsText: '',
    unit: ''
  });
};

const saveAttribute = async (attr) => {
  const label = String(attr.label || '').trim();
  if (!label) {
    notifications.error(t('settings.catalogAttributeLabelRequired'));
    return;
  }

  const options = String(attr.optionsText || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    label,
    dataType: attr.dataType,
    required: attr.required,
    options,
    unit: attr.unit
  };

  try {
    if (attr.isDraft) {
      const res = await apiClient.post(
        `/catalog/categories/${selectedCategoryId.value}/attributes`,
        payload
      );
      if (!res.success) {
        notifications.error(res.message || t('settings.catalogAddAttributeFailed'));
        return;
      }
    } else {
      await apiClient.put(
        `/catalog/categories/${selectedCategoryId.value}/attributes/${attr._id}`,
        payload
      );
    }
    await loadAttributes();
  } catch (err) {
    console.error('saveAttribute error:', err);
    notifications.error(err?.message || t('settings.catalogAddAttributeFailed'));
  }
};

const removeAttribute = async (attrId) => {
  const existing = attributes.value.find((attr) => attr._id === attrId);
  if (existing?.isDraft) {
    attributes.value = attributes.value.filter((attr) => attr._id !== attrId);
    return;
  }
  if (!await confirmAction(t('settings.catalogConfirmDeleteAttribute'))) return;
  await apiClient.delete(`/catalog/categories/${selectedCategoryId.value}/attributes/${attrId}`);
  await loadAttributes();
};

onMounted(loadTree);
</script>
