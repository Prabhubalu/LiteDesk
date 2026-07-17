<template>
  <div class="mx-auto w-full px-6 pt-3 pb-6">
    <header class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          class="text-sm text-primary-600 hover:underline dark:text-primary-400"
          @click="goBack"
        >
          ← {{ t('contentStudio.backToBlog') }}
        </button>
        <span class="hidden text-gray-300 sm:inline" aria-hidden="true">/</span>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.categoriesTitle') }}</h1>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 sm:max-w-md sm:text-right">
        {{ t('contentStudio.blogCategoriesSubtitle') }}
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ editingId ? t('contentStudio.editCategory') : t('contentStudio.createCategory') }}
        </h2>
        <form class="mt-4 space-y-3" @submit.prevent="handleSubmit">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('contentStudio.categoryNameLabel') }}</label>
            <input v-model="formName" type="text" :class="inputClass" :placeholder="t('contentStudio.collectionNamePlaceholder')" />
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('contentStudio.categoryDescriptionLabel') }}</label>
            <textarea
              v-model="formDescription"
              rows="3"
              :class="inputClass"
              :placeholder="t('contentStudio.blogCategoryDescriptionPlaceholder')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('contentStudio.blogCategoryDescriptionHint') }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('contentStudio.categoryTypeLabel') }}</label>
            <select v-model="formParentId" :class="inputClass">
              <option value="">{{ t('contentStudio.categoryTypeTopLevel') }}</option>
              <option
                v-for="category in topLevelCategories"
                :key="category._id"
                :value="category._id"
                :disabled="editingId === category._id"
              >
                {{ t('contentStudio.categoryTypeSubCategoryOf', { name: category.name }) }}
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              class="inline-flex flex-1 items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="saving || !formName.trim()"
            >
              {{ editingId ? t('actions.save') : t('contentStudio.createCategory') }}
            </button>
            <button
              v-if="editingId"
              type="button"
              class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              @click="resetForm"
            >
              {{ t('actions.cancel') }}
            </button>
          </div>
        </form>
      </section>

      <section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div v-if="loading" class="p-8 text-sm text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
        <div v-else-if="!flatCategories.length" class="p-12 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('contentStudio.emptyCollections') }}</p>
        </div>
        <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.categoryNameLabel') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.categoryDescriptionLabel') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.categoryTypeLabel') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.categorySlugLabel') }}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="category in flatCategories" :key="category._id">
              <td class="px-4 py-3">
                <p class="font-medium text-gray-900 dark:text-white" :style="{ paddingLeft: `${category.depth * 16}px` }">
                  {{ category.name }}
                </p>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                <p class="line-clamp-2 max-w-xs">{{ category.description || '—' }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                {{ category.depth > 0 ? t('contentStudio.subCategory') : t('contentStudio.category') }}
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">/{{ category.slug }}</td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex gap-2">
                  <button type="button" class="text-sm text-primary-600 hover:underline dark:text-primary-400" @click="startEdit(category)">
                    {{ t('actions.edit') }}
                  </button>
                  <button type="button" class="text-sm text-red-600 hover:underline dark:text-red-400" @click="handleDelete(category)">
                    {{ t('actions.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  createContentCollection,
  deleteContentCollection,
  listContentCollections,
  updateContentCollection,
} from '@/modules/contentStudio/services/contentStudioApi';

const { t } = useI18n();
const router = useRouter();
const MODE = 'blog';

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900';

const loading = ref(true);
const saving = ref(false);
const categories = ref([]);
const editingId = ref('');
const formName = ref('');
const formDescription = ref('');
const formParentId = ref('');

function buildCollectionTree(rows) {
  const byParent = new Map();
  for (const row of rows) {
    const parentId = row.parentId ? String(row.parentId) : '';
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(row);
  }
  function walk(parentId, depth = 0) {
    const children = byParent.get(parentId) || [];
    return children.flatMap((row) => [{ ...row, depth }, ...walk(String(row._id), depth + 1)]);
  }
  return walk('');
}

const flatCategories = computed(() => buildCollectionTree(categories.value));
const topLevelCategories = computed(() => flatCategories.value.filter((row) => row.depth === 0));

function resetForm() {
  editingId.value = '';
  formName.value = '';
  formDescription.value = '';
  formParentId.value = '';
}

function startEdit(category) {
  editingId.value = category._id;
  formName.value = category.name;
  formDescription.value = category.description || '';
  formParentId.value = category.parentId ? String(category.parentId) : '';
}

function goBack() {
  router.push({ name: 'marketing-blog' });
}

async function loadCategories() {
  loading.value = true;
  try {
    categories.value = await listContentCollections(MODE);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  const name = formName.value.trim();
  if (!name) return;

  saving.value = true;
  try {
    const payload = {
      name,
      slug: name,
      description: formDescription.value.trim(),
      parentId: formParentId.value || null,
      heroIconKey: '',
      heroIconColor: '',
      imageUrl: '',
      emoji: '',
    };
    if (editingId.value) {
      await updateContentCollection(MODE, editingId.value, payload);
    } else {
      await createContentCollection(MODE, payload);
    }
    resetForm();
    await loadCategories();
  } catch (error) {
    window.alert(error?.message || 'Failed to save category');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(category) {
  if (!window.confirm(t('contentStudio.blogDeleteCategoryConfirm', { name: category.name }))) return;
  saving.value = true;
  try {
    await deleteContentCollection(MODE, category._id);
    if (editingId.value === category._id) resetForm();
    await loadCategories();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadCategories();
});
</script>
