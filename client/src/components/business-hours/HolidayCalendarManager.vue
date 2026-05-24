<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.settingsBhTabHolidays') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
          {{ t('settings.settingsBhHolidayDesc') }}
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        @click="openImport"
      >
        {{ t('settings.settingsBhImportCsv') }}
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</div>
    <div v-else class="grid gap-3">
      <div
        v-for="cal in calendars"
        :key="cal._id"
        class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex items-start justify-between gap-3"
      >
        <div>
          <p class="font-medium text-gray-900 dark:text-white">{{ cal.name }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ t('settings.settingsBhHolidayCount', { count: cal.dates?.length || 0 }) }}
            <span v-if="cal.region"> · {{ cal.region }}</span>
          </p>
        </div>
        <button
          type="button"
          class="text-xs text-red-600 hover:underline"
          @click="remove(cal._id)"
        >
          {{ t('actions.delete') }}
        </button>
      </div>
      <p v-if="!calendars.length" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
        {{ t('settings.settingsBhEmptyHolidayCalendars') }}
      </p>
    </div>

    <div
      v-if="showImport"
      class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 space-y-3"
    >
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.settingsBhImportCalendarTitle') }}</h4>
      <input
        v-model="importName"
        type="text"
        :placeholder="t('settings.settingsBhCalendarNamePh')"
        class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
      />
      <textarea
        v-model="importCsv"
        rows="6"
        :placeholder="t('settings.settingsBhImportCsvPh')"
        class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono"
      />
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white"
          :disabled="importing"
          @click="submitImport"
        >
          {{ importing ? t('settings.settingsBhImporting') : t('settings.settingsBhImport') }}
        </button>
        <button
          type="button"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
          @click="showImport = false"
        >
          {{ t('actions.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const { fetchHolidayCalendars, importHolidayCsv, deleteHolidayCalendar } = useBusinessHours();
const { success, error: notifyError } = useNotifications();

const loading = ref(true);
const calendars = ref([]);
const showImport = ref(false);
const importName = ref('');
const importCsv = ref('');
const importing = ref(false);

async function load() {
  loading.value = true;
  try {
    calendars.value = await fetchHolidayCalendars();
  } finally {
    loading.value = false;
  }
}

function openImport() {
  showImport.value = true;
  importName.value = '';
  importCsv.value = '';
}

async function submitImport() {
  importing.value = true;
  try {
    await importHolidayCsv({
      name: importName.value,
      csv: importCsv.value
    });
    success(t('settings.settingsBhHolidayImported'));
    showImport.value = false;
    await load();
  } catch (e) {
    notifyError(e?.message || t('settings.settingsBhImportFailed'));
  } finally {
    importing.value = false;
  }
}

async function remove(id) {
  if (!confirm(t('settings.settingsBhDeleteHolidayConfirm'))) return;
  try {
    await deleteHolidayCalendar(id);
    success(t('settings.settingsBhCalendarDeleted'));
    await load();
  } catch (e) {
    notifyError(e?.message || t('settings.settingsBhDeleteFailed'));
  }
}

onMounted(load);

defineExpose({ reload: load });
</script>
