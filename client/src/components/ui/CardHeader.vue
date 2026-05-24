<template>
  <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <!-- Icon -->
        <div v-if="icon" class="flex-shrink-0">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="iconBgClass">
            <span v-if="typeof icon === 'string'" class="text-lg">{{ icon }}</span>
            <component v-else :is="icon" class="w-5 h-5" :class="iconClass" />
          </div>
        </div>
        
        <!-- Title and Subtitle -->
        <div class="flex-1 min-w-0">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
            {{ title }}
          </h3>
          <p v-if="subtitle" class="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
            {{ subtitle }}
          </p>
        </div>
      </div>
      
      <!-- Actions Slot -->
      <div v-if="$slots.actions" class="flex items-center gap-2 flex-shrink-0 ml-4">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = defineProps({
  icon: {
    type: [String, Object],
    default: null
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  iconVariant: {
    type: String,
    default: 'default', // 'default', 'primary', 'secondary', 'success', 'warning', 'danger'
    validator: (value) => ['default', 'primary', 'secondary', 'success', 'warning', 'danger'].includes(value)
  }
});

const { t } = useI18n();

const iconBgClass = computed(() => {
  const classes = {
    default: 'bg-gray-100 dark:bg-gray-700',
    primary: 'bg-indigo-100 dark:bg-indigo-900/20',
    secondary: 'bg-secondary-100 dark:bg-secondary-900/20',
    success: 'bg-success-100 dark:bg-success-900/20',
    warning: 'bg-warning-100 dark:bg-warning-900/20',
    danger: 'bg-danger-100 dark:bg-danger-900/20'
  };
  return classes[props.iconVariant] || classes.default;
});

const iconClass = computed(() => {
  const classes = {
    default: 'text-gray-600 dark:text-gray-400',
    primary: 'text-indigo-600 dark:text-indigo-400',
    secondary: 'text-secondary-600 dark:text-secondary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400'
  };
  return classes[props.iconVariant] || classes.default;
});
</script>

