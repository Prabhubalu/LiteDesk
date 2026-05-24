<template>
  <a
    v-if="href"
    :href="href"
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
    :class="variantClasses"
    @click.prevent="handleClick"
  >
    <span>{{ label }}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </a>
  <button
    v-else
    type="button"
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
    :class="variantClasses"
    @click="handleClick"
  >
    <span>{{ label }}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
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
  href: {
    type: String,
    default: null
  },
  variant: {
    type: String,
    default: 'primary', // 'primary', 'secondary', 'danger', 'warning', 'info'
    validator: (value) => ['primary', 'secondary', 'danger', 'warning', 'info'].includes(value)
  }
});

const emit = defineEmits(['click']);

const { t } = useI18n();

const variantClasses = computed(() => {
  const classes = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    danger: 'bg-danger-600 hover:bg-danger-700 text-white',
    warning: 'bg-warning-600 hover:bg-warning-700 text-white',
    info: 'bg-info-600 hover:bg-info-700 text-white'
  };
  return classes[props.variant] || classes.primary;
});

const handleClick = (event) => {
  emit('click', event);
};
</script>

