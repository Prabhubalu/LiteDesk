<template>
  <div class="mt-3">
    <!-- KPI strip -->
    <div
      v-if="visual.component === 'kpi_strip'"
      class="overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-slate-50 p-3 dark:border-gray-700 dark:from-gray-900 dark:to-gray-950"
    >
      <p
        v-if="visual.title"
        class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        {{ visual.title }}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="(item, idx) in visual.items || []"
          :key="`${visual.id}-kpi-${idx}`"
          class="rounded-lg border border-gray-100 bg-white/80 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/80"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ item.label }}
          </p>
          <p class="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
            {{ item.value }}
          </p>
          <p
            v-if="item.hint"
            class="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500"
          >
            {{ item.hint }}
          </p>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <AstraVisualChart
      v-else-if="visual.component === 'chart'"
      :visual="visual"
    />

    <!-- Progress list -->
    <div
      v-else-if="visual.component === 'progress_list'"
      class="overflow-hidden rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60"
    >
      <p
        v-if="visual.title"
        class="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        {{ visual.title }}
      </p>
      <ul class="space-y-2.5">
        <li
          v-for="(item, idx) in visual.items || []"
          :key="`${visual.id}-p-${idx}`"
        >
          <div class="mb-1 flex items-center justify-between gap-2 text-[12px]">
            <span class="truncate font-medium text-gray-800 dark:text-gray-100">{{ item.label }}</span>
            <span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
              {{ item.value }} · {{ progressPct(item) }}%
            </span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              class="h-full rounded-full bg-primary-600 transition-all dark:bg-primary-400"
              :style="{ width: `${progressPct(item)}%` }"
            />
          </div>
        </li>
      </ul>
    </div>

    <!-- Data table -->
    <div
      v-else-if="visual.component === 'data_table'"
      class="overflow-hidden rounded-xl border border-gray-200/80 bg-white dark:border-gray-700 dark:bg-gray-900/60"
    >
      <p
        v-if="visual.title"
        class="border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
      >
        {{ visual.title }}
      </p>
      <div class="max-h-64 overflow-auto">
        <table class="w-full min-w-full text-left text-[12px]">
          <thead class="sticky top-0 bg-slate-50 dark:bg-gray-900">
            <tr>
              <th
                v-for="(col, cIdx) in visual.columns || []"
                :key="`${visual.id}-c-${cIdx}`"
                class="px-3 py-2 font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in visual.rows || []"
              :key="`${visual.id}-r-${rIdx}`"
              class="border-t border-gray-100 dark:border-gray-800"
            >
              <td
                v-for="(cell, cellIdx) in row"
                :key="`${visual.id}-r-${rIdx}-${cellIdx}`"
                class="px-3 py-1.5 tabular-nums text-gray-800 dark:text-gray-100"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Callout -->
    <div
      v-else-if="visual.component === 'callout'"
      class="rounded-xl border px-3 py-2.5"
      :class="calloutClass"
    >
      <p
        v-if="visual.title"
        class="text-[11px] font-semibold uppercase tracking-wide opacity-80"
      >
        {{ visual.title }}
      </p>
      <p class="mt-1 text-[13px] leading-snug">
        {{ visual.body }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AstraVisualChart from '@/components/support/AstraVisualChart.vue';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';

const props = defineProps<{
  visual: InAppAiVisual;
}>();

function progressPct(item: { value?: string | number; max?: number }) {
  const max = Number(item.max) > 0
    ? Number(item.max)
    : (props.visual.items || []).reduce((s, it) => s + (Number(it.value) || 0), 0) || 1;
  return Math.min(100, Math.round(((Number(item.value) || 0) / max) * 100));
}

const calloutClass = computed(() => {
  const tone = props.visual.tone || 'insight';
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50';
  }
  if (tone === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50';
  }
  return 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-50';
});
</script>
