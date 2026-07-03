<template>
  <div v-if="result?.columns?.length" class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
    <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
      <thead class="bg-neutral-50 dark:bg-neutral-800">
        <tr>
          <th
            v-for="col in result.columns"
            :key="col.key"
            class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            {{ col.label || col.key }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900">
        <tr v-for="(row, idx) in result.rows" :key="idx">
          <td
            v-for="col in result.columns"
            :key="col.key"
            class="px-4 py-2 text-sm text-neutral-800 dark:text-neutral-200"
          >
            {{ formatCell(row[col.key]) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="py-8 text-center text-sm text-neutral-500">
    {{ emptyMessage }}
  </p>
</template>

<script setup lang="ts">
import type { AnalyticsExecuteResult } from '@/types/analytics.types';

defineProps<{
  result: AnalyticsExecuteResult | null;
  emptyMessage: string;
}>();

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
</script>
