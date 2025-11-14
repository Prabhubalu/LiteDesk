<template>
  <select
    :value="value"
    @change="$emit('update', $event.target.value)"
    :required="question.mandatory"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-brand-500 focus:border-brand-500"
  >
    <option value="" disabled>Select an option</option>
    <option v-for="option in question.options" :key="option" :value="option">
      {{ option }}
    </option>
  </select>
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

