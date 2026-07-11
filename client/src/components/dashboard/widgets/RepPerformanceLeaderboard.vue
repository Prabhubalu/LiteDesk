<template>
  <section class="flex h-full min-h-[250px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('dashboard.repPerformanceLeaderboardRepPerformance') }}</h2>
      <span class="text-xs text-indigo-600 dark:text-indigo-300">{{ t('dashboard.repPerformanceLeaderboardViewAllReps') }}</span>
    </div>
    <div class="flex-1 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-slate-500 dark:text-slate-400">
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardRank') }}</th>
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardRep') }}</th>
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardQuotaAttainment') }}</th>
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardRevenueClosed') }}</th>
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardPipelineOwned') }}</th>
            <th class="py-2 pr-3">{{ t('dashboard.repPerformanceLeaderboardWinRate') }}</th>
            <th class="py-2 pr-3">{{ t('records.genericTabActivity') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rep in displayRows"
            :key="rep.repId"
            :class="[
              'border-t border-slate-200 dark:border-slate-700',
              rep.isPlaceholder ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'
            ]"
          >
            <td class="py-1.5 pr-3 font-semibold">{{ rep.isPlaceholder ? '—' : rep.rank }}</td>
            <td class="py-1.5 pr-3">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="rep.isPlaceholder ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
                >
                  {{ rep.isPlaceholder ? '—' : initials(rep.name) }}
                </span>
                <span>{{ rep.isPlaceholder ? 'No additional reps' : rep.name }}</span>
              </div>
            </td>
            <td class="py-1.5 pr-3">
              <div class="min-w-24">
                <div class="mb-1 flex items-center justify-between text-[11px]">
                  <span
                    :class="[
                      'rounded-full px-1.5 py-0.5 font-semibold',
                      rep.isPlaceholder ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : getQuotaBandClass(rep.quotaBand)
                    ]"
                  >
                    {{ rep.isPlaceholder ? '—' : `${rep.quotaAttainmentPct}%` }}
                  </span>
                </div>
                <div class="h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                  <div
                    class="h-full rounded"
                    :class="rep.isPlaceholder ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-500'"
                    :style="{ width: `${Math.min(100, Number(rep.quotaAttainmentPct || 0))}%` }"
                  ></div>
                </div>
              </div>
            </td>
            <td class="py-1.5 pr-3">{{ rep.isPlaceholder ? '—' : formatCurrency(rep.revenueClosed) }}</td>
            <td class="py-1.5 pr-3">{{ rep.isPlaceholder ? '—' : formatCurrency(rep.pipelineOwned) }}</td>
            <td class="py-1.5 pr-3">{{ rep.isPlaceholder ? '—' : `${rep.winRatePct}%` }}</td>
            <td class="py-1.5 pr-3">{{ rep.isPlaceholder ? '—' : rep.activityCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { formatCompactCurrencyValue } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  rows: { type: Array, required: true }
});

const { t } = useI18n();
const authStore = useAuthStore();
const formatCurrency = (value) =>
  formatCompactCurrencyValue(value, { orgCurrency: authStore.organization });

const MIN_ROWS = 5;
const displayRows = computed(() => {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  if (rows.length >= MIN_ROWS) return rows;
  const fillers = Array.from({ length: MIN_ROWS - rows.length }, (_, idx) => ({
    repId: `placeholder-${idx}`,
    isPlaceholder: true,
    quotaAttainmentPct: 0
  }));
  return [...rows, ...fillers];
});

const getQuotaBandClass = (band) => {
  const normalized = String(band || '').toLowerCase();
  if (normalized === 'green') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (normalized === 'yellow') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
};

const initials = (name) =>
  String(name || 'NA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
</script>
