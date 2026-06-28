<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex flex-col md:flex-row md:items-end gap-4">
        <div class="flex items-end gap-3 md:ml-auto w-full md:w-auto">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskAnalyticsFrom') }}</label>
            <DatePicker
              v-model="filters.from"
              input-class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.helpdeskAnalyticsTo') }}</label>
            <DatePicker
              v-model="filters.to"
              input-class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
            :disabled="loading"
            @click="fetchAnalytics"
          >
            {{ loading ? t('settings.helpdeskAnalyticsRefreshing') : t('actions.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="card in summaryCards" :key="card.label" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
      </div>
    </div>

    <div
      v-if="bhTotals"
      class="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800/50 p-6"
    >
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskAnalyticsBhTitle') }}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.helpdeskAnalyticsBhSubtitle') }}</p>
        </div>
        <router-link
          :to="{ path: '/settings', query: { tab: 'business-hours' } }"
          class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          {{ t('settings.helpdeskAnalyticsManageSchedules') }}
        </router-link>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          v-for="card in bhCards"
          :key="card.label"
          class="rounded-lg border border-gray-100 dark:border-gray-700 p-3"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white mt-1">{{ card.value }}</p>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.helpdeskAnalyticsTrendTitle') }}</h4>
      <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
        <div v-for="point in trendPreview" :key="point.date" class="space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{{ point.date }}</span>
            <span>{{ t('settings.helpdeskAnalyticsTrendLegend', { created: point.created, resolved: point.resolved, breached: point.breached }) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="h-2 rounded bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden">
              <div class="h-2 bg-indigo-500" :style="{ width: normalizeBar(point.created) }"></div>
            </div>
            <div class="h-2 rounded bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
              <div class="h-2 bg-emerald-500" :style="{ width: normalizeBar(point.resolved) }"></div>
            </div>
            <div class="h-2 rounded bg-rose-100 dark:bg-rose-900/40 overflow-hidden">
              <div class="h-2 bg-rose-500" :style="{ width: normalizeBar(point.breached) }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.helpdeskAnalyticsOwnerTitle') }}</h4>
        <div class="space-y-3 max-h-96 overflow-y-auto">
          <div v-for="owner in owners" :key="owner.assignedTo" class="p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ ownerName(owner) }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ owner.owner?.email || owner.assignedTo }}</p>
              </div>
              <span class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {{ t('settings.helpdeskAnalyticsOpenBadge', { count: owner.openCases }) }}
              </span>
            </div>
            <div class="mt-2 text-xs text-gray-600 dark:text-gray-300 flex flex-wrap gap-3">
              <span>{{ t('settings.helpdeskAnalyticsOwnerTotal', { count: owner.totalCases }) }}</span>
              <span>{{ t('settings.helpdeskAnalyticsOwnerSla', { percent: owner.slaCompliancePercent }) }}</span>
              <span>{{ t('settings.helpdeskAnalyticsOwnerReopen', { percent: owner.reopenRatePercent }) }}</span>
              <span>{{ t('settings.helpdeskAnalyticsOwnerAvgRes', { minutes: ownerAvgResMinutes(owner) }) }}</span>
            </div>
          </div>
          <p v-if="owners.length === 0" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskAnalyticsOwnerEmpty') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.helpdeskAnalyticsDistTitle') }}</h4>
        <div class="space-y-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('settings.helpdeskAnalyticsByPriority') }}</p>
            <div class="space-y-2">
              <div v-for="row in distribution.byPriority" :key="`p-${row.segment}`" class="flex items-center justify-between text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ row.segment }}</span>
                <span class="text-gray-600 dark:text-gray-400">{{ t('settings.helpdeskAnalyticsDistRow', { count: row.totalCases, percent: row.slaCompliancePercent }) }}</span>
              </div>
            </div>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('settings.helpdeskAnalyticsByChannel') }}</p>
            <div class="space-y-2">
              <div v-for="row in distribution.byChannel" :key="`c-${row.segment}`" class="flex items-center justify-between text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ row.segment }}</span>
                <span class="text-gray-600 dark:text-gray-400">{{ t('settings.helpdeskAnalyticsDistRow', { count: row.totalCases, percent: row.slaCompliancePercent }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import DatePicker from '@/components/common/DatePicker.vue';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const loading = ref(false);
const error = ref('');
const summary = ref(null);
const trends = ref([]);
const owners = ref([]);
const distribution = ref({ byPriority: [], byChannel: [], byCaseType: [] });
const bhTotals = ref(null);

const bhCards = computed(() => {
  const totals = bhTotals.value;
  if (!totals) return [];
  const capH = Math.floor((totals.businessMinutesAvailable || 0) / 60);
  return [
    { label: t('settings.helpdeskAnalyticsBhCapacity'), value: `${capH}h` },
    { label: t('settings.helpdeskAnalyticsBhInHours'), value: totals.activitiesInsideHours ?? 0 },
    { label: t('settings.helpdeskAnalyticsBhOvertime'), value: totals.overtimeCount ?? 0 },
    { label: t('settings.helpdeskAnalyticsBhBreachesOff'), value: totals.slaBreachesOffHours ?? 0 }
  ];
});

const toDateInput = (date) => date.toISOString().slice(0, 10);
const now = new Date();
const last30 = new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000));
const filters = ref({
  from: toDateInput(last30),
  to: toDateInput(now)
});

const summaryCards = computed(() => {
  const totals = summary.value?.totals || {};
  const resolution = summary.value?.resolution || {};
  const response = summary.value?.response || {};
  const avgFirstResponse = response.averageFirstResponseMinutes != null
    ? `${response.averageFirstResponseMinutes}m`
    : '-';
  return [
    { label: t('settings.helpdeskAnalyticsCardTotalCases'), value: totals.totalCases ?? 0 },
    { label: t('settings.helpdeskAnalyticsCardOpenCases'), value: totals.openCases ?? 0 },
    { label: t('settings.helpdeskAnalyticsCardSlaCompliance'), value: `${resolution.slaCompliancePercent ?? 0}%` },
    { label: t('settings.helpdeskAnalyticsCardAvgFirstResponse'), value: avgFirstResponse }
  ];
});

const trendPreview = computed(() => trends.value.slice(-30));

function normalizeBar(value) {
  const max = Math.max(
    1,
    ...trendPreview.value.map((item) => Math.max(item.created || 0, item.resolved || 0, item.breached || 0))
  );
  const width = Math.round(((Number(value) || 0) / max) * 100);
  return `${Math.max(6, width)}%`;
}

function ownerName(owner) {
  const first = owner?.owner?.firstName || '';
  const last = owner?.owner?.lastName || '';
  return `${first} ${last}`.trim() || t('settings.helpdeskAnalyticsUnknownOwner');
}

function ownerAvgResMinutes(owner) {
  const minutes = owner?.averageResolutionMinutes;
  return minutes != null ? minutes : '-';
}

async function fetchAnalytics() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (filters.value.from) params.set('from', new Date(filters.value.from).toISOString());
    if (filters.value.to) params.set('to', new Date(filters.value.to).toISOString());
    const query = params.toString() ? `?${params.toString()}` : '';

    const bhQuery = new URLSearchParams();
    if (filters.value.from) bhQuery.set('from', filters.value.from);
    if (filters.value.to) bhQuery.set('to', filters.value.to);
    const bhQs = bhQuery.toString() ? `?${bhQuery.toString()}` : '';

    const [summaryRes, trendsRes, ownersRes, distributionRes, bhRes] = await Promise.all([
      apiClient(`/helpdesk/cases/analytics/summary${query}`, { method: 'GET' }),
      apiClient(`/helpdesk/cases/analytics/trends${query}`, { method: 'GET' }),
      apiClient(`/helpdesk/cases/analytics/owners${query}`, { method: 'GET' }),
      apiClient(`/helpdesk/cases/analytics/distribution${query}`, { method: 'GET' }),
      apiClient(`/business-hours/kpis${bhQs}`, { method: 'GET' }).catch(() => null)
    ]);

    if (!summaryRes?.success || !trendsRes?.success || !ownersRes?.success || !distributionRes?.success) {
      throw new Error(t('settings.helpdeskAnalyticsLoadFailed'));
    }

    summary.value = summaryRes.data || null;
    trends.value = trendsRes.data?.points || [];
    owners.value = ownersRes.data || [];
    distribution.value = distributionRes.data || { byPriority: [], byChannel: [], byCaseType: [] };
    bhTotals.value = bhRes?.success ? bhRes.data?.totals || null : null;
  } catch (err) {
    console.error('Failed to load Helpdesk analytics:', err);
    error.value = err?.message || t('settings.helpdeskAnalyticsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAnalytics);
</script>
