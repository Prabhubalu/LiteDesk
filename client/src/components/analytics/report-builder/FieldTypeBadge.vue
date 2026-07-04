<template>
  <span
    class="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-semibold"
    :class="badgeClass"
  >
    {{ badgeText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ type?: string }>();

const normalizedType = computed(() => String(props.type || 'string').toLowerCase());

const badgeClass = computed(() => {
  if (['number', 'currency', 'integer', 'decimal', 'float', 'percent'].includes(normalizedType.value)) {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  }
  if (['date', 'datetime'].includes(normalizedType.value)) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
});

const badgeText = computed(() => {
  if (['number', 'currency', 'integer', 'decimal', 'float', 'percent'].includes(normalizedType.value)) {
    return '#';
  }
  if (['date', 'datetime'].includes(normalizedType.value)) {
    return 'D';
  }
  return 'A';
});
</script>
