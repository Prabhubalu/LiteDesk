<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();

type MetricRow = { label: string; value: string | number };

const metrics = computed((): MetricRow[] => {
  const m = props.widget.config?.metrics;
  if (Array.isArray(m) && m.length) {
    return m
      .filter((row) => row && (row as { value?: unknown }).value != null && String((row as { value?: unknown }).value) !== '—')
      .map((row) => ({
        label: String((row as { label?: unknown }).label || ''),
        value: (row as { value: string | number }).value,
      }));
  }
  return [];
});

function metricTone(label: string, value: string | number): string {
  const l = label.toLowerCase();
  const v = String(value).toLowerCase();
  if (l.includes('health') || l.includes('stage')) {
    if (/\b(active|won|healthy|strong|negotiation|proposal)\b/.test(v)) {
      return 'from-emerald-50 to-teal-50/60 ring-emerald-100/80 dark:from-emerald-950/35 dark:to-teal-950/20 dark:ring-emerald-900/40';
    }
    if (/\b(risk|lost|weak|critical)\b/.test(v)) {
      return 'from-rose-50 to-orange-50/50 ring-rose-100/80 dark:from-rose-950/35 dark:to-orange-950/20 dark:ring-rose-900/40';
    }
    return 'from-amber-50 to-orange-50/40 ring-amber-100/80 dark:from-amber-950/30 dark:to-orange-950/20 dark:ring-amber-900/40';
  }
  if (l.includes('quote') || l.includes('amount') || l.includes('focus')) {
    return 'from-primary-50/90 to-violet-50/50 ring-primary-100/70 dark:from-primary-950/30 dark:to-violet-950/20 dark:ring-primary-900/40';
  }
  return 'from-neutral-50 to-neutral-50/80 ring-black/[0.04] dark:from-white/[0.06] dark:to-white/[0.03] dark:ring-white/[0.08]';
}
</script>

<template>
  <div v-if="metrics.length" class="grid grid-cols-1 gap-2">
    <div
      v-for="(row, idx) in metrics"
      :key="idx"
      class="rounded-2xl bg-gradient-to-br px-3 py-2.5 ring-1"
      :class="metricTone(row.label, row.value)"
    >
      <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">
        {{ row.label }}
      </p>
      <p class="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-50">
        {{ row.value }}
      </p>
    </div>
  </div>
  <p v-else class="text-sm text-neutral-500">
    {{
      String(widget.type || '').includes('kpi') || /score|health|relationship/i.test(String(widget.config?.title || ''))
        ? t('astraStudio.kpiEmpty')
        : t('astraStudio.chartPlaceholder')
    }}
  </p>
</template>
