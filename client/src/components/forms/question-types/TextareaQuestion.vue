<template>
  <textarea
    :value="value"
    @input="$emit('update', $event.target.value)"
    :required="question.mandatory"
    rows="4"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
    :placeholder="t('forms.textAnswerPh')"
  ></textarea>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();
</script>
