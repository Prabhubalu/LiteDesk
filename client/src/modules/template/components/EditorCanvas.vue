<template>
  <div :class="ui.canvasOuter">
    <div
      class="relative mx-auto min-h-full rounded-sm bg-white shadow-lg ring-1 ring-neutral-200/80 dark:ring-neutral-700/50"
      :style="paperStyle"
    >
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
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import BuilderPageMarginGuides from '@/components/templates/builder/BuilderPageMarginGuides.vue';

const props = defineProps({
  canvasWidth: { type: String, default: '794px' },
  canvasHeight: { type: String, default: '1123px' },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 },
  marginsMm: {
    type: Object,
    default: () => ({ top: 12, right: 12, bottom: 12, left: 12 })
  },
  showMarginGuides: { type: Boolean, default: true }
});

const emit = defineEmits(['container-ready']);

const containerRef = ref(null);
const ui = useBuilderUi();

const paperStyle = computed(() => ({
  width: props.canvasWidth,
  minHeight: props.canvasHeight,
  maxWidth: '100%'
}));

const hostStyle = computed(() => ({
  minHeight: props.canvasHeight
}));

watch(
  containerRef,
  (el) => {
    emit('container-ready', el);
  },
  { flush: 'post', immediate: true }
);
</script>

<style scoped>
:deep(.gjs-canvas-host) {
  width: 100%;
}

:deep(.gjs-canvas-host .gjs-editor) {
  background: transparent;
  min-height: inherit;
}

:deep(.gjs-canvas-host .gjs-cv-canvas) {
  background: #fff;
  width: 100%;
  top: 0;
  height: 100%;
  min-height: inherit;
}

:deep(.gjs-canvas-host .gjs-frame-wrapper) {
  background: #fff;
  min-height: inherit;
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
</style>
