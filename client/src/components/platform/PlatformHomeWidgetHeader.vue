<script setup lang="ts">
import PlatformHomeWidgetHeaderDragPad from '@/components/platform/PlatformHomeWidgetHeaderDragPad.vue';
import { PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS } from '@/utils/platformHomeLayout';

defineProps<{
  title: string;
  divider?: boolean;
}>();
</script>

<template>
  <div
    :class="[
      'platform-home-widget-header flex items-stretch gap-2 px-4 py-2.5 sm:px-5',
      divider ? PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS : ''
    ]"
  >
    <h3 class="flex min-w-0 shrink items-center select-text truncate text-sm font-semibold text-neutral-900 dark:text-white">
      {{ title }}
    </h3>
    <PlatformHomeWidgetHeaderDragPad />
    <div v-if="$slots.actions" class="platform-home-widget-header-actions flex shrink-0 flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
