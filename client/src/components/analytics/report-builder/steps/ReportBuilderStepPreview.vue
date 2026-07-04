<template>
  <div :class="rbPanel">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
      <div>
        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ reportTypeLabel }}</p>
        <p v-if="previewResult?.meta" class="text-xs text-zinc-400">
          {{ t('analytics.previewRows', { count: previewResult.meta.totalRows, ms: previewResult.meta.executionMs }) }}
        </p>
      </div>
      <button
        type="button"
        :class="rbBtnSecondary"
        class="!py-1.5"
        :disabled="executing"
        @click="$emit('run-preview')"
      >
        {{ executing ? t('analytics.previewUpdating') : t('analytics.preview') }}
      </button>
    </div>
    <div class="min-h-[360px] p-4">
      <ReportTypePreviewPanel
        :result="previewResult"
        :report-type="effectiveReportType"
        :metric-field="previewMetricField"
        :dimension-field="previewDimensionField"
        :label="formName"
        :loading="executing"
        :theme-mode="themeMode"
        :empty-message="t('analytics.previewEmpty')"
        :expanded-rows="expandedMatrixRows"
        @toggle-row="$emit('toggle-row', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import ReportTypePreviewPanel from '@/components/analytics/ReportTypePreviewPanel.vue';
import { rbBtnSecondary, rbPanel } from '@/components/analytics/report-builder/reportBuilderUi';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import type { AnalyticsChartThemeMode } from '@/platform/analytics/echarts/analyticsChartTheme';

defineProps<{
  previewResult: AnalyticsExecuteResult | null;
  expandedMatrixRows: Record<
    string,
    {
      loading: boolean;
      result: AnalyticsExecuteResult | null;
      label: string;
    }
  >;
  effectiveReportType: string;
  reportTypeLabel: string;
  formName: string;
  executing: boolean;
  themeMode: AnalyticsChartThemeMode;
  previewMetricField: string;
  previewDimensionField: string;
}>();

defineEmits<{
  (e: 'run-preview'): void;
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
</script>
