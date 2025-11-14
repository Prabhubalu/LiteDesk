<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Form Report</h2>
        <div class="flex items-center gap-2">
          <button
            @click="generateReport"
            :disabled="generating"
            class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors disabled:opacity-50"
          >
            {{ generating ? 'Generating...' : 'Generate Report' }}
          </button>
          <button
            v-if="reportUrl"
            @click="downloadReport"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
          >
            Download PDF
          </button>
          <button
            v-if="reportData"
            @click="exportToExcel"
            :disabled="exportingExcel"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg v-if="exportingExcel" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ exportingExcel ? 'Exporting...' : 'Export Excel' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="p-6">
      <!-- Report Content -->
      <div v-if="reportData" class="space-y-6">
        <!-- Report Header -->
        <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ form?.name }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generated on {{ formatDate(new Date()) }}
          </p>
        </div>

        <!-- Summary Section -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Overall Score</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.overallScore || calculateOverallScore(response.sectionScores) }}%
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Compliance</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.compliancePercentage || response.kpis?.compliancePercentage || 0 }}%
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pass Rate</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ reportData.passRate || response.kpis?.passRate || 0 }}%
            </p>
          </div>
        </div>

        <!-- Section Scores -->
        <div v-if="response.sectionScores" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Section Scores</h3>
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
                    class="bg-brand-600 h-2 rounded-full transition-all"
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

        <!-- Corrective Actions Summary -->
        <div v-if="response.correctiveActions && response.correctiveActions.length > 0" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Corrective Actions</h3>
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
                {{ action.managerAction?.comment || 'No comment' }}
              </p>
              <div class="flex items-center gap-2">
                <BadgeCell
                  :value="action.managerAction?.status || 'Pending'"
                  :variant-map="{
                    'Resolved': 'success',
                    'In Progress': 'warning',
                    'Pending': 'default'
                  }"
                />
                <BadgeCell
                  v-if="action.auditorVerification"
                  :value="action.auditorVerification.approved ? 'Approved' : 'Rejected'"
                  :variant-map="{
                    'Approved': 'success',
                    'Rejected': 'danger'
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Report Generated -->
      <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No report generated yet. Click "Generate Report" to create one.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';

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
const exportingExcel = ref(false);
const reportData = ref(null);
const reportUrl = ref(null);
const excelUrl = ref(null);

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
  return new Date(date).toLocaleString('en-US', {
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
    alert('Failed to generate report. Please try again.');
  } finally {
    generating.value = false;
  }
};

const downloadReport = () => {
  if (reportUrl.value) {
    window.open(reportUrl.value, '_blank');
  }
};

const exportToExcel = async () => {
  exportingExcel.value = true;
  try {
    const result = await apiClient(`/forms/${props.form._id}/responses/${props.response._id}/export-excel`, {
      method: 'POST'
    });

    if (result.success && result.data.excelUrl) {
      excelUrl.value = result.data.excelUrl;
      // Open Excel file in new tab
      window.open(result.data.excelUrl, '_blank');
    } else {
      alert('Failed to export Excel. Please try again.');
    }
  } catch (error) {
    console.error('Error exporting Excel:', error);
    alert('Failed to export Excel. Please try again.');
  } finally {
    exportingExcel.value = false;
  }
};
</script>

