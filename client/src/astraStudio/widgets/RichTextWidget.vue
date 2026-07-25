<script setup lang="ts">
import { computed } from 'vue';
import type { CanvasWidget } from '@/astraStudio/types';
import { parseWidgetContentRows } from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>];
}>();

const body = computed({
  get: () => String(props.widget.config?.body || ''),
  set: (value: string) => {
    emit('update:config', { ...props.widget.config, body: value });
  },
});

const structured = computed(() => {
  const raw = body.value.trim();
  if (!raw || props.canEdit) return [];
  // Only structure when content looks multi-line / listed
  if (!/\n/.test(raw) && !/^[\s•\-#]/.test(raw)) return [];
  return parseWidgetContentRows(props.widget, raw);
});

const showStructured = computed(() => structured.value.length > 0 && !props.canEdit);
</script>

<template>
  <div v-if="showStructured" class="space-y-1">
    <template v-for="(row, idx) in structured" :key="idx">
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
        v-else
        class="flex gap-2.5 border-b border-black/[0.04] py-2 last:border-0 dark:border-white/[0.06]"
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
            class="text-[13.5px] leading-snug text-neutral-800 dark:text-neutral-100"
            :class="row.secondary ? 'mt-0.5 font-normal' : 'font-medium'"
          >
            {{ row.secondary || row.primary }}
          </p>
        </div>
      </div>
    </template>
  </div>
  <textarea
    v-else
    v-model="body"
    class="h-full min-h-[120px] w-full resize-none rounded-lg border border-neutral-200 bg-transparent p-2 text-sm dark:border-white/10"
    :readonly="!canEdit"
  />
</template>
