<template>
  <div class="mb-3 flex items-center gap-3">
    <span class="text-sm text-gray-500 dark:text-gray-400">{{ count }} {{ count === 1 ? 'reply' : 'replies' }}</span>
    <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
defineProps({
  count: { type: Number, default: 0 }
});
</script>
