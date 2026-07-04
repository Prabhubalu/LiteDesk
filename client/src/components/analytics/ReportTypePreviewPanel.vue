<template>
  <div>
    <p v-if="showModeLabel && previewModeLabel" class="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
      {{ previewModeLabel }}
    </p>
    <AnalyticsKpiCard
      v-if="reportType === 'kpi'"
      :result="result"
      :value-field="metricField"
      :label="label"
    />
    <ReportMatrixPreviewPanel
      v-else-if="isMatrixPreview"
      :result="result"
      :expanded-rows="expandedRows"
      :empty-message="emptyMessage"
      @toggle-row="$emit('toggle-row', $event)"
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
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportMatrixPreviewPanel, {
  type MatrixExpandedRowState,
} from '@/components/analytics/ReportMatrixPreviewPanel.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';

const props = withDefaults(
  defineProps<{
    result: AnalyticsExecuteResult | null;
    reportType: string;
    metricField?: string;
    dimensionField?: string;
    label?: string;
    loading?: boolean;
    emptyMessage: string;
    expandedRows?: Record<string, MatrixExpandedRowState>;
    showModeLabel?: boolean;
  }>(),
  {
    metricField: 'count',
    dimensionField: '',
    label: '',
    loading: false,
    expandedRows: () => ({}),
    showModeLabel: true,
  },
);

defineEmits<{
  (
    e: 'toggle-row',
    payload: {
      key: string;
      rowFilters: Record<string, unknown>;
      label: string;
    },
  ): void;
}>();

const { t } = useI18n();

const isMatrixPreview = computed(() => {
  const type = String(props.reportType || '').toLowerCase();
  return (type === 'matrix' || type === 'pivot') && Boolean(props.result?.meta?.matrixLayout);
});

const previewModeLabel = computed(() => {
  const type = String(props.reportType || '').toLowerCase();
  const keyMap: Record<string, string> = {
    kpi: 'previewModeKpi',
    summary: 'previewModeGroupedTable',
    matrix: 'previewModeMatrixTable',
    tabular: 'previewModeTable',
    joined: 'previewModeTable',
    exception: 'previewModeException',
  };
  const key = keyMap[type];
  return key ? t(`analytics.${key}`) : '';
});
</script>
