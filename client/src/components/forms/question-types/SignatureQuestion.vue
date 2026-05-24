<template>
  <SignaturePad
    :model-value="value"
    @update:model-value="emit('update', $event)"
    :label="question.questionText"
    :required="question.mandatory"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import SignaturePad from '../SignaturePad.vue';

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

const { t } = useI18n();
</script>
