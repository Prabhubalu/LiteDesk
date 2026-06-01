<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      v-if="$slots.header || $slots.tabs"
      class="sticky top-0 z-10 shrink-0 -mx-1 border-b border-gray-200 bg-white/95 px-1 pb-3 pt-1 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
    >
      <div v-if="$slots.header">
        <slot name="header" />
      </div>
      <div v-if="$slots.tabs" :class="$slots.header ? 'mt-4' : ''">
        <slot name="tabs" />
      </div>
    </div>
    <div
      ref="contentRef"
      class="min-h-0 min-w-0 flex-1"
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
