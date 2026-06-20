<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">{{ t('documents.portalKnowledgeTitle') }}</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">{{ t('documents.portalKnowledgeSubtitle') }}</p>
    </div>

    <div class="mb-4">
      <input
        v-model="searchQuery"
        type="search"
        class="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        :placeholder="t('common.search')"
        @keyup.enter="loadArticles"
      />
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" />
    </div>

    <div
      v-else-if="articles.length === 0"
      class="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800"
    >
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('documents.portalKnowledgeEmptyTitle') }}</h3>
      <p class="mt-2 text-gray-600 dark:text-gray-400">{{ t('documents.portalKnowledgeEmptyMessage') }}</p>
    </div>

    <div v-else class="space-y-3">
      <button
        v-for="article in articles"
        :key="article._id"
        type="button"
        class="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
        @click="openArticle(article._id)"
      >
        <p class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ article.documentNumber }}</p>
        <h3 class="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">{{ article.title }}</h3>
        <p v-if="article.description" class="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{{ article.description }}</p>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('documents.portalKnowledgeUpdated', { date: formatDate(article.updatedAt) }) }}
        </p>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePortalKnowledge } from '@/composables/usePortalKnowledge';
import { capturePortalKnowledgeViewed } from '@/config/posthogDocuments';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { listArticles } = usePortalKnowledge();

const loading = ref(true);
const error = ref(null);
const articles = ref([]);
const searchQuery = ref('');

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

async function loadArticles() {
  loading.value = true;
  error.value = null;
  try {
    const response = await listArticles({ search: searchQuery.value.trim() });
    if (!response?.success) {
      error.value = response?.message || t('documents.portalKnowledgeLoadFailed');
      articles.value = [];
      return;
    }
    articles.value = response.data || [];
  } catch (err) {
    error.value = err?.message || t('documents.portalKnowledgeLoadFailed');
    articles.value = [];
  } finally {
    loading.value = false;
  }
}

function openArticle(id) {
  router.push(`/portal/knowledge/${id}`);
}

onMounted(() => {
  capturePortalKnowledgeViewed({
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void loadArticles();
});
</script>
