<template>
  <div class="flex flex-col h-full w-full min-h-0">
    <div class="flex items-center justify-between bg-white dark:bg-gray-800 h-7 mb-2">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
      <div class="flex items-center gap-2 ld-hover-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="flex-1 min-h-0 overflow-auto">
      <slot />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: { type: String, required: true }
});
</script>


