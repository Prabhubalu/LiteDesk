<template>
  <input
    :type="question.type === 'Email' ? 'email' : question.type === 'Number' ? 'number' : 'text'"
    :value="value"
    @input="$emit('update', $event.target.value)"
    :required="question.mandatory"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-brand-500 focus:border-brand-500"
    :placeholder="question.type === 'Email' ? 'email@example.com' : 'Enter your answer'"
  />
</template>

<script setup>
defineProps({
  question: {
    type: Object,
    required: true
  },
  value: {
    type: [String, Number],
    default: ''
  }
});

defineEmits(['update']);
</script>

