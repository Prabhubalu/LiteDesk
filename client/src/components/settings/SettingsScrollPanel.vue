<template>
  <div class="settings-scroll-panel flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      v-if="$slots.header || $slots.tabs"
      class="settings-scroll-panel__sticky-header sticky top-0 z-10 shrink-0 border-b border-neutral-200/80 bg-white/95 pb-4 backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95"
    >
      <div v-if="$slots.header" class="settings-scroll-panel__header">
        <slot name="header" />
      </div>
      <div v-if="$slots.tabs" :class="$slots.header ? 'mt-4' : ''">
        <slot name="tabs" />
      </div>
    </div>
    <div
      ref="contentRef"
      class="settings-scroll-panel__body min-h-0 min-w-0 flex-1"
      :class="[
        embed
          ? 'flex flex-col overflow-hidden'
          : 'overflow-y-auto overscroll-contain',
        $slots.header || $slots.tabs ? SETTINGS_HEADER_CONTENT_GAP_CLASS : '',
        contentClass,
        saveBarVisible ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''
      ]"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  SETTINGS_HEADER_CONTENT_GAP_CLASS,
  SETTINGS_SAVE_BAR_CONTENT_CLASS
} from '@/components/settings/settingsSaveBar';

defineProps({
  contentClass: {
    type: [String, Array, Object],
    default: ''
  },
  /** When true, body does not scroll; nested children manage their own scroll regions. */
  embed: {
    type: Boolean,
    default: false
  },
  saveBarVisible: {
    type: Boolean,
    default: false
  }
});

const contentRef = ref(null);
defineExpose({ contentRef, SETTINGS_SAVE_BAR_CONTENT_CLASS });
</script>

<style scoped>
.settings-scroll-panel__header :deep(h1),
.settings-scroll-panel__header :deep(h2) {
  font-size: var(--font-size-page-title);
  line-height: var(--line-height-page-title);
  font-weight: var(--font-weight-page-title);
  color: var(--color-neutral-900);
}

.settings-scroll-panel__header :deep(h1 + p),
.settings-scroll-panel__header :deep(h2 + p),
.settings-scroll-panel__header :deep(.settings-page-subtitle) {
  margin-top: 0.25rem;
  font-size: var(--font-size-helper);
  line-height: var(--line-height-helper);
  font-weight: var(--font-weight-helper);
  color: var(--color-neutral-600);
}

.settings-scroll-panel__header :deep(h3) {
  font-size: var(--font-size-section-title);
  line-height: var(--line-height-section-title);
  font-weight: var(--font-weight-section-title);
  color: var(--color-neutral-900);
}

.dark .settings-scroll-panel__header :deep(h1),
.dark .settings-scroll-panel__header :deep(h2),
.dark .settings-scroll-panel__header :deep(h3) {
  color: var(--color-neutral-100);
}

.dark .settings-scroll-panel__header :deep(h1 + p),
.dark .settings-scroll-panel__header :deep(h2 + p),
.dark .settings-scroll-panel__header :deep(.settings-page-subtitle) {
  color: var(--color-neutral-400);
}
</style>
