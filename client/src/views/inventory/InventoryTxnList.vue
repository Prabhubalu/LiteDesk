<template>
  <div class="p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="headerActions" />
        <button
          v-if="secondaryLabel"
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="$emit('secondary')"
        >
          {{ secondaryLabel }}
        </button>
        <button
          v-if="createLabel"
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="$emit('create')"
        >
          {{ createLabel }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
    >
      {{ error }}
    </div>
    <div
      v-else-if="!rows.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ emptyLabel }}
    </div>
    <div
      v-else
      class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <table class="min-w-full text-sm">
        <thead
          class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400"
        >
          <tr>
            <th v-for="col in columns" :key="col.key" class="px-3 py-2.5">{{ col.label }}</th>
            <th v-if="$slots.actions" class="px-3 py-2.5 text-right">{{ actionsLabel }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
            :class="rowClickable ? 'cursor-pointer' : ''"
            @click="onRowClick(row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-3 py-2.5 text-gray-800 dark:text-gray-200"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row?.[col.key]">
                <span
                  v-if="col.format === 'badge'"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="badgeClass(row, col)"
                >
                  {{ formatCell(row, col) }}
                </span>
                <template v-else>{{ formatCell(row, col) }}</template>
              </slot>
            </td>
            <td
              v-if="$slots.actions"
              class="px-3 py-2.5 text-right"
              @click.stop
            >
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  emptyLabel: { type: String, default: 'No records yet.' },
  createLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  actionsLabel: { type: String, default: 'Actions' },
  rowClickable: { type: Boolean, default: false }
});

const emit = defineEmits(['create', 'secondary', 'row-click']);

function rowKey(row) {
  return row?.inventoryLocationId || row?._id || row?.id || row?.inventoryAdjustmentId || row?.inventoryTransferId;
}

function onRowClick(row) {
  if (!props.rowClickable) return;
  emit('row-click', row);
}

function formatCell(row, col) {
  const v = row?.[col.key];
  if (col.format === 'date' && v) return formatUserDate(v);
  if (col.format === 'boolean') {
    if (v === true) return col.trueLabel || 'Yes';
    if (v === false) return col.falseLabel || 'No';
    return '—';
  }
  if (typeof col.formatter === 'function') return col.formatter(v, row) || '—';
  if (v == null || v === '') return '—';
  return String(v);
}

function badgeClass(row, col) {
  const v = String(row?.[col.key] ?? '').toLowerCase();
  if (typeof col.badgeClass === 'function') return col.badgeClass(v, row);
  if (v === 'active' || v === 'posted' || v === 'true') {
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (v === 'inactive' || v === 'cancelled' || v === 'false') {
    return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/15 dark:bg-gray-700 dark:text-gray-300';
  }
  if (v === 'draft') {
    return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-200';
  }
  return 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-600/15 dark:bg-indigo-950/40 dark:text-indigo-200';
}
</script>
