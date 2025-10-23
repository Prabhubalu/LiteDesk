<template>
  <span :class="['badge', variantClass]">
    {{ value }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: {
    type: [String, Number],
    default: ''
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'success', 'warning', 'danger', 'info', 'primary'].includes(value)
  },
  // Auto variant based on value
  variantMap: {
    type: Object,
    default: () => ({})
  }
});

const variantClass = computed(() => {
  // Check if there's a variant mapping
  if (props.variantMap[props.value]) {
    return `badge-${props.variantMap[props.value]}`;
  }
  return `badge-${props.variant}`;
});
</script>

<style scoped>
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-default {
  @apply bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300;
}

.badge-primary {
  @apply bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300;
}

.badge-success {
  @apply bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300;
}

.badge-warning {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300;
}

.badge-danger {
  @apply bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300;
}

.badge-info {
  @apply bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300;
}
</style>

