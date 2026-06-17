<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p class="text-[11px] uppercase text-gray-400">{{ t('webforms.analyticsViews') }}</p>
        <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ summary.totalViews }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p class="text-[11px] uppercase text-gray-400">{{ t('webforms.statSubmissions') }}</p>
        <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ summary.totalSubmissions }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p class="text-[11px] uppercase text-gray-400">{{ t('webforms.analyticsConversion') }}</p>
        <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ summary.conversionRate }}%</p>
      </div>
      <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p class="text-[11px] uppercase text-gray-400">{{ t('webforms.analyticsDedupHits') }}</p>
        <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ summary.dedupHits }}</p>
      </div>
    </div>

    <div v-if="loading" class="text-xs text-gray-400">{{ t('webforms.analyticsLoading') }}</div>
    <div v-else-if="error" class="text-xs text-red-500">{{ error }}</div>

    <div v-if="trend.length" class="space-y-2">
      <p class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('webforms.analyticsTrendTitle') }}</p>
      <div
        v-for="point in trend.slice(-7)"
        :key="point.date"
        class="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400"
      >
        <span>{{ point.date }}</span>
        <span>{{ t('webforms.analyticsTrendPoint', { count: point.submissions }) }}</span>
      </div>
    </div>

    <div v-if="recentAudit.length" class="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      <p class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('webforms.analyticsAuditTitle') }}</p>
      <div
        v-for="(entry, index) in recentAudit"
        :key="`${entry.type}-${entry.createdAt}-${index}`"
        class="text-[11px] text-gray-500 dark:text-gray-400"
      >
        <span class="font-medium text-gray-700 dark:text-gray-300">{{ auditLabel(entry.type) }}</span>
        <span v-if="entry.message"> — {{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  webformId: { type: String, required: true }
});

const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const analytics = ref(null);

const summary = computed(() => analytics.value?.summary || {
  totalViews: 0,
  totalSubmissions: 0,
  conversionRate: 0,
  dedupHits: 0
});
const trend = computed(() => analytics.value?.trend || []);
const recentAudit = computed(() => analytics.value?.recentAudit || []);

function auditLabel(type) {
  const key = `webforms.auditType_${type}`;
  const value = t(key);
  return value.startsWith('webforms.auditType_') ? type : value;
}

async function fetchAnalytics() {
  if (!props.webformId) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient.get(`/webforms/${props.webformId}/analytics`);
    analytics.value = response?.data || null;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('webforms.analyticsLoadError');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void fetchAnalytics();
});

watch(() => props.webformId, () => {
  void fetchAnalytics();
});

defineExpose({ refresh: fetchAnalytics });
</script>
