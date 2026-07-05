<template>
  <div class="pointer-events-none absolute inset-0 z-[1]" :style="overlayStyle" aria-hidden="true">
    <div
      class="absolute inset-x-0 top-0 bg-neutral-500/10 dark:bg-neutral-900/25"
      :style="{ height: `${margins.top}px` }"
    />
    <div
      class="absolute inset-x-0 bottom-0 bg-neutral-500/10 dark:bg-neutral-900/25"
      :style="{ height: `${margins.bottom}px` }"
    />
    <div
      class="absolute left-0 bg-neutral-500/10 dark:bg-neutral-900/25"
      :style="{
        top: `${margins.top}px`,
        bottom: `${margins.bottom}px`,
        width: `${margins.left}px`
      }"
    />
    <div
      class="absolute right-0 bg-neutral-500/10 dark:bg-neutral-900/25"
      :style="{
        top: `${margins.top}px`,
        bottom: `${margins.bottom}px`,
        width: `${margins.right}px`
      }"
    />
    <div
      class="absolute rounded-sm border border-dashed border-primary-400/45 dark:border-primary-500/35"
      :style="contentAreaStyle"
    />
    <div
      class="absolute text-[10px] font-medium uppercase tracking-wide text-primary-500/70 dark:text-primary-400/70"
      :style="{ left: `${contentArea.x + 4}px`, top: `${Math.max(4, contentArea.y - 16)}px` }"
    >
      {{ t('templates.builderPrintAreaLabel') }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_PAGE_MARGINS_MM, resolveContentAreaPx, resolvePageMarginsPx } from '@/constants/contentPageSettings';

const props = defineProps({
  pageWidthPx: { type: Number, required: true },
  pageHeightPx: { type: Number, required: true },
  marginsMm: {
    type: Object,
    default: () => ({ ...DEFAULT_PAGE_MARGINS_MM })
  },
  zoom: { type: Number, default: 1 }
});

const { t } = useI18n();

const overlayStyle = computed(() => ({
  transform: `scale(${props.zoom})`,
  transformOrigin: 'top center'
}));

const margins = computed(() => resolvePageMarginsPx(props.marginsMm));

const contentArea = computed(() =>
  resolveContentAreaPx(props.pageWidthPx, props.pageHeightPx, margins.value)
);

const contentAreaStyle = computed(() => ({
  left: `${contentArea.value.x}px`,
  top: `${contentArea.value.y}px`,
  width: `${contentArea.value.width}px`,
  height: `${contentArea.value.height}px`
}));
</script>
