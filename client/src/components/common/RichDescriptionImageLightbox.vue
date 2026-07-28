<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="open">
      <Dialog class="relative z-[10100]" @close="emit('close')">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-150"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/80" aria-hidden="true" @click="emit('close')" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden p-4 sm:p-8">
          <div class="flex h-full min-h-full flex-col items-center justify-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="relative flex h-full w-full max-w-6xl flex-col">
                <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <DialogTitle class="text-sm font-medium text-white/90">
                    {{ t('records.descriptionImagePreview') }}
                  </DialogTitle>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="!canZoomOut"
                      :title="t('records.descriptionImageZoomOut')"
                      @click="zoomOutPreview"
                    >
                      <span class="sr-only">{{ t('records.descriptionImageZoomOut') }}</span>
                      <MagnifyingGlassMinusIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="min-w-[3.25rem] rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums text-white/80 hover:bg-white/10 hover:text-white"
                      :title="t('actions.reset')"
                      @click="resetPreviewZoom"
                    >
                      {{ previewZoomPercent }}
                    </button>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="!canZoomIn"
                      :title="t('records.descriptionImageZoomIn')"
                      @click="zoomInPreview"
                    >
                      <span class="sr-only">{{ t('records.descriptionImageZoomIn') }}</span>
                      <MagnifyingGlassPlusIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                      @click="emit('close')"
                    >
                      <span class="sr-only">{{ t('actions.close') }}</span>
                      <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  ref="previewScrollRef"
                  class="min-h-0 flex-1 overflow-auto overscroll-contain"
                  @wheel.prevent="onPreviewWheel"
                >
                  <div class="flex min-h-full min-w-full items-center justify-center p-2">
                    <img
                      v-if="src"
                      :src="src"
                      :alt="t('records.descriptionImagePreview')"
                      class="block max-w-none rounded-lg object-contain select-none"
                      :style="previewImageStyle"
                      draggable="false"
                      @click.stop
                      @load="onPreviewImageLoad"
                    >
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';

const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.25;

const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const previewZoom = ref(1);
const previewBaseWidth = ref(0);
const previewScrollRef = ref(null);

const previewZoomPercent = computed(() => `${Math.round(previewZoom.value * 100)}%`);
const canZoomIn = computed(() => previewZoom.value < PREVIEW_ZOOM_MAX - 0.001);
const canZoomOut = computed(() => previewZoom.value > PREVIEW_ZOOM_MIN + 0.001);
const previewImageStyle = computed(() => {
  if (!previewBaseWidth.value) {
    return { maxHeight: '75vh', width: 'auto', maxWidth: '100%' };
  }
  return {
    width: `${previewBaseWidth.value * previewZoom.value}px`,
    height: 'auto',
    maxWidth: 'none',
    maxHeight: 'none'
  };
});

watch(
  () => [props.open, props.src],
  () => {
    previewZoom.value = 1;
    previewBaseWidth.value = 0;
  }
);

const clampPreviewZoom = (value) =>
  Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value));

const applyPreviewZoom = async (nextZoom, anchor) => {
  const el = previewScrollRef.value;
  const prev = previewZoom.value;
  const clamped = clampPreviewZoom(nextZoom);
  if (Math.abs(clamped - prev) < 0.0001) return;

  let ratio = 1;
  let anchorX = 0;
  let anchorY = 0;
  if (el) {
    const rect = el.getBoundingClientRect();
    const clientX = Number.isFinite(anchor?.clientX) ? anchor.clientX : rect.left + rect.width / 2;
    const clientY = Number.isFinite(anchor?.clientY) ? anchor.clientY : rect.top + rect.height / 2;
    anchorX = clientX - rect.left + el.scrollLeft;
    anchorY = clientY - rect.top + el.scrollTop;
    ratio = clamped / prev;
  }

  previewZoom.value = clamped;
  await nextTick();

  if (!el || !Number.isFinite(ratio) || ratio === 0) return;
  const rect = el.getBoundingClientRect();
  const clientX = Number.isFinite(anchor?.clientX) ? anchor.clientX : rect.left + rect.width / 2;
  const clientY = Number.isFinite(anchor?.clientY) ? anchor.clientY : rect.top + rect.height / 2;
  el.scrollLeft = anchorX * ratio - (clientX - rect.left);
  el.scrollTop = anchorY * ratio - (clientY - rect.top);
};

const resetPreviewZoom = () => {
  void applyPreviewZoom(1);
};

const zoomInPreview = () => {
  void applyPreviewZoom(previewZoom.value + PREVIEW_ZOOM_STEP);
};

const zoomOutPreview = () => {
  void applyPreviewZoom(previewZoom.value - PREVIEW_ZOOM_STEP);
};

const onPreviewWheel = (event) => {
  const factor = Math.exp(-event.deltaY * 0.0018);
  void applyPreviewZoom(previewZoom.value * factor, event);
};

const onPreviewImageLoad = (event) => {
  const img = event?.target;
  if (!(img instanceof HTMLImageElement)) return;
  const scroller = previewScrollRef.value;
  const maxW = Math.max(240, (scroller?.clientWidth || window.innerWidth) - 32);
  const maxH = Math.max(240, (scroller?.clientHeight || window.innerHeight * 0.75) - 16);
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  const fit = Math.min(maxW / naturalW, maxH / naturalH, 1);
  previewBaseWidth.value = Math.max(1, naturalW * fit);
  previewZoom.value = 1;
};
</script>
