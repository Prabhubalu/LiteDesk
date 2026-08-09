<template>
  <div
    v-if="showBanner"
    :class="compact ? compactRootClass : ['mt-3 rounded-lg border px-3 py-2 text-sm', bannerClass]"
  >
    <template v-if="compact">
      <span class="font-medium text-amber-900 dark:text-amber-100">{{ headline }}</span>
      <span v-if="detail" class="text-amber-800/80 dark:text-amber-200/80">· {{ detail }}</span>
    </template>
    <template v-else>
      <p class="font-medium text-gray-900 dark:text-white">
        {{ headline }}
      </p>
      <p v-if="detail" class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        {{ detail }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = defineProps({
  slaContext: { type: Object, default: null },
  cycleStatus: { type: String, default: null },
  caseStatus: { type: String, default: null },
  compact: { type: Boolean, default: false }
});

const { t } = useI18n();

const showBanner = computed(() => {
  if (props.cycleStatus === 'paused') return true;
  if (!props.slaContext?.useBusinessHours) return false;
  return props.slaContext.isOpen === false;
});

const headline = computed(() => {
  if (props.cycleStatus === 'paused') {
    if (props.caseStatus === 'Waiting for Customer') {
      return t('cases.recordSlaAlertWaitingCustomer');
    }
    return t('cases.recordSlaAlertPaused');
  }
  if (props.slaContext?.pauseReason) {
    return props.slaContext.pauseReason;
  }
  return t('cases.recordSlaAlertOutsideHours');
});

const detail = computed(() => {
  const parts = [];
  if (props.slaContext?.scheduleName) {
    parts.push(t('cases.recordSlaAlertSchedule', { name: props.slaContext.scheduleName }));
  } else if (props.slaContext?.summary) {
    parts.push(props.slaContext.summary);
  }
  if (props.slaContext?.timezone) {
    parts.push(props.slaContext.timezone);
  }
  return parts.join(' · ');
});

const bannerClass = computed(() => {
  if (props.cycleStatus === 'paused') {
    return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40';
  }
  return 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30';
});

const compactRootClass = computed(() => {
  const tone =
    props.cycleStatus === 'paused'
      ? 'bg-amber-100/70 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/60'
      : 'bg-indigo-100/70 text-indigo-900 ring-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-800/60';
  return [
    'inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight ring-1 ring-inset',
    tone
  ];
});
</script>
