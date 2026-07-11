<template>
  <section class="space-y-2">
    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
      <article
        v-for="(metric, index) in cards"
        :key="metric.key"
        class="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="mb-2 flex items-center gap-2">
          <span :class="['inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold', badgeClass(index)]">
            {{ metricIcon(index) }}
          </span>
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">{{ metric.label }}</p>
        </div>
        <p class="text-[26px] font-bold leading-tight text-slate-900 dark:text-white">{{ metric.formattedValue }}</p>
        <p :class="['mt-1 text-xs font-semibold', metric.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300']">
          {{ metric.delta >= 0 ? '+' : '' }}{{ metric.delta }}%
        </p>
        <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{{ t('dashboard.executiveSnapshotVsPreviousPeriod') }}</p>
        <div class="mt-2 flex h-8 items-end gap-1">
          <span
            v-for="(point, idx) in metric.trend"
            :key="`${metric.key}-trend-${idx}`"
            class="w-1.5 rounded-sm bg-indigo-300/90 dark:bg-indigo-500/50"
            :style="{ height: `${Math.max(15, Math.min(100, point))}%` }"
          ></span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { getCurrencySymbolFromCode, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';

defineProps({
  cards: { type: Array, required: true }
});

const { t } = useI18n();
const authStore = useAuthStore();
const currencySymbol = computed(() =>
  getCurrencySymbolFromCode(resolveOrgCurrencyCode(authStore.organization))
);

const metricIcon = (idx) => [currencySymbol.value, 'P', 'F', 'W', 'S', 'C'][idx] || 'M';
const badgeClass = (idx) => [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
][idx] || 'bg-slate-100 text-slate-700';
</script>
