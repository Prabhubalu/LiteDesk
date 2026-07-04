<template>
  <div v-if="result?.columns?.length" class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-900">
        <tr>
          <th
            v-for="col in result.columns"
            :key="col.key"
            class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {{ col.label || col.key }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
        <tr
          v-for="(row, idx) in result.rows"
          :key="idx"
          class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
        >
          <td
            v-for="col in result.columns"
            :key="col.key"
            class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100"
          >
            {{ formatCell(row[col.key], col) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
    {{ emptyMessage }}
  </p>
</template>

<script setup lang="ts">
import { formatAnalyticsCellValue } from '@/utils/analyticsCellFormat';
import type { AnalyticsExecuteResult } from '@/types/analytics.types';

defineProps<{
  result: AnalyticsExecuteResult | null;
  emptyMessage: string;
}>();

function formatCell(
  value: unknown,
  col: AnalyticsExecuteResult['columns'][number],
): string {
  return formatAnalyticsCellValue(value, col);
}
</script>
