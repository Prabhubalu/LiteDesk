<template>
  <component
    :is="component"
    :event="event"
    :ui="ui"
    v-bind="typeSpecificProps"
  />
</template>

<script setup>
import { computed } from 'vue';
import { getActivityEventComponent } from './activityEventRegistry';

const props = defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true },
  index: { type: Number, default: 0 },
  searchQuery: { type: String, default: '' },
  isThreadViewActive: { type: Boolean, default: false }
});

const component = computed(() => getActivityEventComponent(props.event?.type));

/** Only comment rows declare search/thread props; system/email have multi-root templates (attrs warn). */
const typeSpecificProps = computed(() => {
  if (String(props.event?.type || '').trim() !== 'comment') return {};
  return {
    searchQuery: props.searchQuery,
    isThreadViewActive: props.isThreadViewActive
  };
});
</script>
