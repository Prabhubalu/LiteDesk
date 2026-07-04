<template>
  <aside :class="[rbPanel, 'overflow-hidden', $attrs.class]">
    <div class="border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800">
      <p :class="rbOverline">{{ t('analytics.builderReportSummary') }}</p>
    </div>
    <div class="space-y-4 px-3 py-3">
      <div>
        <p :class="rbOverline">{{ t('analytics.fieldModule') }}</p>
        <p class="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ primaryModuleLabel }}</p>
      </div>

      <div>
        <p :class="rbOverline" class="mb-2">{{ t('analytics.fieldType') }}</p>
        <ReportBuilderTypeSelector
          variant="segment"
          :model-value="reportType"
          @update:model-value="$emit('update:reportType', $event)"
        />
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <p :class="rbOverline">
            {{ t('analytics.builderSelectedFieldsCount', { count: selectedFields.length }) }}
          </p>
          <button v-if="showEditLinks" type="button" :class="rbLink" class="text-xs" @click="$emit('edit-step', 1)">
            {{ t('analytics.builderEditFields') }}
          </button>
        </div>
        <ul class="mt-2 space-y-1">
          <li
            v-for="(field, index) in selectedFields"
            :key="field.key"
            class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
          >
            <span class="w-4 shrink-0 text-[10px] tabular-nums text-zinc-400">{{ index + 1 }}</span>
            <span class="min-w-0 truncate">{{ field.label }}</span>
          </li>
        </ul>
      </div>

      <div v-if="filterSummaries.length || filterCount > 0">
        <div class="flex items-center justify-between gap-2">
          <p :class="rbOverline">
            {{ t('analytics.builderFiltersCount', { count: filterSummaries.length || filterCount }) }}
          </p>
          <button v-if="showEditLinks" type="button" :class="rbLink" class="text-xs" @click="$emit('edit-step', 2)">
            {{ t('analytics.builderEditFilters') }}
          </button>
        </div>
        <ul v-if="filterSummaries.length" class="mt-2 space-y-1">
          <li
            v-for="(line, index) in filterSummaries"
            :key="index"
            class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {{ line }}
          </li>
        </ul>
      </div>

      <div v-if="rowGroups.length || columnGroups.length">
        <div class="flex items-center justify-between gap-2">
          <p :class="rbOverline">{{ t('analytics.builderGrouping') }}</p>
          <button v-if="showEditLinks" type="button" :class="rbLink" class="text-xs" @click="$emit('edit-step', 3)">
            {{ t('analytics.builderEditGrouping') }}
          </button>
        </div>
        <p v-if="rowGroups.length" class="mt-1 text-xs text-zinc-500">
          {{ t('analytics.builderRowGroups') }}: {{ rowGroupLabels.join(', ') }}
        </p>
        <p v-if="columnGroups.length" class="mt-1 text-xs text-zinc-500">
          {{ t('analytics.builderColumnGroups') }}: {{ columnGroupLabels.join(', ') }}
        </p>
      </div>

      <div v-if="sortSummaries.length">
        <div class="flex items-center justify-between gap-2">
          <p :class="rbOverline">{{ t('analytics.builderSorting') }}</p>
          <button v-if="showEditLinks" type="button" :class="rbLink" class="text-xs" @click="$emit('edit-step', 3)">
            {{ t('analytics.builderEditSorting') }}
          </button>
        </div>
        <ul class="mt-2 space-y-1">
          <li
            v-for="(line, index) in sortSummaries"
            :key="index"
            class="text-xs text-zinc-500 dark:text-zinc-400"
          >
            {{ line }}
          </li>
        </ul>
      </div>

      <div v-if="expanded && previewSnippetRows.length">
        <p :class="[rbOverline, 'mb-2']">{{ t('analytics.builderDataPreview') }}</p>
        <div class="overflow-x-auto rounded-lg border border-zinc-200/80 dark:border-zinc-800">
          <table class="min-w-full text-left text-xs">
            <thead class="bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th
                  v-for="column in previewSnippetColumns"
                  :key="column.key"
                  class="whitespace-nowrap px-2 py-1.5 font-medium text-zinc-500"
                >
                  {{ column.label || column.key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rowIndex) in previewSnippetRows"
                :key="rowIndex"
                class="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td
                  v-for="column in previewSnippetColumns"
                  :key="column.key"
                  class="whitespace-nowrap px-2 py-1.5 text-zinc-700 dark:text-zinc-300"
                >
                  {{ formatCell(row[column.key], column) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          v-if="showRunPreview"
          type="button"
          :class="[rbBtnSecondary, 'mt-2 w-full !py-1.5 !text-xs']"
          :disabled="executing"
          @click="$emit('run-preview')"
        >
          {{ executing ? t('analytics.previewUpdating') : t('analytics.builderRunFullReport') }}
        </button>
      </div>

      <div
        v-if="expanded && showWhatsNext"
        class="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
      >
        <p>{{ t('analytics.builderWhatsNextPublish') }}</p>
        <div v-if="reportId && reportStatus === 'published'" class="mt-2 flex flex-col items-start gap-1.5">
          <RouterLink
            :to="{ name: 'analytics-widget-create', query: { reportId } }"
            :class="rbLink"
          >
            {{ t('analytics.createWidgetFromReport') }}
          </RouterLink>
          <RouterLink
            :to="{ name: 'analytics-schedules', query: { reportId } }"
            :class="rbLink"
          >
            {{ t('analytics.schedulesTitle') }}
          </RouterLink>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ReportBuilderTypeSelector from '@/components/analytics/report-builder/ReportBuilderTypeSelector.vue';
import {
  rbBtnSecondary,
  rbLink,
  rbOverline,
  rbPanel,
} from '@/components/analytics/report-builder/reportBuilderUi';
import type { ReportBuilderFieldOption, ReportBuilderSortEntry } from '@/composables/useReportBuilder';
import { formatAnalyticsCellValue } from '@/utils/analyticsCellFormat';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    primaryModuleLabel: string;
    reportType: string;
    selectedFields: Array<{ key: string; label: string }>;
    rowGroups: string[];
    columnGroups: string[];
    sorting: ReportBuilderSortEntry[];
    fieldOptions: ReportBuilderFieldOption[];
    filterCount?: number;
    filterSummaries?: string[];
    sortSummaries?: string[];
    previewResult?: AnalyticsExecuteResult | null;
    expanded?: boolean;
    showEditLinks?: boolean;
    showRunPreview?: boolean;
    showWhatsNext?: boolean;
    executing?: boolean;
    reportId?: string | null;
    reportStatus?: string | null;
  }>(),
  {
    filterCount: 0,
    filterSummaries: () => [],
    sortSummaries: () => [],
    previewResult: null,
    expanded: false,
    showEditLinks: true,
    showRunPreview: false,
    showWhatsNext: false,
    executing: false,
  },
);

defineEmits<{
  (e: 'edit-step', step: number): void;
  (e: 'update:reportType', value: string): void;
  (e: 'run-preview'): void;
}>();

const { t } = useI18n();

const rowGroupLabels = computed(() =>
  props.rowGroups.map((key) => props.fieldOptions.find((f) => f.key === key)?.label || key),
);

const columnGroupLabels = computed(() =>
  props.columnGroups.map((key) => props.fieldOptions.find((f) => f.key === key)?.label || key),
);

const previewSnippetColumns = computed(() => {
  const columns = props.previewResult?.columns;
  if (Array.isArray(columns) && columns.length) {
    return columns.slice(0, 4).map((column) => ({
      key: String(column.key || ''),
      label: column.label || column.key,
      type: column.type,
    }));
  }
  return [];
});

const previewSnippetRows = computed(() => {
  const rows = props.previewResult?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 3);
});

function formatCell(value: unknown, column: { key: string; label?: string; type?: string }) {
  return formatAnalyticsCellValue(value, column);
}
</script>
