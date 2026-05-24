<template>
  <button
    :disabled="disabled"
    :type="type"
    :class="[
      'px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 min-h-[40px]',
      disabled
        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        : variantClasses
    ]"
    @click="$emit('click', $event)"
  >
    <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <svg v-else-if="icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'primary', // 'primary', 'secondary', 'success', 'warning', 'danger'
    validator: (value) => ['primary', 'secondary', 'success', 'warning', 'danger'].includes(value)
  },
  icon: {
    type: String,
    default: null // Icon path for SVG
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  }
});

const { t } = useI18n();

defineEmits(['click']);

// Icon paths
const iconPaths = {
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  convert: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  save: 'M5 13l4 4L19 7',
  cancel: 'M6 18L18 6M6 6l12 12'
};

const iconPath = computed(() => {
  if (!props.icon) return null;
  return iconPaths[props.icon] || null;
});

const variantClasses = computed(() => {
  const classes = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white border-2 border-gray-900 dark:border-gray-500',
    success: 'bg-success-600 hover:bg-success-700 text-white',
    warning: 'bg-warning-600 hover:bg-warning-700 text-white',
    danger: 'bg-danger-600 hover:bg-danger-700 text-white'
  };
  return classes[props.variant] || classes.primary;
});
</script>

