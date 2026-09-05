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
          <div class="fixed inset-0 bg-black/85" aria-hidden="true" @click="emit('close')" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden p-3 sm:p-6">
          <div class="flex h-full min-h-full flex-col">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="relative flex h-full w-full flex-col outline-none">
                <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <DialogTitle class="truncate text-sm font-medium text-white/95">
                      {{ titleText }}
                    </DialogTitle>
                    <p
                      v-if="galleryCount > 1"
                      class="mt-0.5 text-xs tabular-nums text-white/60"
                    >
                      {{ t('internalChat.mediaPreviewCounter', { current: activeIndex + 1, total: galleryCount }) }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="!canZoomOut"
                      :title="t('records.descriptionImageZoomOut')"
                      @click="zoomOutPreview"
                    >
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
                      <MagnifyingGlassPlusIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <a
                      v-if="activeItem?.url"
                      :href="activeItem.url"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                      :title="t('cases.recordAttachmentDownload')"
                      download
                      @click.stop
                    >
                      <ArrowDownTrayIcon class="h-5 w-5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                      :aria-label="t('actions.close')"
                      @click="emit('close')"
                    >
                      <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div class="relative min-h-0 flex-1">
                  <button
                    v-if="galleryCount > 1"
                    type="button"
                    class="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 sm:left-2"
                    :title="t('internalChat.mediaPreviewPrev')"
                    @click="goPrev"
                  >
                    <ChevronLeftIcon class="h-6 w-6" />
                  </button>
                  <button
                    v-if="galleryCount > 1"
                    type="button"
                    class="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 sm:right-2"
                    :title="t('internalChat.mediaPreviewNext')"
                    @click="goNext"
                  >
                    <ChevronRightIcon class="h-6 w-6" />
                  </button>

                  <div
                    ref="previewScrollRef"
                    class="h-full overflow-auto overscroll-contain"
                    @wheel.prevent="onPreviewWheel"
                  >
                    <div class="flex min-h-full min-w-full items-center justify-center p-2">
                      <img
                        v-if="activeItem?.url"
                        :key="activeItem.url"
                        :src="activeItem.url"
                        :alt="titleText"
                        class="block max-w-none rounded-lg object-contain select-none shadow-2xl"
                        :style="previewImageStyle"
                        draggable="false"
                        @click.stop
                        @load="onPreviewImageLoad"
                      >
                    </div>
                  </div>
                </div>

                <div
                  v-if="galleryCount > 1"
                  class="mt-3 flex shrink-0 justify-center gap-1.5 overflow-x-auto pb-1"
                >
                  <button
                    v-for="(item, idx) in items"
                    :key="`${item.url}-${idx}`"
                    type="button"
                    class="h-12 w-12 shrink-0 overflow-hidden rounded-md ring-2 transition"
                    :class="idx === activeIndex
                      ? 'ring-white'
                      : 'ring-transparent opacity-60 hover:opacity-100'"
                    @click="activeIndex = idx"
                  >
                    <img
                      :src="item.url"
                      :alt="item.fileName || ''"
                      class="h-full w-full object-cover"
                    >
                  </button>
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
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';

const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.25;

const props = defineProps({
  open: { type: Boolean, default: false },
  /** @type {{ url: string, fileName?: string, mimeType?: string }[]} */
  items: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const activeIndex = ref(0);
const previewZoom = ref(1);
const previewBaseWidth = ref(0);
const previewScrollRef = ref(null);

const galleryCount = computed(() => props.items.length);
const activeItem = computed(() => props.items[activeIndex.value] || null);
const titleText = computed(() => (
  activeItem.value?.fileName
  || t('internalChat.mediaPreviewTitle')
));
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
    maxHeight: 'none',
  };
});

watch(
  () => [props.open, props.startIndex, props.items],
  () => {
    if (!props.open) return;
    const max = Math.max(0, props.items.length - 1);
    activeIndex.value = Math.min(Math.max(0, Number(props.startIndex) || 0), max);
    previewZoom.value = 1;
    previewBaseWidth.value = 0;
  },
  { deep: true }
);

watch(activeIndex, () => {
  previewZoom.value = 1;
  previewBaseWidth.value = 0;
});

function clampPreviewZoom(value) {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value));
}

async function applyPreviewZoom(nextZoom, anchor) {
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
}

function resetPreviewZoom() {
  void applyPreviewZoom(1);
}

function zoomInPreview() {
  void applyPreviewZoom(previewZoom.value + PREVIEW_ZOOM_STEP);
}

function zoomOutPreview() {
  void applyPreviewZoom(previewZoom.value - PREVIEW_ZOOM_STEP);
}

function onPreviewWheel(event) {
  const factor = Math.exp(-event.deltaY * 0.0018);
  void applyPreviewZoom(previewZoom.value * factor, event);
}

function onPreviewImageLoad(event) {
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
}

function goPrev() {
  if (galleryCount.value <= 1) return;
  activeIndex.value = (activeIndex.value - 1 + galleryCount.value) % galleryCount.value;
}

function goNext() {
  if (galleryCount.value <= 1) return;
  activeIndex.value = (activeIndex.value + 1) % galleryCount.value;
}

watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === 'undefined') return;
    if (isOpen) {
      window.addEventListener('keydown', onWindowKeydown);
    } else {
      window.removeEventListener('keydown', onWindowKeydown);
    }
  }
);

function onWindowKeydown(event) {
  if (!props.open) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goPrev();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    goNext();
  }
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onWindowKeydown);
  }
});
</script>
