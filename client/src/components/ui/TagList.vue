<template>
  <div v-if="tags && tags.length > 0" class="flex flex-wrap gap-2">
    <span
      v-for="(tag, index) in tags"
      :key="index"
      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    >
      {{ tag }}
    </span>
  </div>
  <span v-else class="text-sm text-gray-400 dark:text-gray-500">—</span>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
defineProps({
  tags: {
    type: Array,
    default: () => []
  }
});
</script>

