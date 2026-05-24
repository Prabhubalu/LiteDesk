<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">{{ t('forms.hubResponseDetailLoading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('audit.responseDetailErrorLoadingResponse') }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/forms')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">{{ t('forms.builderShellBackToForms') }}</button>
      </div>
    </div>

    <!-- Access Denied Banner -->
    <div v-else-if="accessDenied" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">{{ t('audit.responseDetailReadOnlyAccess') }}</h3>
            <p class="text-sm text-yellow-700 dark:text-yellow-400">
              {{ accessDeniedMessage || 'You have read-only access to this response. Navigation is restricted based on app boundaries.' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Response Detail Content -->
    <div v-else-if="responseDetail" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/forms')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">{{ t('forms.builderShellBackToForms') }}</span>
        </button>
      </div>

      <!-- Execution Action Bar -->
      <ExecutionActionBar
        v-if="recordContext && recordContext.executionCapabilities"
        :execution-capabilities="recordContext.executionCapabilities || []"
        app-key="SALES"
        :executing="executing"
        :executing-capability-key="executingCapabilityKey"
        @action="handleExecutionAction"
        class="mb-4"
      />

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Response Info -->
        <div class="lg:col-span-1 space-y-4">
          <!-- Response Header Card -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
            <div class="w-12 h-12 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Response {{ responseDetail.responseId }}</h1>
            <div class="flex items-center gap-2 flex-wrap">
              <span :class="getExecutionStatusBadgeClass(responseDetail.executionStatus)">
                {{ responseDetail.executionStatus }}
              </span>
              <span
                v-if="responseDetail.reviewStatus"
                :class="getReviewStatusBadgeClass(responseDetail.reviewStatus)"
              >
                {{ responseDetail.reviewStatus }}
              </span>
              <!-- Phase 2C: Projection-aware type badge (if available) -->
              <span 
                v-if="projectionTypeLabel"
                :class="projectionTypeBadgeClass"
              >
                {{ projectionTypeLabel }}
                <span v-if="projectionAppLabel" class="ml-1 text-xs opacity-75">
                  ({{ projectionAppLabel }})
                </span>
              </span>
            </div>
          </div>

          <!-- Execution Summary Card -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('audit.responseDetailExecutionSummary') }}</h3>
            
            <!-- Form Name -->
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsPbResourceForm') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5 truncate">
                  {{ responseDetail.formName }}
                </div>
              </div>
            </div>

            <!-- Event Reference -->
            <div v-if="responseDetail.eventReference" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsPbActionEvent') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5 truncate">
                  {{ responseDetail.eventReference.eventName || 'Event' }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ responseDetail.eventReference.eventId }}
                </div>
              </div>
            </div>

            <!-- Submitted At -->
            <div v-if="responseDetail.submittedAt" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubExecutionSubmitted') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {{ formatDateTime(responseDetail.submittedAt) }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  by {{ responseDetail.submittedBy?.name || 'Unknown' }}
                </div>
              </div>
            </div>

            <!-- Auditor (if available) -->
            <div v-if="responseDetail.auditor" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('audit.responseDetailAuditor') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {{ responseDetail.auditor.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- KPI Card -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsActivitySummary') }}</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('forms.reportCompliance') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ responseDetail.compliancePercentage }}%</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('audit.responseDetailTotalQuestions') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ responseDetail.totalQuestions }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('process.execLogsPassed') }}</span>
                <span class="font-medium text-green-600 dark:text-green-400">{{ responseDetail.totalPassed }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('process.execFailed') }}</span>
                <span class="font-medium text-red-600 dark:text-red-400">{{ responseDetail.totalFailed }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('audit.responseDetailFinalScore') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ responseDetail.finalScore }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Columns - Details -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Failed Questions Section -->
          <div v-if="responseDetail.failedQuestions && responseDetail.failedQuestions.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.rbTypeFailedQuestions') }}</h3>
            <div class="space-y-3">
              <div
                v-for="(question, index) in responseDetail.failedQuestions"
                :key="question.questionId || index"
                class="flex items-start gap-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
              >
                <div class="flex-shrink-0 mt-0.5">
                  <span :class="getSeverityBadgeClass(question.severity)">
                    {{ question.severity }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ question.label }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Question ID: {{ question.questionId }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Corrective Actions Section (Read-Only) -->
          <div v-if="responseDetail.correctiveActions && responseDetail.correctiveActions.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportCorrectiveActions') }}</h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsReadOnly') }}</span>
            </div>
            <div class="space-y-3">
              <div
                v-for="(action, index) in responseDetail.correctiveActions"
                :key="action.id || index"
                class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
              >
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {{ action.title }}
                    </h4>
                    <p v-if="action.auditorFinding" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {{ action.auditorFinding }}
                    </p>
                  </div>
                  <span :class="getCorrectiveActionStatusBadgeClass(action.status)">
                    {{ formatCorrectiveActionStatus(action.status) }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{{ t('settings.modFieldsMetadataOwner') }}</span>
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ action.owner?.name || 'Unassigned' }}</span>
                  <span v-if="action.addedAt" class="ml-2">• Added {{ formatDateTime(action.addedAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline Section -->
          <div v-if="responseDetail.timeline && responseDetail.timeline.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('audit.responseDetailTimeline') }}</h3>
            <div class="space-y-4">
              <div
                v-for="(entry, index) in responseDetail.timeline"
                :key="index"
                class="flex items-start gap-3 relative pl-6"
              >
                <!-- Timeline Line -->
                <div
                  v-if="index < responseDetail.timeline.length - 1"
                  class="absolute left-2 top-8 w-0.5 h-full bg-gray-200 dark:bg-gray-700"
                ></div>
                
                <!-- Timeline Dot -->
                <div :class="getTimelineDotClass(entry.type)" class="relative z-10 flex-shrink-0 mt-0.5"></div>
                
                <!-- Timeline Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ formatTimelineType(entry.type) }}
                    </span>
                    <span v-if="entry.reviewStatus" :class="getReviewStatusBadgeClass(entry.reviewStatus)" class="text-xs">
                      {{ entry.reviewStatus }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    by {{ entry.actor?.name || 'Unknown' }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ formatDateTime(entry.timestamp) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Related Records Panel (Phase 0F.1: Show Corrective Actions) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('records.taskRelatedRecordsTab') }}</h3>
            <!-- SAFETY: Response Detail is read-only. Any execution or review mutations must occur via CRM execution controllers only. -->
            <RelatedRecordsPanel
              app-key="SALES"
              module-key="responses"
              :record-id="responseDetail.id"
              :read-only="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import ExecutionActionBar from '@/components/ExecutionActionBar.vue';
import { useRecordContext } from '@/composables/useRecordContext';
import { useNotifications } from '@/composables/useNotifications';
import { getProjectionTypeLabel, getProjectionTypeBadgeClass, getAppLabel } from '@/utils/projectionLabels';

const route = useRoute();
const router = useRouter();

const responseDetail = ref(null);
const loading = ref(true);
const error = ref(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref('');

// Phase 1F: Notifications
const { success: showSuccess, error: showError } = useNotifications();

// Record context for execution capabilities and projection metadata
const { context: recordContext, load: loadRecordContext } = useRecordContext('SALES', 'responses', () => route.params.id);

// Phase 2C: Computed projection type label and badge (minimal for responses)
const projectionTypeLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.currentType) return null;
  const currentType = recordContext.value.record.projection.currentType;
  const appKey = recordContext.value.record.projection.appKey || 'SALES';
  return getProjectionTypeLabel(currentType, appKey);
});

const projectionTypeBadgeClass = computed(() => {
  if (!recordContext.value?.record?.projection?.currentType) return '';
  const currentType = recordContext.value.record.projection.currentType;
  const appKey = recordContext.value.record.projection.appKey || 'SALES';
  return getProjectionTypeBadgeClass(currentType, appKey);
});

const projectionAppLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.appKey) return null;
  return getAppLabel(recordContext.value.record.projection.appKey);
});

// Fetch response detail
const fetchResponseDetail = async () => {
  try {
    loading.value = true;
    error.value = null;
    accessDenied.value = false;
    
    const response = await apiClient.get(`/responses/${route.params.id}`);
    
    if (response.success) {
      responseDetail.value = response.data;
    } else {
      // Check if access denied
      if (response.message && response.message.includes('access')) {
        accessDenied.value = true;
        accessDeniedMessage.value = response.message;
      } else {
        error.value = response.message || 'Response not found';
      }
    }
  } catch (err) {
    console.error('Error fetching response detail:', err);
    
    // Check if 403 (forbidden)
    if (err.status === 403) {
      accessDenied.value = true;
      accessDeniedMessage.value = err.message || 'Access denied. Only the assigned auditor or corrective action owner can view this response.';
    } else {
      error.value = err.message || 'Failed to load response';
    }
  } finally {
    loading.value = false;
  }
};

// Format helpers
const formatDateTime = (date) => {
  return dateUtils.format(date, 'MMM D, YYYY h:mm A');
};

const formatTimelineType = (type) => {
  const typeMap = {
    'CHECK_IN': 'Check In',
    'SUBMIT': 'Submitted',
    'REVIEW': 'Review',
    'ACTION_COMPLETED': 'Corrective Action Completed'
  };
  return typeMap[type] || type;
};

const formatCorrectiveActionStatus = (status) => {
  const statusMap = {
    'OPEN': 'Open',
    'IN_PROGRESS': 'In Progress',
    'COMPLETED': 'Completed'
  };
  return statusMap[status] || status;
};

// Badge classes
const getExecutionStatusBadgeClass = (status) => {
  const classes = {
    'Not Started': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'In Progress': 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    'Submitted': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium'
  };
  return classes[status] || classes['Not Started'];
};

const getReviewStatusBadgeClass = (status) => {
  const classes = {
    'Pending Corrective Action': 'px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    'Needs Auditor Review': 'px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    'Approved': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'Rejected': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    'Closed': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium'
  };
  return classes[status] || classes['Needs Auditor Review'];
};

const getSeverityBadgeClass = (severity) => {
  const classes = {
    'LOW': 'px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    'MEDIUM': 'px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    'HIGH': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium'
  };
  return classes[severity] || classes['MEDIUM'];
};

const getCorrectiveActionStatusBadgeClass = (status) => {
  const classes = {
    'OPEN': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'IN_PROGRESS': 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    'COMPLETED': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium'
  };
  return classes[status] || classes['OPEN'];
};

const getTimelineDotClass = (type) => {
  const baseClass = 'w-4 h-4 rounded-full border-2 border-white dark:border-gray-800';
  const colorClasses = {
    'CHECK_IN': 'bg-blue-500',
    'SUBMIT': 'bg-green-500',
    'REVIEW': 'bg-indigo-500',
    'ACTION_COMPLETED': 'bg-orange-500'
  };
  return `${baseClass} ${colorClasses[type] || 'bg-gray-500'}`;
};

// Phase 1F: Execution state
const executing = ref(false);
const executingCapabilityKey = ref(null);

// Handle execution action
const handleExecutionAction = async (actionData) => {
  try {
    const { capabilityKey, capability } = actionData;
    
    // Phase 1F: Set executing state
    executing.value = true;
    executingCapabilityKey.value = capabilityKey;
    
    // Show confirmation if required
    if (capability?.uiHints?.confirmationRequired) {
      const confirmed = confirm(`Are you sure you want to ${capability.uiHints.label.toLowerCase()}?`);
      if (!confirmed) {
        executing.value = false;
        executingCapabilityKey.value = null;
        return;
      }
    }

    // Phase 1F: Optimistic UI lock - disable interactions
    // (No optimistic state mutation, just visual lock)

    // Execute action via execution API
    const response = await apiClient.post('/execution/execute', {
      capabilityKey,
      recordId: route.params.id,
      params: actionData.capability || {}
    });

    if (response.success) {
      // Phase 1F: Refresh record context after success (backend is source of truth)
      await fetchResponseDetail();
      await loadRecordContext();
      
      // Phase 1F: Show success toast
      if (!response.duplicate) {
        showSuccess(response.message || 'Action completed successfully');
      }
    } else {
      // Phase 1F: Show mapped error feedback
      const errorMessage = response.error?.message || response.message || 'Action failed';
      showError(errorMessage);
    }
  } catch (err) {
    console.error('[ResponseDetail] Execution error:', err);
    
    // Phase 1F: Show mapped error feedback
    const errorMessage = err.error?.message || err.message || 'Failed to execute action';
    showError(errorMessage);
  } finally {
    // Phase 1F: Clear executing state
    executing.value = false;
    executingCapabilityKey.value = null;
  }
};

// Load on mount
onMounted(async () => {
  await fetchResponseDetail();
  // Load record context for execution capabilities (uses route.params.id from composable)
  if (route.params.id) {
    await loadRecordContext();
  }
});
</script>

