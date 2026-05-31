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
      :title="responseInfo?.title || responseLabel"
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
import { formatRelativeTime } from '@/utils/relativeTime';

const WARNING_THRESHOLD_PERCENT = 80;

const props = defineProps({
  cycle: { type: Object, default: null },
  slaProgress: { type: Object, default: null },
  compact: { type: Boolean, default: false }
});

const { t } = useI18n();

function formatTarget(dateStr, prefixKey, metricKey) {
  if (!dateStr) return null;

  const progress = props.slaProgress?.[metricKey];
  if (progress?.state === 'met') {
    return {
      label: t('cases.recordSlaMet', { metric: t(prefixKey) }),
      state: 'met'
    };
  }

  if (progress?.state === 'breached') {
    const budget = progress.budgetMinutes || 0;
    const overMin = Math.max(0, Math.round((progress.elapsedMinutes || 0) - budget));
    const timePart =
      overMin < 60
        ? `${overMin}m`
        : overMin < 1440
          ? `${Math.round(overMin / 60)}h`
          : `${Math.round(overMin / 1440)}d`;
    return {
      label: t('cases.recordSlaBreached', { metric: t(prefixKey), time: timePart }),
      state: 'breached'
    };
  }

  if (progress?.state === 'warning') {
    const remaining = Math.max(0, (progress.budgetMinutes || 0) - (progress.elapsedMinutes || 0));
    const timePart =
      remaining < 60
        ? `${remaining}m`
        : remaining < 1440
          ? `${Math.round(remaining / 60)}h`
          : `${Math.round(remaining / 1440)}d`;
    return {
      label: t('cases.recordSlaWarning', { metric: t(prefixKey), time: timePart }),
      state: 'warning'
    };
  }

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

  if (breached) {
    return {
      label: t('cases.recordSlaBreached', { metric: t(prefixKey), time: timePart }),
      state: 'breached'
    };
  }

  const startedAt = props.cycle?.startedAt ? new Date(props.cycle.startedAt) : null;
  if (startedAt && !Number.isNaN(startedAt.getTime())) {
    const totalMs = at.getTime() - startedAt.getTime();
    if (totalMs > 0) {
      const elapsedRatio = (now - startedAt.getTime()) / totalMs;
      if (elapsedRatio >= WARNING_THRESHOLD_PERCENT / 100) {
        return {
          label: t('cases.recordSlaWarning', { metric: t(prefixKey), time: timePart }),
          state: 'warning'
        };
      }
    }
  }

  return {
    label: t('cases.recordSlaDue', { metric: t(prefixKey), time: timePart }),
    state: 'ok'
  };
}

function badgeClass(state, tone = 'neutral') {
  if (state === 'met') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (state === 'breached') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
  }
  if (state === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  }
  if (tone === 'resolution') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200';
}

const responseInfo = computed(() => {
  if (props.cycle?.responseMetAt) {
    const relative = formatRelativeTime(props.cycle.responseMetAt, t);
    return {
      label: relative
        ? t('cases.recordSlaMetWithTime', {
            metric: t('cases.recordSlaResponse'),
            time: relative
          })
        : t('cases.recordSlaMet', { metric: t('cases.recordSlaResponse') }),
      state: 'met',
      title: t('cases.recordSlaMet', { metric: t('cases.recordSlaResponse') })
    };
  }
  return formatTarget(props.cycle?.responseTargetAt, 'cases.recordSlaResponse', 'response');
});

const resolutionInfo = computed(() =>
  formatTarget(props.cycle?.resolutionTargetAt, 'cases.recordSlaResolution', 'resolution')
);

const responseLabel = computed(() => responseInfo.value?.label || null);
const resolutionLabel = computed(() => resolutionInfo.value?.label || null);

const responseClass = computed(() => badgeClass(responseInfo.value?.state, 'response'));
const resolutionClass = computed(() => badgeClass(resolutionInfo.value?.state, 'resolution'));
</script>
