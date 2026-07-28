<template>
  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <!-- Header -->
    <div class="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-5 dark:border-gray-700 dark:from-indigo-950/40 dark:to-gray-800">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportHeading') }}</h2>
          <p v-if="reportData" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {{ t('forms.reportGeneratedOn', { date: formatDate(reportGeneratedAt) }) }}
          </p>
        </div>
        <div class="flex flex-wrap items-start gap-2">
          <div class="flex flex-col gap-1">
            <button
              @click="generateReport"
              :disabled="generating || !canGenerateReport"
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg v-if="generating" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ generating ? t('forms.reportGenerating') : t('forms.reportGenerate') }}
            </button>
            <p v-if="isStatusBlocked" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('forms.reportBlockedHint') }}
            </p>
          </div>
          <button
            @click="generateComprehensiveReport"
            :disabled="generatingComprehensive || !canGenerateReport"
            class="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            :title="t('forms.reportComprehensiveTitle')"
          >
            <svg v-if="generatingComprehensive" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ generatingComprehensive ? t('forms.reportGenerating') : t('forms.reportComprehensive') }}
          </button>
          <button
            v-if="reportUrl"
            @click="downloadReport"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {{ t('forms.reportDownloadPdf') }}
          </button>
          <button
            v-if="comprehensiveReportUrl"
            @click="downloadComprehensiveReport"
            class="inline-flex items-center gap-2 rounded-lg bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
          >
            {{ t('forms.reportDownloadComprehensivePdf') }}
          </button>
          <button
            v-if="reportData"
            @click="exportToExcel"
            :disabled="exportingExcel || !canGenerateReport"
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg v-if="exportingExcel" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {{ exportingExcel ? t('forms.reportExporting') : t('forms.reportExportExcel') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Report body -->
    <div class="p-6">
      <div v-if="reportData" class="space-y-8">
        <!-- Title -->
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{{ form?.name }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('forms.reportResponseId', { id: response.responseId || response._id }) }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            v-for="metric in kpiMetrics"
            :key="metric.key"
            class="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ metric.label }}</p>
                <p class="mt-1 text-3xl font-bold tabular-nums" :class="getScoreTextColorClass(metric.value)">
                  {{ metric.value }}%
                </p>
              </div>
              <div class="relative h-14 w-14 shrink-0">
                <svg class="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" class="stroke-gray-200 dark:stroke-gray-700" stroke-width="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    :stroke="getScoreRingColor(metric.value)"
                    stroke-width="3"
                    stroke-linecap="round"
                    :stroke-dasharray="`${metric.value * 0.974}, 100`"
                  />
                </svg>
                <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {{ Math.round(metric.value) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section scores -->
        <div v-if="normalizedSections.length > 0" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportSectionScores') }}</h3>

          <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div class="border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/60">
              <ReportSectionScoresChart :sections="normalizedSections" />
            </div>

            <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <div
                v-for="section in normalizedSections"
                :key="section.sectionId"
                class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ section.sectionName }}</p>
                  <p v-if="section.total > 0" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('forms.reportSectionPassFail', { passed: section.passed, failed: section.failed, total: section.total }) }}
                  </p>
                </div>
                <div class="flex w-48 shrink-0 items-center gap-3">
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="getScoreBarColorClass(section.percentage)"
                      :style="{ width: `${Math.min(section.percentage, 100)}%` }"
                    />
                  </div>
                  <span
                    class="w-12 text-right text-sm font-semibold tabular-nums"
                    :class="getScoreTextColorClass(section.percentage)"
                  >
                    {{ section.percentage }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Corrective actions -->
        <div v-if="response.correctiveActions?.length > 0" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportCorrectiveActions') }}</h3>
          <div class="space-y-3">
            <div
              v-for="(action, index) in response.correctiveActions"
              :key="index"
              class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            >
              <h4 class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                {{ action.questionText }}
              </h4>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                {{ action.managerAction?.comment || t('forms.reportNoComment') }}
              </p>
              <div class="flex items-center gap-2">
                <BadgeCell
                  :value="mapManagerStatus(action.managerAction?.status)"
                  :variant-map="managerStatusVariantMap"
                />
                <BadgeCell
                  v-if="action.auditorVerification"
                  :value="action.auditorVerification.approved ? t('forms.auditorApproved') : t('forms.auditorRejected')"
                  :variant-map="verificationVariantMap"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40">
          <svg class="h-8 w-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p class="max-w-sm text-sm text-gray-500 dark:text-gray-400">{{ t('forms.reportNoReportYet') }}</p>
        <button
          v-if="canGenerateReport"
          @click="generateReport"
          :disabled="generating"
          class="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ generating ? t('forms.reportGenerating') : t('forms.reportGenerate') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import ReportSectionScoresChart from '@/components/forms/report/ReportSectionScoresChart.vue';
import {
  normalizeSectionScores,
  calculateOverallScoreFromSections,
  getScoreTextColorClass,
  getScoreBarColorClass,
  getScoreRingColor,
} from '@/utils/formScoringUtils';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


const props = defineProps({
  form: {
    type: Object,
    required: true,
  },
  response: {
    type: Object,
    required: true,
  },
});

const generating = ref(false);
const generatingComprehensive = ref(false);
const exportingExcel = ref(false);
const reportData = ref(null);
const reportUrl = ref(null);
const comprehensiveReportUrl = ref(null);
const reportGeneratedAt = ref(null);

const getPersistedReportUrl = (response) =>
  response?.finalReport?.reportUrl || response?.reportUrl || null;

const buildReportDataFromResponse = (response) => ({
  responseId: response._id,
  formName: props.form?.name,
  kpis: response.kpis,
  sectionScores: response.sectionScores,
  overallScore: calculateOverallScoreFromSections(response.sectionScores, props.form),
  reportUrl: getPersistedReportUrl(response),
});

const hydrateFromResponse = (response) => {
  const persistedUrl = getPersistedReportUrl(response);
  const generatedAt = response?.finalReport?.generatedAt;

  if (persistedUrl || generatedAt) {
    reportData.value = buildReportDataFromResponse(response);
    reportUrl.value = persistedUrl;
    reportGeneratedAt.value = generatedAt ? new Date(generatedAt) : new Date();
    if (response?.finalReport?.includesComparison && persistedUrl) {
      comprehensiveReportUrl.value = persistedUrl;
    }
  }
};

watch(
  () => props.response,
  (response) => {
    if (response) hydrateFromResponse(response);
  },
  { immediate: true }
);

const managerStatusVariantMap = computed(() => ({
  [t('forms.auditorStatusResolved')]: 'success',
  [t('forms.correctiveStatusInProgress')]: 'warning',
  [t('forms.auditorStatusPending')]: 'default',
}));

const verificationVariantMap = computed(() => ({
  [t('forms.auditorApproved')]: 'success',
  [t('forms.auditorRejected')]: 'danger',
}));

const normalizedSections = computed(() =>
  normalizeSectionScores(props.response?.sectionScores, props.form)
);

const kpiMetrics = computed(() => {
  const overall =
    reportData.value?.overallScore ??
    reportData.value?.kpis?.finalScore ??
    calculateOverallScoreFromSections(props.response?.sectionScores, props.form);

  const compliance =
    reportData.value?.kpis?.compliancePercentage ??
    props.response?.kpis?.compliancePercentage ??
    0;

  const passRate =
    reportData.value?.kpis?.passRate ??
    props.response?.kpis?.passRate ??
    0;

  return [
    { key: 'overall', label: t('forms.reportOverallScore'), value: overall },
    { key: 'compliance', label: t('forms.reportCompliance'), value: compliance },
    { key: 'passRate', label: t('forms.reportPassRate'), value: passRate },
  ];
});

const mapManagerStatus = (status) => {
  const statusMap = {
    Resolved: t('forms.auditorStatusResolved'),
    'In Progress': t('forms.correctiveStatusInProgress'),
    Pending: t('forms.auditorStatusPending'),
    open: t('forms.correctiveStatusOpen'),
    in_progress: t('forms.correctiveStatusInProgress'),
    completed: t('forms.correctiveStatusCompleted'),
  };
  return statusMap[status] || t('forms.auditorStatusPending');
};

const canGenerateReport = computed(() => {
  const status = props.response?.reviewStatus || props.response?.status;
  return status === 'Approved' || status === 'Closed';
});

const isStatusBlocked = computed(() => {
  const status = props.response?.reviewStatus || props.response?.status;
  return status === 'Pending Corrective Action' || status === 'Needs Auditor Review';
});

const formatDate = (date) => {
  return new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const generateReport = async () => {
  generating.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/generate-report`, {
      method: 'POST',
    });

    if (result.success) {
      reportData.value = result.data;
      reportUrl.value = result.data.reportUrl || null;
      reportGeneratedAt.value = new Date();
    }
  } catch (error) {
    console.error('Error generating report:', error);
    notifications.error(t('forms.reportFailedGenerate'));
  } finally {
    generating.value = false;
  }
};

const downloadReport = () => {
  if (reportUrl.value) {
    window.open(reportUrl.value, '_blank');
  }
};

const generateComprehensiveReport = async () => {
  generatingComprehensive.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/generate-comprehensive-report`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (result.success) {
      comprehensiveReportUrl.value = result.data.reportUrl || null;
      if (comprehensiveReportUrl.value) {
        reportUrl.value = comprehensiveReportUrl.value;
        reportGeneratedAt.value = result.data.generatedAt
          ? new Date(result.data.generatedAt)
          : new Date();
        if (!reportData.value) {
          reportData.value = buildReportDataFromResponse(props.response);
        }
        window.open(comprehensiveReportUrl.value, '_blank');
      }
      notifications.success(t('forms.reportComprehensiveSuccess'));
    } else {
      notifications.error(result.message || t('forms.reportFailedComprehensive'));
    }
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    const message = error?.message || t('forms.reportFailedComprehensive');
    notifications.error(message);
  } finally {
    generatingComprehensive.value = false;
  }
};

const downloadComprehensiveReport = () => {
  if (comprehensiveReportUrl.value) {
    window.open(comprehensiveReportUrl.value, '_blank');
  }
};

const exportToExcel = async () => {
  exportingExcel.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/export-excel`, {
      method: 'POST',
    });

    if (result.success && result.data.excelUrl) {
      window.open(result.data.excelUrl, '_blank');
    } else {
      notifications.error(t('forms.reportFailedExport'));
    }
  } catch (error) {
    console.error('Error exporting Excel:', error);
    notifications.error(t('forms.reportFailedExport'));
  } finally {
    exportingExcel.value = false;
  }
};
</script>
