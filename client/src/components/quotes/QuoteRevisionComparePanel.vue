<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Revision changes</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span v-if="compare?.from">Rev {{ compare.from.revisionNumber }} to Rev {{ compare.to?.revisionNumber }}</span>
          <span v-else>No prior revision to compare</span>
        </p>
      </div>
      <QuoteCommercialRiskBadge :level="compare?.summary?.riskLevel || 'low'" />
    </div>

    <ul class="mt-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
      <li v-for="(item, idx) in executiveSummary" :key="idx" class="flex gap-2">
        <span class="mt-2 h-1 w-1 rounded-full bg-gray-400"></span>
        <span>{{ item }}</span>
      </li>
    </ul>

    <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div v-for="metric in metrics" :key="metric.label" class="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ metric.label }}</div>
        <div class="mt-1 font-semibold text-gray-900 dark:text-white">{{ metric.value }}</div>
      </div>
    </div>

    <div v-if="riskIndicators.length" class="mt-4 space-y-2">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Commercial risk indicators</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="risk in riskIndicators"
          :key="risk.key || risk.label"
          class="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
        >
          {{ risk.label || risk.key }}
        </span>
      </div>
    </div>

    <div v-if="showDiffs" class="mt-5 space-y-4">
      <DiffGroup title="Header changes" :rows="headerRows" />
      <DiffGroup title="Section changes" :rows="sectionRows" />
      <DiffGroup title="Line changes" :rows="lineRows" />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import QuoteCommercialRiskBadge from './QuoteCommercialRiskBadge.vue';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  compare: { type: Object, default: null },
  showDiffs: { type: Boolean, default: false }
});

const executiveSummary = computed(() => props.compare?.summary?.executiveSummary || ['No compare summary available.']);
const riskIndicators = computed(() => props.compare?.summary?.riskIndicators || []);
const counts = computed(() => props.compare?.summary?.changeCounts || {});

const metrics = computed(() => [
  { label: 'Header', value: counts.value.header || 0 },
  { label: 'Sections', value: (counts.value.sectionsAdded || 0) + (counts.value.sectionsRemoved || 0) + (counts.value.sectionsChanged || 0) },
  { label: 'Lines', value: (counts.value.linesAdded || 0) + (counts.value.linesRemoved || 0) + (counts.value.linesChanged || 0) },
  { label: 'Impact', value: (props.compare?.summary?.impactAreas || []).join(', ') || 'None' }
]);

function flattenRows(rows) {
  return (rows || []).map((row) => ({
    label: row.label || row.field || row.changeType,
    changeType: row.changeType,
    impactArea: row.impactArea,
    customerVisible: row.customerVisible,
    severity: row.severity,
    details: row.fieldDiffs?.length
      ? row.fieldDiffs.map((d) => `${d.label}: ${displayValue(d.fromValue, d.label)} -> ${displayValue(d.toValue, d.label)}`).join('; ')
      : `${displayValue(row.fromValue, row.label)} -> ${displayValue(row.toValue, row.label)}`
  }));
}

function isMoneyLabel(label) {
  const s = String(label || '').toLowerCase();
  return /amount|price|total|subtotal|tax|charge|discount|currency|value|cost/.test(s);
}

function displayValue(value, label = '') {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  if (isMoneyLabel(label)) {
    const n = Number(value);
    if (Number.isFinite(n)) return formatCurrencyValue(n) || String(value);
  }
  return String(value);
}

const headerRows = computed(() => flattenRows(props.compare?.headerDiffs));
const sectionRows = computed(() => flattenRows(props.compare?.sectionDiffs));
const lineRows = computed(() => flattenRows(props.compare?.lineDiffs));

const DiffGroup = {
  props: {
    title: { type: String, required: true },
    rows: { type: Array, default: () => [] }
  },
  template: `
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
      <div v-if="!rows.length" class="mt-2 rounded-md border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">No changes</div>
      <div v-else class="mt-2 overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th class="px-3 py-2 text-left">Change</th>
              <th class="px-3 py-2 text-left">Impact</th>
              <th class="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="idx" class="border-t border-gray-100 dark:border-gray-800">
              <td class="px-3 py-2">
                <div class="font-medium text-gray-900 dark:text-white">{{ row.label }}</div>
                <div class="text-xs text-gray-500">{{ row.changeType }} · {{ row.severity }}</div>
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">
                {{ row.impactArea || '-' }}
                <span v-if="row.customerVisible" class="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">customer</span>
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{{ row.details }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};
</script>
