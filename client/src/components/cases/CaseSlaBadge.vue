<template>
  <div
    v-if="cycle"
    class="inline-flex max-w-full flex-wrap items-center gap-1"
    :class="compact ? 'text-[11px]' : 'gap-2 text-xs'"
  >
    <span
      v-if="responseLabel"
      class="inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded-full border font-medium sm:max-w-none"
      :class="[responseClass, compact ? 'px-1.5 py-0.5' : 'gap-1 px-2 py-0.5']"
      :title="responseLabel"
    >
      <ClockIcon class="shrink-0" :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'" />
      <span class="truncate">{{ responseLabel }}</span>
    </span>
    <span
      v-if="resolutionLabel"
      class="inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded-full border font-medium sm:max-w-none"
      :class="[resolutionClass, compact ? 'px-1.5 py-0.5' : 'gap-1 px-2 py-0.5']"
      :title="resolutionLabel"
    >
      <FlagIcon class="shrink-0" :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'" />
      <span class="truncate">{{ resolutionLabel }}</span>
    </span>
    <span
      v-if="cycle.status === 'paused' && !compact"
      class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
    >
      {{ t('cases.recordSlaPaused') }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClockIcon, FlagIcon } from '@heroicons/vue/20/solid';

const props = defineProps({
  cycle: { type: Object, default: null },
  compact: { type: Boolean, default: false }
});

const { t } = useI18n();

function formatTarget(dateStr, prefixKey) {
  if (!dateStr) return null;
  const at = new Date(dateStr);
  if (Number.isNaN(at.getTime())) return null;
  const now = Date.now();
  const diffMs = at.getTime() - now;
  const breached = diffMs < 0;
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  const timePart =
    absMin < 60
      ? `${absMin}m`
      : absMin < 1440
        ? `${Math.round(absMin / 60)}h`
        : `${Math.round(absMin / 1440)}d`;
  const label = breached
    ? t('cases.recordSlaBreached', { metric: t(prefixKey), time: timePart })
    : t('cases.recordSlaDue', { metric: t(prefixKey), time: timePart });
  return { label, breached };
}

const responseInfo = computed(() =>
  formatTarget(props.cycle?.responseTargetAt, 'cases.recordSlaResponse')
);
const resolutionInfo = computed(() =>
  formatTarget(props.cycle?.resolutionTargetAt, 'cases.recordSlaResolution')
);

const responseLabel = computed(() => responseInfo.value?.label || null);
const resolutionLabel = computed(() => resolutionInfo.value?.label || null);

const responseClass = computed(() =>
  responseInfo.value?.breached
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
    : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
);

const resolutionClass = computed(() =>
  resolutionInfo.value?.breached
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
    : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200'
);
</script>
