<template>
  <div class="px-1 py-2">
    <div
      v-if="!lines.length"
      class="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ t('records.adjLinesEmpty') }}
    </div>
    <div
      v-else
      class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <table class="min-w-full text-sm">
        <thead
          class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80"
        >
          <tr>
            <th class="px-3 py-2.5">{{ t('records.adjItem') }}</th>
            <th class="px-3 py-2.5 text-right">{{ t('records.adjQtyChange') }}</th>
            <th class="px-3 py-2.5 text-right">{{ t('records.adjUnitCost') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="(line, idx) in lines" :key="idx" class="bg-white dark:bg-gray-900/20">
            <td class="px-3 py-2.5 text-gray-800 dark:text-gray-200">
              <span class="font-mono text-xs text-gray-500">{{ shortId(line.variantId) }}</span>
            </td>
            <td
              class="px-3 py-2.5 text-right tabular-nums font-medium"
              :class="deltaClass(line.quantityDelta)"
            >
              {{ formatDelta(line.quantityDelta) }}
            </td>
            <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
              {{ formatCost(line.unitCostSnapshot) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  record: { type: Object, default: null },
  section: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const lines = computed(() =>
  Array.isArray(props.record?.lines) ? props.record.lines : []
);

function shortId(v) {
  if (v == null || v === '') return '—';
  const s = String(v);
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function formatDelta(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n > 0) return `+${n}`;
  return String(n);
}

function deltaClass(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'text-gray-800 dark:text-gray-200';
  if (n > 0) return 'text-emerald-700 dark:text-emerald-400';
  return 'text-red-700 dark:text-red-400';
}

function formatCost(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}
</script>
