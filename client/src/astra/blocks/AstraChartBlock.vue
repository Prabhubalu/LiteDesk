<template>
  <section :class="['overflow-hidden', PLATFORM_HOME_CARD_CLASS]">
    <div
      :class="[
        'flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5',
        PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
      ]"
    >
      <h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ title || t('astra.chartTitle') }}
      </h3>
      <span
        v-if="total"
        class="shrink-0 rounded-full border border-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-white/10 dark:text-neutral-400"
      >
        {{ total }}
      </span>
    </div>
    <div class="h-52 px-2 py-2 sm:px-3">
      <AnalyticsChartView
        :result="chartResult"
        :config="chartConfig"
        :theme-mode="themeMode"
        fill-height
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import { useColorMode } from '@/composables/useColorMode';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import type { WidgetChartConfig } from '@/platform/analytics/echarts/buildChartOption';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
} from '@/utils/platformHomeLayout';
import type { AstraChartPoint } from '@/astra/blocks/types';

const props = withDefaults(
  defineProps<{
    title?: string;
    chartType?: 'bar' | 'donut' | 'pie' | 'line';
    series: AstraChartPoint[];
  }>(),
  { chartType: 'bar', series: () => [] },
);

const { t } = useI18n();
const { effectiveDark } = useColorMode();

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const total = computed(() =>
  props.series.reduce((sum, point) => sum + (Number(point.value) || 0), 0),
);

const chartResult = computed<AnalyticsExecuteResult>(() => {
  const rows = props.series.map((point) => ({
    name: point.name,
    value: Number(point.value) || 0,
  }));
  return {
    columns: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'value', label: 'Value', type: 'number' },
    ],
    rows,
    meta: {
      totalRows: rows.length,
      truncated: false,
      executionMs: 0,
      reportId: 'astra-inline',
      reportVersion: 1,
    },
  };
});

const chartConfig = computed<WidgetChartConfig>(() => {
  const chartType = props.chartType === 'donut' || props.chartType === 'pie' || props.chartType === 'line'
    ? props.chartType
    : 'bar';
  return {
    chartType,
    columnMapping: { dimension: 'name', metric: 'value' },
    showLegend: chartType === 'pie' || chartType === 'donut',
  };
});
</script>
