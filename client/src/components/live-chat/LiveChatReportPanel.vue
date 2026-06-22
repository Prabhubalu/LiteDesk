<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
});
</script>
