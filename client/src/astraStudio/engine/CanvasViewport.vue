<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { StudioPeer } from '@/astraStudio/types';

const props = withDefaults(
  defineProps<{
    cameraX?: number;
    cameraY?: number;
    zoom?: number;
    selectedId?: string | null;
    peers?: StudioPeer[];
  }>(),
  {
    cameraX: 0,
    cameraY: 0,
    zoom: 1,
    selectedId: null,
    peers: () => [],
  },
);

const emit = defineEmits<{
  'update:camera': [payload: { x: number; y: number; zoom: number }];
  select: [widgetId: string | null];
  'cursor-move': [payload: { x: number; y: number }];
}>();

const viewportEl = ref<HTMLElement | null>(null);
const panning = ref(false);
const spaceDown = ref(false);
const lastPan = ref({ x: 0, y: 0 });

const cam = ref({ x: props.cameraX, y: props.cameraY, zoom: props.zoom });

watch(
  () => [props.cameraX, props.cameraY, props.zoom] as const,
  ([x, y, z]) => {
    cam.value = { x: x ?? 0, y: y ?? 0, zoom: z ?? 1 };
  },
);

const worldStyle = computed(() => ({
  transform: `translate(${cam.value.x}px, ${cam.value.y}px) scale(${cam.value.zoom})`,
  transformOrigin: '0 0',
}));

const viewportCursor = computed(() => {
  if (panning.value) return 'grabbing';
  if (spaceDown.value) return 'grab';
  return 'default';
});

function emitCamera(): void {
  emit('update:camera', { x: cam.value.x, y: cam.value.y, zoom: cam.value.zoom });
}

function panBy(dx: number, dy: number): void {
  cam.value.x += dx;
  cam.value.y += dy;
  emitCamera();
}

function zoomAt(clientX: number, clientY: number, factor: number): void {
  if (!viewportEl.value) return;
  const rect = viewportEl.value.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const nextZoom = Math.min(3, Math.max(0.25, cam.value.zoom * factor));
  if (nextZoom === cam.value.zoom) return;
  const wx = (mx - cam.value.x) / cam.value.zoom;
  const wy = (my - cam.value.y) / cam.value.zoom;
  cam.value.x = mx - wx * nextZoom;
  cam.value.y = my - wy * nextZoom;
  cam.value.zoom = nextZoom;
  emitCamera();
}

/**
 * Trackpad / mouse wheel:
 * - Default scroll → pan (left/right/up/down)
 * - Ctrl / Meta / pinch (ctrlKey) → zoom
 * - Shift+vertical wheel → horizontal pan (mouse wheel fallback)
 */
function onWheel(e: WheelEvent): void {
  e.preventDefault();
  e.stopPropagation();

  const wantsZoom = e.ctrlKey || e.metaKey;
  if (wantsZoom) {
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoomAt(e.clientX, e.clientY, factor);
    return;
  }

  // deltaMode: 0=pixel (trackpad), 1=line, 2=page
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.shiftKey && Math.abs(dx) < Math.abs(dy)) {
    dx = dy;
    dy = 0;
  }
  if (e.deltaMode === 1) {
    dx *= 16;
    dy *= 16;
  } else if (e.deltaMode === 2) {
    dx *= 400;
    dy *= 400;
  }
  // Invert so content follows finger (natural trackpad feel)
  panBy(-dx, -dy);
}

function isPanGesture(e: PointerEvent): boolean {
  if (e.button === 1) return true; // middle mouse
  if (spaceDown.value && e.button === 0) return true;
  // Left-drag on empty canvas background (not a widget)
  if (e.button === 0) {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    if (t.closest('[data-studio-widget]')) return false;
    if (t.closest('[data-studio-chrome]')) return false;
    return true;
  }
  return false;
}

function onPointerDown(e: PointerEvent): void {
  if (!isPanGesture(e)) return;
  e.preventDefault();
  panning.value = true;
  lastPan.value = { x: e.clientX, y: e.clientY };
  viewportEl.value?.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  const rect = viewportEl.value?.getBoundingClientRect();
  if (rect) {
    const wx = (e.clientX - rect.left - cam.value.x) / cam.value.zoom;
    const wy = (e.clientY - rect.top - cam.value.y) / cam.value.zoom;
    emit('cursor-move', { x: wx, y: wy });
  }
  if (!panning.value) return;
  panBy(e.clientX - lastPan.value.x, e.clientY - lastPan.value.y);
  lastPan.value = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e: PointerEvent): void {
  if (!panning.value) return;
  panning.value = false;
  try {
    viewportEl.value?.releasePointerCapture(e.pointerId);
  } catch {
    // ignore
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.code === 'Space' && !e.repeat) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }
    e.preventDefault();
    spaceDown.value = true;
  }
  // Arrow keys pan
  const step = e.shiftKey ? 80 : 40;
  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    panBy(step, 0);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    panBy(-step, 0);
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    panBy(0, step);
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    panBy(0, -step);
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') spaceDown.value = false;
}

function onBackgroundClick(e: MouseEvent): void {
  if (panning.value) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest('[data-studio-widget]')) return;
  emit('select', null);
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});

defineExpose({ cam });
</script>

<template>
  <div
    ref="viewportEl"
    class="relative h-full w-full touch-none overflow-hidden bg-neutral-100 dark:bg-neutral-900"
    :style="{ cursor: viewportCursor }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onBackgroundClick"
  >
    <!-- Large hit area so empty space is always pannable -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true" />

    <div class="absolute left-0 top-0 will-change-transform" :style="worldStyle">
      <slot />
    </div>

    <div class="pointer-events-none absolute inset-0 overflow-hidden" data-studio-chrome>
      <div
        v-for="peer in peers.filter((p) => p.cursor && p.user)"
        :key="peer.clientId"
        class="absolute text-xs font-medium"
        :style="{
          transform: `translate(${cam.x + (peer.cursor?.x ?? 0) * cam.zoom}px, ${cam.y + (peer.cursor?.y ?? 0) * cam.zoom}px)`,
          color: peer.user?.color || '#6366f1',
        }"
      >
        <span
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 shadow-sm ring-1 ring-black/10 dark:ring-white/10"
          :style="{ backgroundColor: `${peer.user?.color || '#6366f1'}22` }"
        >
          {{ peer.user?.name || '?' }}
        </span>
      </div>
    </div>
  </div>
</template>
