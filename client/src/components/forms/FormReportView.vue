<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportHeading') }}</h2>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex flex-col gap-1">
            <button
              @click="generateReport"
              :disabled="generating || !canGenerateReport"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ generating ? t('forms.reportGenerating') : t('forms.reportGenerate') }}
            </button>
            <p v-if="isStatusBlocked" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('forms.reportBlockedHint') }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <button
              @click="generateComprehensiveReport"
              :disabled="generatingComprehensive || !canGenerateReport"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              :title="t('forms.reportComprehensiveTitle')"
            >
              <svg v-if="generatingComprehensive" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {{ generatingComprehensive ? t('forms.reportGenerating') : t('forms.reportComprehensive') }}
            </button>
            <p v-if="isStatusBlocked" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('forms.reportBlockedHint') }}
            </p>
          </div>
          <button
            v-if="reportUrl"
            @click="downloadReport"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
          >
            {{ t('forms.reportDownloadPdf') }}
          </button>
          <button
            v-if="comprehensiveReportUrl"
            @click="downloadComprehensiveReport"
            class="px-4 py-2 bg-orange-200 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-300 dark:hover:bg-orange-900/50 font-medium transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ t('forms.reportDownloadComprehensivePdf') }}
          </button>
          <button
            v-if="reportData"
            @click="exportToExcel"
            :disabled="exportingExcel || !canGenerateReport"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg v-if="exportingExcel" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ exportingExcel ? t('forms.reportExporting') : t('forms.reportExportExcel') }}
          </button>
        </div>
      </div>
    </div>

    <div class="p-6">
      <div v-if="reportData" class="space-y-6">
        <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ form?.name }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ t('forms.reportGeneratedOn', { date: formatDate(new Date()) }) }}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.reportOverallScore') }}</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.overallScore || calculateOverallScore(response.sectionScores) }}%
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.reportCompliance') }}</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.compliancePercentage || response.kpis?.compliancePercentage || 0 }}%
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.reportPassRate') }}</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.passRate || response.kpis?.passRate || 0 }}%
            </p>
          </div>
        </div>

        <div v-if="response.sectionScores" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportSectionScores') }}</h3>
          <div class="space-y-2">
            <div
              v-for="(score, sectionId) in response.sectionScores"
              :key="sectionId"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
            >
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ getSectionName(sectionId) }}
              </span>
              <div class="flex items-center gap-4">
                <div class="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    class="bg-indigo-600 h-2 rounded-full transition-all"
                    :style="{ width: `${score}%` }"
                  ></div>
                </div>
                <span class="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                  {{ score }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="response.correctiveActions && response.correctiveActions.length > 0" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportCorrectiveActions') }}</h3>
          <div class="space-y-3">
            <div
              v-for="(action, index) in response.correctiveActions"
              :key="index"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {{ action.questionText }}
              </h4>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
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

      <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>{{ t('forms.reportNoReportYet') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';

const { t } = useI18n();

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  response: {
    type: Object,
    required: true
  }
});

const generating = ref(false);
const generatingComprehensive = ref(false);
const exportingExcel = ref(false);
const reportData = ref(null);
const reportUrl = ref(null);
const comprehensiveReportUrl = ref(null);

const managerStatusVariantMap = computed(() => ({
  [t('forms.auditorStatusResolved')]: 'success',
  [t('forms.correctiveStatusInProgress')]: 'warning',
  [t('forms.auditorStatusPending')]: 'default',
}));

const verificationVariantMap = computed(() => ({
  [t('forms.auditorApproved')]: 'success',
  [t('forms.auditorRejected')]: 'danger',
}));

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

const calculateOverallScore = (sectionScores) => {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;
  const scores = Object.values(sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
};

const getSectionName = (sectionId) => {
  if (!props.form || !props.form.sections) return sectionId;
  for (const section of props.form.sections) {
    if (section.sectionId === sectionId) {
      return section.name;
    }
  }
  return sectionId;
};

const formatDate = (date) => {
  return new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generateReport = async () => {
  generating.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/generate-report`, {
      method: 'POST'
    });

    if (result.success) {
      reportData.value = result.data;
      reportUrl.value = result.data.reportUrl || null;
    }
  } catch (error) {
    console.error('Error generating report:', error);
    alert(t('forms.reportFailedGenerate'));
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
      body: JSON.stringify({})
    });

    if (result.success) {
      comprehensiveReportUrl.value = result.data.reportUrl || null;
      if (comprehensiveReportUrl.value) {
        window.open(comprehensiveReportUrl.value, '_blank');
      }
      alert(t('forms.reportComprehensiveSuccess'));
    } else {
      alert(result.message || t('forms.reportFailedComprehensive'));
    }
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    alert(t('forms.reportFailedComprehensive'));
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
      method: 'POST'
    });

    if (result.success && result.data.excelUrl) {
      window.open(result.data.excelUrl, '_blank');
    } else {
      alert(t('forms.reportFailedExport'));
    }
  } catch (error) {
    console.error('Error exporting Excel:', error);
    alert(t('forms.reportFailedExport'));
  } finally {
    exportingExcel.value = false;
  }
};
</script>
