<template>
  <div class="flex items-center gap-2">
    <div class="flex-shrink-0">
      <div
        class="w-2 h-2 rounded-full"
        :class="severityClasses.bg"
      ></div>
    </div>
    <span
      v-if="label"
      class="text-xs font-medium uppercase tracking-wide"
      :class="severityClasses.text"
    >
      {{ label }}
    </span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = defineProps({
  severity: {
    type: String,
    required: true,
    validator: (value) => ['critical', 'warning', 'info'].includes(value)
  },
  label: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();

const severityClasses = computed(() => {
  const classes = {
    critical: {
      bg: 'bg-danger-500',
      text: 'text-danger-700 dark:text-danger-300'
    },
    warning: {
      bg: 'bg-warning-500',
      text: 'text-warning-700 dark:text-warning-300'
    },
    info: {
      bg: 'bg-info-500',
      text: 'text-info-700 dark:text-info-300'
    }
  };
  return classes[props.severity] || classes.info;
});
</script>

