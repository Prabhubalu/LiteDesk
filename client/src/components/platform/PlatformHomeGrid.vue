<template>
  <div
    ref="gridRef"
    class="platform-home-grid grid-stack min-h-[12rem]"
    :class="{ 'platform-home-grid--locked': customizeMode }"
  >
    <div
      v-for="item in visibleItems"
      :key="item.instanceId"
      class="grid-stack-item group/home-widget"
      :gs-id="item.instanceId"
    >
      <div class="grid-stack-item-content h-full overflow-hidden rounded-2xl">
        <slot name="cell" :item="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import type { PlatformHomeLayoutItem } from '@/types/platformHome.types';
import { resolvePlatformHomeItemConstraints } from '@/utils/platformHomeWidgetRegistry';

const props = defineProps<{
  items: PlatformHomeLayoutItem[];
  customizeMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:items', items: PlatformHomeLayoutItem[]): void;
}>();

const gridRef = ref<HTMLElement | null>(null);
let grid: GridStack | null = null;
let syncingGrid = false;
let isGridInteracting = false;
let chartResizeFrame = 0;
const DESKTOP_COLUMNS = 12;
const GRID_MARGIN = 8;

const visibleItems = computed(() => props.items.filter((item) => item.enabled !== false));

const visibleInstanceKey = computed(() =>
  visibleItems.value
    .map((item) => item.instanceId)
    .sort()
    .join('|'),
);

function itemConstraints(item: PlatformHomeLayoutItem) {
  return resolvePlatformHomeItemConstraints(item);
}

function buildWidgetOptions(item: PlatformHomeLayoutItem) {
  const { minW, minH } = itemConstraints(item);
  return {
    id: item.instanceId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW,
    minH,
  };
}

type GridStackNodeSnapshot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function readLayoutFromGrid(): GridStackNodeSnapshot[] {
  if (!grid) return [];

  return grid.getGridItems().flatMap((el) => {
    const node = (el as HTMLElement & {
      gridstackNode?: { id?: string; x?: number; y?: number; w?: number; h?: number };
    }).gridstackNode;
    const id = String(node?.id || el.getAttribute('gs-id') || '').trim();
    if (!id || !node) return [];

    return [{
      id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      w: node.w ?? 1,
      h: node.h ?? 1,
    }];
  });
}

function syncLayoutFromGrid() {
  if (!grid || syncingGrid || props.customizeMode) return;

  const saved = readLayoutFromGrid();
  let changed = false;

  const nextItems = props.items.map((item) => {
    const node = saved.find((entry) => entry.id === item.instanceId);
    if (!node) return item;

    const { x, y, w, h } = node;

    if (x === item.x && y === item.y && w === item.w && h === item.h) {
      return item;
    }

    changed = true;
    return { ...item, x, y, w, h };
  });

  if (changed) {
    emit('update:items', nextItems);
  }
}

function scheduleChartResize() {
  if (chartResizeFrame) {
    cancelAnimationFrame(chartResizeFrame);
  }
  chartResizeFrame = requestAnimationFrame(() => {
    chartResizeFrame = 0;
    window.dispatchEvent(new Event('resize'));
  });
}

function initGrid() {
  if (!gridRef.value || grid) return;

  grid = GridStack.init(
    {
      column: DESKTOP_COLUMNS,
      cellHeight: 80,
      margin: GRID_MARGIN,
      float: true,
      animate: false,
      staticGrid: false,
      disableDrag: false,
      disableResize: false,
      resizable: { handles: 'all' },
      draggable: {
        handle: '.platform-home-widget-drag-surface',
      },
    },
    gridRef.value,
  );

  grid.on('dragstart', () => {
    isGridInteracting = true;
  });

  grid.on('dragstop', () => {
    isGridInteracting = false;
    syncLayoutFromGrid();
  });

  grid.on('resizestart', () => {
    isGridInteracting = true;
    document.body.classList.add('grid-stack-resizing');
  });

  grid.on('resize', () => {
    scheduleChartResize();
  });

  grid.on('resizestop', () => {
    isGridInteracting = false;
    document.body.classList.remove('grid-stack-resizing');
    syncLayoutFromGrid();
    scheduleChartResize();
  });
}

async function registerGridItems() {
  if (!grid || !gridRef.value) return;

  syncingGrid = true;
  await nextTick();

  const activeIds = new Set(visibleItems.value.map((item) => item.instanceId));

  for (const el of grid.getGridItems()) {
    const id = el.getAttribute('gs-id');
    if (id && !activeIds.has(id)) {
      grid.removeWidget(el, false);
    }
  }

  for (const item of visibleItems.value) {
    const el = gridRef.value.querySelector(`[gs-id="${item.instanceId}"]`);
    if (!el) continue;

    const node = (el as HTMLElement & { gridstackNode?: unknown }).gridstackNode;
    if (!node) {
      grid.makeWidget(el as HTMLElement, buildWidgetOptions(item));
    }
  }

  syncingGrid = false;
}

function applyLayoutFromItems() {
  if (!grid || !gridRef.value || isGridInteracting) return;

  syncingGrid = true;
  grid.load(
    visibleItems.value.map((item) => buildWidgetOptions(item)),
    false,
  );
  syncingGrid = false;
}

function setLayoutLocked(locked: boolean) {
  if (!grid) return;
  grid.setStatic(locked);
  grid.enableMove(!locked);
  grid.enableResize(!locked);
}

function destroyGrid() {
  isGridInteracting = false;
  if (chartResizeFrame) {
    cancelAnimationFrame(chartResizeFrame);
    chartResizeFrame = 0;
  }
  document.body.classList.remove('grid-stack-resizing');
  if (grid) {
    grid.destroy(false);
    grid = null;
  }
}

watch(
  () => props.customizeMode,
  async (customize, wasCustomize) => {
    setLayoutLocked(Boolean(customize));
    await nextTick();
    if (customize) {
      await registerGridItems();
      return;
    }
    if (wasCustomize) {
      applyLayoutFromItems();
    }
  },
);

watch(visibleInstanceKey, async () => {
  if (!grid) return;
  await registerGridItems();
  applyLayoutFromItems();
});

onMounted(async () => {
  initGrid();
  await registerGridItems();
  applyLayoutFromItems();
  setLayoutLocked(Boolean(props.customizeMode));
  scheduleChartResize();
});

onBeforeUnmount(() => {
  destroyGrid();
});

defineExpose({
  syncLayoutFromGrid,
});
</script>

<style scoped>
.platform-home-grid.grid-stack {
  --gs-item-margin-top: 8px;
  --gs-item-margin-right: 8px;
  --gs-item-margin-bottom: 8px;
  --gs-item-margin-left: 8px;
}

/* Preserve GridStack margin insets — do not use inset:0 (it removes gutters) */
.platform-home-grid :deep(.grid-stack-item-content) {
  position: absolute;
  top: var(--gs-item-margin-top, 8px) !important;
  right: var(--gs-item-margin-right, 8px) !important;
  bottom: var(--gs-item-margin-bottom, 8px) !important;
  left: var(--gs-item-margin-left, 8px) !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
}

.platform-home-grid :deep(.grid-stack-item-content > *) {
  height: 100%;
  min-height: 0;
}

.platform-home-grid :deep(.echarts) {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
}

.platform-home-grid :deep(.platform-home-widget-drag-surface) {
  user-select: none;
  -webkit-user-select: none;
}

.platform-home-grid.platform-home-grid--locked :deep(.grid-stack-item > .ui-resizable-handle),
.platform-home-grid.platform-home-grid--locked :deep(.grid-stack-item:hover > .ui-resizable-handle) {
  opacity: 0 !important;
  pointer-events: none !important;
}

.platform-home-grid:not(.platform-home-grid--locked) :deep(.grid-stack-item-content) {
  pointer-events: none;
}

.platform-home-grid:not(.platform-home-grid--locked) :deep(.grid-stack-item-content > *) {
  pointer-events: auto;
}
</style>
