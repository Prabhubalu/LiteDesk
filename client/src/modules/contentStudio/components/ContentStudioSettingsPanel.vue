<template>
  <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
    <div v-if="mode === 'articles'" class="space-y-4">
      <div>
        <label :class="ui.label">{{ t('contentStudio.fieldCollection') }}</label>
        <select
          :value="collectionId || ''"
          :class="[ui.input, 'mt-1']"
          @change="emit('update:collectionId', $event.target.value || null)"
        >
          <option value="">{{ t('contentStudio.noCollection') }}</option>
          <option v-for="collection in collections" :key="collection._id" :value="collection._id">
            {{ collection.name }}
          </option>
        </select>
      </div>
      <div class="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p class="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">{{ t('contentStudio.manageCollections') }}</p>
        <ContentStudioCollectionsPanel @created="reloadCollections" />
      </div>
    </div>

    <div v-if="mode === 'articles' && status === 'published' && articleId" class="space-y-4">
      <ContentStudioAnalyticsSummary :article-id="articleId" />
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
        {{ t('contentStudio.deleteArticle') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useAuthStore } from '@/stores/authRegistry';
import { buildHeadlessArticleApiUrl } from '@/modules/contentStudio/headless';
import { listArticleCollections } from '../services/contentStudioApi';
import ContentStudioCollectionsPanel from './ContentStudioCollectionsPanel.vue';
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

const canUnpublish = computed(() => props.status === 'published');
const canArchive = computed(() => props.status !== 'archived');

const headlessApiUrl = computed(() => {
  if (props.mode !== 'articles' || props.visibility !== 'public') return '';
  const orgSlug = authStore.organization?.slug;
  if (!orgSlug || !props.slug) return '';
  return buildHeadlessArticleApiUrl(orgSlug, props.slug);
});

async function reloadCollections() {
  if (props.mode !== 'articles') return;
  try {
    collections.value = await listArticleCollections();
  } catch {
    collections.value = [];
  }
}

onMounted(() => {
  void reloadCollections();
});
</script>
