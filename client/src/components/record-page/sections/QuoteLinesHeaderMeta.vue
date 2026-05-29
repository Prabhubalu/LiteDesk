<template>
  <div class="inline-flex flex-wrap items-center gap-2">
    <span
      v-if="quoteStatus"
      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      :class="statusBadgeClass"
    >
      {{ quoteStatus }}
    </span>
    <span
      v-if="record?.revisionNumber"
      class="text-xs text-gray-500 dark:text-gray-400"
    >
      {{ t('records.quoteRevisionLabel', { n: record.revisionNumber }) }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const quoteStatus = computed(() => String(props.record?.status || '').trim());

const statusBadgeClass = computed(() => {
  const s = quoteStatus.value;
  if (s === 'Draft') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  if (s === 'Pending Approval') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (s === 'Approved' || s === 'Accepted') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
  if (s === 'Rejected' || s === 'Cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
});
</script>
