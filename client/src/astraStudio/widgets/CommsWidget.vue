<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import {
  parseWidgetContentRows,
  type ParsedContentRow,
} from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();

type Msg = { kind: 'heading' | 'paragraph' | 'item'; label: string; detail?: string; channel?: string };

function inferChannel(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\bemail\b|@/.test(lower)) return 'email';
  if (/\b(call|phone|dial)\b/.test(lower)) return 'call';
  if (/\b(meet|meeting|zoom|teams)\b/.test(lower)) return 'meeting';
  return undefined;
}

function rowToMsg(row: ParsedContentRow): Msg {
  if (row.kind === 'heading') {
    return { kind: 'heading', label: row.primary };
  }
  if (row.kind === 'paragraph') {
    return { kind: 'paragraph', label: row.primary };
  }
  const label = row.secondary ? row.primary : row.primary;
  const detail = row.secondary;
  const channel = inferChannel(`${row.primary} ${row.secondary || ''}`);
  return {
    kind: 'item',
    label,
    detail,
    channel,
  };
}

const messages = computed<Msg[]>(() => {
  const cfg = props.widget.config || {};
  const raw = cfg.messages ?? cfg.items;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row) => {
        if (typeof row === 'string') {
          return rowToMsg({ kind: 'item', primary: row, tone: 'neutral' });
        }
        const r = row as { label?: unknown; body?: unknown; channel?: unknown; title?: unknown };
        const label = String(r.label || r.body || r.title || '').trim();
        if (!label) return null;
        return {
          kind: 'item' as const,
          label,
          channel: r.channel != null ? String(r.channel) : inferChannel(label),
        };
      })
      .filter((m): m is Msg => Boolean(m));
  }
  const body = String(cfg.body || props.widget.ai?.text || '').trim();
  if (!body) return [];
  return parseWidgetContentRows(props.widget, body).map(rowToMsg);
});

function channelTone(channel?: string): string {
  const c = String(channel || '').toLowerCase();
  if (c.includes('email')) return 'bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300';
  if (c.includes('call') || c.includes('phone')) return 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300';
  if (c.includes('meet')) return 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300';
  return 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300';
}
</script>

<template>
  <div v-if="!messages.length" class="text-[13.5px] text-neutral-500">
    {{ t('astraStudio.commsEmpty') }}
  </div>
  <div v-else class="space-y-1">
    <template v-for="(msg, idx) in messages" :key="idx">
      <h4
        v-if="msg.kind === 'heading'"
        class="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 first:pt-0 dark:text-neutral-400"
      >
        {{ msg.label }}
      </h4>
      <p
        v-else-if="msg.kind === 'paragraph'"
        class="py-1.5 text-[13.5px] font-normal leading-relaxed text-neutral-700 dark:text-neutral-200"
      >
        {{ msg.label }}
      </p>
      <div
        v-else
        class="flex gap-3 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
      >
        <span
          class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300"
          aria-hidden="true"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 4.5h11v7h-11v-7z" stroke="currentColor" stroke-width="1.2" />
            <path d="M2.5 4.5L8 8.5l5.5-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p
              v-if="msg.detail"
              class="text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-500"
            >
              {{ msg.label }}
            </p>
            <p
              v-else
              class="text-[13.5px] font-medium leading-snug text-neutral-900 dark:text-neutral-50"
            >
              {{ msg.label }}
            </p>
            <span
              v-if="msg.channel"
              class="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              :class="channelTone(msg.channel)"
            >
              {{ msg.channel }}
            </span>
          </div>
          <p v-if="msg.detail" class="mt-0.5 text-[13.5px] font-medium leading-snug text-neutral-800 dark:text-neutral-100">
            {{ msg.detail }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
