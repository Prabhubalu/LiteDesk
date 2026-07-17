<template>
  <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
    <div v-if="mode === 'articles' || mode === 'blog'" class="space-y-4">
      <div>
        <label :class="ui.label">{{ t('contentStudio.fieldCollection') }}</label>
        <Listbox :model-value="selectedCategoryId" @update:model-value="onCategoryChange">
          <div class="relative mt-1">
            <ListboxButton :class="[ui.input, 'relative pr-9 text-left']">
              <span :class="['block truncate', !selectedCategoryLabel && 'text-neutral-400']">
                {{ selectedCategoryLabel || t('contentStudio.noCollection') }}
              </span>
              <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                <ChevronUpDownIcon class="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </span>
            </ListboxButton>
            <transition
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <ListboxOptions
                class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:ring-white/10"
              >
                <ListboxOption :value="''" v-slot="{ active, selected }">
                  <li :class="listboxOptionClass(active, selected)">
                    <span :class="['block truncate', !selected && 'text-neutral-500']">{{ t('contentStudio.noCollection') }}</span>
                    <CheckIcon v-if="selected" class="absolute inset-y-0 right-2.5 my-auto h-4 w-4 text-primary-600" aria-hidden="true" />
                  </li>
                </ListboxOption>
                <ListboxOption
                  v-for="category in topLevelCategories"
                  :key="category._id"
                  :value="category._id"
                  v-slot="{ active, selected }"
                >
                  <li :class="listboxOptionClass(active, selected)">
                    <span class="block truncate">
                      <span v-if="category.emoji" class="mr-1.5" aria-hidden="true">{{ category.emoji }}</span>{{ category.name }}
                    </span>
                    <CheckIcon v-if="selected" class="absolute inset-y-0 right-2.5 my-auto h-4 w-4 text-primary-600" aria-hidden="true" />
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </div>
        </Listbox>
      </div>

      <div>
        <label :class="ui.label">{{ t('contentStudio.fieldSubCategory') }}</label>
        <Listbox
          :model-value="selectedSubCategoryId"
          :disabled="!selectedCategoryId || !subCategories.length"
          @update:model-value="onSubCategoryChange"
        >
          <div class="relative mt-1">
            <ListboxButton
              :class="[
                ui.input,
                'relative pr-9 text-left',
                (!selectedCategoryId || !subCategories.length) && 'cursor-not-allowed opacity-60',
              ]"
              :disabled="!selectedCategoryId || !subCategories.length"
            >
              <span :class="['block truncate', !selectedSubCategoryLabel && 'text-neutral-400']">
                {{ subCategoryButtonLabel }}
              </span>
              <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                <ChevronUpDownIcon class="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </span>
            </ListboxButton>
            <transition
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <ListboxOptions
                class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:ring-white/10"
              >
                <ListboxOption :value="''" v-slot="{ active, selected }">
                  <li :class="listboxOptionClass(active, selected)">
                    <span :class="['block truncate', !selected && 'text-neutral-500']">{{ t('contentStudio.noSubCategory') }}</span>
                    <CheckIcon v-if="selected" class="absolute inset-y-0 right-2.5 my-auto h-4 w-4 text-primary-600" aria-hidden="true" />
                  </li>
                </ListboxOption>
                <ListboxOption
                  v-for="subCategory in subCategories"
                  :key="subCategory._id"
                  :value="subCategory._id"
                  v-slot="{ active, selected }"
                >
                  <li :class="listboxOptionClass(active, selected)">
                    <span class="block truncate">
                      <span v-if="subCategory.emoji" class="mr-1.5" aria-hidden="true">{{ subCategory.emoji }}</span>{{ subCategory.name }}
                    </span>
                    <CheckIcon v-if="selected" class="absolute inset-y-0 right-2.5 my-auto h-4 w-4 text-primary-600" aria-hidden="true" />
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </div>
        </Listbox>
      </div>

      <router-link
        :to="{ name: mode === 'blog' ? 'marketing-blog-categories' : 'helpdesk-article-categories' }"
        class="inline-block text-xs text-primary-600 hover:underline dark:text-primary-400"
      >
        {{ t('contentStudio.manageCategories') }} →
      </router-link>
    </div>

    <div v-if="(mode === 'articles' || mode === 'blog') && status === 'published' && articleId" class="space-y-4">
      <ContentStudioAnalyticsSummary :article-id="articleId" :mode="mode" />
    </div>

    <div v-if="headlessApiUrl" class="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-700">
      <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ t('contentStudio.headlessApiUrlLabel') }}</p>
      <a
        :href="headlessApiUrl"
        class="mt-1 block break-all text-primary-600 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ headlessApiUrl }}
      </a>
      <p class="mt-2 text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.headlessApiUrlHint') }}</p>
    </div>

    <div class="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <button
        v-if="canUnpublish"
        type="button"
        :class="ui.btnSecondary"
        class="w-full"
        :disabled="busy"
        @click="emit('unpublish')"
      >
        {{ t('contentStudio.unpublish') }}
      </button>
      <button
        v-if="canArchive"
        type="button"
        :class="ui.btnSecondary"
        class="w-full"
        :disabled="busy"
        @click="emit('archive')"
      >
        {{ t('contentStudio.archive') }}
      </button>
      <button
        type="button"
        class="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        :disabled="busy"
        @click="emit('delete')"
      >
        {{ mode === 'blog' ? t('contentStudio.deletePost') : t('contentStudio.deleteArticle') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useAuthStore } from '@/stores/authRegistry';
import { buildHeadlessArticleApiUrl, buildHeadlessBlogPostApiUrl } from '@/modules/contentStudio/headless';
import { listContentCollections } from '../services/contentStudioApi';
import ContentStudioAnalyticsSummary from './ContentStudioAnalyticsSummary.vue';

const props = defineProps({
  mode: { type: String, default: 'articles' },
  status: { type: String, default: 'draft' },
  visibility: { type: String, default: 'portal' },
  slug: { type: String, default: '' },
  articleId: { type: String, default: '' },
  collectionId: { type: String, default: null },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['update:collectionId', 'unpublish', 'archive', 'delete']);

const { t } = useI18n();
const ui = useBuilderUi();
const authStore = useAuthStore();
const collections = ref([]);
const selectedCategoryId = ref('');
const selectedSubCategoryId = ref('');

const collectionsById = computed(() => {
  const map = new Map();
  for (const row of collections.value) {
    map.set(String(row._id), row);
  }
  return map;
});

const topLevelCategories = computed(() => collections.value.filter((row) => !row.parentId));

const subCategories = computed(() => {
  if (!selectedCategoryId.value) return [];
  return collections.value.filter((row) => String(row.parentId) === selectedCategoryId.value);
});

const selectedCategoryLabel = computed(() => {
  if (!selectedCategoryId.value) return '';
  return collectionsById.value.get(selectedCategoryId.value)?.name || '';
});

const selectedSubCategoryLabel = computed(() => {
  if (!selectedSubCategoryId.value) return '';
  return collectionsById.value.get(selectedSubCategoryId.value)?.name || '';
});

const subCategoryButtonLabel = computed(() => {
  if (!selectedCategoryId.value) return t('contentStudio.subCategorySelectCategoryFirst');
  if (!subCategories.value.length) return t('contentStudio.noSubCategoriesAvailable');
  if (selectedSubCategoryLabel.value) return selectedSubCategoryLabel.value;
  return t('contentStudio.noSubCategory');
});

const canUnpublish = computed(() => props.status === 'published');
const canArchive = computed(() => props.status !== 'archived');

const headlessApiUrl = computed(() => {
  if ((props.mode !== 'articles' && props.mode !== 'blog') || props.visibility !== 'public') return '';
  const orgSlug = authStore.organization?.slug;
  if (!orgSlug || !props.slug) return '';
  if (props.mode === 'blog') {
    return buildHeadlessBlogPostApiUrl(orgSlug, props.slug);
  }
  return buildHeadlessArticleApiUrl(orgSlug, props.slug);
});

function listboxOptionClass(active, selected) {
  return [
    'relative cursor-default select-none py-2 pl-3 pr-9',
    active ? 'bg-primary-50 text-primary-900 dark:bg-primary-950/40 dark:text-primary-100' : 'text-neutral-900 dark:text-neutral-100',
    selected ? 'font-medium' : 'font-normal',
  ];
}

function syncFromCollectionId(collectionId) {
  if (!collectionId) {
    selectedCategoryId.value = '';
    selectedSubCategoryId.value = '';
    return;
  }

  const row = collectionsById.value.get(String(collectionId));
  if (!row) {
    selectedCategoryId.value = '';
    selectedSubCategoryId.value = '';
    return;
  }

  if (row.parentId) {
    selectedCategoryId.value = String(row.parentId);
    selectedSubCategoryId.value = String(row._id);
    return;
  }

  selectedCategoryId.value = String(row._id);
  selectedSubCategoryId.value = '';
}

function emitCollectionId() {
  if (!selectedCategoryId.value) {
    emit('update:collectionId', null);
    return;
  }
  if (selectedSubCategoryId.value) {
    emit('update:collectionId', selectedSubCategoryId.value);
    return;
  }
  emit('update:collectionId', selectedCategoryId.value);
}

function onCategoryChange(value) {
  selectedCategoryId.value = value || '';
  selectedSubCategoryId.value = '';
  emitCollectionId();
}

function onSubCategoryChange(value) {
  selectedSubCategoryId.value = value || '';
  emitCollectionId();
}

async function reloadCollections() {
  if (props.mode !== 'articles' && props.mode !== 'blog') return;
  try {
    collections.value = await listContentCollections(props.mode);
    syncFromCollectionId(props.collectionId);
  } catch {
    collections.value = [];
  }
}

watch(
  () => props.collectionId,
  (collectionId) => {
    syncFromCollectionId(collectionId);
  },
);

onMounted(() => {
  void reloadCollections();
});
</script>
