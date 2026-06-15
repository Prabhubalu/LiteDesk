<template>
  <PlatformHomeSection
    analytics-id="today"
    :title="t('platform.platformHomeTodayTitle')"
  >
    <p class="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
      {{ focusText }}
    </p>

    <div v-if="signals.length" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="signal in signals"
        :key="signal.id"
        type="button"
        class="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors"
        :class="[PLATFORM_HOME_FLAT_CHIP_CLASS, chipClass(signal.severity)]"
        @click="$emit('signal-select', signal)"
      >
        <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dotClass(signal.severity)" />
        <span class="truncate">{{ signal.text }}</span>
      </button>
    </div>
  </PlatformHomeSection>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import PlatformHomeSection from '@/components/platform/PlatformHomeSection.vue';
import { PLATFORM_HOME_FLAT_CHIP_CLASS } from '@/utils/platformHomeLayout';

defineProps({
  focusText: {
    type: String,
    required: true
  },
  signals: {
    type: Array,
    default: () => []
  }
});

defineEmits(['signal-select']);

const { t } = useI18n();

function chipClass(severity) {
  switch (severity) {
    case 'danger':
      return [
        'border-danger-200/80 bg-danger-50 text-danger-900 hover:bg-danger-100',
        'dark:border-danger-600 dark:bg-danger-900/35 dark:text-danger-200 dark:hover:bg-danger-900/55'
      ].join(' ');
    case 'warning':
      return [
        'border-warning-200/80 bg-warning-50 text-warning-900 hover:bg-warning-100',
        'dark:border-warning-600 dark:bg-warning-900/35 dark:text-warning-200 dark:hover:bg-warning-900/55'
      ].join(' ');
    default:
      return [
        'border-secondary-200/80 bg-secondary-50 text-secondary-900 hover:bg-secondary-100',
        'dark:border-secondary-600 dark:bg-secondary-900/35 dark:text-secondary-200 dark:hover:bg-secondary-900/55'
      ].join(' ');
  }
}

function dotClass(severity) {
  switch (severity) {
    case 'danger':
      return 'bg-danger-500 dark:bg-danger-400';
    case 'warning':
      return 'bg-warning-500 dark:bg-warning-400';
    default:
      return 'bg-secondary-500 dark:bg-secondary-400';
  }
}
</script>
