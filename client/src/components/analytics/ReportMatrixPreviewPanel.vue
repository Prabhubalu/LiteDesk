<template>
  <div v-if="result?.columns?.length" class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
    <table class="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
      <thead class="bg-zinc-50 dark:bg-zinc-900">
        <tr>
          <th
            v-for="col in result.columns"
            :key="col.key"
            class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
            :class="headerClass(col)"
          >
            {{ col.label || col.key }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
        <template v-for="(row, idx) in result.rows" :key="rowExpandKey(row, idx)">
          <tr class="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
            <td
              v-for="(col, colIdx) in result.columns"
              :key="col.key"
              class="px-4 py-2.5 text-sm"
              :class="cellClass(col)"
            >
              <div v-if="col.role === 'row' && colIdx === firstRowColumnIndex" class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  :aria-expanded="isRowExpanded(row)"
                  :aria-label="isRowExpanded(row) ? t('analytics.matrixRowCollapse') : t('analytics.matrixRowExpand')"
                  @click="onToggleRow(row)"
                >
                  <ChevronRightIcon
                    class="h-4 w-4 transition-transform"
                    :class="{ 'rotate-90': isRowExpanded(row) }"
                  />
                </button>
                <span>{{ formatMatrixCell(row[col.key], col) }}</span>
              </div>
              <span v-else>{{ formatMatrixCell(row[col.key], col) }}</span>
            </td>
          </tr>
          <tr v-if="isRowExpanded(row)">
            <td :colspan="result.columns.length" class="p-0">
              <div class="border-l-2 border-indigo-400 bg-zinc-50/80 dark:border-indigo-500/60 dark:bg-zinc-900/50">
                <div
                  v-if="expandedEntry(row)?.loading"
                  class="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {{ t('analytics.matrixDrillDownLoading') }}
                </div>
                <div v-else-if="expandedEntry(row)?.result?.columns?.length" class="overflow-x-auto p-3">
                  <p class="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {{ t('analytics.matrixRowRecords', { count: expandedEntry(row)?.result?.meta.totalRows ?? 0 }) }}
                  </p>
                  <table class="min-w-full divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
                    <thead class="bg-zinc-100 dark:bg-zinc-900/80">
                      <tr>
                        <th
                          v-for="detailCol in expandedEntry(row)!.result!.columns"
                          :key="detailCol.key"
                          class="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                        >
                          {{ detailCol.label || detailCol.key }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-700">
                      <tr
                        v-for="(detailRow, detailIdx) in expandedEntry(row)!.result!.rows"
                        :key="detailIdx"
                      >
                        <td
                          v-for="detailCol in expandedEntry(row)!.result!.columns"
                          :key="detailCol.key"
                          class="whitespace-nowrap px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200"
                        >
                          {{ formatAnalyticsCellValue(detailRow[detailCol.key], detailCol) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {{ t('analytics.matrixDrillDownEmpty') }}
                </p>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
      <tfoot v-if="grandTotalRow">
        <tr class="border-t-2 border-zinc-300 bg-zinc-50 font-medium dark:border-zinc-600 dark:bg-zinc-900/80">
          <td
            v-for="col in result.columns"
            :key="`total-${col.key}`"
            class="px-4 py-2.5 text-sm"
            :class="cellClass(col, true)"
          >
            {{ formatMatrixCell(grandTotalRow[col.key], col) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p v-else class="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
    {{ emptyMessage }}
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import { formatAnalyticsCellValue } from '@/utils/analyticsCellFormat';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';

export type MatrixExpandedRowState = {
  loading: boolean;
  result: AnalyticsExecuteResult | null;
  label: string;
};

const props = defineProps<{
  result: AnalyticsExecuteResult | null;
  expandedRows: Record<string, MatrixExpandedRowState>;
  emptyMessage: string;
}>();

const emit = defineEmits<{
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

type MatrixColumn = AnalyticsExecuteResult['columns'][number] & {
  role?: 'row' | 'pivot' | 'total';
};

type MatrixLayout = NonNullable<AnalyticsExecuteResult['meta']['matrixLayout']>;

const grandTotalRow = computed(() => props.result?.meta?.grandTotalRow ?? null);
const matrixLayout = computed(() => props.result?.meta?.matrixLayout ?? null);

const firstRowColumnIndex = computed(() =>
  props.result?.columns.findIndex((col) => col.role === 'row') ?? -1,
);

function headerClass(col: MatrixColumn) {
  if (col.role === 'row') return 'text-zinc-600 dark:text-zinc-300';
  if (col.role === 'total') return 'text-indigo-700 dark:text-indigo-300';
  return 'text-zinc-500 dark:text-zinc-400';
}

function cellClass(col: MatrixColumn, isFooter = false) {
  if (col.role === 'row') return 'font-medium text-zinc-900 dark:text-zinc-100';
  if (col.role === 'total' || isFooter) return 'tabular-nums text-indigo-700 dark:text-indigo-300';
  return 'tabular-nums text-zinc-800 dark:text-zinc-200';
}

function formatMatrixCell(value: unknown, col: MatrixColumn): string {
  if (value === null || value === undefined) {
    return col.role === 'pivot' || col.role === 'total' ? '—' : '';
  }
  return formatAnalyticsCellValue(value, col);
}

function buildRowFilters(row: Record<string, unknown>, layout: MatrixLayout) {
  const rowFilters: Record<string, unknown> = {};
  for (const field of layout.rowFields) {
    rowFilters[field] = row[field] ?? null;
  }
  return rowFilters;
}

function rowExpandKey(row: Record<string, unknown>, index: number) {
  const layout = matrixLayout.value;
  if (!layout) return `row-${index}`;
  return JSON.stringify(buildRowFilters(row, layout));
}

function buildRowLabel(row: Record<string, unknown>, layout: MatrixLayout) {
  const rowFilters = buildRowFilters(row, layout);
  return layout.rowFields
    .map((field) => `${field}: ${rowFilters[field] ?? '(blank)'}`)
    .join(' · ');
}

function isRowExpanded(row: Record<string, unknown>) {
  return Boolean(expandedEntry(row));
}

function expandedEntry(row: Record<string, unknown>) {
  const layout = matrixLayout.value;
  if (!layout) return null;
  return props.expandedRows[rowExpandKey(row, 0)] ?? null;
}

function onToggleRow(row: Record<string, unknown>) {
  const layout = matrixLayout.value;
  if (!layout) return;
  const rowFilters = buildRowFilters(row, layout);
  emit('toggle-row', {
    key: rowExpandKey(row, 0),
    rowFilters,
    label: buildRowLabel(row, layout),
  });
}
</script>
