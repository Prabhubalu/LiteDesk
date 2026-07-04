<template>
  <nav :aria-label="t('analytics.builderStepperLabel')" class="w-full">
    <ol class="flex items-center">
      <li
        v-for="(item, idx) in items"
        :key="item.id"
        class="flex flex-1 items-center last:flex-none"
      >
        <button
          type="button"
          class="group flex min-w-0 items-center gap-2"
          :disabled="idx > currentStep"
          @click="idx < currentStep ? $emit('go-to', idx) : undefined"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all"
            :class="stepCircleClass(idx)"
          >
            <CheckIcon v-if="idx < currentStep" class="h-3 w-3" aria-hidden="true" />
            <span v-else>{{ idx + 1 }}</span>
          </span>
          <span
            class="hidden truncate text-xs font-medium lg:block"
            :class="
              idx === currentStep
                ? 'text-indigo-600 dark:text-indigo-400'
                : idx < currentStep
                  ? 'text-zinc-700 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
            "
          >
            {{ item.label }}
          </span>
        </button>
        <div
          v-if="idx < items.length - 1"
          class="mx-1.5 h-px min-w-[0.5rem] flex-1 transition-colors"
          :class="idx < currentStep ? 'bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-800'"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { CheckIcon } from '@heroicons/vue/24/solid';

const props = defineProps<{
  items: Array<{ id: string; label: string }>;
  currentStep: number;
}>();

defineEmits<{
  (e: 'go-to', step: number): void;
}>();

const { t } = useI18n();

function stepCircleClass(idx: number) {
  if (idx < props.currentStep) {
    return 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30';
  }
  if (idx === props.currentStep) {
    return 'bg-indigo-600 text-white ring-2 ring-indigo-100 dark:ring-indigo-500/20';
  }
  return 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500';
}
</script>
