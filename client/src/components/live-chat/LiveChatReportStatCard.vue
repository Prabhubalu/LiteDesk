<template>
  <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
    <p class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ value }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
});
</script>
