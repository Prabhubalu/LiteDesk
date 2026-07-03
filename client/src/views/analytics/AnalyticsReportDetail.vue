<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6">
      <button
        type="button"
        class="mb-2 text-sm text-primary-600 hover:underline dark:text-primary-400"
        @click="goList"
      >
        ← {{ t('analytics.listTitle') }}
      </button>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
            {{ report?.name || t('states.loading') }}
          </h1>
          <p v-if="report" class="mt-1 text-sm text-neutral-500 capitalize">
            {{ report.primaryModule }} · {{ report.type }} · {{ statusLabel(report.status) }}
            <span
              v-if="report.certified"
              class="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {{ t('analytics.certifiedBadge') }}
            </span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="report?.status === 'published'"
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goCreateWidget"
          >
            {{ t('analytics.createWidgetFromReport') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goSchedules"
          >
            {{ t('analytics.schedulesTitle') }}
          </button>
          <button
            v-if="canCertify && report?.status === 'published' && !report?.certified"
            type="button"
            class="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 dark:border-amber-600 dark:text-amber-200"
            :disabled="saving"
            @click="certify"
          >
            {{ t('analytics.certifyReport') }}
          </button>
          <button
            v-if="canCertify && report?.certified"
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            :disabled="saving"
            @click="uncertify"
          >
            {{ t('analytics.uncertifyReport') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goAlerts"
          >
            {{ t('analytics.alertsTitle') }}
          </button>
          <button
            v-if="canEditReport"
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goEdit"
          >
            {{ t('actions.edit') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="executing || report?.status !== 'published'"
            @click="runReport"
          >
            {{ t('analytics.runReport') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600 disabled:opacity-50"
            :disabled="executing || report?.status !== 'published'"
            @click="exportCsv"
          >
            {{ t('analytics.exportCsv') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600 disabled:opacity-50"
            :disabled="executing || report?.status !== 'published'"
            @click="exportXlsx"
          >
            {{ t('analytics.exportXlsx') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600 disabled:opacity-50"
            :disabled="executing || report?.status !== 'published'"
            @click="exportPdf"
          >
            {{ t('analytics.exportPdf') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">
      {{ t('states.loading') }}
    </div>

    <template v-else-if="report">
      <div class="mb-6 grid gap-4 sm:grid-cols-4">
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.detailLastRun') }}</p>
          <p class="mt-1 text-sm font-medium">{{ formatDate(report.lastExecutedAt) }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.detailExecutions') }}</p>
          <p class="mt-1 text-sm font-medium">{{ report.executionCount ?? 0 }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.detailViews') }}</p>
          <p class="mt-1 text-sm font-medium">{{ report.viewCount ?? 0 }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.colStatus') }}</p>
          <p class="mt-1 text-sm font-medium capitalize">{{ statusLabel(report.status) }}</p>
        </div>
      </div>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <ReportPreviewPanel
          :result="runResult"
          :empty-message="t('analytics.previewEmpty')"
        />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import {
  captureAnalyticsReportCertified,
  captureAnalyticsReportExecuted,
  captureAnalyticsReportUncertified,
  captureAnalyticsReportViewed,
} from '@/config/posthogAnalytics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const {
  report,
  loading,
  executing,
  saving,
  fetchReport,
  executeReport,
  exportReport,
  certifyReport,
  uncertifyReport,
} = useAnalyticsReports();

const runResult = ref(null);

const canCertify = computed(() => authStore.can('analytics_admin', 'certify'));
const canEditReport = computed(() => {
  if (!report.value) return false;
  if (!report.value.certified) return authStore.can('reports', 'edit');
  if (canCertify.value) return true;
  const ownerId = typeof report.value.ownerId === 'object'
    ? report.value.ownerId?._id
    : report.value.ownerId;
  return ownerId && String(ownerId) === String(authStore.user?._id);
});

function statusLabel(status) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function goList() {
  router.push({ name: 'analytics-reports' });
}

function goEdit() {
  router.push({ name: 'analytics-report-edit', params: { id: route.params.id } });
}

function goCreateWidget() {
  router.push({
    name: 'analytics-widget-create',
    query: { reportId: String(route.params.id) },
  });
}

function goSchedules() {
  router.push({
    name: 'analytics-schedules',
    query: { reportId: String(route.params.id) },
  });
}

function goAlerts() {
  router.push({ name: 'analytics-alerts' });
}

async function certify() {
  const res = await certifyReport(String(route.params.id));
  if (res?.success) {
    captureAnalyticsReportCertified({ report_id: route.params.id });
  }
}

async function uncertify() {
  const res = await uncertifyReport(String(route.params.id));
  if (res?.success) {
    captureAnalyticsReportUncertified({ report_id: route.params.id });
  }
}

async function runReport() {
  const res = await executeReport(String(route.params.id), {});
  if (res?.success) {
    runResult.value = res.data;
    captureAnalyticsReportExecuted({ report_id: route.params.id });
    await fetchReport(String(route.params.id));
  }
}

async function exportCsv() {
  await exportReport(String(route.params.id), 'csv', {});
}

async function exportXlsx() {
  await exportReport(String(route.params.id), 'xlsx', {});
}

async function exportPdf() {
  await exportReport(String(route.params.id), 'pdf', {});
}

onMounted(async () => {
  await fetchReport(String(route.params.id));
  captureAnalyticsReportViewed({ report_id: route.params.id, view_count: report.value?.viewCount });
  if (report.value?.status === 'published') {
    await runReport();
  }
});
</script>
