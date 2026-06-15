<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
    @click="$emit('select', item)"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-50 text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-200"
    >
      <CalendarIcon class="h-4 w-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {{ item.title }}
      </span>
      <span class="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{{ item.sourceApp }}</span>
        <span v-if="startLabel" aria-hidden="true">·</span>
        <span v-if="startLabel">{{ startLabel }}</span>
      </span>
    </span>
    <span
      v-if="startLabel"
      class="shrink-0 rounded-full bg-secondary-50 px-1.5 py-0.5 text-[10px] font-medium text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-200"
    >
      {{ t('platform.platformHomeNextEventBadge') }}
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarIcon } from '@heroicons/vue/24/outline';
import { formatUpcomingEventTime } from '@/utils/attentionFormatters';

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
});

defineEmits(['select']);

const { t } = useI18n();

const startLabel = computed(() =>
  props.item.startAt ? formatUpcomingEventTime(props.item.startAt, t) : ''
);
</script>
