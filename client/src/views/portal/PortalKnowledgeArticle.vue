<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <button
      type="button"
      class="mb-4 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      @click="router.push('/portal/knowledge')"
    >
      {{ t('documents.portalKnowledgeBack') }}
    </button>

    <div v-if="loading" class="h-64 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" />

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <article
      v-else-if="article"
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ article.documentNumber }}</p>
      <h1 class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ article.title }}</h1>
      <p v-if="article.description" class="mt-2 text-gray-600 dark:text-gray-400">{{ article.description }}</p>
      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {{ t('documents.portalKnowledgeUpdated', { date: formatDate(article.updatedAt) }) }}
      </p>

      <div
        v-if="richHtml"
        class="prose prose-sm mt-6 max-w-none dark:prose-invert"
        v-html="richHtml"
      />
      <p v-else-if="article.richContentText" class="mt-6 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
        {{ article.richContentText }}
      </p>
    </article>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePortalKnowledge } from '@/composables/usePortalKnowledge';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { getArticle } = usePortalKnowledge();

const loading = ref(true);
const error = ref(null);
const article = ref(null);

const richHtml = computed(() => {
  const content = article.value?.richContent;
  if (!content) return '';
  if (typeof content === 'string') return content;
  return String(content.html || content.body || '');
});

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await getArticle(route.params.id);
    if (!response?.success) {
      error.value = response?.message || t('documents.portalKnowledgeLoadFailed');
      return;
    }
    article.value = response.data || null;
  } catch (err) {
    error.value = err?.message || t('documents.portalKnowledgeLoadFailed');
  } finally {
    loading.value = false;
  }
});
</script>
