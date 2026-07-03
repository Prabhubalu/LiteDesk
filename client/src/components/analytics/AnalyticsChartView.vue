<template>
  <div :class="wrapperClass">
    <div v-if="state === 'loading'" :class="loadingClass" />
    <p v-else-if="state === 'empty'" :class="ANALYTICS_CHART_STATE_CLASSES.empty">
      {{ emptyMessage }}
    </p>
    <p v-else-if="state === 'error'" :class="ANALYTICS_CHART_STATE_CLASSES.error">
      {{ errorMessage || t('analytics.chartError') }}
    </p>
    <VChart
      v-else-if="option"
      :option="option"
      :theme="themeId"
      autoresize
      :class="chartClass"
      @click="handleChartClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, PieChart, FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import {
  ANALYTICS_CHART_STATE_CLASSES,
  type AnalyticsChartState,
} from '@/platform/analytics/echarts/chartStates';
import {
  buildChartOption,
  type WidgetChartConfig,
} from '@/platform/analytics/echarts/buildChartOption';
import {
  type AnalyticsChartThemeMode,
} from '@/platform/analytics/echarts/analyticsChartTheme';
import { useAnalyticsChart } from '@/platform/analytics/echarts/useAnalyticsChart';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
]);

const props = withDefaults(
  defineProps<{
    result: AnalyticsExecuteResult | null;
    config: WidgetChartConfig;
    themeMode?: AnalyticsChartThemeMode;
    loading?: boolean;
    errorMessage?: string | null;
    emptyMessage?: string;
    interactive?: boolean;
    /** Fill parent flex area (Platform Home / resizable grid widgets) */
    fillHeight?: boolean;
  }>(),
  {
    themeMode: 'light',
    loading: false,
    errorMessage: null,
    emptyMessage: '',
    interactive: false,
    fillHeight: false,
  },
);

const emit = defineEmits<{
  (e: 'segment-click', payload: { label: string; value: unknown }): void;
}>();

const { t } = useI18n();
const { ensureThemeRegistered, themeId } = useAnalyticsChart({
  chartType: computed(() => props.config.chartType),
  themeMode: computed(() => props.themeMode),
});

const state = computed<AnalyticsChartState>(() => {
  if (props.loading) return 'loading';
  if (props.errorMessage) return 'error';
  if (!props.result?.rows?.length) return 'empty';
  return 'ready';
});

const emptyMessage = computed(
  () => props.emptyMessage || t('analytics.chartEmpty'),
);

const wrapperClass = computed(() =>
  props.fillHeight
    ? 'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
    : ANALYTICS_CHART_STATE_CLASSES.wrapper,
);

const loadingClass = computed(() =>
  props.fillHeight
    ? [ANALYTICS_CHART_STATE_CLASSES.loading, 'h-full min-h-0 w-full flex-1']
    : [ANALYTICS_CHART_STATE_CLASSES.loading, 'h-full min-h-[12rem] w-full'],
);

const chartClass = computed(() =>
  props.fillHeight
    ? 'h-full min-h-0 w-full flex-1'
    : 'min-h-[12rem] w-full rounded-xl',
);

const option = computed(() => {
  if (state.value !== 'ready' || !props.result) return null;
  if (props.config.chartType === 'table' || props.config.chartType === 'kpi') return null;
  return buildChartOption(props.result, props.config, props.themeMode);
});

onMounted(() => {
  void ensureThemeRegistered();
});

watch(
  () => props.themeMode,
  () => {
    void ensureThemeRegistered();
  },
);

function handleChartClick(params: Record<string, unknown>) {
  if (!props.interactive) return;
  const label = params.name != null ? String(params.name) : '';
  if (!label) return;
  const data = params.data as Record<string, unknown> | undefined;
  const value = data?.value ?? params.value ?? label;
  emit('segment-click', { label, value });
}
</script>
