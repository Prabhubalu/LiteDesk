<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-visible">
    <slot></slot>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
// SurfaceCard - Generic card container for Surface layers
// No props needed - pure container component
</script>

