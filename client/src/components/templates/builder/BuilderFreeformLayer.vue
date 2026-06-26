<template>
  <div
    class="group absolute"
    :class="isNodeHidden(node) ? 'opacity-50' : ''"
    :style="layerStyle"
  >
    <div
      v-if="isSelected && !isNodeLocked(node)"
      class="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-primary-500/80"
    />

    <div
      v-if="isTextBlock && isSelected && !isNodeLocked(node)"
      class="pointer-events-auto absolute bottom-full left-0 z-50 mb-1 w-max max-w-none"
    >
      <BuilderTextFormatToolbar
        dock="above"
        :show-drag-handle="false"
        :node-id="node.id"
        :node-type="String(node.type)"
        :heading-level="Number(node.bindings?.level || 1)"
        :text-align="String(node.style?.typography?.textAlign || 'left')"
        :active-formats="textFormatState"
        @format="onTextFormat"
        @duplicate="emit('duplicate', node.id)"
      />
    </div>

    <div
      v-else-if="isSelected && !isNodeLocked(node) && !isTableBlock"
      class="pointer-events-auto absolute bottom-full right-0 z-50 mb-1 w-max max-w-none"
    >
      <BuilderSelectionToolbar
        dock="above"
        :show-drag-handle="false"
        :node-id="node.id"
        :is-selected="true"
        :locked="false"
        @duplicate="emit('duplicate', node.id)"
      />
    </div>

    <div
      data-freeform-drag-handle
      class="absolute -top-7 left-0 flex max-w-full cursor-move items-center gap-1 rounded-t-md border border-b-0 px-2 py-0.5 text-[10px] font-medium shadow-sm"
      :class="[
        ui.panel,
        ui.border,
        isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-500',
        isNodeLocked(node) ? 'cursor-not-allowed' : 'cursor-move'
      ]"
      @mousedown.stop="onDragHandleMouseDown"
    >
      <span class="truncate">{{ node.name || node.type }}</span>
    </div>

    <div
      class="h-full w-full rounded-sm bg-white/80 dark:bg-neutral-900/80"
      :class="isTableBlock ? 'overflow-auto' : 'overflow-visible'"
    >
      <BuilderCanvasBlock
        :node="node"
        :selected-id="selectedId"
        :selected-ids="selectedIds"
        @select="emit('select', $event)"
        @remove="emit('remove', $event)"
        @duplicate="emit('duplicate', $event)"
        @reorder="emit('reorder', $event)"
        @patch="emit('patch', $event)"
        @format-state="onFormatState"
        @continue-after="emit('continue-after', $event)"
        @library-add="emit('library-add', $event)"
      />
    </div>

    <BuilderFreeformResizeHandles
      v-if="isSelected && !isNodeLocked(node)"
      @start="startResize"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import BuilderCanvasBlock from '@/components/templates/builder/BuilderCanvasBlock.vue';
import BuilderFreeformResizeHandles from '@/components/templates/builder/BuilderFreeformResizeHandles.vue';
import BuilderSelectionToolbar from '@/components/templates/builder/BuilderSelectionToolbar.vue';
import BuilderTextFormatToolbar from '@/components/templates/builder/BuilderTextFormatToolbar.vue';
import { BUILDER_ACTIVE_TEXT_EDITOR_KEY } from '@/constants/builderInjectKeys';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { clampLayoutToContentArea, snapToGrid } from '@/utils/builderLayout';
import { resolveContentAreaPx, resolvePageMarginsPx } from '@/constants/contentPageSettings';
import { normalizeTableGridBindings, resolveSyncedTableLayout } from '@/utils/builderTableGridModel';
import { buildLineItemPreviewTableBindings } from '@/constants/lineItemDefaults';
import { isNodeHidden, isNodeLocked } from '@/utils/templateBuilderTree';

function resolveDisplayLayout(node, pageWidthPx, pageHeightPx) {
  if (node.type === 'Table') {
    return resolveSyncedTableLayout(node, pageWidthPx, pageHeightPx);
  }
  if (node.type === 'LineItem') {
    const previewNode = {
      ...node,
      type: 'Table',
      bindings: buildLineItemPreviewTableBindings(node.bindings || {})
    };
    return resolveSyncedTableLayout(previewNode, pageWidthPx, pageHeightPx);
  }
  const contentArea = resolveContentAreaPx(pageWidthPx, pageHeightPx, resolvePageMarginsPx());
  const current = node.layout || {};
  return clampLayoutToContentArea({
    x: Number(current.x) || contentArea.x,
    y: Number(current.y) || contentArea.y,
    width: Math.max(32, Number(current.width) || 240),
    height: Math.max(32, Number(current.height) || 80),
    zIndex: current.zIndex
  }, contentArea);
}

const MIN_SIZE = 32;

const props = defineProps({
  node: { type: Object, required: true },
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
  'continue-after',
  'library-add',
  'layout-change'
]);

const ui = useBuilderUi();
const activeTextEditor = inject(BUILDER_ACTIVE_TEXT_EDITOR_KEY, null);
const textFormatState = ref({ bold: false, italic: false });

const isSelected = computed(() => props.node.id === props.selectedId);
const isTextBlock = computed(() => props.node.type === 'Heading' || props.node.type === 'Paragraph');
const isTableBlock = computed(() => props.node.type === 'Table' || props.node.type === 'LineItem');

const contentArea = computed(() =>
  resolveContentAreaPx(props.pageWidthPx, props.pageHeightPx, resolvePageMarginsPx())
);

function clampNodeLayout(layout) {
  return clampLayoutToContentArea(
    {
      x: Number(layout.x) || contentArea.value.x,
      y: Number(layout.y) || contentArea.value.y,
      width: Number(layout.width) || 240,
      height: Number(layout.height) || 80,
      zIndex: layout.zIndex
    },
    contentArea.value
  );
}

const layerStyle = computed(() => {
  const layout = resolveDisplayLayout(props.node, props.pageWidthPx, props.pageHeightPx);
  return {
    left: `${Number(layout.x) || 0}px`,
    top: `${Number(layout.y) || 0}px`,
    width: `${Number(layout.width) || 240}px`,
    height: `${Number(layout.height) || 80}px`,
    zIndex: Number(layout.zIndex) || 1
  };
});

function onDragHandleMouseDown(event) {
  if (isNodeLocked(props.node)) return;
  if (event.button !== 0) return;

  emit('select', { id: props.node.id, additive: Boolean(event.shiftKey) });

  const layout = props.node.layout || {};
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = Number(layout.x) || 0;
  const originY = Number(layout.y) || 0;

  function onMove(moveEvent) {
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;
    emit('layout-change', {
      id: props.node.id,
      layout: clampNodeLayout({
        x: snapToGrid(Math.max(contentArea.value.x, originX + dx)),
        y: snapToGrid(Math.max(contentArea.value.y, originY + dy)),
        width: Number(layout.width) || 240,
        height: Number(layout.height) || 80,
        zIndex: layout.zIndex
      }),
      live: true
    });
  }

  function onUp(moveEvent) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;
    emit('layout-change', {
      id: props.node.id,
      layout: clampNodeLayout({
        x: snapToGrid(Math.max(contentArea.value.x, originX + dx)),
        y: snapToGrid(Math.max(contentArea.value.y, originY + dy)),
        width: Number(layout.width) || 240,
        height: Number(layout.height) || 80,
        zIndex: layout.zIndex
      }),
      live: false
    });
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function startResize(handle, event) {
  const layout = props.node.layout || {};
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = {
    x: Number(layout.x) || 0,
    y: Number(layout.y) || 0,
    width: Number(layout.width) || 240,
    height: Number(layout.height) || 80
  };

  function applyResize(moveEvent, live) {
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;

    let nextX = origin.x;
    let nextY = origin.y;
    let nextWidth = origin.width;
    let nextHeight = origin.height;

    if (handle.includes('e')) nextWidth = origin.width + dx;
    if (handle.includes('s')) nextHeight = origin.height + dy;
    if (handle.includes('w')) {
      nextWidth = origin.width - dx;
      nextX = origin.x + dx;
    }
    if (handle.includes('n')) {
      nextHeight = origin.height - dy;
      nextY = origin.y + dy;
    }

    nextWidth = Math.max(MIN_SIZE, nextWidth);
    nextHeight = Math.max(MIN_SIZE, nextHeight);

    if (handle.includes('w') && nextWidth === MIN_SIZE) {
      nextX = origin.x + origin.width - MIN_SIZE;
    }
    if (handle.includes('n') && nextHeight === MIN_SIZE) {
      nextY = origin.y + origin.height - MIN_SIZE;
    }

    emit('layout-change', {
      id: props.node.id,
      layout: clampNodeLayout({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        zIndex: layout.zIndex
      }),
      live
    });
  }

  function onMove(moveEvent) {
    applyResize(moveEvent, true);
  }

  function onUp(moveEvent) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    applyResize(moveEvent, false);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function onFormatState(state) {
  textFormatState.value = {
    bold: Boolean(state?.bold),
    italic: Boolean(state?.italic)
  };
}

function onTextFormat(action, value) {
  activeTextEditor?.value?.applyFormat?.(action, value);
}
</script>
