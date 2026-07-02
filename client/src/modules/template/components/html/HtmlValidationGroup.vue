<template>
  <section class="space-y-2">
    <h3
      class="text-xs font-semibold uppercase tracking-wide"
      :class="toneClass"
    >
      {{ title }}
    </h3>
    <ul v-if="items.length" class="space-y-2">
      <li
        v-for="(item, index) in items"
        :key="`${item.code}-${index}`"
        class="rounded-lg border px-3 py-2 text-sm"
        :class="itemClass"
      >
        <p class="font-medium">{{ item.message }}</p>
        <p v-if="item.detail" class="mt-1 text-xs opacity-80">{{ item.detail }}</p>
      </li>
    </ul>
    <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ emptyLabel }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  tone: { type: String, default: 'info' },
  emptyLabel: { type: String, default: '' }
});

const toneClass = computed(() => {
  if (props.tone === 'error') return 'text-red-600 dark:text-red-400';
  if (props.tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-600 dark:text-blue-400';
});

const itemClass = computed(() => {
  if (props.tone === 'error') {
    return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-100';
  }
  if (props.tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100';
});
</script>
