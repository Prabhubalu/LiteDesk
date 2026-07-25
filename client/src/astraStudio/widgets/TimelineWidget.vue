<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import { parseWidgetContentRows } from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();

type EventRow = {
  kind: 'heading' | 'paragraph' | 'item';
  label: string;
  at?: string;
  meta?: string;
};

function formatWhen(at?: string): string {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function looksLikeDate(text: string): boolean {
  if (!text || text.length > 42) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return true;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(text)) return true;
  const t = Date.parse(text);
  return !Number.isNaN(t);
}

const events = computed((): EventRow[] => {
  const cfg = props.widget.config || {};
  const raw = cfg.events ?? cfg.items;
  if (Array.isArray(raw) && raw.length) {
    const rows: EventRow[] = [];
    for (const row of raw) {
      if (typeof row === 'string') {
        rows.push({ kind: 'item', label: row });
        continue;
      }
      const r = row as { label?: unknown; at?: unknown; meta?: unknown; title?: unknown };
      const label = String(r.label || r.title || '').trim();
      if (!label) continue;
      rows.push({
        kind: 'item',
        label,
        at: r.at != null ? String(r.at) : undefined,
        meta: r.meta != null ? String(r.meta) : undefined,
      });
    }
    return rows;
  }

  const body = String(cfg.body || props.widget.ai?.text || '').trim();
  if (body) {
    return parseWidgetContentRows(props.widget, body).map((row): EventRow => {
      if (row.kind === 'heading') {
        return { kind: 'heading', label: row.primary };
      }
      if (row.kind === 'paragraph') {
        return { kind: 'paragraph' as const, label: row.primary };
      }
      if (row.secondary && looksLikeDate(row.primary)) {
        return { kind: 'item' as const, label: row.secondary, at: row.primary };
      }
      if (row.secondary && looksLikeDate(row.secondary)) {
        return { kind: 'item' as const, label: row.primary, at: row.secondary };
      }
      return {
        kind: 'item' as const,
        label: row.primary,
        meta: row.secondary,
      };
    });
  }

  return [];
});
</script>

<template>
  <div v-if="!events.length" class="text-[13.5px] text-neutral-500">
    {{ t('astraStudio.timelineEmpty') }}
  </div>
  <div v-else class="space-y-1">
    <template v-for="(ev, idx) in events" :key="idx">
      <h4
        v-if="ev.kind === 'heading'"
        class="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 first:pt-0 dark:text-neutral-400"
      >
        {{ ev.label }}
      </h4>
      <p
        v-else-if="ev.kind === 'paragraph'"
        class="py-1.5 text-[13.5px] font-normal leading-relaxed text-neutral-700 dark:text-neutral-200"
      >
        {{ ev.label }}
      </p>
      <div
        v-else
        class="relative ps-5 pb-4 last:pb-0"
      >
        <span
          class="absolute bottom-1 left-[7px] top-1 w-px bg-neutral-200 dark:bg-white/10"
          aria-hidden="true"
        />
        <span
          class="absolute left-0 top-1.5 z-[1] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-2 ring-primary-500 dark:bg-neutral-900"
          aria-hidden="true"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p class="text-[13.5px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
              {{ ev.label }}
            </p>
            <span
              v-if="ev.at"
              class="rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
            >
              {{ formatWhen(ev.at) }}
            </span>
          </div>
          <p v-if="ev.meta" class="mt-0.5 text-[12.5px] text-neutral-500">{{ ev.meta }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
