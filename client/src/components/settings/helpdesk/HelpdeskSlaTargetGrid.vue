<template>
  <div class="overflow-x-auto">
    <table class="min-w-full">
      <thead>
        <tr class="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <th class="pb-3 pr-4">{{ t('settings.helpdeskExecSlaPriorityColumn') }}</th>
          <th class="pb-3 pr-4">{{ t('settings.helpdeskExecFirstResponse') }}</th>
          <th class="pb-3 pr-4">{{ t('settings.helpdeskExecResolution') }}</th>
          <th v-if="showOverrideHours" class="pb-3">{{ t('settings.slaTargetOverrideHours') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr v-for="priority in priorities" :key="priority">
          <td class="py-3 pr-4">
            <span
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              <span class="h-2 w-2 rounded-full" :class="priorityDotClassFor(priority)" />
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
          <td class="py-3 pr-4">
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
          <td v-if="showOverrideHours" class="py-3">
            <select
              v-model="model[priority].overrideHours"
              class="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option v-for="mode in overrideModeOptions" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { priorityDotClass, targetRowFromStandard } from '@/constants/helpdeskSlaPolicy';
import { buildOverrideModeOptions } from '@/components/settings/helpdesk/slaPolicyOptionLabels.js';

const props = defineProps({
  priorities: { type: Array, required: true },
  priorityLabel: { type: Function, required: true },
  standardTargets: { type: Object, default: () => ({}) },
  hourOverrideModes: { type: Array, default: () => [] },
  showOverrideHours: { type: Boolean, default: false }
});

const model = defineModel('targets', { type: Object, required: true });

const { t } = useI18n();

const overrideModeOptions = computed(() => buildOverrideModeOptions(props.hourOverrideModes, t));

function ensureRows() {
  if (!model.value || typeof model.value !== 'object') {
    model.value = {};
  }
  const defaultMode = props.hourOverrideModes[0] || 'default';
  for (const priority of props.priorities) {
    if (!model.value[priority]) {
      model.value[priority] = {
        ...targetRowFromStandard(priority, props.standardTargets, props.priorities),
        overrideHours: defaultMode
      };
    }
  }
}

onMounted(ensureRows);
watch(() => [props.priorities, props.standardTargets], ensureRows, { immediate: true, deep: true });

function priorityDotClassFor(priority) {
  return priorityDotClass(props.priorities, priority);
}

function resolutionDaysLabel(priority) {
  const hours = Number(model.value?.[priority]?.resolutionHours || 0);
  if (hours < 24) return '';
  const days = Math.round((hours / 24) * 10) / 10;
  return t('settings.helpdeskExecResolutionDaysHint', { days });
}
</script>
