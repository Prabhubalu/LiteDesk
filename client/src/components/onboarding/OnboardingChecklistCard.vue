<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  titleKey: {
    type: String,
    default: 'onboarding.checklistTitle'
  },
  steps: {
    type: Array,
    default: () => []
  },
  progress: {
    type: Object,
    default: () => ({ completed: 0, total: 0 })
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();
const router = useRouter();

const progressLabel = computed(() => t('onboarding.progressLabel', {
  completed: props.progress.completed,
  total: props.progress.total
}));

const isDone = (step) => step.status === 'completed' || step.status === 'skipped';

const openStep = (step) => {
  if (step.route) {
    router.push(step.route);
  }
};
</script>

<template>
  <section
    v-if="steps.length"
    class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm"
  >
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ t(titleKey) }}
      </h2>
      <span class="text-xs text-gray-500 dark:text-gray-400">{{ progressLabel }}</span>
    </div>
    <ul class="space-y-2">
      <li
        v-for="step in steps"
        :key="step.key"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
          :disabled="loading || !step.route"
          @click="openStep(step)"
        >
          <CheckCircleIcon
            class="h-5 w-5 flex-shrink-0"
            :class="isDone(step) ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'"
          />
          <span
            class="text-sm"
            :class="isDone(step) ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-white'"
          >
            {{ t(step.labelKey) }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
