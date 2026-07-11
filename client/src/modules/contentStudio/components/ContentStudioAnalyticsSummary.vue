<template>
  <div class="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
    <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      {{ t('contentStudio.articleAnalyticsTitle') }}
    </p>

    <div v-if="loading" class="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <dl v-else class="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt class="text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.articleAnalyticsHelpfulYes') }}</dt>
        <dd class="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{{ analytics.helpfulYes }}</dd>
      </div>
      <div>
        <dt class="text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.articleAnalyticsHelpfulNo') }}</dt>
        <dd class="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{{ analytics.helpfulNo }}</dd>
      </div>
      <div>
        <dt class="text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.articleAnalyticsHelpfulRate') }}</dt>
        <dd class="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{{ analytics.helpfulRate }}%</dd>
      </div>
      <div>
        <dt class="text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.articleAnalyticsShares') }}</dt>
        <dd class="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{{ analytics.sharesTotal }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getArticleAnalytics } from '../services/contentStudioApi';

const props = defineProps({
  articleId: { type: String, required: true },
});

const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const analytics = ref({
  helpfulYes: 0,
  helpfulNo: 0,
  helpfulRate: 0,
  sharesTotal: 0,
});

async function loadAnalytics() {
  if (!props.articleId) return;
  loading.value = true;
  error.value = '';
  try {
    analytics.value = await getArticleAnalytics(props.articleId);
  } catch (err) {
    error.value = err?.message || t('contentStudio.articleAnalyticsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadAnalytics();
});

watch(
  () => props.articleId,
  () => {
    void loadAnalytics();
  },
);
</script>
