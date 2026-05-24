<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.settingsBhFieldName') }}</label>
      <input
        v-model="form.name"
        type="text"
        :placeholder="t('settings.settingsBhNamePh')"
        class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
    <BusinessHoursSelect
      v-model="form.linkedTo.type"
      :label="t('settings.settingsBhFieldScope')"
      :options="scopeOptions"
      :disabled="isDefaultLocked"
    />
    <BusinessHoursSelect
      v-model="form.status"
      :label="t('settings.settingsBhFieldStatus')"
      :options="statusOptions"
    />

    <div v-if="form.linkedTo.type === 'group'" class="sm:col-span-2">
      <BusinessHoursSelect
        v-model="form.linkedTo.id"
        :label="t('settings.settingsBhScopeTeam')"
        :options="groupOptions"
        :placeholder="t('settings.settingsBhSelectTeamPh')"
      />
      <p v-if="!groupOptions.length" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
        {{ t('settings.settingsBhNoTeamsHint') }}
      </p>
    </div>

    <div v-if="form.linkedTo.type === 'user'" class="sm:col-span-2">
      <BusinessHoursSelect
        v-model="form.linkedTo.id"
        :label="t('settings.settingsBhFieldUser')"
        :options="userOptions"
        :placeholder="t('settings.settingsBhSelectUserPh')"
      />
    </div>

    <div class="sm:col-span-2">
      <TimezoneSelect v-model="form.timezone" :label="t('settings.settingsBhFieldTimezone')" />
    </div>
    <div class="sm:col-span-2">
      <BusinessHoursSelect
        v-model="form.holidayCalendarId"
        :label="t('settings.settingsBhFieldHolidayCalendar')"
        :options="holidayCalendarOptions"
        allow-empty
        :empty-label="t('settings.settingsBhNone')"
        :empty-value="null"
        :placeholder="t('settings.settingsBhNone')"
      />
    </div>
    <label class="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input v-model="form.overtimeAllowed" type="checkbox" class="rounded text-indigo-600" />
      {{ t('settings.settingsBhOvertimeAllowed') }}
    </label>
    <label
      v-if="form.linkedTo.type === 'company'"
      class="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
    >
      <input v-model="form.isDefault" type="checkbox" class="rounded text-indigo-600" />
      {{ t('settings.settingsBhCompanyDefault') }}
    </label>

    <div class="sm:col-span-2">
      <ScheduleWeekEditor v-model="form.week" />
    </div>

    <div v-if="previewSetId" class="sm:col-span-2">
      <SchedulePreviewPanel :set-id="previewSetId" :timezone="form.timezone" />
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BusinessHoursSelect from '@/components/business-hours/BusinessHoursSelect.vue';
import TimezoneSelect from '@/components/business-hours/TimezoneSelect.vue';
import ScheduleWeekEditor from '@/components/business-hours/ScheduleWeekEditor.vue';
import SchedulePreviewPanel from '@/components/business-hours/SchedulePreviewPanel.vue';

const form = defineModel('form', { type: Object, required: true });

defineProps({
  scopeOptions: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [] },
  holidayCalendarOptions: { type: Array, default: () => [] },
  groupOptions: { type: Array, default: () => [] },
  userOptions: { type: Array, default: () => [] },
  isDefaultLocked: { type: Boolean, default: false },
  previewSetId: { type: String, default: null }
});

const { t } = useI18n();

watch(
  () => form.value.linkedTo?.type,
  (type, prevType) => {
    if (type === prevType || !form.value?.linkedTo) return;
    form.value.linkedTo.id = null;
    if (type !== 'company') {
      form.value.isDefault = false;
    }
  }
);
</script>
