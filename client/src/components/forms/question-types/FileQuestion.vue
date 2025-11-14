<template>
  <div>
    <input
      :id="question.questionId"
      type="file"
      @change="handleFileChange"
      :required="question.mandatory"
      :multiple="question.attachmentAllowance"
      class="w-full text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 dark:file:bg-brand-900/30 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900/50"
    />
    <p v-if="value" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
      Selected: {{ value }}
    </p>
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

const emit = defineEmits(['update']);

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    // In a real application, you would upload this file to a storage service
    // and store the URL. For preview, we'll just store the file name.
    emit('update', file.name);
  }
};
</script>

