<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsBhWeekSchedule') }}</p>
      <button
        type="button"
        class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="copyMondayToWeekdays"
      >
        {{ t('settings.settingsBhCopyMonWeekdays') }}
      </button>
    </div>

    <div
      v-for="day in localWeek"
      :key="day.day"
      class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800/50"
    >
      <div class="flex flex-wrap items-center gap-3 mb-2">
        <label class="inline-flex items-center gap-2 min-w-[5rem]">
          <input
            v-model="day.enabled"
            type="checkbox"
            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ dayLabels[day.day] }}</span>
        </label>
        <template v-if="day.enabled">
          <input
            v-model="day.windows[0].start"
            type="time"
            class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span class="text-gray-400 text-sm">{{ t('settings.settingsBhTimeTo') }}</span>
          <input
            v-model="day.windows[0].end"
            type="time"
            class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </template>
        <span v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhClosed') }}</span>
      </div>

      <div v-if="day.enabled" class="flex flex-wrap items-center gap-2 sm:pl-24">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhBreak') }}</span>
        <template v-if="day.breaks.length">
          <input
            v-model="day.breaks[0].start"
            type="time"
            class="px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
          <span class="text-gray-400 text-xs">–</span>
          <input
            v-model="day.breaks[0].end"
            type="time"
            class="px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
          <button type="button" class="text-xs text-gray-500 hover:text-red-600" @click="clearBreak(day)">
            {{ t('actions.remove') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="text-xs font-medium text-indigo-600 dark:text-indigo-400"
          @click="addBreak(day)"
        >
          {{ t('settings.settingsBhAddBreak') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const dayLabels = computed(() => [
  t('appointments.daySun'),
  t('appointments.dayMon'),
  t('appointments.dayTue'),
  t('appointments.dayWed'),
  t('appointments.dayThu'),
  t('appointments.dayFri'),
  t('appointments.daySat')
]);

const localWeek = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

function copyMondayToWeekdays() {
  const week = props.modelValue.map((d) => ({ ...d, windows: [...d.windows], breaks: [...d.breaks] }));
  const mon = week.find((d) => d.day === 1);
  if (!mon) return;
  for (const d of week) {
    if (d.day >= 1 && d.day <= 5) {
      d.enabled = mon.enabled;
      d.windows = [{ ...mon.windows[0] }];
      d.breaks = mon.breaks.length ? [{ ...mon.breaks[0] }] : [];
    }
  }
  emit('update:modelValue', week);
}

function addBreak(day) {
  day.breaks = [{ start: '12:00', end: '13:00' }];
}

function clearBreak(day) {
  day.breaks = [];
}
</script>
