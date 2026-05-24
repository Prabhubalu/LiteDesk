<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="styleClass"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LIFECYCLE_STYLES, STATUS_STYLES } from '@/utils/targetDisplayUtils';

const props = defineProps({
  kind: { type: String, default: 'status' },
  value: { type: String, default: '' },
});

const { t } = useI18n();

const label = computed(() => {
  if (props.kind === 'lifecycle') {
    const key = `performance.lifecycle${props.value?.charAt(0).toUpperCase()}${props.value?.slice(1)}`;
    return t(key) !== key ? t(key) : props.value;
  }
  const statusKey = {
    on_track: 'statusOnTrack',
    at_risk: 'statusAtRisk',
    achieved: 'statusAchieved',
    overachieved: 'statusOverachieved',
    not_started: 'statusNotStarted',
  }[props.value];
  return statusKey ? t(`performance.${statusKey}`) : props.value;
});

const styleClass = computed(() => {
  if (props.kind === 'lifecycle') {
    return LIFECYCLE_STYLES[props.value] || LIFECYCLE_STYLES.draft;
  }
  return STATUS_STYLES[props.value] || STATUS_STYLES.not_started;
});
</script>
