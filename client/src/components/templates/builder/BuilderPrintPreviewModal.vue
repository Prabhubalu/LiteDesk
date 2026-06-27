<template>
  <Dialog :open="open" class="relative z-50" @close="emit('close')">
    <div class="fixed inset-0 bg-neutral-950/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-3">
      <DialogPanel
        class="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden rounded-xl shadow-xl"
        :class="ui.panel"
      >
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-3" :class="ui.border">
          <DialogTitle :class="ui.heading">{{ t('templates.builderPrintPreview') }}</DialogTitle>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-xs text-primary-600 hover:underline disabled:opacity-50 dark:text-primary-400"
              :disabled="loading"
              @click="emit('refresh')"
            >
              {{ t('actions.refresh') }}
            </button>
            <button type="button" :class="ui.btnIcon" @click="emit('close')">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center text-sm" :class="ui.textMuted">
          {{ t('templates.builderPreviewUpdating') }}
        </div>

        <div
          v-else-if="error"
          class="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-danger-600 dark:text-danger-400"
        >
          {{ error }}
        </div>

        <div
          v-else
          ref="viewportRef"
          class="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-200 dark:bg-neutral-900"
        >
          <div class="shrink-0" :style="frameTransformStyle">
            <iframe
              class="block border-0 bg-white"
              :style="iframeStyle"
              :srcdoc="previewDocument"
              :title="t('templates.builderPrintPreview')"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { resolvePageMarginsPx } from '@/constants/contentPageSettings';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  open: { type: Boolean, default: false },
  html: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 }
});

const emit = defineEmits(['close', 'refresh']);

const { t } = useI18n();
const ui = useBuilderUi();
const viewportRef = ref(null);
const viewportSize = ref({ width: 0, height: 0 });

let resizeObserver = null;

const pageMarginsPx = computed(() => resolvePageMarginsPx());

const contentHeightPx = computed(() => {
  const m = pageMarginsPx.value;
  return Math.max(0, props.pageHeightPx - m.top - m.bottom);
});

const previewDocument = computed(() => {
  const html = props.html || '';
  if (!html.includes('</head>')) return html;

  const m = pageMarginsPx.value;
  const contentH = contentHeightPx.value;
  const pixelPageStyle = `<style id="ld-builder-preview-page">
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      width: ${props.pageWidthPx}px !important;
      min-height: ${props.pageHeightPx}px !important;
      padding: ${m.top}px ${m.right}px ${m.bottom}px ${m.left}px !important;
      box-sizing: border-box !important;
    }
    .content.absolute-layout {
      width: 100% !important;
      height: ${contentH}px !important;
      min-height: ${contentH}px !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }
  </style>`;

  return html.replace('</head>', `${pixelPageStyle}</head>`);
});

const fitScale = computed(() => {
  const { width, height } = viewportSize.value;
  if (!width || !height) return 1;
  const scaleX = (width - 16) / props.pageWidthPx;
  const scaleY = (height - 16) / props.pageHeightPx;
  return Math.min(1, scaleX, scaleY);
});

const iframeStyle = computed(() => ({
  width: `${props.pageWidthPx}px`,
  height: `${props.pageHeightPx}px`
}));

const frameTransformStyle = computed(() => ({
  width: `${props.pageWidthPx}px`,
  height: `${props.pageHeightPx}px`,
  transform: `scale(${fitScale.value})`,
  transformOrigin: 'center center'
}));

function measureViewport() {
  const el = viewportRef.value;
  if (!el) return;
  viewportSize.value = {
    width: el.clientWidth,
    height: el.clientHeight
  };
}

function attachObserver() {
  detachObserver();
  const el = viewportRef.value;
  if (!el) return;
  measureViewport();
  resizeObserver = new ResizeObserver(() => measureViewport());
  resizeObserver.observe(el);
}

function detachObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

watch(
  () => [props.open, props.loading, props.error],
  ([isOpen, isLoading, hasError]) => {
    if (isOpen && !isLoading && !hasError) {
      requestAnimationFrame(attachObserver);
      return;
    }
    detachObserver();
  },
  { immediate: true }
);

watch(
  () => [props.pageWidthPx, props.pageHeightPx, props.html],
  () => {
    if (props.open && !props.loading && !props.error) {
      measureViewport();
    }
  }
);

onUnmounted(detachObserver);
</script>
