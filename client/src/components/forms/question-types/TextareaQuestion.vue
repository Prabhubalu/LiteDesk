<template>
  <textarea
    :value="value"
    @input="$emit('update', $event.target.value)"
    :required="question.mandatory"
    rows="4"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-brand-500 focus:border-brand-500"
    placeholder="Enter your answer"
  ></textarea>
</template>

<script setup>
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

