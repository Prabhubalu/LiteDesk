<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import { parseWidgetContentRows } from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>];
}>();

const { t } = useI18n();

type Item = { id?: string; label: string; done?: boolean };

const items = computed<Item[]>(() => {
  const raw = props.widget.config?.items;
  if (Array.isArray(raw) && raw.length) {
    return (raw as Item[]).filter((it) => String(it?.label || '').trim());
  }
  // Body fallback — skip section headings / long prose
  const body = String(props.widget.config?.body || props.widget.ai?.text || '').trim();
  if (!body) return [];
  return parseWidgetContentRows(props.widget, body)
    .filter((row) => row.kind === 'item')
    .map((row, i) => ({
      id: String(i + 1),
      label: row.secondary ? `${row.primary}: ${row.secondary}` : row.primary,
      done: false,
    }));
});

const doneCount = computed(() => items.value.filter((it) => it.done).length);

function toggle(idx: number): void {
  if (!props.canEdit) return;
  const next = items.value.map((it, i) => (i === idx ? { ...it, done: !it.done } : it));
  emit('update:config', { ...props.widget.config, items: next });
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="items.length"
      class="flex items-center justify-between text-[11px] text-neutral-400"
    >
      <span class="font-medium uppercase tracking-[0.1em]">{{ t('astraStudio.checklistProgress') }}</span>
      <span class="tabular-nums text-neutral-500">{{ doneCount }}/{{ items.length }}</span>
    </div>
    <div
      v-if="items.length"
      class="h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10"
    >
      <div
        class="h-full rounded-full bg-primary-500 transition-all duration-300"
        :style="{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }"
      />
    </div>
    <ul v-if="items.length" class="space-y-0">
      <li
        v-for="(item, idx) in items"
        :key="item.id || idx"
        class="flex items-start gap-3 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
      >
        <button
          type="button"
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 transition"
          :class="item.done
            ? 'bg-primary-500 ring-primary-500 text-white'
            : 'bg-white ring-neutral-300 text-transparent hover:ring-primary-400 dark:bg-transparent dark:ring-white/25'"
          :disabled="!canEdit"
          :aria-checked="Boolean(item.done)"
          role="checkbox"
          @click="toggle(idx)"
        >
          <svg v-if="item.done" class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span
          class="min-w-0 flex-1 text-[13.5px] leading-snug"
          :class="item.done
            ? 'text-neutral-400 line-through'
            : 'font-medium text-neutral-800 dark:text-neutral-100'"
        >
          {{ item.label }}
        </span>
      </li>
    </ul>
    <p v-else class="text-[13.5px] text-neutral-500">{{ t('astraStudio.checklistEmpty', 'No checklist items yet') }}</p>
  </div>
</template>
