<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goHome">
          ← {{ t('analytics.homeTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ t('analytics.schedulesTitle') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.schedulesDescription') }}</p>
      </div>
      <button
        v-if="canSchedule && !showForm"
        type="button"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        @click="openCreateForm"
      >
        {{ t('analytics.schedulesCreate') }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="mb-6 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
      @submit.prevent="submitForm"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {{ editingId ? t('analytics.schedulesEdit') : t('analytics.schedulesCreate') }}
      </h2>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.fieldName') }}</span>
        <input v-model="form.name" type="text" required class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesAssetType') }}</span>
        <select v-model="form.assetType" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
          <option value="report">{{ t('analytics.schedulesAssetReport') }}</option>
          <option value="dashboard">{{ t('analytics.schedulesAssetDashboard') }}</option>
        </select>
      </label>
      <label v-if="form.assetType === 'report'" class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesReport') }}</span>
        <select
          v-model="form.reportId"
          required
          :disabled="Boolean(editingId)"
          class="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900"
        >
          <option value="">{{ t('analytics.schedulesSelectReport') }}</option>
          <option v-for="report in publishedReports" :key="report._id" :value="report._id">
            {{ report.name }}
          </option>
        </select>
      </label>
      <label v-else class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesDashboard') }}</span>
        <select
          v-model="form.dashboardId"
          required
          :disabled="Boolean(editingId)"
          class="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900"
        >
          <option value="">{{ t('analytics.schedulesSelectDashboard') }}</option>
          <option v-for="dashboard in publishedDashboards" :key="dashboard._id" :value="dashboard._id">
            {{ dashboard.name }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesExportFormat') }}</span>
        <select v-model="form.exportFormat" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
          <option value="csv">CSV</option>
          <option value="xlsx">Excel</option>
          <option value="pdf">PDF</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesFrequency') }}</span>
        <select v-model="form.frequency" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
          <option value="daily">{{ t('analytics.schedulesDaily') }}</option>
          <option value="weekly">{{ t('analytics.schedulesWeekly') }}</option>
          <option value="monthly">{{ t('analytics.schedulesMonthly') }}</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesTimezone') }}</span>
        <select v-model="form.timezone" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
          <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
        </select>
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.schedulesHour') }}</span>
          <input v-model.number="form.hour" type="number" min="0" max="23" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.schedulesMinute') }}</span>
          <input v-model.number="form.minute" type="number" min="0" max="59" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
      </div>
      <label v-if="form.frequency === 'weekly'" class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesDayOfWeek') }}</span>
        <select v-model.number="form.dayOfWeek" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
          <option v-for="day in weekDays" :key="day.value" :value="day.value">{{ day.label }}</option>
        </select>
      </label>
      <label v-if="form.frequency === 'monthly'" class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesDayOfMonth') }}</span>
        <input v-model.number="form.dayOfMonth" type="number" min="1" max="28" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesRecipients') }}</span>
        <input
          v-model="form.recipientsText"
          type="text"
          required
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.schedulesRecipientsPlaceholder')"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.schedulesEmailSubject') }}</span>
        <input
          v-model="form.emailSubject"
          type="text"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.schedulesEmailSubjectPlaceholder')"
        />
      </label>
      <div class="flex gap-2">
        <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="saving">
          {{ t('actions.save') }}
        </button>
        <button type="button" class="rounded-lg border px-4 py-2 text-sm dark:border-neutral-600" @click="cancelForm">
          {{ t('actions.cancel') }}
        </button>
      </div>
    </form>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <div
      v-else-if="schedules.length === 0"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
    >
      <p class="text-sm text-neutral-500">{{ t('analytics.schedulesEmpty') }}</p>
      <button
        v-if="canSchedule"
        type="button"
        class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        @click="openCreateForm"
      >
        {{ t('analytics.schedulesCreate') }}
      </button>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
      <table class="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
        <thead class="bg-neutral-50 dark:bg-neutral-800/60">
          <tr>
            <th class="px-4 py-3 text-left font-medium">{{ t('analytics.fieldName') }}</th>
            <th class="px-4 py-3 text-left font-medium">{{ t('analytics.schedulesReport') }}</th>
            <th class="px-4 py-3 text-left font-medium">{{ t('analytics.schedulesFrequency') }}</th>
            <th class="px-4 py-3 text-left font-medium">{{ t('analytics.colStatus') }}</th>
            <th class="px-4 py-3 text-left font-medium">{{ t('analytics.schedulesLastRun') }}</th>
            <th class="px-4 py-3 text-right font-medium">{{ t('analytics.colActions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-200 dark:divide-neutral-700">
          <tr v-for="row in schedules" :key="row._id">
            <td class="px-4 py-3">
              <p class="font-medium">{{ row.name }}</p>
              <p v-if="row.lastError" class="mt-0.5 text-xs text-red-600">{{ row.lastError }}</p>
            </td>
            <td class="px-4 py-3">{{ reportName(row) }}</td>
            <td class="px-4 py-3">
              <span class="capitalize">{{ row.frequency }}</span>
              <span class="block text-xs text-neutral-500">{{ row.timezone || 'UTC' }}</span>
            </td>
            <td class="px-4 py-3 capitalize">{{ row.status }}</td>
            <td class="px-4 py-3">
              <span>{{ formatDate(row.lastRunAt) }}</span>
              <span v-if="row.lastRunStatus" class="block text-xs capitalize text-neutral-500">{{ row.lastRunStatus }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap justify-end gap-2">
                <button v-if="canSchedule" type="button" class="text-neutral-600 hover:underline" @click="openEditForm(row)">
                  {{ t('actions.edit') }}
                </button>
                <button type="button" class="text-primary-600 hover:underline" @click="runNow(row._id)">
                  {{ t('analytics.schedulesRunNow') }}
                </button>
                <button
                  v-if="row.status === 'active'"
                  type="button"
                  class="text-neutral-600 hover:underline"
                  @click="pause(row._id)"
                >
                  {{ t('analytics.schedulesPause') }}
                </button>
                <button
                  v-else-if="row.status === 'paused'"
                  type="button"
                  class="text-neutral-600 hover:underline"
                  @click="resume(row._id)"
                >
                  {{ t('analytics.schedulesResume') }}
                </button>
                <button type="button" class="text-neutral-600 hover:underline" @click="viewSnapshots(row._id)">
                  {{ t('analytics.schedulesSnapshots') }}
                </button>
                <button
                  v-if="canSchedule"
                  type="button"
                  class="text-red-600 hover:underline"
                  @click="remove(row)"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsSchedules } from '@/composables/useAnalyticsSchedules';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useAuthStore } from '@/stores/authRegistry';
import { ANALYTICS_SCHEDULE_TIMEZONES } from '@/utils/analyticsExport';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsScheduleCreated,
  captureAnalyticsScheduleDeleted,
  captureAnalyticsScheduleRunNow,
  captureAnalyticsScheduleUpdated,
} from '@/config/posthogAnalytics';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const {
  schedules,
  loading,
  saving,
  fetchSchedules,
  fetchSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
} = useAnalyticsSchedules();
const { reports, fetchReports } = useAnalyticsReports();
const { dashboards, fetchDashboards } = useAnalyticsDashboards();

const showForm = ref(false);
const editingId = ref(null);
const timezones = ANALYTICS_SCHEDULE_TIMEZONES;

const form = reactive({
  name: '',
  assetType: 'report',
  reportId: '',
  dashboardId: '',
  exportFormat: 'csv',
  frequency: 'weekly',
  timezone: 'UTC',
  hour: 9,
  minute: 0,
  dayOfWeek: 1,
  dayOfMonth: 1,
  recipientsText: '',
  emailSubject: '',
});

const canSchedule = computed(() => authStore.can('reports', 'edit'));
const publishedReports = computed(() => reports.value.filter((r) => r.status === 'published'));
const publishedDashboards = computed(() => dashboards.value.filter((d) => d.status === 'published'));

const weekDays = computed(() => [
  { value: 0, label: t('analytics.schedulesSunday') },
  { value: 1, label: t('analytics.schedulesMonday') },
  { value: 2, label: t('analytics.schedulesTuesday') },
  { value: 3, label: t('analytics.schedulesWednesday') },
  { value: 4, label: t('analytics.schedulesThursday') },
  { value: 5, label: t('analytics.schedulesFriday') },
  { value: 6, label: t('analytics.schedulesSaturday') },
]);

function resetForm() {
  form.name = '';
  form.assetType = 'report';
  form.reportId = '';
  form.dashboardId = '';
  form.exportFormat = 'csv';
  form.frequency = 'weekly';
  form.timezone = 'UTC';
  form.hour = 9;
  form.minute = 0;
  form.dayOfWeek = 1;
  form.dayOfMonth = 1;
  form.recipientsText = '';
  form.emailSubject = '';
  editingId.value = null;
}

function openCreateForm() {
  resetForm();
  if (route.query.reportId) {
    form.reportId = String(route.query.reportId);
  }
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  resetForm();
}

async function openEditForm(row) {
  const res = await fetchSchedule(String(row._id));
  const data = res?.data || row;
  editingId.value = String(data._id);
  form.name = data.name;
  form.assetType = data.assetType || 'report';
  form.reportId = typeof data.reportId === 'object' ? data.reportId?._id : data.reportId || '';
  form.dashboardId = typeof data.dashboardId === 'object' ? data.dashboardId?._id : data.dashboardId || '';
  form.exportFormat = data.exportFormat || 'csv';
  form.frequency = data.frequency;
  form.timezone = data.timezone || 'UTC';
  form.hour = data.hour ?? 9;
  form.minute = data.minute ?? 0;
  form.dayOfWeek = data.dayOfWeek ?? 1;
  form.dayOfMonth = data.dayOfMonth ?? 1;
  form.recipientsText = (data.recipients || []).join(', ');
  form.emailSubject = data.emailSubject || '';
  showForm.value = true;
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

function reportName(row) {
  if (row.reportId && typeof row.reportId === 'object') return row.reportId.name;
  return '—';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function buildPayload() {
  const recipients = form.recipientsText
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    name: form.name.trim(),
    assetType: form.assetType,
    reportId: form.assetType === 'report' ? form.reportId : null,
    dashboardId: form.assetType === 'dashboard' ? form.dashboardId : null,
    exportFormat: form.exportFormat,
    frequency: form.frequency,
    timezone: form.timezone,
    hour: form.hour,
    minute: form.minute,
    dayOfWeek: form.dayOfWeek,
    dayOfMonth: form.dayOfMonth,
    recipients,
    emailSubject: form.emailSubject.trim() || null,
  };
}

async function load() {
  await fetchSchedules(route.query.reportId ? { reportId: String(route.query.reportId) } : {});
}

async function submitForm() {
  const payload = buildPayload();
  if (editingId.value) {
    const res = await updateSchedule(editingId.value, payload);
    if (res?.success) {
      captureAnalyticsScheduleUpdated({ schedule_id: editingId.value });
      cancelForm();
      await load();
    }
    return;
  }

  const res = await createSchedule(payload);
  if (res?.success) {
    captureAnalyticsScheduleCreated({
      schedule_id: res.data?._id,
      report_id: form.reportId,
      frequency: form.frequency,
    });
    cancelForm();
    await load();
  }
}

async function runNow(id) {
  const res = await runScheduleNow(id);
  if (res?.success) {
    captureAnalyticsScheduleRunNow({ schedule_id: id });
    await load();
  }
}

async function pause(id) {
  await pauseSchedule(id);
  await load();
}

async function resume(id) {
  await resumeSchedule(id);
  await load();
}

async function remove(row) {
  if (!window.confirm(t('analytics.schedulesDeleteConfirm', { name: row.name }))) return;
  const res = await deleteSchedule(row._id);
  if (res?.success) {
    captureAnalyticsScheduleDeleted({ schedule_id: row._id });
    await load();
  }
}

function viewSnapshots(scheduleId) {
  router.push({ name: 'analytics-snapshots', query: { scheduleId } });
}

onMounted(async () => {
  captureAnalyticsModuleVisited({ surface: 'analytics_schedules' });
  if (route.query.reportId) {
    openCreateForm();
  }
  await Promise.all([
    fetchReports({ status: 'published', limit: 200 }),
    fetchDashboards({ status: 'published', limit: 200 }),
  ]);
  await load();
});
</script>
