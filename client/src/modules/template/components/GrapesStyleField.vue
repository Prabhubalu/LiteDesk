<template>
  <div>
    <label class="mb-1 block text-xs" :class="ui.textMuted">{{ label }}</label>
    <input
      :value="value"
      type="text"
      :class="ui.input"
      :placeholder="placeholder"
      @change="emit('change', $event.target.value)"
    />
  </div>
</template>

<script setup>
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  label: { type: String, required: true },
  value: { type: String, default: '' },
  placeholder: { type: String, default: '' }
});

const emit = defineEmits(['change']);
const ui = useBuilderUi();
</script>
