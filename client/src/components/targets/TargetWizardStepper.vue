<template>
  <nav :aria-label="t('common.targetWizardStepperTargetCreationProgress')" class="w-full">
    <ol class="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0">
      <li
        v-for="(item, idx) in items"
        :key="item.id"
        class="relative flex flex-1 flex-col sm:min-w-0"
      >
        <div class="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:px-2 sm:text-center">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors"
            :class="circleClass(idx)"
          >
            <CheckIcon v-if="idx < currentStep" class="h-5 w-5 text-white" aria-hidden="true" />
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <div class="min-w-0 flex-1 pt-0.5 sm:pt-0">
            <p
              class="text-sm font-medium leading-tight"
              :class="idx === currentStep ? 'text-indigo-600 dark:text-indigo-400' : idx < currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ item.label }}
            </p>
            <p v-if="idx === currentStep && item.hint" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:hidden">
              {{ item.hint }}
            </p>
          </div>
        </div>
        <div
          v-if="idx < items.length - 1"
          class="ml-[1.125rem] h-4 w-px bg-gray-200 dark:bg-gray-600 sm:absolute sm:left-1/2 sm:top-9 sm:ml-0 sm:h-px sm:w-full sm:-translate-x-1/2"
          aria-hidden="true"
        />
      </li>
    </ol>
    <p v-if="currentHint" class="mt-4 hidden text-sm text-gray-600 dark:text-gray-400 sm:block">
      {{ currentHint }}
    </p>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { CheckIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  items: { type: Array, required: true },
  currentStep: { type: Number, required: true },
});

const { t } = useI18n();

const currentHint = computed(() => props.items[props.currentStep]?.hint || '');

function circleClass(idx) {
  if (idx < props.currentStep) {
    return 'border-indigo-600 bg-indigo-600';
  }
  if (idx === props.currentStep) {
    return 'border-indigo-600 bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400';
  }
  return 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800';
}
</script>
