<template>
  <label class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
    <span>
      <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ title }}</span>
      <span v-if="description" class="block text-xs text-gray-500 dark:text-gray-400">{{ description }}</span>
    </span>
    <span class="relative inline-flex h-6 w-11 shrink-0">
      <input :checked="modelValue" type="checkbox" class="peer sr-only" @change="$emit('update:modelValue', $event.target.checked)" />
      <span class="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-indigo-600 dark:bg-gray-700" />
      <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  </label>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  modelValue: { type: Boolean, default: false }
});

defineEmits(['update:modelValue']);
</script>
