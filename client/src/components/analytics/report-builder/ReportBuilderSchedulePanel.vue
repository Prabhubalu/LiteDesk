<template>
  <div class="space-y-4">
    <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
      <input
        type="checkbox"
        :checked="enabled"
        class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
        @change="$emit('update:enabled', ($event.target as HTMLInputElement).checked)"
      />
      {{ t('analytics.builderScheduleEnable') }}
    </label>

    <template v-if="enabled">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label :class="rbLabel" for="schedule-frequency">{{ t('analytics.schedulesFrequency') }}</label>
          <HeadlessSelect
            id="schedule-frequency"
            :model-value="frequency"
            :options="frequencyOptions"
            wrapper-class="mt-0"
            teleport
            @update:model-value="$emit('update:frequency', $event)"
          />
        </div>
        <div>
          <label :class="rbLabel" for="schedule-timezone">{{ t('analytics.schedulesTimezone') }}</label>
          <HeadlessSelect
            id="schedule-timezone"
            :model-value="timezone"
            :options="timezoneOptions"
            wrapper-class="mt-0"
            teleport
            @update:model-value="$emit('update:timezone', $event)"
          />
        </div>
        <div>
          <label :class="rbLabel" for="schedule-hour">{{ t('analytics.schedulesHour') }}</label>
          <input
            id="schedule-hour"
            :value="hour"
            type="number"
            min="0"
            max="23"
            :class="rbInput"
            @input="$emit('update:hour', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div>
          <label :class="rbLabel" for="schedule-minute">{{ t('analytics.schedulesMinute') }}</label>
          <input
            id="schedule-minute"
            :value="minute"
            type="number"
            min="0"
            max="59"
            :class="rbInput"
            @input="$emit('update:minute', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div v-if="frequency === 'weekly'">
          <label :class="rbLabel" for="schedule-dow">{{ t('analytics.schedulesDayOfWeek') }}</label>
          <HeadlessSelect
            id="schedule-dow"
            :model-value="String(dayOfWeek)"
            :options="weekDayOptions"
            wrapper-class="mt-0"
            teleport
            @update:model-value="$emit('update:dayOfWeek', Number($event))"
          />
        </div>
        <div v-if="frequency === 'monthly'">
          <label :class="rbLabel" for="schedule-dom">{{ t('analytics.schedulesDayOfMonth') }}</label>
          <input
            id="schedule-dom"
            :value="dayOfMonth"
            type="number"
            min="1"
            max="28"
            :class="rbInput"
            @input="$emit('update:dayOfMonth', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div>
          <label :class="rbLabel" for="schedule-start">{{ t('analytics.builderScheduleStartDate') }}</label>
          <input
            id="schedule-start"
            :value="startDate"
            type="date"
            :class="rbInput"
            @input="$emit('update:startDate', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label :class="rbLabel" for="schedule-end">{{ t('analytics.builderScheduleEndDate') }}</label>
          <input
            id="schedule-end"
            :value="endDate"
            type="date"
            :class="rbInput"
            @input="$emit('update:endDate', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div>
        <p :class="rbLabel">{{ t('analytics.builderScheduleFormats') }}</p>
        <div class="mt-2 flex flex-wrap gap-4">
          <label
            v-for="format in formatOptions"
            :key="format.value"
            class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"
          >
            <input
              type="checkbox"
              :checked="exportFormats.includes(format.value)"
              class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              @change="toggleFormat(format.value, ($event.target as HTMLInputElement).checked)"
            />
            {{ format.label }}
          </label>
        </div>
      </div>

      <div>
        <label :class="rbLabel" for="schedule-recipients">{{ t('analytics.builderScheduleRecipients') }}</label>
        <textarea
          id="schedule-recipients"
          :value="recipientsText"
          rows="2"
          :class="rbTextarea"
          :placeholder="t('analytics.builderScheduleRecipientsPlaceholder')"
          @input="$emit('update:recipientsText', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input
          type="checkbox"
          :checked="sendCopyToOwner"
          class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
          @change="$emit('update:sendCopyToOwner', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('analytics.builderScheduleSendCopy') }}
      </label>

      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        {{ t('analytics.builderSchedulePublishHint') }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { rbInput, rbLabel, rbTextarea } from '@/components/analytics/report-builder/reportBuilderUi';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { ANALYTICS_SCHEDULE_TIMEZONES } from '@/utils/analyticsExport';

const props = defineProps<{
  enabled: boolean;
  frequency: string;
  timezone: string;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  exportFormats: string[];
  startDate: string;
  endDate: string;
  recipientsText: string;
  sendCopyToOwner: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void;
  (e: 'update:frequency', value: string): void;
  (e: 'update:timezone', value: string): void;
  (e: 'update:hour', value: number): void;
  (e: 'update:minute', value: number): void;
  (e: 'update:dayOfWeek', value: number): void;
  (e: 'update:dayOfMonth', value: number): void;
  (e: 'update:exportFormats', value: string[]): void;
  (e: 'update:startDate', value: string): void;
  (e: 'update:endDate', value: string): void;
  (e: 'update:recipientsText', value: string): void;
  (e: 'update:sendCopyToOwner', value: boolean): void;
}>();

const { t } = useI18n();

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('analytics.schedulesDaily') },
  { value: 'weekly', label: t('analytics.schedulesWeekly') },
  { value: 'monthly', label: t('analytics.schedulesMonthly') },
]);

const formatOptions = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

const timezoneOptions = ANALYTICS_SCHEDULE_TIMEZONES.map((tz) => ({ value: tz, label: tz }));

const weekDayOptions = computed(() => [
  { value: '0', label: t('analytics.schedulesSunday') },
  { value: '1', label: t('analytics.schedulesMonday') },
  { value: '2', label: t('analytics.schedulesTuesday') },
  { value: '3', label: t('analytics.schedulesWednesday') },
  { value: '4', label: t('analytics.schedulesThursday') },
  { value: '5', label: t('analytics.schedulesFriday') },
  { value: '6', label: t('analytics.schedulesSaturday') },
]);

function toggleFormat(format: string, checked: boolean) {
  const next = checked
    ? [...new Set([...props.exportFormats, format])]
    : props.exportFormats.filter((entry) => entry !== format);
  emit('update:exportFormats', next.length ? next : ['csv']);
}
</script>
