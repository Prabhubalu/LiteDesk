<template>
  <span :class="badgeClass">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  level: { type: String, default: 'low' }
});

const normalized = computed(() => String(props.level || 'low').toLowerCase());
const label = computed(() => {
  if (normalized.value === 'high') return 'High risk';
  if (normalized.value === 'medium') return 'Medium risk';
  return 'Low risk';
});

const badgeClass = computed(() => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  if (normalized.value === 'high') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200`;
  if (normalized.value === 'medium') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200`;
  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200`;
});
</script>
