<template>
  <component
    :is="component"
    :event="event"
    :ui="ui"
    :index="index"
    :search-query="searchQuery"
    :is-thread-view-active="isThreadViewActive"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { getActivityEventComponent } from './activityEventRegistry';

const props = defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true },
  index: { type: Number, default: 0 },
  searchQuery: { type: String, default: '' },
  isThreadViewActive: { type: Boolean, default: false }
});

const { t } = useI18n();

const component = computed(() => getActivityEventComponent(props.event?.type));
</script>
