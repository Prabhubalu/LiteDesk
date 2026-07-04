<template>
  <div class="mx-auto w-full max-w-7xl px-6 py-8">
    <button
      type="button"
      class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      @click="goBack"
    >
      <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
      {{ backLabel }}
    </button>

    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {{ t('analytics.schedulesTitle') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('analytics.schedulesDescription') }}
        </p>
        <p
          v-if="!loading && schedules.length"
          class="mt-2 text-xs text-neutral-400 dark:text-neutral-500"
        >
          {{ t('analytics.schedulesCountSummary', { count: schedules.length }) }}
        </p>
      </div>
      <button
        v-if="canSchedule && !showDialog"
        type="button"
        class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500"
        @click="openCreateForm"
      >
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        {{ t('analytics.schedulesCreate') }}
      </button>
    </div>

    <div
      v-if="filteredReportName"
      class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3 dark:border-primary-800/50 dark:bg-primary-950/30"
    >
      <div class="flex min-w-0 items-center gap-2 text-sm text-primary-800 dark:text-primary-200">
        <DocumentChartBarIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          {{ t('analytics.schedulesFilteredReport', { name: filteredReportName }) }}
        </span>
      </div>
      <button
        type="button"
        class="text-sm font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
        @click="clearReportFilter"
      >
        {{ t('analytics.schedulesClearFilter') }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div
        v-for="idx in 4"
        :key="idx"
        class="h-16 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700"
      />
    </div>

    <div
      v-else-if="schedules.length === 0"
      class="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center shadow-sm dark:border-neutral-600 dark:bg-neutral-900"
    >
      <CalendarDaysIcon
        class="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600"
        aria-hidden="true"
      />
      <h2 class="mt-4 text-base font-semibold text-neutral-900 dark:text-white">
        {{ t('analytics.schedulesEmpty') }}
      </h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('analytics.schedulesEmptyDescription') }}
      </p>
      <button
        v-if="canSchedule"
        type="button"
        class="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500"
        @click="openCreateForm"
      >
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        {{ t('analytics.schedulesCreate') }}
      </button>
    </div>

    <div
      v-else
      class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <table class="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
        <thead class="bg-neutral-50 dark:bg-neutral-800/60">
          <tr>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.fieldName') }}
            </th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.schedulesReport') }}
            </th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.schedulesFrequency') }}
            </th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.colStatus') }}
            </th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.schedulesLastRun') }}
            </th>
            <th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('analytics.colActions') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-200 dark:divide-neutral-700">
          <tr
            v-for="row in schedules"
            :key="row._id"
            class="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <td class="px-5 py-4">
              <div class="flex items-start gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-neutral-900 dark:text-white">{{ row.name }}</p>
                  <p
                    v-if="row.lastError"
                    class="mt-1 text-xs text-red-600 dark:text-red-400"
                  >
                    {{ row.lastError }}
                  </p>
                </div>
                <span
                  class="mt-0.5 shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {{ exportFormatLabel(row.exportFormat) }}
                </span>
              </div>
            </td>
            <td class="px-5 py-4 text-neutral-600 dark:text-neutral-300">
              {{ assetName(row) }}
            </td>
            <td class="px-5 py-4">
              <p class="text-neutral-900 dark:text-white">{{ frequencyLabel(row.frequency) }}</p>
              <p class="mt-0.5 text-xs text-neutral-500">{{ frequencyDetail(row) }}</p>
            </td>
            <td class="px-5 py-4">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="scheduleStatusClass(row.status)"
              >
                {{ scheduleStatusLabel(row.status) }}
              </span>
            </td>
            <td class="px-5 py-4">
              <p class="text-neutral-900 dark:text-white">{{ formatDate(row.lastRunAt) }}</p>
              <p
                v-if="row.lastRunStatus"
                class="mt-0.5 text-xs"
                :class="lastRunStatusClass(row.lastRunStatus)"
              >
                {{ lastRunStatusLabel(row.lastRunStatus) }}
              </p>
            </td>
            <td class="px-5 py-4 text-right">
              <Menu as="div" class="relative inline-block text-left">
                <MenuButton
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  :aria-label="t('analytics.rowActionsLabel')"
                >
                  <EllipsisVerticalIcon class="h-5 w-5" aria-hidden="true" />
                </MenuButton>
                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems
                    class="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
                  >
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="runNow(row._id)"
                      >
                        {{ t('analytics.schedulesRunNow') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-if="canSchedule" v-slot="{ active }">
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="openEditForm(row)"
                      >
                        {{ t('actions.edit') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="viewSnapshots(row._id)"
                      >
                        {{ t('analytics.schedulesSnapshots') }}
                      </button>
                    </MenuItem>
                    <div class="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                    <MenuItem
                      v-if="row.status === 'active'"
                      v-slot="{ active }"
                    >
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="pause(row._id)"
                      >
                        {{ t('analytics.schedulesPause') }}
                      </button>
                    </MenuItem>
                    <MenuItem
                      v-else-if="row.status === 'paused'"
                      v-slot="{ active }"
                    >
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="resume(row._id)"
                      >
                        {{ t('analytics.schedulesResume') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-if="canSchedule" v-slot="{ active }">
                      <button
                        type="button"
                        :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
                        @click="remove(row)"
                      >
                        {{ t('actions.delete') }}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TransitionRoot as="template" :show="showDialog">
      <Dialog class="relative z-50" @close="cancelForm">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-150"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-neutral-900/40 backdrop-blur-[1px]" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-neutral-900">
                <div class="border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
                  <DialogTitle class="text-lg font-semibold text-neutral-900 dark:text-white">
                    {{ editingId ? t('analytics.schedulesEdit') : t('analytics.schedulesCreate') }}
                  </DialogTitle>
                  <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {{ t('analytics.schedulesFormHint') }}
                  </p>
                </div>

                <form class="space-y-5 px-6 py-5" @submit.prevent="submitForm">
                  <label class="block">
                    <span :class="labelClass">{{ t('analytics.fieldName') }}</span>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      :class="inputClass"
                    />
                  </label>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span :class="labelClass">{{ t('analytics.schedulesAssetType') }}</span>
                      <HeadlessSelect
                        v-model="form.assetType"
                        :options="assetTypeOptions"
                        wrapper-class="mt-0"
                        teleport
                      />
                    </div>
                    <div>
                      <span :class="labelClass">{{ t('analytics.schedulesExportFormat') }}</span>
                      <HeadlessSelect
                        v-model="form.exportFormat"
                        :options="exportFormatOptions"
                        wrapper-class="mt-0"
                        teleport
                      />
                    </div>
                  </div>

                  <div v-if="form.assetType === 'report'">
                    <span :class="labelClass">{{ t('analytics.schedulesReport') }}</span>
                    <HeadlessSelect
                      v-model="form.reportId"
                      :options="reportOptions"
                      :disabled="Boolean(editingId)"
                      :placeholder="t('analytics.schedulesSelectReport')"
                      wrapper-class="mt-0"
                      teleport
                    />
                  </div>
                  <div v-else>
                    <span :class="labelClass">{{ t('analytics.schedulesDashboard') }}</span>
                    <HeadlessSelect
                      v-model="form.dashboardId"
                      :options="dashboardOptions"
                      :disabled="Boolean(editingId)"
                      :placeholder="t('analytics.schedulesSelectDashboard')"
                      wrapper-class="mt-0"
                      teleport
                    />
                  </div>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span :class="labelClass">{{ t('analytics.schedulesFrequency') }}</span>
                      <HeadlessSelect
                        v-model="form.frequency"
                        :options="frequencyOptions"
                        wrapper-class="mt-0"
                        teleport
                      />
                    </div>
                    <div>
                      <span :class="labelClass">{{ t('analytics.schedulesTimezone') }}</span>
                      <HeadlessSelect
                        v-model="form.timezone"
                        :options="timezoneOptions"
                        wrapper-class="mt-0"
                        teleport
                        show-search
                      />
                    </div>
                    <div>
                      <label :class="labelClass" for="schedule-hour">{{ t('analytics.schedulesHour') }}</label>
                      <input
                        id="schedule-hour"
                        v-model.number="form.hour"
                        type="number"
                        min="0"
                        max="23"
                        :class="inputClass"
                      />
                    </div>
                    <div>
                      <label :class="labelClass" for="schedule-minute">{{ t('analytics.schedulesMinute') }}</label>
                      <input
                        id="schedule-minute"
                        v-model.number="form.minute"
                        type="number"
                        min="0"
                        max="59"
                        :class="inputClass"
                      />
                    </div>
                    <div v-if="form.frequency === 'weekly'">
                      <span :class="labelClass">{{ t('analytics.schedulesDayOfWeek') }}</span>
                      <HeadlessSelect
                        v-model="formDayOfWeek"
                        :options="weekDayOptions"
                        wrapper-class="mt-0"
                        teleport
                      />
                    </div>
                    <div v-if="form.frequency === 'monthly'">
                      <label :class="labelClass" for="schedule-dom">{{ t('analytics.schedulesDayOfMonth') }}</label>
                      <input
                        id="schedule-dom"
                        v-model.number="form.dayOfMonth"
                        type="number"
                        min="1"
                        max="28"
                        :class="inputClass"
                      />
                    </div>
                  </div>

                  <label class="block">
                    <span :class="labelClass">{{ t('analytics.schedulesRecipients') }}</span>
                    <input
                      v-model="form.recipientsText"
                      type="text"
                      required
                      :class="inputClass"
                      :placeholder="t('analytics.schedulesRecipientsPlaceholder')"
                    />
                  </label>

                  <label class="block">
                    <span :class="labelClass">{{ t('analytics.schedulesEmailSubject') }}</span>
                    <input
                      v-model="form.emailSubject"
                      type="text"
                      :class="inputClass"
                      :placeholder="t('analytics.schedulesEmailSubjectPlaceholder')"
                    />
                  </label>

                  <div class="flex justify-end gap-2 border-t border-neutral-100 pt-5 dark:border-neutral-800">
                    <button
                      type="button"
                      class="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      @click="cancelForm"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="submit"
                      class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="saving || !isFormValid"
                    >
                      <ArrowPathIcon
                        v-if="saving"
                        class="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      {{ t('actions.save') }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  DocumentChartBarIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { useAnalyticsSchedules } from '@/composables/useAnalyticsSchedules';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useAuthStore } from '@/stores/authRegistry';
import { ANALYTICS_SCHEDULE_TIMEZONES } from '@/utils/analyticsExport';
import type { AnalyticsScheduleRecord } from '@/types/analytics.types';
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
  createSchedule,
  updateSchedule,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
} = useAnalyticsSchedules();
const { reports, fetchReports } = useAnalyticsReports();
const { dashboards, fetchDashboards } = useAnalyticsDashboards();

const showDialog = ref(false);
const editingId = ref<string | null>(null);

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

const labelClass = 'mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300';
const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white';

const canSchedule = computed(() => authStore.can('reports', 'edit'));
const publishedReports = computed(() => reports.value.filter((entry) => entry.status === 'published'));
const publishedDashboards = computed(() => dashboards.value.filter((entry) => entry.status === 'published'));

const filteredReportName = computed(() => {
  const reportId = route.query.reportId ? String(route.query.reportId) : '';
  if (!reportId) return '';
  const match = publishedReports.value.find((entry) => entry._id === reportId);
  return match?.name || '';
});

const backLabel = computed(() => (
  route.query.reportId
    ? t('analytics.schedulesBackToReport')
    : t('analytics.homeTitle')
));

const formDayOfWeek = computed({
  get: () => String(form.dayOfWeek),
  set: (value: string) => {
    form.dayOfWeek = Number(value);
  },
});

const isFormValid = computed(() => {
  if (!form.name.trim() || !form.recipientsText.trim()) return false;
  if (form.assetType === 'report') return Boolean(form.reportId);
  return Boolean(form.dashboardId);
});

const assetTypeOptions = computed(() => [
  { value: 'report', label: t('analytics.schedulesAssetReport') },
  { value: 'dashboard', label: t('analytics.schedulesAssetDashboard') },
]);

const exportFormatOptions = computed(() => [
  { value: 'csv', label: t('analytics.exportCsv') },
  { value: 'xlsx', label: t('analytics.exportXlsx') },
  { value: 'pdf', label: t('analytics.exportPdf') },
]);

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('analytics.schedulesDaily') },
  { value: 'weekly', label: t('analytics.schedulesWeekly') },
  { value: 'monthly', label: t('analytics.schedulesMonthly') },
]);

const timezoneOptions = computed(() =>
  ANALYTICS_SCHEDULE_TIMEZONES.map((tz) => ({ value: tz, label: tz })),
);

const reportOptions = computed(() =>
  publishedReports.value.map((entry) => ({ value: entry._id, label: entry.name })),
);

const dashboardOptions = computed(() =>
  publishedDashboards.value.map((entry) => ({ value: entry._id, label: entry.name })),
);

const weekDayOptions = computed(() => [
  { value: '0', label: t('analytics.schedulesSunday') },
  { value: '1', label: t('analytics.schedulesMonday') },
  { value: '2', label: t('analytics.schedulesTuesday') },
  { value: '3', label: t('analytics.schedulesWednesday') },
  { value: '4', label: t('analytics.schedulesThursday') },
  { value: '5', label: t('analytics.schedulesFriday') },
  { value: '6', label: t('analytics.schedulesSaturday') },
]);

function menuItemClass(active: boolean) {
  return [
    'block w-full px-3 py-2 text-left text-sm',
    active
      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
      : 'text-neutral-700 dark:text-neutral-200',
  ];
}

function scheduleStatusClass(status: string) {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status === 'paused') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
}

function scheduleStatusLabel(status: string) {
  if (status === 'active') return t('analytics.schedulesStatusActive');
  if (status === 'paused') return t('analytics.schedulesStatusPaused');
  if (status === 'archived') return t('analytics.schedulesStatusArchived');
  return status;
}

function lastRunStatusClass(status: string) {
  if (status === 'success') return 'text-emerald-600 dark:text-emerald-400';
  if (status === 'failed') return 'text-red-600 dark:text-red-400';
  return 'text-neutral-500';
}

function lastRunStatusLabel(status: string) {
  if (status === 'success') return t('analytics.schedulesLastRunSuccess');
  if (status === 'failed') return t('analytics.schedulesLastRunFailed');
  if (status === 'skipped') return t('analytics.schedulesLastRunSkipped');
  return status;
}

function frequencyLabel(frequency: string) {
  if (frequency === 'daily') return t('analytics.schedulesDaily');
  if (frequency === 'weekly') return t('analytics.schedulesWeekly');
  if (frequency === 'monthly') return t('analytics.schedulesMonthly');
  return frequency;
}

function frequencyDetail(row: AnalyticsScheduleRecord) {
  const time = `${String(row.hour ?? 0).padStart(2, '0')}:${String(row.minute ?? 0).padStart(2, '0')}`;
  if (row.frequency === 'weekly') {
    const day = weekDayOptions.value.find((entry) => Number(entry.value) === row.dayOfWeek)?.label;
    return `${day ?? ''} · ${time} · ${row.timezone || 'UTC'}`;
  }
  if (row.frequency === 'monthly') {
    return `${t('analytics.schedulesDayOfMonth')} ${row.dayOfMonth ?? 1} · ${time} · ${row.timezone || 'UTC'}`;
  }
  return `${time} · ${row.timezone || 'UTC'}`;
}

function exportFormatLabel(format: string) {
  if (format === 'xlsx') return 'XLSX';
  if (format === 'pdf') return 'PDF';
  return 'CSV';
}

function assetName(row: AnalyticsScheduleRecord) {
  if (row.assetType === 'dashboard') {
    if (row.dashboardId && typeof row.dashboardId === 'object') return row.dashboardId.name;
    return '—';
  }
  if (row.reportId && typeof row.reportId === 'object') return row.reportId.name;
  return '—';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

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
  showDialog.value = true;
}

function cancelForm() {
  showDialog.value = false;
  resetForm();
}

function openEditForm(row: AnalyticsScheduleRecord) {
  editingId.value = String(row._id);
  form.name = row.name;
  form.assetType = row.assetType || 'report';
  form.reportId = row.reportId && typeof row.reportId === 'object'
    ? row.reportId._id
    : (row.reportId ?? '');
  form.dashboardId = row.dashboardId && typeof row.dashboardId === 'object'
    ? row.dashboardId._id
    : (row.dashboardId ?? '');
  form.exportFormat = row.exportFormat || 'csv';
  form.frequency = row.frequency;
  form.timezone = row.timezone || 'UTC';
  form.hour = row.hour ?? 9;
  form.minute = row.minute ?? 0;
  form.dayOfWeek = row.dayOfWeek ?? 1;
  form.dayOfMonth = row.dayOfMonth ?? 1;
  form.recipientsText = (row.recipients || []).join(', ');
  form.emailSubject = row.emailSubject || '';
  showDialog.value = true;
}

function goBack() {
  if (route.query.reportId) {
    router.push({ name: 'analytics-report-detail', params: { id: String(route.query.reportId) } });
    return;
  }
  router.push({ name: 'analytics-home' });
}

function clearReportFilter() {
  cancelForm();
  router.push({ name: 'analytics-schedules' });
}

watch(
  () => route.query.reportId,
  async () => {
    await load();
  },
);

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
    const res = await updateSchedule(editingId.value, payload as Partial<AnalyticsScheduleRecord>);
    if (res?.success) {
      captureAnalyticsScheduleUpdated({ schedule_id: editingId.value });
      cancelForm();
      await load();
    }
    return;
  }

  const res = await createSchedule(payload as Parameters<typeof createSchedule>[0]);
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

async function runNow(id: string) {
  const res = await runScheduleNow(id);
  if (res?.success) {
    captureAnalyticsScheduleRunNow({ schedule_id: id });
    await load();
  }
}

async function pause(id: string) {
  await pauseSchedule(id);
  await load();
}

async function resume(id: string) {
  await resumeSchedule(id);
  await load();
}

async function remove(row: AnalyticsScheduleRecord) {
  if (!window.confirm(t('analytics.schedulesDeleteConfirm', { name: row.name }))) return;
  const res = await deleteSchedule(row._id);
  if (res?.success) {
    captureAnalyticsScheduleDeleted({ schedule_id: row._id });
    await load();
  }
}

function viewSnapshots(scheduleId: string) {
  router.push({ name: 'analytics-snapshots', query: { scheduleId } });
}

onMounted(async () => {
  captureAnalyticsModuleVisited({ surface: 'analytics_schedules' });
  await Promise.all([
    fetchReports({ status: 'published', limit: 200 }),
    fetchDashboards({ status: 'published', limit: 200 }),
  ]);
  await load();
  if (route.query.reportId && canSchedule.value) {
    openCreateForm();
  }
});
</script>
