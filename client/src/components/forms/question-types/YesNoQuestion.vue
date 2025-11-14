<template>
  <div class="flex gap-4">
    <label class="inline-flex items-center">
      <input
        type="radio"
        :name="question.questionId"
        value="Yes"
        :checked="value === 'Yes'"
        @change="$emit('update', 'Yes')"
        :required="question.mandatory"
        class="form-radio text-brand-600 focus:ring-brand-500"
      />
      <span class="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
    </label>
    <label class="inline-flex items-center">
      <input
        type="radio"
        :name="question.questionId"
        value="No"
        :checked="value === 'No'"
        @change="$emit('update', 'No')"
        :required="question.mandatory"
        class="form-radio text-brand-600 focus:ring-brand-500"
      />
      <span class="ml-2 text-gray-700 dark:text-gray-300">No</span>
    </label>
  </div>
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

