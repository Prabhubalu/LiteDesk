<template>
  <Switch
    as="button"
    type="button"
    :disabled="disabled"
    :model-value="resolvedChecked"
    role="switch"
    :aria-checked="String(resolvedChecked)"
    data-headless-switch="true"
    :class="[
      'inline-flex items-center justify-start rounded-full p-0.5 overflow-hidden flex-shrink-0 transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900',
      resolvedChecked ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      sizeClass,
      switchClass
    ]"
    @update:modelValue="handleToggle"
    @focus="(e) => emit('focus', e)"
    @blur="(e) => emit('blur', e)"
    @click="(e) => emit('click', e)"
  >
    <span
      :class="[
        'block flex-shrink-0 self-center rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200',
        thumbClass,
        resolvedChecked ? thumbOnClass : thumbOffClass
      ]"
    />
  </Switch>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { Switch } from '@headlessui/vue';

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
  size: {
    type: String,
    default: 'md'
  },
  switchClass: {
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
  if (props.size === 'sm') return 'h-4 w-8';
  if (props.size === 'lg') return 'h-7 w-12';
  return 'h-5 w-9';
});

const thumbClass = computed(() => {
  if (props.size === 'sm') return 'h-3 w-3';
  if (props.size === 'lg') return 'h-6 w-6';
  return 'h-4 w-4';
});

const thumbOnClass = computed(() => {
  if (props.size === 'sm') return 'translate-x-4';
  if (props.size === 'lg') return 'translate-x-5';
  return 'translate-x-4';
});

const thumbOffClass = computed(() => 'translate-x-0');

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
