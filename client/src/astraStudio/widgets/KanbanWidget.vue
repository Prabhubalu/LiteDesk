<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import { parseWidgetContentRows } from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();

type Col = { id: string; title: string; cards: Array<{ id: string; title: string }> };

const columns = computed<Col[]>(() => {
  const raw = props.widget.config?.columns;
  if (Array.isArray(raw) && raw.length) {
    return raw as Col[];
  }
  const body = String(props.widget.config?.body || props.widget.ai?.text || '').trim();
  const cards = body
    ? parseWidgetContentRows(props.widget, body)
      .filter((row) => row.kind === 'item')
      .map((row, i) => ({
        id: String(i + 1),
        title: row.secondary ? `${row.primary}: ${row.secondary}` : row.primary,
      }))
    : [];
  return [
    { id: 'todo', title: t('astraStudio.kanbanTodo'), cards },
    { id: 'doing', title: t('astraStudio.kanbanDoing'), cards: [] },
    { id: 'done', title: t('astraStudio.kanbanDone'), cards: [] },
  ];
});
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-1">
    <div
      v-for="col in columns"
      :key="col.id"
      class="min-w-[120px] flex-1 rounded-lg bg-neutral-50 p-2 dark:bg-white/5"
    >
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{{ col.title }}</p>
      <div
        v-for="card in col.cards || []"
        :key="card.id"
        class="mb-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-neutral-900"
      >
        {{ card.title }}
      </div>
    </div>
  </div>
</template>
