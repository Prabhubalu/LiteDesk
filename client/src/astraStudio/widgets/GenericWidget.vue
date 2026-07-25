<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import {
  contentLayoutForWidget,
  parseWidgetContentRows,
} from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const { t } = useI18n();

const body = computed(() => {
  const cfg = props.widget.config || {};
  return String(cfg.body || props.widget.ai?.text || '').trim();
});

const layout = computed(() => contentLayoutForWidget(props.widget));

const rows = computed(() => {
  if (body.value) return parseWidgetContentRows(props.widget, body.value);
  const raw = props.widget.config?.rows;
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    if (typeof row === 'string') {
      return { kind: 'item' as const, primary: row, tone: 'neutral' as const };
    }
    if (row && typeof row === 'object' && 'label' in row) {
      const r = row as { label?: unknown; detail?: unknown };
      return {
        kind: 'item' as const,
        primary: String(r.label || ''),
        secondary: r.detail != null ? String(r.detail) : undefined,
        tone: 'neutral' as const,
      };
    }
    return { kind: 'item' as const, primary: '', tone: 'neutral' as const };
  }).filter((r) => r.primary);
});
</script>

<template>
  <div v-if="!rows.length" class="text-[13.5px] text-neutral-500">
    {{ t('astraStudio.genericPlaceholder') }}
  </div>
  <div v-else class="space-y-1">
    <template v-for="(row, idx) in rows" :key="idx">
      <h4
        v-if="row.kind === 'heading'"
        class="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 first:pt-0 dark:text-neutral-400"
      >
        {{ row.primary }}
      </h4>
      <p
        v-else-if="row.kind === 'paragraph'"
        class="py-1.5 text-[13.5px] font-normal leading-relaxed text-neutral-700 dark:text-neutral-200"
      >
        {{ row.primary }}
      </p>
      <div
        v-else-if="layout === 'agenda'"
        class="flex gap-3 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
      >
        <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-semibold text-white">
          {{ idx + 1 }}
        </span>
        <div class="min-w-0">
          <p class="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-50">{{ row.primary }}</p>
          <p v-if="row.secondary" class="mt-0.5 text-[12.5px] text-neutral-500">{{ row.secondary }}</p>
        </div>
      </div>
      <div
        v-else
        class="flex gap-2.5 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
      >
        <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400/80" aria-hidden="true" />
        <div class="min-w-0">
          <p
            v-if="row.secondary"
            class="text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-500"
          >
            {{ row.primary }}
          </p>
          <p
            class="text-[13.5px] text-neutral-800 dark:text-neutral-100"
            :class="row.secondary ? 'mt-0.5 font-normal' : 'font-medium'"
          >
            {{ row.secondary || row.primary }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
