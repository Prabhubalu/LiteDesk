<template>
  <div
    :class="[
      'mb-6 sticky z-10 border-b transition-[padding,background-color,border-color,backdrop-filter] duration-200 ease-out',
      embed ? 'top-0 py-2 lg:py-4 lg:mb-0 mb-0' : 'top-0 lg:-top-6',
      sticky
        ? 'border-b border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur py-4'
        : 'border-b border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur py-4 lg:border-transparent lg:bg-transparent lg:shadow-none lg:py-0'
    ]"
  >
    <div class="flex items-center gap-3">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
defineProps({
  /** When true, the title row is in "sticky" state (scrolled): show border and background. */
  sticky: { type: Boolean, default: false },
  /** When true, use embed layout (e.g. different top/padding for embedded record view). */
  embed: { type: Boolean, default: false }
});
</script>
