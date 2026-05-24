<template>
  <section class="grid grid-cols-1 gap-3 xl:grid-cols-12">
    <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-7">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('dashboard.pipelineForecastPipelineHealth') }}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ trendSubtitle }}</p>
        </div>
        <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {{ trendDirectionLabel }}
        </span>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-2">
          <div
            v-for="(stage, idx) in pipelineStages"
            :key="stage.stageId"
            class="relative overflow-hidden rounded-md bg-slate-100 px-3 py-2 text-white dark:bg-slate-800"
            :style="{ backgroundColor: funnelColor(idx) }"
          >
            <div class="flex items-center justify-between text-xs font-semibold">
              <span>{{ stage.label }}</span>
              <span>{{ stage.count }}</span>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="text-left text-slate-500 dark:text-slate-400">
                <th class="pb-2 pr-2">{{ t('settings.modFieldsStageLabelFallback') }}</th>
                <th class="pb-2 pr-2">{{ t('settings.settingsSubDetailUsageDeals') }}</th>
                <th class="pb-2 pr-2">{{ t('settings.modFieldsValue') }}</th>
                <th class="pb-2 pr-2">{{ t('dashboard.pipelineForecastConversion') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stage in pipelineStages" :key="`row-${stage.stageId}`" class="border-t border-slate-200 dark:border-slate-700">
                <td class="py-2 pr-2 font-medium text-slate-700 dark:text-slate-200">{{ stage.label }}</td>
                <td class="py-2 pr-2 text-slate-600 dark:text-slate-300">{{ stage.count }}</td>
                <td class="py-2 pr-2 text-slate-600 dark:text-slate-300">{{ formatCurrency(stage.value) }}</td>
                <td class="py-2 pr-2">
                  <span :class="['font-semibold', conversionClass(stage.conversionToNextPct)]">
                    {{ stage.conversionToNextPct === null ? '—' : `${stage.conversionToNextPct}%` }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          Biggest drop-off: {{ biggestDropoffSummary }}
        </div>
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Stuck deals: {{ stuckDealsSummary }}
        </div>
      </div>
    </article>

    <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-5">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('dashboard.pipelineForecastForecastOverview') }}</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('dashboard.pipelineForecastCommitBestCasePipelineAndAccuracy') }}</p>
      <div class="mt-3 grid grid-cols-12 gap-2.5">
        <div class="col-span-8">
          <div v-if="forecastBars.length" class="flex h-36 items-end gap-2">
            <div
              v-for="(bar, idx) in forecastBars"
              :key="`bar-${idx}`"
              class="flex w-full flex-col items-center gap-1"
            >
              <div class="relative h-28 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                <div class="w-full rounded-t-md bg-blue-500" :style="{ height: `${bar.commit}%` }"></div>
                <div class="w-full bg-blue-300" :style="{ height: `${bar.bestCase}%` }"></div>
                <div class="w-full rounded-b-md bg-slate-300 dark:bg-slate-600" :style="{ height: `${bar.pipeline}%` }"></div>
              </div>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">{{ bar.label }}</span>
            </div>
          </div>
          <div v-else class="flex h-36 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">{{ t('dashboard.pipelineForecastNoForecastByMonthDataFor') }}</div>
          <div class="mt-2.5 rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <p class="text-slate-500 dark:text-slate-400">{{ t('dashboard.pipelineForecastForecastVsTarget') }}</p>
            <p class="mt-1 font-semibold text-slate-900 dark:text-white">{{ forecastPanel.vsTarget?.attainmentPct || 0 }}% of target</p>
            <div class="mt-2 h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
              <div class="h-full rounded bg-blue-500" :style="{ width: `${Math.min(100, forecastPanel.vsTarget?.attainmentPct || 0)}%` }"></div>
            </div>
          </div>
        </div>
        <aside class="col-span-4 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/70">
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ t('dashboard.pipelineForecastForecastAccuracy') }}</p>
          <p class="mb-2 text-[10px] text-slate-500 dark:text-slate-400">{{ t('dashboard.pipelineForecastLast3Months') }}</p>
          <ul class="space-y-2">
            <li v-for="item in accuracyRows" :key="item.month" class="text-xs">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-300">{{ item.month }}</span>
                <span class="font-semibold text-slate-700 dark:text-slate-100">{{ item.accuracyPct }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div class="h-full rounded bg-emerald-500" :style="{ width: `${Math.min(100, item.accuracyPct || 0)}%` }"></div>
              </div>
            </li>
            <li v-if="accuracyRows.length === 0" class="text-[11px] text-slate-500 dark:text-slate-400">{{ t('dashboard.pipelineForecastNoHistoricalForecastAccuracyYet') }}</li>
          </ul>
        </aside>
      </div>
      <ul class="mt-2 space-y-1.5">
        <li
          v-for="rep in topForecastReps"
          :key="rep.repId"
          class="flex items-center justify-between text-[11px]"
        >
          <span class="text-slate-600 dark:text-slate-300">{{ rep.name }}</span>
          <span class="font-semibold text-slate-900 dark:text-slate-100">{{ formatCurrency(rep.total) }}</span>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

const funnelColor = (idx) => [
  '#3B82F6',
  '#6366F1',
  '#F59E0B',
  '#10B981',
  '#22C55E'
][idx] || '#64748B';

const conversionClass = (value) => {
  if (value === null || value === undefined) return 'text-slate-400';
  if (value >= 60) return 'text-emerald-600 dark:text-emerald-300';
  if (value >= 40) return 'text-amber-600 dark:text-amber-300';
  return 'text-rose-600 dark:text-rose-300';
};

const props = defineProps({
  trendSubtitle: { type: String, required: true },
  trendDirectionLabel: { type: String, required: true },
  pipelineStages: { type: Array, required: true },
  biggestDropoffSummary: { type: String, required: true },
  stuckDealsSummary: { type: String, required: true },
  forecastPanel: { type: Object, required: true },
  forecastByRep: { type: Array, required: true }
});

const { t } = useI18n();

const forecastBars = computed(() => {
  const rows = Array.isArray(props.forecastPanel?.byClosingMonth) ? props.forecastPanel.byClosingMonth.slice(0, 3) : [];
  if (!rows.length) return [];
  const max = Math.max(...rows.map((r) => (r.commit || 0) + (r.bestCase || 0) + (r.pipelineUncommitted || 0)), 1);
  return rows.map((r) => ({
    label: shortMonth(r.month),
    commit: Math.max(8, Math.round(((r.commit || 0) / max) * 100)),
    bestCase: Math.max(8, Math.round(((r.bestCase || 0) / max) * 100)),
    pipeline: Math.max(8, Math.round(((r.pipelineUncommitted || 0) / max) * 100))
  }));
});

const accuracyRows = computed(() => {
  const rows = Array.isArray(props.forecastPanel?.accuracyLast3Months) ? props.forecastPanel.accuracyLast3Months : [];
  if (!rows.length) return [];
  return rows.map((r) => ({
    month: shortMonth(r.month),
    accuracyPct: Number(r.accuracyPct || 0)
  }));
});

const topForecastReps = computed(() =>
  (Array.isArray(props.forecastByRep) ? props.forecastByRep : [])
    .map((rep) => ({ ...rep, total: Number(rep.commit || 0) + Number(rep.bestCase || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
);

const shortMonth = (monthValue) => {
  const raw = String(monthValue || '');
  if (!raw) return '-';
  if (raw.length >= 7) {
    const [, mm] = raw.split('-');
    const map = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = Number(mm) - 1;
    if (idx >= 0 && idx < map.length) return map[idx];
  }
  return raw;
};
</script>
