<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import { parseWidgetContentRows } from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();

type NodeRow = { id: string; kind: 'heading' | 'item'; label: string };

const nodes = computed<NodeRow[]>(() => {
  const raw = props.widget.config?.nodes;
  if (Array.isArray(raw) && raw.length) {
    return (raw as Array<{ id: string; label: string }>).map((n) => ({
      id: n.id,
      kind: 'item' as const,
      label: n.label,
    }));
  }
  const body = String(props.widget.config?.body || props.widget.ai?.text || '').trim();
  if (body) {
    return parseWidgetContentRows(props.widget, body)
      .filter((row) => row.kind === 'heading' || row.kind === 'item')
      .map((row, i) => ({
        id: String(i + 1),
        kind: row.kind === 'heading' ? ('heading' as const) : ('item' as const),
        label: row.secondary ? `${row.primary}: ${row.secondary}` : row.primary,
      }));
  }
  return [];
});

function stepIndex(idx: number): number {
  let n = 0;
  for (let i = 0; i <= idx; i += 1) {
    if (nodes.value[i]?.kind === 'item') n += 1;
  }
  return Math.max(1, n);
}
</script>

<template>
  <div v-if="!nodes.length" class="text-[13.5px] text-neutral-500">
    {{ t('astraStudio.processEmpty') }}
  </div>
  <div v-else class="space-y-2">
    <template v-for="(node, idx) in nodes" :key="node.id">
      <h4
        v-if="node.kind === 'heading'"
        class="pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 first:pt-0 dark:text-neutral-400"
      >
        {{ node.label }}
      </h4>
      <div
        v-else
        class="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1 text-sm dark:border-white/10"
      >
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
          {{ stepIndex(idx) }}
        </span>
        <span class="min-w-0 text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">{{ node.label }}</span>
      </div>
    </template>
  </div>
</template>
