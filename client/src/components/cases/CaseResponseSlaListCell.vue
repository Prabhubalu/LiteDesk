<template>
  <span
    v-if="metAt"
    class="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    :title="metTitle"
  >
    <CheckCircleIcon class="h-3.5 w-3.5 shrink-0" />
    <span class="truncate">{{ metLabel }}</span>
  </span>
  <span
    v-else-if="dueState === 'overdue'"
    class="inline-flex max-w-full items-center truncate rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    :title="dueTitle"
  >
    {{ overdueLabel }}
  </span>
  <span
    v-else-if="dueState === 'due'"
    class="inline-flex max-w-full items-center truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    :title="dueTitle"
  >
    {{ dueLabel }}
  </span>
  <span
    v-else
    class="text-[11px] text-gray-500 dark:text-gray-400"
  >
    {{ t('cases.listResponseSlaAwaiting') }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon } from '@heroicons/vue/20/solid';
import { formatRelativeTime } from '@/utils/relativeTime';

const props = defineProps({
  row: { type: Object, default: null }
});

const { t, d: formatDate } = useI18n();

function formatDurationMinutes(totalMinutes) {
  const minutes = Math.max(1, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

const metAt = computed(() => props.row?.responseMetAt || props.row?.currentSlaCycle?.responseMetAt || null);

const dueAt = computed(() =>
  props.row?.firstResponseDueAt || props.row?.currentSlaCycle?.responseTargetAt || null
);

const metTitle = computed(() => {
  if (!metAt.value) return '';
  const absolute = formatDate(new Date(metAt.value), 'medium');
  return absolute ? `${t('cases.recordSlaMet', { metric: t('cases.recordSlaResponse') })} · ${absolute}` : '';
});

const metLabel = computed(() => {
  const relative = formatRelativeTime(metAt.value, t);
  return relative
    ? t('cases.recordSlaMetWithTime', {
        metric: t('cases.recordSlaResponse'),
        time: relative
      })
    : t('cases.listResponseSlaMet');
});

const dueState = computed(() => {
  if (metAt.value || !dueAt.value) return null;
  const dueMs = new Date(dueAt.value).getTime();
  if (Number.isNaN(dueMs)) return null;
  return dueMs < Date.now() ? 'overdue' : 'due';
});

const dueTitle = computed(() => {
  if (!dueAt.value) return '';
  return formatDate(new Date(dueAt.value), 'medium') || '';
});

const overdueLabel = computed(() => {
  const dueMs = new Date(dueAt.value).getTime();
  const overMin = (Date.now() - dueMs) / 60000;
  return t('cases.listResponseSlaOverdue', { time: formatDurationMinutes(overMin) });
});

const dueLabel = computed(() => {
  const dueMs = new Date(dueAt.value).getTime();
  const remainingMin = (dueMs - Date.now()) / 60000;
  return t('cases.listResponseSlaDue', { time: formatDurationMinutes(remainingMin) });
});
</script>
