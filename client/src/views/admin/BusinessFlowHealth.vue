<template>
  <div class="w-full max-w-6xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Health Dashboard -->
    <div v-else-if="healthData" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            @click="$router.back()"
            class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ t('actions.back') }}
          </button>
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ healthData.flowName }}{{ t('process.flowHealthTitleSuffix') }}
            </h1>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.flowHealthSubtitle') }}
            </p>
          </div>
        </div>

        <!-- Time Filter -->
        <select
          v-model="selectedDays"
          @change="loadAllData"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option :value="7">{{ t('process.flowHealthLast7') }}</option>
          <option :value="30">{{ t('process.flowHealthLast30') }}</option>
          <option :value="90">{{ t('process.flowHealthLast90') }}</option>
        </select>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <!-- Health Status -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardStatus') }}
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-3 h-3 rounded-full',
                healthData.summary.healthStatus === 'healthy' ? 'bg-green-500' :
                healthData.summary.healthStatus === 'needs_attention' ? 'bg-yellow-500' : 'bg-red-500'
              ]"
            ></span>
            <span class="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {{ healthStatusLabel(healthData.summary.healthStatus) }}
            </span>
          </div>
        </div>

        <!-- Total Executions -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardExecutions') }}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ healthData.summary.totalExecutions }}
          </div>
        </div>

        <!-- Completion Rate -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardCompletion') }}
          </div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ healthData.summary.completionRate }}%
          </div>
        </div>

        <!-- Avg Time -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardAvgTime') }}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formatDuration(healthData.summary.avgCompletionTimeMinutes) }}
          </div>
        </div>

        <!-- Approval Pause Rate -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardApprovalPauses') }}
          </div>
          <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {{ healthData.summary.approvalPauseRate }}%
          </div>
        </div>

        <!-- Failure Rate -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {{ t('process.flowHealthCardFailureRate') }}
          </div>
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">
            {{ healthData.summary.failureRate }}%
          </div>
        </div>
      </div>

      <!-- Bottlenecks Alert -->
      <div v-if="bottlenecks && bottlenecks.bottleneckCount > 0" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
              {{ t('process.flowHealthBottlenecks', { count: bottlenecks.bottleneckCount }) }}
            </h3>
            <p class="text-sm text-yellow-800 dark:text-yellow-300">
              {{ t('process.flowHealthBottleneckSummary', { critical: bottlenecks.criticalCount, warning: bottlenecks.warningCount }) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Process Metrics Timeline -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('process.flowHealthProcessMetrics') }}</h2>

        <div v-if="processMetrics && processMetrics.processes.length > 0" class="space-y-6">
          <div
            v-for="(proc, index) in processMetrics.processes"
            :key="proc.processId"
            class="relative pl-16"
          >
            <!-- Timeline connector -->
            <div
              v-if="index < processMetrics.processes.length - 1"
              class="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"
            ></div>

            <!-- Process marker -->
            <div
              :class="[
                'absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800',
                getProcessHealthColor(proc)
              ]"
            >
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <!-- Process card with metrics -->
            <div
              @click="selectProcess(proc)"
              class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-white">
                    {{ proc.processName }}
                  </h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ getTriggerLabel(proc.trigger) }}
                  </p>
                </div>
                <span
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    proc.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  ]"
                >
                  {{ proc.status === 'active' ? t('process.statusActive') : t('process.statusDraft') }}
                </span>
              </div>

              <!-- Metrics Grid -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthMetricExecutions') }}</div>
                  <div class="font-semibold text-gray-900 dark:text-white">{{ proc.metrics.totalExecutions }}</div>
                </div>
                <div>
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthMetricCompletion') }}</div>
                  <div class="font-semibold text-green-600 dark:text-green-400">{{ proc.metrics.completionRate }}%</div>
                </div>
                <div>
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthMetricAvgTime') }}</div>
                  <div class="font-semibold text-gray-900 dark:text-white">{{ formatDuration(proc.metrics.avgDurationMinutes) }}</div>
                </div>
                <div>
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthMetricFailures') }}</div>
                  <div :class="['font-semibold', proc.metrics.failedExecutions > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white']">
                    {{ proc.metrics.failedExecutions }}
                  </div>
                </div>
              </div>

              <!-- Approval Metrics (if applicable) -->
              <div v-if="proc.approvalMetrics.totalApprovals > 0" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ t('process.flowHealthApprovalGate') }}</div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthPending') }}</div>
                    <div :class="['font-semibold', proc.approvalMetrics.pendingApprovals > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white']">
                      {{ proc.approvalMetrics.pendingApprovals }}
                    </div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthApproved') }}</div>
                    <div class="font-semibold text-green-600 dark:text-green-400">{{ proc.approvalMetrics.approvedCount }}</div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthRejected') }}</div>
                    <div :class="['font-semibold', proc.approvalMetrics.rejectedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white']">
                      {{ proc.approvalMetrics.rejectedCount }}
                    </div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthAvgWait') }}</div>
                    <div class="font-semibold text-gray-900 dark:text-white">{{ formatDuration(proc.approvalMetrics.avgApprovalWaitMinutes) }}</div>
                  </div>
                </div>
              </div>

              <!-- Bottleneck Warning -->
              <div v-if="getProcessBottlenecks(proc.processId).length > 0" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div
                  v-for="bottleneck in getProcessBottlenecks(proc.processId)"
                  :key="bottleneck.type"
                  class="flex items-start gap-2 text-sm"
                >
                  <svg
                    :class="[
                      'w-4 h-4 mt-0.5',
                      bottleneck.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                    ]"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span :class="bottleneck.severity === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'">
                    {{ bottleneck.message }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ t('process.flowHealthNoData') }}
        </div>
      </div>

      <!-- Bottlenecks Detail -->
      <div v-if="bottlenecks && bottlenecks.bottlenecks.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('process.flowHealthBottleneckDetails') }}</h2>

        <div class="space-y-3">
          <div
            v-for="(bottleneck, index) in bottlenecks.bottlenecks"
            :key="index"
            :class="[
              'rounded-lg p-4 border',
              bottleneck.severity === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            ]"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase',
                      bottleneck.severity === 'critical'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    ]"
                  >
                    {{ bottleneck.severity }}
                  </span>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ bottleneck.processName }}
                  </span>
                </div>
                <p :class="bottleneck.severity === 'critical' ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'">
                  {{ bottleneck.message }}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ bottleneck.recommendation }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Process Drilldown Modal -->
    <div
      v-if="selectedProcess"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="selectedProcess = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ selectedProcess.processName }}
            </h3>
            <button
              @click="selectedProcess = null"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="space-y-4">
            <!-- Execution Stats -->
            <div>
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('process.flowHealthExecStats') }}</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthTotalExecutions') }}</div>
                  <div class="text-xl font-bold text-gray-900 dark:text-white">{{ selectedProcess.metrics.totalExecutions }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthCompleted') }}</div>
                  <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ selectedProcess.metrics.completedExecutions }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthFailed') }}</div>
                  <div class="text-xl font-bold text-red-600 dark:text-red-400">{{ selectedProcess.metrics.failedExecutions }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthWaitingApproval') }}</div>
                  <div class="text-xl font-bold text-yellow-600 dark:text-yellow-400">{{ selectedProcess.metrics.waitingApproval }}</div>
                </div>
              </div>
            </div>

            <!-- Approval Stats (if applicable) -->
            <div v-if="selectedProcess.approvalMetrics.totalApprovals > 0">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('process.flowHealthApprovalStats') }}</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthTotalApprovals') }}</div>
                  <div class="text-xl font-bold text-gray-900 dark:text-white">{{ selectedProcess.approvalMetrics.totalApprovals }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthAvgWaitTime') }}</div>
                  <div class="text-xl font-bold text-gray-900 dark:text-white">{{ formatDuration(selectedProcess.approvalMetrics.avgApprovalWaitMinutes) }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthTimedOut') }}</div>
                  <div class="text-xl font-bold text-orange-600 dark:text-orange-400">{{ selectedProcess.approvalMetrics.timedOutCount }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <div class="text-gray-500 dark:text-gray-400">{{ t('process.flowHealthRejectionRate') }}</div>
                  <div class="text-xl font-bold text-red-600 dark:text-red-400">
                    {{ getRejectionRate(selectedProcess.approvalMetrics) }}%
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="viewProcessLogs(selectedProcess)"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {{ t('process.flowHealthViewLogs') }}
              </button>
              <button
                @click="viewProcess(selectedProcess)"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {{ t('process.flowHealthViewProcess') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

function healthStatusLabel(status) {
  if (status === 'healthy') return t('process.flowHealthStatusHealthy');
  if (status === 'needs_attention') return t('process.flowHealthStatusNeedsAttention');
  return t('process.flowHealthStatusUnhealthy');
}

const loading = ref(true);
const error = ref(null);
const selectedDays = ref(30);
const healthData = ref(null);
const processMetrics = ref(null);
const bottlenecks = ref(null);
const selectedProcess = ref(null);

const loadAllData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const flowId = route.params.id;
    const days = selectedDays.value;

    const [healthRes, metricsRes, bottlenecksRes] = await Promise.all([
      apiClient.get(`/admin/business-flows/${flowId}/health`, { params: { days } }),
      apiClient.get(`/admin/business-flows/${flowId}/metrics`, { params: { days } }),
      apiClient.get(`/admin/business-flows/${flowId}/bottlenecks`, { params: { days } })
    ]);

    healthData.value = healthRes.data;
    processMetrics.value = metricsRes.data;
    bottlenecks.value = bottlenecksRes.data;
  } catch (err) {
    error.value = err.message || t('process.flowHealthLoadFailed');
    console.error('Error loading health data:', err);
  } finally {
    loading.value = false;
  }
};

const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return t('process.durationZero');
  if (minutes < 60) return t('process.durationMinutes', { minutes });
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? t('process.durationHoursMinutes', { hours, minutes: mins })
      : t('process.durationHours', { hours });
  }
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  return hours > 0
    ? t('process.durationDaysHours', { days, hours })
    : t('process.durationDays', { days });
};

const getTriggerLabel = (trigger) => {
  if (!trigger) return t('process.triggerManualSummary');
  const labels = {
    'record.created': t('process.triggerHealthRecordCreated'),
    'record.updated': t('process.triggerHealthRecordUpdated'),
    'status.changed': t('process.triggerHealthStatusChanged'),
    'stage.changed': t('process.triggerHealthStageChanged')
  };
  return labels[trigger.eventType] || trigger.eventType || t('process.triggerManualSummary');
};

const getProcessHealthColor = (proc) => {
  const failureRate = proc.metrics.failureRate || 0;
  const pendingApprovals = proc.approvalMetrics?.pendingApprovals || 0;
  
  if (failureRate > 20 || pendingApprovals > 10) {
    return 'bg-red-500';
  } else if (failureRate > 10 || pendingApprovals > 5) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
};

const getProcessBottlenecks = (processId) => {
  if (!bottlenecks.value?.bottlenecks) return [];
  return bottlenecks.value.bottlenecks.filter(b => b.processId === processId);
};

const getRejectionRate = (approvalMetrics) => {
  const total = approvalMetrics.approvedCount + approvalMetrics.rejectedCount;
  if (total === 0) return 0;
  return Math.round((approvalMetrics.rejectedCount / total) * 100);
};

const selectProcess = (proc) => {
  selectedProcess.value = proc;
};

const viewProcess = (proc) => {
  router.push(`/settings/automation/processes?processId=${proc.processId}`);
};

const viewProcessLogs = (proc) => {
  // Navigate to process with logs view
  router.push(`/settings/automation/processes?processId=${proc.processId}&view=logs`);
};

onMounted(() => {
  document.title = t('process.flowHealthPageTitle');
  loadAllData();
});
</script>
