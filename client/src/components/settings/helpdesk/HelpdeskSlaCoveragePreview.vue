<template>
  <div class="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/30">
    <p class="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaCoverageAppliesTo') }}</p>
    <div v-if="conditions.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('settings.slaCoverageAllRecords') }}
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <template v-for="(condition, index) in conditions" :key="`${condition.label}-${index}`">
        <span
          v-if="index > 0"
          class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-400"
        >
          {{ t('settings.slaCoverageAnd') }}
        </span>
        <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
          {{ condition.label }}
        </span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  caseTypes: { type: Array, default: () => [] },
  channels: { type: Array, default: () => [] },
  priorities: { type: Array, default: () => [] },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  isStandard: { type: Boolean, default: false }
});

const { t } = useI18n();

const conditions = computed(() => {
  const items = [];
  if (props.caseTypes.length) {
    props.caseTypes.forEach((type) => {
      items.push({ label: props.caseTypeLabel(type) });
    });
  }
  if (props.channels.length) {
    props.channels.forEach((channel) => {
      items.push({ label: `${t('settings.slaCoverageChannel')} = ${channel}` });
    });
  }
  if (props.priorities.length) {
    props.priorities.forEach((priority) => {
      items.push({ label: `${t('settings.helpdeskExecSlaPriorityColumn')} = ${props.priorityLabel(priority)}` });
    });
  }
  return items;
});
</script>
