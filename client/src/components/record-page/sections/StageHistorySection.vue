<template>
  <section v-if="history.length" class="space-y-2">
    <h3 v-if="!hideHeader" class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.stageHistoryTitle') }}</h3>
    <div class="space-y-2">
      <div v-for="(entry, index) in history" :key="entry.id || index" class="flex items-center gap-2 text-xs">
        <div class="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500"></div>
        <span class="font-medium text-gray-900 dark:text-white">{{ entry.stage || '—' }}</span>
        <span class="text-gray-500 dark:text-gray-400">•</span>
        <span class="text-gray-600 dark:text-gray-400">{{ entry.changedAtLabel || '—' }}</span>
        <span v-if="entry.changedBy" class="text-gray-500 dark:text-gray-400">by {{ entry.changedBy }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const history = computed(() => {
  const value = props.adapter?.getStageHistory?.(props.record, props.context);
  return Array.isArray(value) ? value : [];
});

const hideHeader = computed(() => props.context?.hideHeader === true);
</script>
