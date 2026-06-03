<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <h2 class="text-base font-semibold text-gray-900 dark:text-white">Approval history</h2>
    <div v-if="!rows.length" class="mt-3 text-sm text-gray-500 dark:text-gray-400">No approval history for this revision yet.</div>
    <ol v-else class="mt-4 space-y-3">
      <li v-for="(row, idx) in rows" :key="`${row.type}-${idx}`" class="flex gap-3 text-sm">
        <span class="mt-1.5 h-2 w-2 rounded-full bg-indigo-500"></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white">{{ label(row) }}</span>
            <span v-if="row.revisionNumber" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">Rev {{ row.revisionNumber }}</span>
          </div>
          <p v-if="row.comment" class="mt-1 text-gray-600 dark:text-gray-300">{{ row.comment }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ row.actor?.name || 'User' }} · {{ formatDate(row.createdAt) }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
defineProps({
  rows: { type: Array, default: () => [] }
});

function label(row) {
  const action = String(row?.action || '').replace(/_/g, ' ');
  if (!action) return row?.type === 'quote_activity' ? 'Activity' : 'Approval event';
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}
</script>
