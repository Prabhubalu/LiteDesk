<template>
  <div class="mx-auto w-full px-6 py-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <button
          type="button"
          class="mb-2 text-sm text-primary-600 hover:underline dark:text-primary-400"
          @click="goBack"
        >
          ← {{ t('contentStudio.backToArticles') }}
        </button>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.categoriesTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('contentStudio.categoriesSubtitle') }}</p>
      </div>
    </div>

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
              :placeholder="t('contentStudio.categoryDescriptionPlaceholder')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('contentStudio.categoryDescriptionHint') }}</p>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between gap-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('contentStudio.categoryHeroIconLabel') }}</label>
              <button
                v-if="iconMode === 'preset'"
                type="button"
                class="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                @click="switchToCustomImage"
              >
                {{ t('contentStudio.categoryHeroIconUseCustom') }}
              </button>
              <button
                v-else
                type="button"
                class="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                @click="switchToPresetIcons"
              >
                {{ t('contentStudio.categoryHeroIconBackToPicker') }}
              </button>
            </div>
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {{ iconMode === 'preset' ? t('contentStudio.categoryHeroIconHint') : t('contentStudio.categoryImageHint') }}
            </p>

            <div v-if="iconMode === 'preset'" class="space-y-3">
              <input
                v-model="iconSearch"
                type="search"
                :class="inputClass"
                :placeholder="t('contentStudio.categoryHeroIconSearch')"
              />
              <div class="max-h-56 overflow-y-auto pr-1">
                <div v-if="!filteredIcons.length" class="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  {{ t('contentStudio.categoryHeroIconEmpty') }}
                </div>
                <div v-else class="grid grid-cols-4 gap-2">
                  <button
                    v-for="icon in filteredIcons"
                    :key="icon.key"
                    type="button"
                    class="product-icon-picker__btn"
                    :class="{ 'product-icon-picker__btn--selected': formHeroIconKey === icon.key }"
                    :style="{ backgroundColor: formHeroIconColor }"
                    :title="icon.label"
                    :aria-label="icon.label"
                    :aria-pressed="formHeroIconKey === icon.key"
                    @click="selectHeroIcon(icon.key)"
                  >
                    <component :is="icon.component" class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('contentStudio.categoryHeroIconColorLabel') }}</label>
                <div class="mb-2 flex flex-wrap gap-2">
                  <button
                    v-for="color in HERO_ICON_COLOR_PRESETS"
                    :key="color"
                    type="button"
                    class="product-icon-picker__color"
                    :class="{ 'product-icon-picker__color--selected': formHeroIconColor === color }"
                    :style="{ backgroundColor: color }"
                    :aria-label="color"
                    :aria-pressed="formHeroIconColor === color"
                    @click="formHeroIconColor = color"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <input v-model="formHeroIconColor" type="color" class="h-9 w-12 cursor-pointer rounded border border-gray-200 dark:border-gray-700" />
                  <input v-model="formHeroIconColor" type="text" :class="[inputClass, 'font-mono text-xs']" maxlength="7" />
                </div>
              </div>
            </div>

            <div v-else class="space-y-3">
              <div v-if="formImagePreviewUrl" class="flex items-center gap-3">
                <img
                  :src="formImagePreviewUrl"
                  alt=""
                  class="h-12 w-12 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                />
                <button
                  type="button"
                  class="text-xs text-red-600 hover:underline dark:text-red-400"
                  @click="clearCustomImage"
                >
                  {{ t('contentStudio.categoryImageRemove') }}
                </button>
              </div>
              <label class="block">
                <span class="sr-only">{{ t('contentStudio.categoryImageUpload') }}</span>
                <input
                  type="file"
                  accept="image/*"
                  class="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-200"
                  :disabled="uploadingImage"
                  @change="handleImageUpload"
                />
              </label>
              <p v-if="uploadingImage" class="text-xs text-gray-500 dark:text-gray-400">{{ t('contentStudio.categoryImageUploading') }}</p>
            </div>
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
              :disabled="saving || uploadingImage || !formName.trim()"
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
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.categoryIconLabel') }}</th>
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
                <img
                  v-if="categoryImageUrl(category)"
                  :src="categoryImageUrl(category)"
                  alt=""
                  class="h-8 w-8 rounded-md border border-gray-200 object-cover dark:border-gray-700"
                />
                <span
                  v-else-if="categoryHeroIcon(category)"
                  class="product-icon-picker__preview"
                  :style="{ backgroundColor: categoryHeroIconColor(category) }"
                  aria-hidden="true"
                >
                  <component :is="categoryHeroIcon(category).component" class="h-4 w-4" />
                </span>
                <span v-else class="text-xs text-gray-400">—</span>
              </td>
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
import { getApiUrlForFetch } from '@/config/apiBase';
import { uploadCategoryImage } from '@/utils/categoryImageUpload';
import {
  DEFAULT_HERO_ICON_COLOR,
  HEROICON_OPTIONS,
  HERO_ICON_COLOR_PRESETS,
  normalizeHeroiconColor,
  normalizeHeroiconId,
  resolveHeroiconOption,
} from '@/constants/heroiconCatalog';
import {
  createArticleCollection,
  deleteArticleCollection,
  listArticleCollections,
  updateArticleCollection,
} from '@/modules/contentStudio/services/contentStudioApi';

const { t } = useI18n();
const router = useRouter();

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900';

const loading = ref(true);
const saving = ref(false);
const uploadingImage = ref(false);
const categories = ref([]);
const editingId = ref('');
const formName = ref('');
const formDescription = ref('');
const formHeroIconKey = ref('');
const formHeroIconColor = ref(DEFAULT_HERO_ICON_COLOR);
const formImageUrl = ref('');
const formParentId = ref('');
const iconMode = ref('preset');
const iconSearch = ref('');

const filteredIcons = computed(() => {
  const query = iconSearch.value.trim().toLowerCase();
  if (!query) return HEROICON_OPTIONS;
  return HEROICON_OPTIONS.filter((icon) => icon.key.includes(query) || icon.label.toLowerCase().includes(query));
});

function resolveImagePreviewUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return getApiUrlForFetch(raw);
  }
  return raw;
}

const formImagePreviewUrl = computed(() => resolveImagePreviewUrl(formImageUrl.value));

function categoryImageUrl(category) {
  return resolveImagePreviewUrl(category?.imageUrl);
}

function categoryHeroIcon(category) {
  return resolveHeroiconOption(category?.heroIconKey);
}

function categoryHeroIconColor(category) {
  return normalizeHeroiconColor(category?.heroIconColor) || DEFAULT_HERO_ICON_COLOR;
}

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
  formHeroIconKey.value = '';
  formHeroIconColor.value = DEFAULT_HERO_ICON_COLOR;
  formImageUrl.value = '';
  formParentId.value = '';
  iconMode.value = 'preset';
  iconSearch.value = '';
}

function selectHeroIcon(key) {
  formHeroIconKey.value = key;
  formImageUrl.value = '';
  iconMode.value = 'preset';
}

function switchToCustomImage() {
  iconMode.value = 'custom';
  formHeroIconKey.value = '';
}

function switchToPresetIcons() {
  iconMode.value = 'preset';
  formImageUrl.value = '';
}

function startEdit(category) {
  editingId.value = category._id;
  formName.value = category.name;
  formDescription.value = category.description || '';
  formParentId.value = category.parentId ? String(category.parentId) : '';
  iconSearch.value = '';

  if (category.imageUrl) {
    iconMode.value = 'custom';
    formImageUrl.value = category.imageUrl;
    formHeroIconKey.value = '';
    return;
  }

  iconMode.value = 'preset';
  formImageUrl.value = '';
  formHeroIconKey.value = normalizeHeroiconId(category.heroIconKey) || '';
  formHeroIconColor.value = normalizeHeroiconColor(category.heroIconColor) || DEFAULT_HERO_ICON_COLOR;
}

function clearCustomImage() {
  formImageUrl.value = '';
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  uploadingImage.value = true;
  try {
    formImageUrl.value = await uploadCategoryImage(file);
    formHeroIconKey.value = '';
    iconMode.value = 'custom';
  } catch (error) {
    window.alert(error?.message || t('contentStudio.categoryImageUploadFailed'));
  } finally {
    uploadingImage.value = false;
  }
}

function goBack() {
  router.push({ name: 'helpdesk-articles' });
}

async function loadCategories() {
  loading.value = true;
  try {
    categories.value = await listArticleCollections();
  } finally {
    loading.value = false;
  }
}

function buildIconPayload() {
  if (iconMode.value === 'custom') {
    return {
      imageUrl: formImageUrl.value.trim() || '',
      heroIconKey: '',
    };
  }
  return {
    heroIconKey: formHeroIconKey.value || '',
    heroIconColor: normalizeHeroiconColor(formHeroIconColor.value) || DEFAULT_HERO_ICON_COLOR,
    imageUrl: '',
  };
}

async function handleSubmit() {
  const name = formName.value.trim();
  if (!name) return;

  saving.value = true;
  try {
    const payload = {
      name,
      description: formDescription.value.trim(),
      parentId: formParentId.value || null,
      ...buildIconPayload(),
    };
    if (editingId.value) {
      await updateArticleCollection(editingId.value, payload);
    } else {
      await createArticleCollection(payload);
    }
    resetForm();
    await loadCategories();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(category) {
  if (!window.confirm(t('contentStudio.deleteCategoryConfirm', { name: category.name }))) return;
  saving.value = true;
  try {
    await deleteArticleCollection(category._id);
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

<style scoped>
.product-icon-picker__btn,
.product-icon-picker__preview {
  display: inline-grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  border: 2px solid transparent;
  color: #fff;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.product-icon-picker__color {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
}

.product-icon-picker__color--selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

.product-icon-picker__btn {
  cursor: pointer;
}

.product-icon-picker__btn:hover {
  transform: translateY(-1px);
}

.product-icon-picker__btn--selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}
</style>
