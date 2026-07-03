<template>
  <div>
    <p v-if="previewModeLabel" class="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
      {{ previewModeLabel }}
    </p>
    <AnalyticsKpiCard
      v-if="reportType === 'kpi'"
      :result="result"
      :value-field="metricField"
      :label="label"
    />
    <AnalyticsChartView
      v-else-if="isChartType"
      :result="result"
      :config="chartConfig"
      :theme-mode="themeMode"
      :loading="loading"
      :empty-message="emptyMessage"
    />
    <ReportPreviewPanel
      v-else
      :result="result"
      :empty-message="emptyMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import type { AnalyticsChartThemeMode } from '@/platform/analytics/echarts/analyticsChartTheme';
import type { WidgetChartConfig } from '@/platform/analytics/echarts/buildChartOption';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';

const props = withDefaults(
  defineProps<{
    result: AnalyticsExecuteResult | null;
    reportType: string;
    metricField?: string;
    dimensionField?: string;
    label?: string;
    loading?: boolean;
    themeMode?: AnalyticsChartThemeMode;
    emptyMessage: string;
  }>(),
  {
    metricField: 'count',
    dimensionField: '',
    label: '',
    loading: false,
    themeMode: 'light',
  },
);

const { t } = useI18n();

const isChartType = computed(() =>
  ['summary', 'trend', 'matrix'].includes(String(props.reportType || '').toLowerCase()),
);

const chartConfig = computed((): WidgetChartConfig => {
  const type = String(props.reportType || 'summary').toLowerCase();
  const chartType = type === 'trend' ? 'line' : type === 'matrix' ? 'bar' : 'bar';
  return {
    chartType,
    columnMapping: {
      dimension: props.dimensionField || undefined,
      metric: props.metricField || 'count',
    },
    showLegend: type === 'summary',
    smooth: type === 'trend',
  };
});

const previewModeLabel = computed(() => {
  const type = String(props.reportType || '').toLowerCase();
  const keyMap: Record<string, string> = {
    kpi: 'previewModeKpi',
    summary: 'previewModeChart',
    trend: 'previewModeTrend',
    matrix: 'previewModeMatrix',
    tabular: 'previewModeTable',
    joined: 'previewModeTable',
    exception: 'previewModeException',
  };
  const key = keyMap[type];
  return key ? t(`analytics.${key}`) : '';
});
</script>
