<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Konva from 'konva';
import type { CanvasWidget } from '@/astraStudio/types';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const container = ref<HTMLDivElement | null>(null);
let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;

function initStage(): void {
  if (!container.value) return;
  stage?.destroy();
  stage = new Konva.Stage({
    container: container.value,
    width: container.value.clientWidth || 280,
    height: container.value.clientHeight || 160,
  });
  layer = new Konva.Layer();
  stage.add(layer);
  if (props.canEdit) {
    stage.on('mousedown touchstart', () => {
      if (!stage || !layer) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      layer.add(
        new Konva.Circle({
          x: pos.x,
          y: pos.y,
          radius: 6,
          fill: '#6366f1',
        }),
      );
      layer.batchDraw();
    });
  }
}

onMounted(initStage);
watch(() => props.canEdit, initStage);
</script>

<template>
  <div ref="container" class="h-full min-h-[140px] w-full rounded-lg bg-white dark:bg-neutral-950" />
</template>
