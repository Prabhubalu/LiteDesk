<template>
  <div class="overflow-x-auto">
    <table class="min-w-full">
      <thead>
        <tr class="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <th class="pb-3 pr-4">{{ t('settings.helpdeskExecSlaPriorityColumn') }}</th>
          <th class="pb-3 pr-4">{{ t('settings.helpdeskExecFirstResponse') }}</th>
          <th class="pb-3">{{ t('settings.helpdeskExecResolution') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr v-for="priority in priorities" :key="priority">
          <td class="py-3 pr-4">
            <span
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              <span class="h-2 w-2 rounded-full" :class="priorityDotClass(priority)" />
              {{ priorityLabel(priority) }}
            </span>
          </td>
          <td class="py-3 pr-4">
            <div class="flex items-center gap-2 max-w-[8.5rem]">
              <input
                v-model.number="model[priority].responseHours"
                min="1"
                type="number"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <span class="shrink-0 text-xs text-gray-400">{{ t('settings.helpdeskExecHoursShort') }}</span>
            </div>
          </td>
          <td class="py-3">
            <div class="flex items-center gap-2 max-w-[8.5rem]">
              <input
                v-model.number="model[priority].resolutionHours"
                min="1"
                type="number"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <span class="shrink-0 text-xs text-gray-400">{{ t('settings.helpdeskExecHoursShort') }}</span>
            </div>
            <p v-if="resolutionDaysLabel(priority)" class="mt-1 text-[11px] text-gray-400">
              {{ resolutionDaysLabel(priority) }}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  priorities: { type: Array, required: true },
  priorityLabel: { type: Function, required: true }
});

const model = defineModel('targets', { type: Object, required: true });

const { t } = useI18n();

const PRIORITY_DOT = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-amber-500',
  Low: 'bg-gray-400'
};

function priorityDotClass(priority) {
  return PRIORITY_DOT[priority] || 'bg-gray-400';
}

function resolutionDaysLabel(priority) {
  const hours = Number(model.value?.[priority]?.resolutionHours || 0);
  if (hours < 24) return '';
  const days = Math.round((hours / 24) * 10) / 10;
  return t('settings.helpdeskExecResolutionDaysHint', { days });
}
</script>
