<template>
  <div class="space-y-3">
    <article
      v-for="(alert, index) in alerts"
      :key="alert.id"
      class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/40"
        @click="toggleExpand(alert.id)"
      >
        <div class="flex items-center gap-2">
          <span
            class="h-2 w-2 rounded-full"
            :class="alert.type === 'breach' ? 'bg-red-500' : 'bg-amber-500'"
          />
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ alertLabel(alert) }}</span>
        </div>
        <svg
          class="h-4 w-4 text-gray-400 transition-transform"
          :class="{ 'rotate-180': expanded[alert.id] }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-show="expanded[alert.id]" class="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaAlertPriorities') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="priority in priorities"
              :key="priority"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              :class="pillClass(alert.priorities, priority)"
              @click="toggleValue(alert.priorities, priority)"
            >
              {{ priorityLabel(priority) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaAlertRecipients') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="recipient in recipientOptions"
              :key="recipient.value"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              :class="pillClass(alert.recipients, recipient.value)"
              @click="toggleValue(alert.recipients, recipient.value)"
            >
              {{ recipient.label }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaAlertTiming') }}</label>
            <select
              v-model="alert.timingMode"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option v-for="mode in timingModeOptions" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </div>
          <div v-if="alert.timingMode !== 'immediately'">
            <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaAlertTimingMinutes') }}</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="alert.timingMinutes"
                type="number"
                min="1"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <span class="shrink-0 text-xs text-gray-400">{{ t('settings.slaAlertMinutesShort') }}</span>
            </div>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaAlertChannels') }}</p>
          <div class="flex flex-wrap gap-3">
            <label v-for="ch in channelOptions" :key="ch.value" class="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <input v-model="alert.channels[ch.value]" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
              {{ ch.label }}
            </label>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            @click="removeAlert(index)"
          >
            {{ t('settings.slaAlertDelete') }}
          </button>
        </div>
      </div>
    </article>

    <button
      type="button"
      class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      @click="addAlert"
    >
      <PlusIcon class="h-4 w-4" />
      {{ t('settings.slaAlertAdd') }}
    </button>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { normalizeSlaAlert } from '@/components/settings/helpdesk/slaPolicyNormalize.js';
import {
  alertTypeLabel,
  buildChannelOptions,
  buildRecipientOptions,
  buildTimingModeOptions
} from '@/components/settings/helpdesk/slaPolicyOptionLabels.js';

const props = defineProps({
  priorities: { type: Array, required: true },
  priorityLabel: { type: Function, required: true },
  slaPolicyOptions: { type: Object, required: true }
});

const alerts = defineModel('alerts', { type: Array, default: () => [] });

const { t } = useI18n();

const expanded = reactive({});

const recipientOptions = computed(() => buildRecipientOptions(props.slaPolicyOptions.alertRecipients, t));
const channelOptions = computed(() => buildChannelOptions(props.slaPolicyOptions.alertChannels, t));
const timingModeOptions = computed(() => buildTimingModeOptions(props.slaPolicyOptions.alertTimingModes, t));

function alertLabel(alert) {
  const label = alertTypeLabel(alert.type, t);
  if (label) return label;
  return alert.name || t('settings.slaAlertCustom');
}

function pillClass(list, value) {
  const active = Array.isArray(list) && list.includes(value);
  return active
    ? 'bg-indigo-600 text-white'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

function toggleValue(list, value) {
  if (!Array.isArray(list)) return;
  const idx = list.indexOf(value);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(value);
}

function toggleExpand(id) {
  expanded[id] = !expanded[id];
}

function addAlert() {
  const defaultType = props.slaPolicyOptions.alertTypes?.[0] || 'warning';
  const alert = normalizeSlaAlert({ type: defaultType }, props.priorities, props.slaPolicyOptions, defaultType);
  alerts.value = [...alerts.value, alert];
  expanded[alert.id] = true;
}

function removeAlert(index) {
  alerts.value = alerts.value.filter((_, i) => i !== index);
}
</script>
