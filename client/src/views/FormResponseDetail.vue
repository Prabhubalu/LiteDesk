<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <button 
            @click="$router.push(`/forms/${formId}/responses`)" 
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span class="font-medium">Back to Responses</span>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Response Details
          </h1>
          <p v-if="response" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Submitted {{ formatDate(response.submittedAt) }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <BadgeCell 
            v-if="response"
            :value="response.status" 
            :variant-map="{
              'New': 'default',
              'Pending Corrective Action': 'warning',
              'Needs Auditor Review': 'info',
              'Approved': 'success',
              'Rejected': 'danger',
              'Closed': 'default'
            }"
          />
          <button
            v-if="response && (response.status === 'New' || response.status === 'Needs Auditor Review')"
            @click="approveResponse"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          >
            Approve
          </button>
          <button
            v-if="response && (response.status === 'New' || response.status === 'Needs Auditor Review')"
            @click="rejectResponse"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
          >
            Reject
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading response...</p>
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-800 dark:text-red-200">{{ error }}</p>
      </div>

      <div v-else-if="response && form" class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Overall Score</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ calculateOverallScore(response.sectionScores) }}%
            </p>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Compliance</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ response.kpis?.compliancePercentage || 0 }}%
            </p>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pass Rate</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ response.kpis?.passRate || 0 }}%
            </p>
          </div>
        </div>

        <!-- Response Details -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Response Details</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Sections -->
            <div v-for="(section, sIndex) in form.sections" :key="section.sectionId || sIndex" class="space-y-4">
              <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ section.name }}</h3>
                <div v-if="response.sectionScores && response.sectionScores[section.sectionId]" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Score: {{ response.sectionScores[section.sectionId] }}%
                </div>
              </div>

              <!-- Subsections -->
              <div v-for="(subsection, subIndex) in section.subsections" :key="subsection.subsectionId || subIndex" class="ml-4 space-y-3">
                <h4 class="text-md font-medium text-gray-800 dark:text-gray-200">{{ subsection.name }}</h4>

                <!-- Questions -->
                <div v-for="(question, qIndex) in subsection.questions" :key="question.questionId || qIndex" class="ml-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {{ question.questionText }}
                      </p>
                      <div class="flex items-center gap-2 mt-2">
                        <BadgeCell 
                          v-if="getQuestionResponse(question.questionId)"
                          :value="getQuestionResponse(question.questionId).passFail || 'N/A'" 
                          :variant-map="{
                            'Pass': 'success',
                            'Fail': 'danger',
                            'N/A': 'default'
                          }"
                        />
                        <span v-if="getQuestionResponse(question.questionId)?.score !== undefined" class="text-xs text-gray-600 dark:text-gray-400">
                          Score: {{ getQuestionResponse(question.questionId).score }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Answer Display -->
                  <div class="mt-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Answer:</p>
                    <div class="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
                      {{ formatAnswer(getQuestionResponse(question.questionId)?.answer) }}
                    </div>
                  </div>

                  <!-- Attachments -->
                  <div v-if="getQuestionResponse(question.questionId)?.attachments?.length" class="mt-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Attachments:</p>
                    <div class="flex flex-wrap gap-2">
                      <a
                        v-for="(attachment, aIndex) in getQuestionResponse(question.questionId).attachments"
                        :key="aIndex"
                        :href="attachment"
                        target="_blank"
                        class="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 bg-brand-50 dark:bg-brand-900/20 rounded"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {{ attachment.split('/').pop() }}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Corrective Actions Panel -->
        <CorrectiveActionPanel
          v-if="response.status === 'Pending Corrective Action' || response.status === 'Needs Auditor Review'"
          :response="response"
          :form="form"
          @updated="fetchResponse"
        />

        <!-- Auditor Verification Panel -->
        <AuditorVerificationPanel
          v-if="response.status === 'Needs Auditor Review'"
          :response="response"
          :form="form"
          @updated="fetchResponse"
        />

        <!-- Report Generation -->
        <FormReportView
          :form="form"
          :response="response"
        />

        <!-- Comparison View -->
        <FormComparisonView
          :form="form"
          :response="response"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CorrectiveActionPanel from '@/components/forms/CorrectiveActionPanel.vue';
import AuditorVerificationPanel from '@/components/forms/AuditorVerificationPanel.vue';
import FormReportView from '@/components/forms/FormReportView.vue';
import FormComparisonView from '@/components/forms/FormComparisonView.vue';

const route = useRoute();
const router = useRouter();

// Props
const formId = computed(() => route.params.id);
const responseId = computed(() => route.params.responseId);

// State
const loading = ref(true);
const error = ref(null);
const form = ref(null);
const response = ref(null);
const previousResponse = ref(null);

// Methods
const fetchForm = async () => {
  try {
    const result = await apiClient(`/forms/${formId.value}`, { method: 'GET' });
    if (result.success) {
      form.value = result.data.data || result.data;
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = 'Failed to load form details';
  }
};

const fetchResponse = async () => {
  loading.value = true;
  error.value = null;
  try {
    const result = await apiClient(`/forms/${formId.value}/responses/${responseId.value}`, { method: 'GET' });
    if (result.success) {
      response.value = result.data.data || result.data;
      
      // Fetch previous response if available
      if (result.data.data?.finalReport?.previousResponseId) {
        try {
          const prevResult = await apiClient(`/forms/${formId.value}/responses/${result.data.data.finalReport.previousResponseId}`, { method: 'GET' });
          if (prevResult.success) {
            previousResponse.value = prevResult.data.data || prevResult.data;
          }
        } catch (err) {
          console.error('Error fetching previous response:', err);
        }
      }
    } else {
      error.value = result.message || 'Failed to load response';
    }
  } catch (err) {
    console.error('Error fetching response:', err);
    error.value = err.message || 'Failed to load response';
  } finally {
    loading.value = false;
  }
};

const getQuestionResponse = (questionId) => {
  if (!response.value || !response.value.responseDetails) return null;
  return response.value.responseDetails.find(rd => rd.questionId === questionId);
};

const formatAnswer = (answer) => {
  if (answer === null || answer === undefined) return 'No answer provided';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
};

const calculateOverallScore = (sectionScores) => {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;
  const scores = Object.values(sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const approveResponse = async () => {
  if (!confirm('Are you sure you want to approve this response?')) {
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId.value}/responses/${responseId.value}/approve`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponse();
      router.push(`/forms/${formId.value}/responses`);
    }
  } catch (err) {
    console.error('Error approving response:', err);
    alert('Failed to approve response. Please try again.');
  }
};

const rejectResponse = async () => {
  if (!confirm('Are you sure you want to reject this response?')) {
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId.value}/responses/${responseId.value}/reject`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponse();
      router.push(`/forms/${formId.value}/responses`);
    }
  } catch (err) {
    console.error('Error rejecting response:', err);
    alert('Failed to reject response. Please try again.');
  }
};

// Lifecycle
onMounted(() => {
  fetchForm();
  fetchResponse();
});
</script>

