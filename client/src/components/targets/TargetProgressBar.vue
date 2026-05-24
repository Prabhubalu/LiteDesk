<template>
  <div class="space-y-1.5">
    <div v-if="showLabels" class="flex items-baseline justify-between gap-2 text-sm">
      <span class="text-gray-600 dark:text-gray-400">{{ achievedLabel }}</span>
      <span class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ percent }}%</span>
    </div>
    <div
      class="overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/80"
      :class="size === 'lg' ? 'h-3' : 'h-2'"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full rounded-full transition-all duration-500 ease-out"
        :class="barColorClass"
        :style="{ width: barWidth }"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { progressBarWidth, targetProgressPercent } from '@/utils/targetDisplayUtils';

const props = defineProps({
  target: { type: Object, required: true },
  size: { type: String, default: 'md' },
  showLabels: { type: Boolean, default: true },
  achievedLabel: { type: String, default: '' },
});

const { t } = useI18n();

const percent = computed(() => targetProgressPercent(props.target));

const barWidth = computed(() => progressBarWidth(percent.value));

const barColorClass = computed(() => {
  const s = props.target?.status;
  if (s === 'overachieved') return 'bg-violet-500';
  if (s === 'achieved') return 'bg-emerald-500';
  if (s === 'at_risk') return 'bg-amber-500';
  return 'bg-indigo-500';
});
</script>
