<script setup lang="ts">
import type { CanvasWidget } from '@/astraStudio/types';

defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>];
}>();
</script>

<template>
  <textarea
    class="h-full min-h-[100px] w-full resize-none rounded-lg bg-amber-100/80 p-3 text-sm text-amber-950 shadow-inner dark:bg-amber-900/40 dark:text-amber-50"
    :value="widget.config?.body || ''"
    :readonly="!canEdit"
    @input="emit('update:config', { ...widget.config, body: ($event.target as HTMLTextAreaElement).value })"
  />
</template>
