<template>
  <section :class="['overflow-hidden', PLATFORM_HOME_CARD_CLASS, 'portal-dashboard-enter']">
    <div :class="['flex items-start justify-between gap-3 px-4 py-3 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
      <div>
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
          {{ title }}
        </h2>
        <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {{ progressLabel }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        @click="$emit('dismiss')"
      >
        {{ t('cases.portalDashboardChecklistDismiss') }}
      </button>
    </div>

    <ul class="divide-y divide-neutral-100 dark:divide-white/[0.06]">
      <li v-for="step in steps" :key="step.id">
        <component
          :is="step.route ? 'router-link' : 'div'"
          :to="step.route || undefined"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5"
          :class="step.route && !step.completed ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60' : ''"
          @click="step.route && !step.completed ? $emit('step-click', step.id) : undefined"
        >
          <CheckCircleIcon
            class="h-5 w-5 shrink-0"
            :class="step.completed
              ? 'text-success-500 dark:text-success-400'
              : 'text-neutral-300 dark:text-neutral-600'"
          />
          <span
            class="min-w-0 flex-1 text-sm"
            :class="step.completed
              ? 'text-neutral-500 line-through dark:text-neutral-400'
              : 'font-medium text-neutral-900 dark:text-white'"
          >
            {{ step.label }}
          </span>
          <ArrowRightIcon
            v-if="step.route && !step.completed"
            class="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600"
          />
        </component>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowRightIcon } from '@heroicons/vue/24/outline';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  steps: {
    type: Array,
    default: () => []
  }
});

defineEmits(['dismiss', 'step-click']);

const { t } = useI18n();

const progressLabel = computed(() => {
  const completed = props.steps.filter((step) => step.completed).length;
  return t('cases.portalDashboardChecklistProgress', {
    completed,
    total: props.steps.length
  });
});
</script>
