<template>
  <div class="relative min-w-0 flex-1">
    <MagnifyingGlassIcon
      class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      aria-hidden="true"
    />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      :class="INPUT_CLASS"
      @input="onInput"
    />
  </div>
</template>

<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { DETAILS_TAB_TOOLBAR_HEIGHT_CLASS, DETAILS_TAB_TOOLBAR_FOCUS_CLASS } from '@/components/record-page/detailsTabToolbar';

const INPUT_CLASS = [
  'block w-full rounded-md bg-gray-100 dark:bg-gray-700',
  'border border-gray-200/90 dark:border-gray-600/70',
  'pl-8 pr-3 py-0 text-xs leading-none text-gray-900 dark:text-white',
  'placeholder:text-gray-500 dark:placeholder:text-gray-500',
  DETAILS_TAB_TOOLBAR_FOCUS_CLASS,
  DETAILS_TAB_TOOLBAR_HEIGHT_CLASS,
].join(' ');

defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

function onInput(event) {
  emit('update:modelValue', event.target.value);
}
</script>
