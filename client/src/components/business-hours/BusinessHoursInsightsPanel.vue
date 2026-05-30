<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.settingsBhInsightsTitle') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ t('settings.settingsBhInsightsDesc') }}
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterFrom') }}</label>
          <DatePicker
            v-model="filters.from"
            input-class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('common.filterTo') }}</label>
          <DatePicker
            v-model="filters.to"
            input-class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="loading"
          @click="loadKpis"
        >
          {{ loading ? t('states.loading') : t('actions.refresh') }}
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          :disabled="aggregating"
          @click="runAggregate"
        >
          {{ aggregating ? t('settings.settingsBhAggregating') : t('settings.settingsBhRecomputeYesterday') }}
        </button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-if="totals" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in summaryCards"
        :key="card.label"
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
        <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
      </div>
    </div>

    <div
      v-if="series.length"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5"
    >
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.settingsBhDailyTrend') }}</h4>
      <div class="space-y-3 max-h-80 overflow-y-auto">
        <div v-for="row in series" :key="row.date" class="space-y-1">
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{{ row.date }}</span>
            <span>
              {{
                t('settings.settingsBhTrendRow', {
                  inside: row.activitiesInsideHours,
                  overtime: row.overtimeCount,
                  sla: row.slaBreachesOffHours
                })
              }}
            </span>
          </div>
          <div class="h-2 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div class="h-2 bg-indigo-500" :style="{ width: barWidth(row.utilizationPercent) }" />
          </div>
        </div>
      </div>
    </div>

    <p v-else-if="!loading" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
      {{ t('settings.settingsBhNoKpiData') }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import DatePicker from '@/components/common/DatePicker.vue';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();

const loading = ref(false);
const aggregating = ref(false);
const error = ref(null);
const series = ref([]);
const totals = ref(null);

const filters = ref({ from: '', to: '' });

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  filters.value.to = to.toISOString().slice(0, 10);
  filters.value.from = from.toISOString().slice(0, 10);
}

function barWidth(pct) {
  const n = Math.min(100, Math.max(0, Number(pct) || 0));
  return `${n}%`;
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const summaryCards = computed(() => {
  if (!totals.value) return [];
  const row = totals.value;
  return [
    {
      label: t('settings.settingsBhKpiCapacity'),
      value: formatMinutes(row.businessMinutesAvailable),
      hint: t('settings.settingsBhKpiCapacityHint')
    },
    {
      label: t('settings.settingsBhKpiInHours'),
      value: row.activitiesInsideHours,
      hint: t('settings.settingsBhKpiInHoursHint', { pct: row.utilizationPercent })
    },
    {
      label: t('settings.settingsBhKpiOvertime'),
      value: row.overtimeCount,
      hint: t('settings.settingsBhKpiOvertimeHint')
    },
    {
      label: t('settings.settingsBhKpiSlaOffHours'),
      value: row.slaBreachesOffHours,
      hint: t('settings.settingsBhKpiDeferredHint', {
        assign: row.assignmentDeferredCount,
        auto: row.automationDeferredCount
      })
    }
  ];
});

async function loadKpis() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filters.value.from) params.set('from', filters.value.from);
    if (filters.value.to) params.set('to', filters.value.to);
    const qs = params.toString();
    const res = await apiClient.get(`/business-hours/kpis${qs ? `?${qs}` : ''}`);
    series.value = res.data?.series || [];
    totals.value = res.data?.totals || null;
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || t('settings.settingsBhKpiLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function runAggregate() {
  aggregating.value = true;
  try {
    await apiClient.post('/business-hours/kpis/aggregate', {});
    notifySuccess(t('settings.settingsBhKpiAggregated'));
    await loadKpis();
  } catch (e) {
    notifyError(e?.response?.data?.message || t('settings.settingsBhKpiAggregateFailed'));
  } finally {
    aggregating.value = false;
  }
}

onMounted(() => {
  defaultRange();
  loadKpis();
});
</script>
