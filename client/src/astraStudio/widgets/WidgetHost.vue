<script setup lang="ts">
import { computed } from 'vue';
import { getWidgetComponent } from '@/astraStudio/widgets/registry';
import type { CanvasWidget } from '@/astraStudio/types';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>];
}>();

const inner = computed(() => getWidgetComponent(props.widget.type));

function onConfig(config: Record<string, unknown>): void {
  emit('update:config', config);
}
</script>

<template>
  <component
    :is="inner"
    :widget="widget"
    :can-edit="canEdit"
    @update:config="onConfig"
  />
</template>
