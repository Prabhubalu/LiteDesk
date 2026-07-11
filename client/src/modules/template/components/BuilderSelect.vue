<template>
  <HeadlessSelect
    :model-value="modelValue"
    :options="options"
    :option-groups="optionGroups"
    :placeholder="placeholder"
    :allow-empty="allowEmpty"
    :empty-label="emptyLabel"
    :empty-value="emptyValue"
    :disabled="disabled"
    teleport
    :teleport-match-width="teleportMatchWidth"
    :teleport-min-width-px="teleportMinWidthPx"
    :teleport-align="teleportAlign"
    :truncate-options="truncateOptions"
    :truncate-button-label="truncateButtonLabel"
    :button-class="[ui.input, '!flex !h-8 !items-center !py-0 text-sm leading-5', buttonClass]"
    :options-class="optionsClass"
    :options-attrs="optionsAttrs"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup>
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  modelValue: { type: [String, Number, null], default: null },
  options: { type: Array, default: () => [] },
  optionGroups: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: false },
  emptyLabel: { type: String, default: '—' },
  emptyValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  buttonClass: { type: [String, Array, Object], default: '' },
  optionsClass: { type: [String, Array, Object], default: 'z-[10060]' },
  optionsAttrs: { type: Object, default: () => ({}) },
  /** Inspector side panels: grow menu to labels instead of matching narrow trigger. */
  teleportMatchWidth: { type: Boolean, default: false },
  teleportMinWidthPx: { type: Number, default: 0 },
  teleportAlign: {
    type: String,
    default: 'end',
    validator: (value) => value === 'start' || value === 'end',
  },
  truncateOptions: { type: Boolean, default: false },
  truncateButtonLabel: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue']);

const ui = useBuilderUi();
</script>
