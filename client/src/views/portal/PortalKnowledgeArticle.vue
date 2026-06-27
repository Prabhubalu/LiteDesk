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
        class="prose prose-sm max-w-none dark:prose-invert"
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
