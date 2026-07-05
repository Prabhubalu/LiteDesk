<template>
  <div :class="ui.segmentGroup" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :disabled="disabled"
      :class="[ui.segmentBtn, modelValue === option.value ? ui.segmentBtnActive : '']"
      :title="option.label"
      @click="emit('update:modelValue', option.value)"
    >
      <component v-if="option.icon" :is="option.icon" class="h-4 w-4" aria-hidden="true" />
      <span v-else class="text-[11px] font-medium">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  modelValue: { type: String, default: '' },
  options: {
    type: Array,
    default: () => []
  },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);
const ui = useBuilderUi();
</script>
