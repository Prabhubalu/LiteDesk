<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border-2 overflow-hidden" :class="borderClass">
    <div class="px-6 py-4">
      <div class="flex items-start justify-between gap-4">
        <!-- Left: Severity + Message -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-2">
            <SeverityIndicator :severity="severity" :label="severityLabel" />
            <span v-if="context" class="text-xs text-gray-500 dark:text-gray-400">
              {{ context }}
            </span>
          </div>
          <p class="text-sm text-gray-900 dark:text-white leading-relaxed">
            {{ message }}
          </p>
        </div>

        <!-- Right: Action -->
        <div class="flex-shrink-0">
          <slot name="action">
            <SuggestedActionLink
              v-if="action"
              :label="action.label"
              :href="action.href"
              :variant="actionVariant"
              @click="action.handler && action.handler()"
            />
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import SeverityIndicator from './SeverityIndicator.vue';
import SuggestedActionLink from './SuggestedActionLink.vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  severity: {
    type: String,
    required: true,
    validator: (value) => ['critical', 'warning', 'info'].includes(value)
  },
  message: {
    type: String,
    required: true
  },
  context: {
    type: String,
    default: ''
  },
  action: {
    type: Object,
    default: null
  }
});

const severityLabel = computed(() => {
  const labels = {
    critical: t('states.severityCritical'),
    warning: t('states.severityWarning'),
    info: t('states.severityInfo'),
  };
  return labels[props.severity] || '';
});

const borderClass = computed(() => {
  const classes = {
    critical: 'border-danger-200 dark:border-danger-800',
    warning: 'border-warning-200 dark:border-warning-800',
    info: 'border-info-200 dark:border-info-800'
  };
  return classes[props.severity] || 'border-gray-200 dark:border-gray-700';
});

const actionVariant = computed(() => {
  const variants = {
    critical: 'danger',
    warning: 'warning',
    info: 'primary'
  };
  return variants[props.severity] || 'primary';
});
</script>

