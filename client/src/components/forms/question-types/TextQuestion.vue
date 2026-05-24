<template>
  <input
    :type="question.type === 'Email' ? 'email' : question.type === 'Number' ? 'number' : 'text'"
    :value="value"
    @input="$emit('update', $event.target.value)"
    :required="question.mandatory"
    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
    :placeholder="placeholder"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
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

const { t } = useI18n();

const placeholder = computed(() =>
  props.question.type === 'Email' ? t('forms.emailExamplePh') : t('forms.textAnswerPh')
);
</script>
