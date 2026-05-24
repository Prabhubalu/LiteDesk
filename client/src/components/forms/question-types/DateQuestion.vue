<template>
  <input
    type="date"
    :value="value"
    @input="$emit('update', $event.target.value)"
    @click="openDatePicker"
    :required="question.mandatory"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { openDatePicker } from '@/utils/dateUtils';

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

