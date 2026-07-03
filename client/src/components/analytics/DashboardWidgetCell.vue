<template>
  <div :class="rootClass">
    <div
      :class="[
        'platform-home-widget-header flex items-stretch gap-2',
        headerPaddingClass,
        headerDividerClass,
      ]"
    >
      <p class="flex min-w-0 shrink items-center select-text truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ title }}
      </p>
      <PlatformHomeWidgetHeaderDragPad v-if="showDragPad" />
      <button
        v-if="editable && showRemove"
        type="button"
        class="platform-home-widget-header-actions shrink-0 self-center text-xs text-neutral-500 hover:text-red-600"
        @click="$emit('remove')"
      >
        {{ t('actions.remove') }}
      </button>
    </div>
    <div :class="bodyClass">
      <p
        v-if="payload?.error"
        class="flex h-full min-h-0 items-center justify-center px-3 py-6 text-center text-xs text-danger-600 dark:text-danger-400"
      >
        {{ payload.error }}
      </p>
      <div
        v-else-if="chartType === 'kpi'"
        class="flex h-full min-h-0 items-center justify-center"
      >
        <AnalyticsKpiCard
          class="w-full"
          :class="isPlatformHomeSurface ? 'min-h-0' : undefined"
          :result="payload?.result || null"
          :value-field="payload?.kpiValueField"
          :label="payload?.kpiLabel || title"
          :prefix="payload?.kpiPrefix"
          :suffix="payload?.kpiSuffix"
          :thresholds="payload?.thresholds"
        />
      </div>
      <div
        v-else-if="chartType === 'table'"
        class="h-full min-h-0 overflow-auto"
      >
        <ReportPreviewPanel
          :result="payload?.result || null"
          :empty-message="t('analytics.previewEmpty')"
        />
      </div>
      <AnalyticsChartView
        v-else-if="chartType"
        :result="payload?.result || null"
        :config="chartConfig"
        :theme-mode="themeMode"
        :loading="loading"
        :interactive="interactive"
        :fill-height="isPlatformHomeSurface"
        @segment-click="$emit('segment-click', $event)"
      />
      <p v-else class="py-8 text-center text-xs text-neutral-500">
        {{ t('analytics.dashboardWidgetPlaceholder') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
import PlatformHomeWidgetHeaderDragPad from '@/components/platform/PlatformHomeWidgetHeaderDragPad.vue';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
} from '@/utils/platformHomeLayout';
import type { AnalyticsDashboardWidgetPayload } from '@/composables/useAnalyticsDashboards';
import type { WidgetChartConfig } from '@/platform/analytics/echarts/buildChartOption';

const props = defineProps<{
  title: string;
  chartType?: string | null;
  payload?: AnalyticsDashboardWidgetPayload | null;
  themeMode?: 'light' | 'dark';
  loading?: boolean;
  editable?: boolean;
  showRemove?: boolean;
  interactive?: boolean;
  /** Match Platform Home widget chrome when embedded on home grid */
  surface?: 'dashboard' | 'platform-home';
  showDragPad?: boolean;
}>();

defineEmits<{
  (e: 'remove'): void;
  (e: 'segment-click', payload: { label: string; value: unknown }): void;
}>();

const { t } = useI18n();

const isPlatformHomeSurface = computed(() => props.surface === 'platform-home');

const rootClass = computed(() =>
  isPlatformHomeSurface.value
    ? ['flex h-full min-h-0 flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]
    : ['flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'],
);

const headerDividerClass = computed(() =>
  isPlatformHomeSurface.value
    ? PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS
    : 'border-b border-neutral-200 dark:border-neutral-700',
);

const headerPaddingClass = computed(() =>
  isPlatformHomeSurface.value ? 'px-4 py-2.5 sm:px-5' : 'px-3 py-2',
);

const bodyClass = computed(() =>
  isPlatformHomeSurface.value
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-2'
    : 'min-h-0 flex-1 p-2',
);

const showDragPad = computed(() => props.showDragPad !== false && isPlatformHomeSurface.value);

const chartConfig = computed((): WidgetChartConfig => ({
  chartType: props.chartType || 'bar',
  columnMapping: props.payload?.columnMapping || {},
  showLegend: props.payload?.showLegend !== false,
  orientation:
    props.payload?.orientation === 'horizontal' || props.payload?.orientation === 'vertical'
      ? props.payload.orientation
      : undefined,
  stacked: props.payload?.stacked,
  smooth: props.payload?.smooth,
  showDataLabels: props.payload?.showDataLabels,
}));
</script>
