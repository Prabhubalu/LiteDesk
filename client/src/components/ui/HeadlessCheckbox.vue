<template>
  <Switch
    as="button"
    type="button"
    :disabled="disabled"
    :model-value="resolvedChecked"
    role="checkbox"
    :aria-checked="indeterminate ? 'mixed' : String(resolvedChecked)"
    data-headless-checkbox="true"
    :class="[
      'inline-flex items-center justify-center transition-colors rounded border',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900',
      resolvedChecked || indeterminate
        ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
        : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-700',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      sizeClass,
      checkboxClass
    ]"
    @update:modelValue="handleToggle"
    @focus="(e) => emit('focus', e)"
    @blur="(e) => emit('blur', e)"
    @click="(e) => emit('click', e)"
  >
    <MinusIcon v-if="indeterminate" class="h-3 w-3" aria-hidden="true" />
    <CheckIcon v-else class="h-3 w-3" aria-hidden="true" />
  </Switch>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { Switch } from '@headlessui/vue';
import { CheckIcon, MinusIcon } from '@heroicons/vue/20/solid';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: undefined
  },
  checked: {
    type: Boolean,
    default: undefined
  },
  disabled: {
    type: Boolean,
    default: false
  },
  indeterminate: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md'
  },
  checkboxClass: {
    type: [String, Array, Object],
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur', 'click']);

const { t } = useI18n();

const resolvedChecked = computed(() => {
  if (typeof props.modelValue === 'boolean') return props.modelValue;
  if (typeof props.checked === 'boolean') return props.checked;
  return false;
});

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'h-3.5 w-3.5';
  if (props.size === 'lg') return 'h-5 w-5';
  return 'h-4 w-4';
});

function createChangeEvent(checked) {
  let defaultPrevented = false;
  return {
    type: 'change',
    bubbles: true,
    cancelable: true,
    defaultPrevented,
    target: { checked },
    currentTarget: { checked },
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    preventDefault: () => {
      defaultPrevented = true;
    }
  };
}

function handleToggle(nextChecked) {
  const value = Boolean(nextChecked);
  emit('update:modelValue', value);
  emit('change', createChangeEvent(value));
}
</script>
