<template>
  <div class="space-y-4">
    <div v-if="average != null" class="flex items-end gap-4">
      <div>
        <p class="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{{ average }}</p>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('forms.resultsSummaryAvgRating') }}
        </p>
      </div>
      <div class="flex gap-0.5 pb-1" aria-hidden="true">
        <svg
          v-for="star in 5"
          :key="star"
          class="h-6 w-6"
          :class="star <= Math.round(average) ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
    </div>

    <div class="space-y-2.5">
      <div
        v-for="row in distributionRows"
        :key="row.star"
        class="flex items-center gap-3"
      >
        <div class="flex w-16 shrink-0 items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300">
          <span>{{ row.star }}</span>
          <svg class="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/80">
          <div
            class="h-full rounded-full bg-amber-400 transition-all duration-700 ease-out dark:bg-amber-300"
            :style="{ width: `${Math.max(row.percentage, row.count > 0 ? 4 : 0)}%` }"
          />
        </div>
        <span class="w-12 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {{ row.count }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  average: { type: Number, default: null },
  distribution: { type: Array, default: () => [] }
});

const { t } = useI18n();

const distributionRows = computed(() =>
  [...(props.distribution || [])].sort((a, b) => b.star - a.star)
);
</script>
