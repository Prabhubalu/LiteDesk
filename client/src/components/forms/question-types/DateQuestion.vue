<template>
  <DatePicker
    :model-value="value"
    :input-class="[
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer',
    ].join(' ')"
    @update:model-value="$emit('update', $event)"
  />
</template>

<script setup>
import DatePicker from '@/components/common/DatePicker.vue';

defineProps({
  question: {
    type: Object,
    required: true
  },
  value: {
    type: String,
    default: ''
  }
});

defineEmits(['update']);
</script>
