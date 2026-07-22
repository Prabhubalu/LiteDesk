<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import { CheckCircleIcon as CheckCircleOutlineIcon } from '@heroicons/vue/24/outline';
import { PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS } from '@/utils/platformHomeLayout';

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
    class="rounded-2xl border border-neutral-900/[0.06] bg-white dark:border-white/[0.08] dark:bg-neutral-800/55"
  >
    <div
      :class="[
        'flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5',
        PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS
      ]"
    >
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
        {{ t(titleKey) }}
      </h2>
      <span class="text-xs text-neutral-500 dark:text-neutral-400">{{ progressLabel }}</span>
    </div>
    <ul class="flex flex-col px-1.5 py-1.5">
      <li
        v-for="step in steps"
        :key="step.key"
      >
        <button
          type="button"
          class="group flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-neutral-800/60"
          :disabled="loading || !step.route"
          @click="openStep(step)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="isDone(step)
              ? 'bg-success-50 text-success-600 dark:bg-success-900/40 dark:text-success-300'
              : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'"
          >
            <CheckCircleIcon
              v-if="isDone(step)"
              class="h-4 w-4"
            />
            <CheckCircleOutlineIcon
              v-else
              class="h-4 w-4"
            />
          </span>
          <span
            class="min-w-0 flex-1 truncate text-sm font-medium"
            :class="isDone(step)
              ? 'text-neutral-500 dark:text-neutral-400'
              : 'text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400'"
          >
            {{ t(step.labelKey) }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
