<template>
  <div class="space-y-3">
    <div
      v-for="(option, index) in normalizedOptions"
      :key="option.labelKey"
      class="group"
    >
      <div class="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span class="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">
          {{ option.displayLabel }}
        </span>
        <span class="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
          {{ t('forms.resultsSummaryChoiceCount', { count: option.count, percentage: option.percentage }) }}
        </span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/80">
        <div
          class="h-full rounded-full transition-all duration-700 ease-out"
          :class="barClass(index)"
          :style="{ width: `${Math.max(option.percentage, option.count > 0 ? 4 : 0)}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  options: { type: Array, default: () => [] }
});

const { t } = useI18n();

const BAR_CLASSES = [
  'bg-indigo-500 dark:bg-indigo-400',
  'bg-violet-500 dark:bg-violet-400',
  'bg-sky-500 dark:bg-sky-400',
  'bg-teal-500 dark:bg-teal-400',
  'bg-amber-500 dark:bg-amber-400',
  'bg-rose-500 dark:bg-rose-400'
];

const normalizedOptions = computed(() =>
  (props.options || []).map((option) => ({
    ...option,
    labelKey: option.label,
    displayLabel: option.label === '__other__'
      ? t('forms.resultsSummaryOtherOption')
      : option.label
  }))
);

function barClass(index) {
  return BAR_CLASSES[index % BAR_CLASSES.length];
}
</script>
