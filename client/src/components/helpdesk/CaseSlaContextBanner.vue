<template>
  <div
    v-if="showBanner"
    class="mt-3 rounded-lg border px-3 py-2 text-sm"
    :class="bannerClass"
  >
    <p class="font-medium text-gray-900 dark:text-white">
      {{ headline }}
    </p>
    <p v-if="detail" class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
      {{ detail }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = defineProps({
  slaContext: { type: Object, default: null },
  cycleStatus: { type: String, default: null }
});

const { t } = useI18n();

const showBanner = computed(() => {
  if (!props.slaContext?.useBusinessHours) return false;
  if (props.cycleStatus === 'paused') return true;
  return props.slaContext.isOpen === false;
});

const headline = computed(() => {
  if (props.cycleStatus === 'paused') {
    return 'SLA paused — case is on hold';
  }
  if (props.slaContext?.pauseReason) {
    return props.slaContext.pauseReason;
  }
  return 'Outside business hours';
});

const detail = computed(() => {
  const parts = [];
  if (props.slaContext?.scheduleName) {
    parts.push(`Schedule: ${props.slaContext.scheduleName}`);
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
</script>
