<template>
  <div
    ref="surfaceRef"
    class="relative w-full"
    :class="dropHighlight"
    :style="surfaceStyle"
    @mousedown.self="onBackgroundClick"
    @dragenter.capture.prevent="onDragEnter"
    @dragover.capture.prevent="onDragOver"
    @dragleave.capture="onDragLeave"
    @drop.capture.prevent="onDrop"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-40"
      :style="gridStyle"
      aria-hidden="true"
    />

    <BuilderPageMarginGuides
      :page-width-px="pageWidthPx"
      :page-height-px="pageHeightPx"
    />

    <BuilderDocStarter
      v-if="!nodes.length"
      class="relative z-10 mx-auto max-w-md pt-24"
      @start-typing="emit('start-typing', $event)"
    />

    <BuilderFreeformLayer
      v-for="node in sortedNodes"
      :key="node.id"
      :node="node"
      :selected-id="selectedId"
      :selected-ids="selectedIds"
      :zoom="zoom"
      :page-width-px="pageWidthPx"
      :page-height-px="pageHeightPx"
      @select="emit('select', $event)"
      @remove="emit('remove', $event)"
      @duplicate="emit('duplicate', $event)"
      @reorder="emit('reorder', $event)"
      @patch="emit('patch', $event)"
      @continue-after="emit('continue-after', $event)"
      @library-add="emit('library-add', $event)"
      @layout-change="onLayoutChange"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import BuilderDocStarter from '@/components/templates/builder/BuilderDocStarter.vue';
import BuilderFreeformLayer from '@/components/templates/builder/BuilderFreeformLayer.vue';
import BuilderPageMarginGuides from '@/components/templates/builder/BuilderPageMarginGuides.vue';
import { BUILDER_DROP_KEY } from '@/constants/builderInjectKeys';
import { useBuilderDropHighlightClass, useBuilderDropZone } from '@/composables/useBuilderDragDrop';
import { BUILDER_GRID_SIZE, layoutAtPoint, sortNodesByZIndex } from '@/utils/builderLayout';

const props = defineProps({
  rootId: { type: String, default: 'root' },
  nodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  selectedIds: { type: Array, default: () => [] },
  zoom: { type: Number, default: 1 },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 }
});

const emit = defineEmits([
  'select',
  'remove',
  'duplicate',
  'reorder',
  'patch',
  'start-typing',
  'continue-after',
  'library-add',
  'layout-change',
  'component-drop'
]);

const surfaceRef = ref(null);
const dropHandler = inject(BUILDER_DROP_KEY, null);
let dragDepth = 0;

const sortedNodes = computed(() => sortNodesByZIndex(props.nodes));

const surfaceStyle = computed(() => ({
  width: '100%',
  height: `${props.pageHeightPx}px`,
  minHeight: `${props.pageHeightPx}px`
}));

const gridStyle = computed(() => ({
  backgroundImage:
    `linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px),
     linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px)`,
  backgroundSize: `${BUILDER_GRID_SIZE}px ${BUILDER_GRID_SIZE}px`
}));

const { isDragOver, onDragOver, onDragLeave: onDragLeaveBase, onDrop: onNativeDrop } = useBuilderDropZone((payload, event) => {
  handleDropPayload(payload, event);
});

const dropHighlight = useBuilderDropHighlightClass(isDragOver);

function clientToCanvasPoint(event) {
  const surface = surfaceRef.value;
  if (!surface) return null;
  const rect = surface.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / props.zoom,
    y: (event.clientY - rect.top) / props.zoom
  };
}

function handleDropPayload(payload, event) {
  const point = clientToCanvasPoint(event);
  if (!point) return;

  if (payload.kind === 'component' && payload.type) {
    emit('component-drop', {
      type: payload.type,
      parentId: props.rootId,
      layout: layoutAtPoint(
        point.x,
        point.y,
        payload.type,
        props.pageWidthPx,
        props.pageHeightPx,
        props.nodes.length + 1
      )
    });
    return;
  }

  if (dropHandler) {
    dropHandler(payload, { parentId: props.rootId });
  }
}

function onDragEnter(event) {
  dragDepth += 1;
  onDragOver(event);
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    onDragLeaveBase();
  }
}

function onDrop(event) {
  dragDepth = 0;
  onNativeDrop(event);
}

function onBackgroundClick() {
  emit('select', { id: null, additive: false });
}

function onLayoutChange(payload) {
  emit('layout-change', payload);
}
</script>
