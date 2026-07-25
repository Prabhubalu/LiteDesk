<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
      </div>
      <button
        v-if="createLabel"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('create')"
      >
        {{ createLabel }}
      </button>
    </div>
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-else-if="!rows.length" class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
      {{ emptyLabel }}
    </div>
    <div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/80">
          <tr>
            <th v-for="col in columns" :key="col.key" class="px-3 py-2.5">{{ col.label }}</th>
            <th v-if="$slots.actions" class="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="row in rows" :key="row._id || row.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <td v-for="col in columns" :key="col.key" class="px-3 py-2.5 text-gray-800 dark:text-gray-200">
              {{ formatCell(row, col) }}
            </td>
            <td v-if="$slots.actions" class="px-3 py-2.5 text-right">
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  emptyLabel: { type: String, default: 'No records yet.' },
  createLabel: { type: String, default: '' }
});
defineEmits(['create']);

function formatCell(row, col) {
  const v = row?.[col.key];
  if (col.format === 'date' && v) return new Date(v).toLocaleDateString();
  if (v == null || v === '') return '—';
  return String(v);
}
</script>
