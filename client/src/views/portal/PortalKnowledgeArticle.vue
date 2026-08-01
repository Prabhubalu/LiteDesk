<template>
  <PortalRecordShell
    :loading="loading"
    :error="error"
    :back-label="t('documents.portalKnowledgeBack')"
    :eyebrow="article?.documentNumber"
    :title="article?.title || ''"
    :description="article?.description || ''"
    @back="router.push({ name: 'portal-knowledge' })"
  >
    <template v-if="article" #header-extra>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('documents.portalKnowledgeUpdated', { date: formatDate(article.updatedAt) }) }}
      </p>
    </template>

    <section v-if="article" :class="['p-5 sm:p-6', PLATFORM_HOME_CARD_CLASS]">
      <div
        v-if="richHtml"
        class="portal-knowledge-content prose prose-sm max-w-none dark:prose-invert"
        v-html="richHtml"
      />
      <p v-else-if="article.richContentText" class="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
        {{ article.richContentText }}
      </p>
    </section>
  </PortalRecordShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePortalKnowledge } from '@/composables/usePortalKnowledge';
import PortalRecordShell from '@/components/portal/PortalRecordShell.vue';
import { PLATFORM_HOME_CARD_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';

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
  return formatUserDate(value) || '—';
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

<style scoped>
@import '@/modules/contentStudio/editor/contentStudioArticleAppearance.css';
@import '@/modules/contentStudio/editor/contentStudioFaq.css';

:deep(.portal-knowledge-content .content-subtitle) {
  font-size: 1.125rem;
  line-height: 1.6;
  color: rgb(82 82 82);
  margin-bottom: 1.5rem;
}

:deep(.portal-knowledge-content .content-callout) {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(212 212 212);
}

:deep(.portal-knowledge-content .content-callout--info) {
  background: rgb(239 246 255);
  border-color: rgb(147 197 253);
}

:deep(.portal-knowledge-content .content-callout--tip) {
  background: rgb(236 253 245);
  border-color: rgb(52 211 153);
}

:deep(.portal-knowledge-content .content-callout--warning) {
  background: rgb(254 252 232);
  border-color: rgb(250 204 21);
}

:deep(.portal-knowledge-content pre) {
  overflow-x: auto;
  border-radius: 0.5rem;
  background: rgb(245 245 245);
  padding: 0.75rem 1rem;
}

:deep(.portal-knowledge-content pre code) {
  font-size: 0.875rem;
}

:deep(.dark .portal-knowledge-content pre) {
  background: rgb(38 38 38);
}
</style>
