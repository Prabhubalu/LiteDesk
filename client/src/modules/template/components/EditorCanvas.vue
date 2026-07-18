<template>
  <div class="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div ref="scrollRef" :class="ui.canvasOuter">
      <div :class="ui.canvasPaper" :style="paperStyle">
        <div
          ref="containerRef"
          class="gjs-canvas-host arivu-gjs-theme h-full"
          :style="hostStyle"
        />
        <BuilderPageMarginGuides
          v-if="showMarginGuides"
          :page-width-px="pageWidthPx"
          :page-height-px="pageHeightPx"
          :margins-mm="marginsMm"
          :zoom="zoom"
        />
      </div>
    </div>

    <div :class="ui.zoomBar" role="toolbar" :aria-label="t('templates.builderZoom')">
      <button
        type="button"
        :class="ui.zoomBtn"
        :title="t('templates.builderZoomOut')"
        :disabled="zoom <= minZoom"
        @click="adjustZoom(-0.1)"
      >
        <MinusIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        :class="ui.zoomLabel"
        :title="t('templates.builderZoomReset')"
        @click="resetZoom"
      >
        {{ zoomPercent }}%
      </button>
      <button
        type="button"
        :class="ui.zoomBtn"
        :title="t('templates.builderZoomIn')"
        :disabled="zoom >= maxZoom"
        @click="adjustZoom(0.1)"
      >
        <PlusIcon class="h-4 w-4" />
      </button>
      <span :class="ui.zoomDivider" aria-hidden="true" />
      <button
        type="button"
        :class="ui.zoomLabel"
        :title="t('templates.builderZoomFit')"
        @click="fitToWidth"
      >
        {{ t('templates.builderZoomFit') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MinusIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';
import BuilderPageMarginGuides from '@/components/templates/builder/BuilderPageMarginGuides.vue';

const props = defineProps({
  editor: { type: Object, default: null },
  canvasWidth: { type: String, default: '794px' },
  canvasHeight: { type: String, default: '1123px' },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 },
  marginsMm: {
    type: Object,
    default: () => ({ ...DEFAULT_PAGE_MARGINS_MM })
  },
  showMarginGuides: { type: Boolean, default: true }
});

const emit = defineEmits(['container-ready']);

const { t } = useI18n();
const containerRef = ref(null);
const scrollRef = ref(null);
const ui = useBuilderUi();
const zoom = ref(1);
const minZoom = 0.4;
const maxZoom = 1.5;

const zoomPercent = computed(() => Math.round(zoom.value * 100));

const paperStyle = computed(() => ({
  // Must match Grapes frame + margin guides exactly. maxWidth:100% shrinks the
  // paper while guides/frame stay at pageWidthPx — content appears outside print area.
  width: `${props.pageWidthPx}px`,
  minWidth: `${props.pageWidthPx}px`,
  minHeight: `${props.pageHeightPx}px`,
  height: `${props.pageHeightPx}px`,
  maxWidth: 'none'
}));

const hostStyle = computed(() => ({
  width: `${props.pageWidthPx}px`,
  height: `${props.pageHeightPx}px`,
  minHeight: `${props.pageHeightPx}px`,
  flexShrink: 0
}));

function adjustZoom(delta) {
  zoom.value = Math.min(maxZoom, Math.max(minZoom, Number((zoom.value + delta).toFixed(2))));
}

function resetZoom() {
  zoom.value = 1;
}

function fitToWidth() {
  const container = scrollRef.value;
  if (!container) return;
  const available = container.clientWidth - 80;
  const pageWidth = props.pageWidthPx || 794;
  if (pageWidth <= 0) return;
  zoom.value = Math.min(1, maxZoom, Math.max(minZoom, Number((available / pageWidth).toFixed(2))));
}

function applyEditorZoom() {
  const canvas = props.editor?.Canvas;
  if (!canvas?.setZoom) return;
  canvas.setZoom(Math.round(zoom.value * 100));
}

watch(
  containerRef,
  (el) => {
    emit('container-ready', el);
  },
  { flush: 'post', immediate: true }
);

watch(
  () => props.pageWidthPx,
  () => {
    fitToWidth();
  }
);

watch(
  [() => props.editor, zoom],
  () => {
    applyEditorZoom();
  },
  { flush: 'post' }
);

let resizeObserver = null;

onMounted(() => {
  fitToWidth();
  const container = scrollRef.value;
  if (container && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (zoom.value <= 1) {
        fitToWidth();
      }
    });
    resizeObserver.observe(container);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
:deep(.gjs-canvas-host) {
  width: 100%;
  height: 100%;
  min-width: inherit;
  min-height: inherit;
}

:deep(.gjs-canvas-host .gjs-editor) {
  background: transparent;
  min-height: inherit;
  height: 100%;
}

:deep(.gjs-canvas-host .gjs-cv-canvas) {
  background: #fff;
  width: 100% !important;
  top: 0;
  height: 100% !important;
  min-height: inherit;
}

:deep(.gjs-canvas-host .gjs-frame-wrapper) {
  background: #fff;
  min-height: inherit;
  height: 100% !important;
  width: 100% !important;
}

:deep(.gjs-canvas-host .gjs-frame) {
  height: 100% !important;
  width: 100% !important;
}

:deep(.gjs-canvas-host .gjs-pn-panels),
:deep(.gjs-canvas-host .gjs-pn-panel),
:deep(.gjs-canvas-host .gjs-pn-views),
:deep(.gjs-canvas-host .gjs-pn-commands),
:deep(.gjs-canvas-host .gjs-pn-options),
:deep(.gjs-canvas-host .gjs-pn-devices-c),
:deep(.gjs-canvas-host #views-container) {
  display: none !important;
}

:deep(.gjs-canvas-host .gjs-editor-cont) {
  width: 100%;
}

:deep(.gjs-canvas-host .gjs-cv-canvas) {
  left: 0;
  top: 0;
  width: 100%;
}

:deep(.gjs-canvas-host .gjs-cv-canvas__frames) {
  transform-origin: top center;
}
</style>
