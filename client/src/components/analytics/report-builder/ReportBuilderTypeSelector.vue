<template>
  <div>
    <p v-if="variant === 'cards'" :class="rbOverline" class="mb-2">{{ t('analytics.fieldType') }}</p>

    <RadioGroup
      v-if="variant === 'segment'"
      :model-value="modelValue"
      :class="[rbSegment, 'flex w-full']"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <RadioGroupOption
        v-for="option in options"
        :key="option.value"
        v-slot="{ checked }"
        :value="option.value"
        as="template"
      >
        <button
          type="button"
          class="flex-1 truncate text-center text-xs font-medium"
          :class="checked ? rbSegmentBtnActive : rbSegmentBtn"
        >
          {{ option.label }}
        </button>
      </RadioGroupOption>
    </RadioGroup>

    <RadioGroup
      v-else
      :model-value="modelValue"
      class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <RadioGroupOption
        v-for="option in options"
        :key="option.value"
        v-slot="{ checked }"
        :value="option.value"
        as="template"
      >
        <button
          type="button"
          class="rounded-xl border px-3 py-2.5 text-left transition-all"
          :class="
            checked
              ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-500/10'
              : 'border-zinc-200/80 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
          "
        >
          <span class="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ option.label }}</span>
          <span v-if="option.description" class="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
            {{ option.description }}
          </span>
        </button>
      </RadioGroupOption>
    </RadioGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';
import {
  rbOverline,
  rbSegment,
  rbSegmentBtn,
  rbSegmentBtnActive,
} from '@/components/analytics/report-builder/reportBuilderUi';

withDefaults(
  defineProps<{
    modelValue: string;
    variant?: 'cards' | 'segment';
  }>(),
  { variant: 'segment' },
);

defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const { t } = useI18n();

const options = computed(() => [
  {
    value: 'tabular',
    label: t('analytics.typeTabular'),
    description: t('analytics.builderTypeDesc_tabular'),
  },
  {
    value: 'summary',
    label: t('analytics.typeSummary'),
    description: t('analytics.builderTypeDesc_summary'),
  },
  {
    value: 'matrix',
    label: t('analytics.typeMatrix'),
    description: t('analytics.builderTypeDesc_matrix'),
  },
  {
    value: 'kpi',
    label: t('analytics.typeKpi'),
    description: t('analytics.builderTypeDesc_kpi'),
  },
]);
</script>
