<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('process.testModalHeading') }}</h2>
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

      <div class="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-blue-800 dark:text-blue-200 font-medium">
            {{ t('process.testModalBanner') }}
          </p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="step === 1" class="max-w-2xl mx-auto space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.testModalSelectRecordHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.testModalSelectRecordIntro') }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('process.fieldEntityType') }} <span class="text-red-500">*</span>
            </label>
            <select
              v-model="testData.entityType"
              class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
            >
              <option value="">{{ t('process.phSelectEntityType') }}</option>
              <option value="people">{{ t('process.entityPeople') }}</option>
              <option value="organization">{{ t('process.entityOrganization') }}</option>
              <option value="deal">{{ t('process.entityDeal') }}</option>
            </select>
          </div>

          <div v-if="testData.entityType">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('process.fieldRecord') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="testData.entityId"
              type="text"
              :placeholder="t('process.phRecordId')"
              class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('process.testModalRecordIdHint', { entityType: testData.entityType }) }}
            </p>
          </div>

          <div v-if="process?.trigger?.type === 'domain_event'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('process.testModalSimulateTrigger') }}
            </label>
            <div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p class="text-sm text-gray-700 dark:text-gray-300">
                <span class="font-medium">{{ t('process.testModalEventType') }}</span>
                {{ process.trigger.eventType }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ t('process.testModalSimulateHint') }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="step === 2" class="max-w-3xl mx-auto">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.testModalResultsHeading') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('process.testModalResultsIntro') }}
            </p>
          </div>

          <div v-if="testLoading" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{{ t('process.testModalRunning') }}</p>
          </div>

          <div v-else-if="testResults" class="space-y-4">
            <TimelineItem
              type="start"
              status="completed"
              :title="t('process.testModalProcessStartedTest')"
              :timestamp="new Date().toISOString()"
            >
              <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>
                  <span class="font-medium">{{ t('process.execLogsTrigger') }}</span>
                  {{ process?.trigger?.type === 'domain_event' ? process.trigger.eventType : t('process.testModalTriggerManual') }}
                </div>
                <div>
                  <span class="font-medium">{{ t('process.testModalTestRecord') }}</span>
                  {{ testData.entityType }} ({{ testData.entityId }})
                </div>
              </div>
            </TimelineItem>

            <template v-for="node in processNodes" :key="node.id">
              <TimelineItem
                v-if="node.type === 'condition'"
                type="condition"
                status="completed"
                :title="t('process.execLogsRuleEvaluated')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ t('process.execLogsCondition') }}</div>
                  <div>{{ getConditionSummary(node) }}</div>
                  <div class="mt-2 text-xs text-green-600 dark:text-green-400">
                    {{ t('process.testModalWouldPass') }}
                  </div>
                </div>
              </TimelineItem>

              <TimelineItem
                v-if="node.type === 'field_rule'"
                type="behavior"
                status="completed"
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
                status="completed"
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
                status="completed"
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
                status="completed"
                :title="t('process.testModalActionWouldExecute')"
                :timestamp="null"
              >
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  <div class="font-medium mb-1">{{ getActionTypeLabel(node) }}:</div>
                  <div>{{ getActionSummary(node) }}</div>
                  <div class="mt-2 text-xs text-green-600 dark:text-green-400">
                    {{ t('process.testModalWouldSucceed') }}
                  </div>
                </div>
              </TimelineItem>
            </template>

            <TimelineItem
              type="success"
              status="completed"
              :title="t('process.testModalWouldComplete')"
              :timestamp="new Date().toISOString()"
            >
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('process.testModalWouldCompleteBody') }}
              </div>
            </TimelineItem>
          </div>

          <div v-else-if="testError" class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {{ testError }}
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          v-if="step === 2"
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @click="step = 1"
        >
          {{ t('actions.back') }}
        </button>
        <div v-else class="flex-1"></div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="$emit('close')"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            v-if="step === 1"
            type="button"
            :disabled="!canRunTest || testLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="runTest"
          >
            {{ t('process.testModalRunTest') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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

const step = ref(1);
const testData = ref({
  entityType: '',
  entityId: ''
});
const testLoading = ref(false);
const testResults = ref(null);
const testError = ref(null);

const canRunTest = computed(() => testData.value.entityType && testData.value.entityId);

const processNodes = computed(() => {
  if (!props.process?.nodes) return [];
  return props.process.nodes.filter((n) => n.type !== 'trigger' && n.type !== 'end');
});

const runTest = async () => {
  testLoading.value = true;
  testError.value = null;
  testResults.value = null;

  try {
    const response = await apiClient.post(`/admin/processes/${props.process._id}/test`, {
      entityType: testData.value.entityType,
      entityId: testData.value.entityId
    });

    if (response.success) {
      testResults.value = response.data;
      step.value = 2;
    } else {
      testError.value = response.message || t('process.testModalTestFailed');
    }
  } catch (err) {
    testError.value = err.message || t('process.testModalRunFailed');
    console.error('Error running test:', err);
  } finally {
    testLoading.value = false;
  }
};
</script>
