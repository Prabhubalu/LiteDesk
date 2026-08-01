<template>
  <div
    class="relative flex min-h-[9rem] flex-col items-center justify-center overflow-hidden rounded-2xl border px-6 py-8"
    :class="cardClasses"
    :style="accentStyle"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-70"
      :class="glowClasses"
      aria-hidden="true"
    />
    <p
      v-if="label"
      class="relative text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400"
    >
      {{ label }}
    </p>
    <p
      class="relative mt-2 text-4xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-white"
      :class="valueClasses"
    >
      {{ formattedValue }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '@/utils/localeFormat';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import {
  extractKpiValue,
  resolveKpiThresholdColor,
} from '@/platform/analytics/echarts/buildChartOption';
import type { AnalyticsThresholdBand } from '@/types/analytics.types';

const props = defineProps<{
  result: AnalyticsExecuteResult | null;
  valueField?: string | null;
  label?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  thresholds?: AnalyticsThresholdBand[] | null;
}>();

const rawValue = computed(() =>
  props.result ? extractKpiValue(props.result, props.valueField) : null,
);

const formattedValue = computed(() => {
  if (rawValue.value === null) return '—';
  const prefix = props.prefix || '';
  const suffix = props.suffix || '';
  return `${prefix}${formatNumber(rawValue.value)}${suffix}`;
});

const thresholdColor = computed(() => {
  if (rawValue.value === null) return null;
  return resolveKpiThresholdColor(rawValue.value, props.thresholds);
});

const cardClasses = computed(() => {
  if (thresholdColor.value) {
    return 'border-neutral-200/80 bg-white dark:border-neutral-700 dark:bg-neutral-900/80';
  }
  return 'border-neutral-200/80 bg-gradient-to-br from-white via-white to-primary-50/40 dark:border-neutral-700 dark:from-neutral-900 dark:via-neutral-900 dark:to-primary-950/30';
});

const glowClasses = computed(() => {
  if (thresholdColor.value) return '';
  return 'bg-[radial-gradient(circle_at_top,rgba(96,73,231,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.12),transparent_55%)]';
});

const valueClasses = computed(() => {
  if (!thresholdColor.value) {
    return 'bg-gradient-to-br from-neutral-900 to-neutral-600 bg-clip-text text-transparent dark:from-white dark:to-neutral-300';
  }
  return '';
});

const accentStyle = computed(() => {
  if (!thresholdColor.value) return undefined;
  return {
    borderColor: thresholdColor.value,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px ${thresholdColor.value}33, 0 12px 32px ${thresholdColor.value}18`,
  };
});
</script>
