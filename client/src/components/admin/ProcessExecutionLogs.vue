<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('process.execLogsHeading') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ process?.name }}
          </p>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          @click="$emit('close')"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="!selectedExecution" class="p-6">
          <div v-if="loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>

          <div v-else-if="executions.length === 0" class="text-center py-12">
            <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.execLogsEmptyHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.execLogsEmptyBody') }}
            </p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="execution in executions"
              :key="execution._id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow bg-white dark:bg-gray-800"
              @click="viewExecutionDetails(execution)"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        execution.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : execution.status === 'failed'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      ]"
                    >
                      {{ executionStatusLabel(execution.status) }}
                    </span>
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                      {{ formatDate(execution.startedAt) }}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>
                      <span class="font-medium">{{ t('process.execLogsTrigger') }}</span>
                      {{ getTriggerLabel(execution) }}
                    </div>
                    <div v-if="execution.entityType && execution.entityId">
                      <span class="font-medium">{{ t('process.execLogsEntity') }}</span>
                      {{ execution.entityType }} ({{ execution.entityId }})
                    </div>
                    <div v-if="execution.completedAt && execution.startedAt">
                      <span class="font-medium">{{ t('process.execLogsDuration') }}</span>
                      {{ getDuration(execution.startedAt, execution.completedAt) }}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  @click.stop="viewExecutionDetails(execution)"
                >
                  {{ t('process.execLogsViewDetails') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="p-6">
          <div class="mb-4">
            <button
              type="button"
              class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              @click="selectedExecution = null"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ t('process.execLogsBackToList') }}
            </button>
          </div>

          <div class="space-y-4">
            <TimelineItem
              type="start"
              :status="'completed'"
              :title="t('process.execLogsProcessStarted')"
              :timestamp="selectedExecution.startedAt"
            >
              <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>
                  <span class="font-medium">{{ t('process.execLogsTrigger') }}</span>
                  {{ getTriggerLabel(selectedExecution) }}
                </div>
                <div v-if="selectedExecution.triggeredBy">
                  <span class="font-medium">{{ t('process.execLogsTriggeredBy') }}</span>
                  {{ t('process.execLogsTriggeredByUser', { id: selectedExecution.triggeredBy }) }}
                </div>
                <div v-if="selectedExecution.entityType && selectedExecution.entityId">
                  <span class="font-medium">{{ t('process.execLogsEntity') }}</span>
                  {{ selectedExecution.entityType }} ({{ selectedExecution.entityId }})
                </div>
              </div>
            </TimelineItem>

            <template v-for="(node, index) in processNodes" :key="node.id">
              <TimelineItem
                v-if="node.type === 'condition'"
                type="condition"
                :status="getNodeStatus(node, index)"
                :title="t('process.execLogsRuleEvaluated')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ t('process.execLogsCondition') }}</div>
                  <div>{{ getConditionSummary(node) }}</div>
                  <div class="mt-2 text-xs">
                    {{ t('process.execLogsResult') }}
                    <span :class="getNodeStatus(node, index) === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'">
                      {{ getNodeStatus(node, index) === 'completed' ? t('process.execLogsPassed') : t('process.execLogsSkipped') }}
                    </span>
                  </div>
                </div>
              </TimelineItem>

              <TimelineItem
                v-if="node.type === 'field_rule'"
                type="behavior"
                :status="getNodeStatus(node, index)"
                :title="t('process.execLogsBehaviorProposed')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ t('process.execLogsFieldRule') }}</div>
                  <div>{{ getFieldRuleSummary(node) }}</div>
                </div>
              </TimelineItem>

              <TimelineItem
                v-if="node.type === 'ownership_rule'"
                type="behavior"
                :status="getNodeStatus(node, index)"
                :title="t('process.execLogsBehaviorProposed')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ t('process.execLogsOwnershipRule') }}</div>
                  <div>{{ getOwnershipRuleSummary(node) }}</div>
                </div>
              </TimelineItem>

              <TimelineItem
                v-if="node.type === 'status_guard'"
                type="behavior"
                :status="getNodeStatus(node, index)"
                :title="t('process.execLogsBehaviorProposed')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ t('process.execLogsStatusGuard') }}</div>
                  <div>{{ getStatusGuardSummary(node) }}</div>
                </div>
              </TimelineItem>

              <TimelineItem
                v-if="node.type === 'action'"
                type="action"
                :status="getNodeStatus(node, index)"
                :title="t('process.execLogsActionExecuted')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ getActionTypeLabel(node) }}:</div>
                  <div>{{ getActionSummary(node) }}</div>
                  <div class="mt-2 text-xs">
                    {{ t('process.execLogsResult') }}
                    <span :class="getNodeStatus(node, index) === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                      {{ getNodeStatus(node, index) === 'completed' ? t('process.execLogsSuccess') : t('process.execLogsStatusFailed') }}
                    </span>
                  </div>
                </div>
              </TimelineItem>
            </template>

            <TimelineItem
              :type="selectedExecution.status === 'completed' ? 'success' : 'error'"
              :status="selectedExecution.status === 'completed' ? 'completed' : 'failed'"
              :title="executionEndTitle(selectedExecution)"
              :timestamp="selectedExecution.completedAt || selectedExecution.startedAt"
            >
              <div v-if="selectedExecution.status === 'failed'" class="text-sm text-red-600 dark:text-red-400">
                <div class="font-medium mb-1">{{ t('process.execLogsError') }}</div>
                <div>{{ selectedExecution.error || t('process.execLogsUnknownError') }}</div>
              </div>
              <div v-else class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('process.execLogsCompletedSuccess') }}
              </div>
            </TimelineItem>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import TimelineItem from '@/components/admin/process/TimelineItem.vue';
import {
  getConditionSummary,
  getFieldRuleSummary,
  getOwnershipRuleSummary,
  getStatusGuardSummary,
  getActionTypeLabel,
  getActionSummary
} from '@/utils/processTimelineSummaries';

const { t } = useI18n();

const props = defineProps({
  process: {
    type: Object,
    required: true
  }
});

defineEmits(['close']);

const executions = ref([]);
const loading = ref(true);
const selectedExecution = ref(null);

const processNodes = computed(() => {
  if (!props.process?.nodes) return [];
  return props.process.nodes.filter((n) => n.type !== 'trigger' && n.type !== 'end');
});

const executionStatusLabel = (status) => {
  if (status === 'completed') return t('process.execLogsStatusCompleted');
  if (status === 'failed') return t('process.execLogsStatusFailed');
  return t('process.execLogsStatusRunning');
};

const executionEndTitle = (execution) =>
  execution.status === 'completed'
    ? t('process.execLogsProcessCompleted')
    : t('process.execLogsProcessFailed');

const loadExecutions = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get(`/admin/processes/${props.process._id}/executions`);
    executions.value = response.data || [];
  } catch (err) {
    console.error('Error loading executions:', err);
  } finally {
    loading.value = false;
  }
};

const viewExecutionDetails = (execution) => {
  selectedExecution.value = execution;
};

const getTriggerLabel = (execution) => {
  if (execution.eventId) {
    return t('process.execLogsTriggerDomain');
  }
  return t('process.execLogsTriggerManual');
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const getDuration = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const diffMs = endMs - startMs;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const getNodeStatus = (node, index) => {
  if (selectedExecution.value?.status === 'completed') {
    return 'completed';
  }
  if (selectedExecution.value?.status === 'failed') {
    const failedNodeId = selectedExecution.value.currentNodeId;
    if (failedNodeId && node.id === failedNodeId) {
      return 'failed';
    }
    return 'skipped';
  }
  return 'pending';
};

onMounted(() => {
  loadExecutions();
});
</script>
