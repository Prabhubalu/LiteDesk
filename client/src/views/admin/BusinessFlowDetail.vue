<template>
  <div class="w-full max-w-5xl mx-auto">
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

    <!-- Flow Detail -->
    <div v-else-if="flow" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button
          @click="$router.back()"
          class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          {{ t('actions.back') }}
        </button>
        <div class="flex items-center gap-3">
          <button
            @click="viewHealth"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {{ t('process.flowViewHealth') }}
          </button>
          <button
            @click="editFlow"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {{ t('actions.edit') }}
          </button>
        </div>
      </div>

      <!-- Flow Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {{ flow.name }}
            </h1>
            <p v-if="flow.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {{ flow.description }}
            </p>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {{ flow.appKey }}
              </span>
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  hasActiveProcesses
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                ]"
              >
                {{ hasActiveProcesses ? t('process.statusActive') : t('process.statusDraft') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Flow Timeline (PRIMARY VISUAL) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('process.flowTimelineHeading') }}</h2>

        <div class="relative">
          <!-- Timeline Line -->
          <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>

          <!-- Timeline Items -->
          <div class="space-y-8 relative">
            <div
              v-for="(item, index) in timelineItems"
              :key="`${item.type}-${index}`"
              class="relative pl-16"
            >
              <!-- Event Marker -->
              <div
                v-if="item.type === 'event'"
                class="absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 border-4 border-white dark:border-gray-800"
              >
                <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <!-- Process Marker -->
              <div
                v-else-if="item.type === 'process'"
                class="absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 border-4 border-white dark:border-gray-800"
              >
                <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <!-- Outcome Marker -->
              <div
                v-else-if="item.type === 'outcome'"
                class="absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 border-4 border-white dark:border-gray-800"
              >
                <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <!-- Event Card -->
              <div
                v-if="item.type === 'event'"
                @click="showEventDrawer(item)"
                class="cursor-pointer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h3 class="font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  {{ item.label }}
                </h3>
                <p class="text-sm text-purple-700 dark:text-purple-300">
                  {{ item.description }}
                </p>
              </div>

              <!-- Process Card -->
              <div
                v-else-if="item.type === 'process'"
                @click="viewProcess(item.process)"
                class="cursor-pointer bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between mb-2">
                  <h3 class="font-semibold text-blue-900 dark:text-blue-200">
                    {{ item.process.name }}
                  </h3>
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      item.process.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    ]"
                  >
                    {{ item.process.status === 'active' ? t('process.statusActive') : t('process.statusDraft') }}
                  </span>
                </div>
                <p class="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {{ getTriggerSummary(item.process) }}
                </p>
                <div class="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <div v-for="(action, idx) in getProcessActions(item.process)" :key="idx">
                    • {{ action }}
                  </div>
                </div>
              </div>

              <!-- Outcome Card -->
              <div
                v-else-if="item.type === 'outcome'"
                class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
              >
                <h3 class="font-semibold text-green-900 dark:text-green-200">
                  {{ item.label }}
                </h3>
                <p v-if="item.description" class="text-sm text-green-700 dark:text-green-300 mt-1">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Drawer -->
    <div
      v-if="selectedEvent"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50"
      @click.self="selectedEvent = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('process.flowDomainEventTitle') }}</h3>
            <button
              @click="selectedEvent = null"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('process.flowEventName') }}</span>
              <p class="text-sm text-gray-900 dark:text-white">{{ selectedEvent.label }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('process.flowDescription') }}</span>
              <p class="text-sm text-gray-900 dark:text-white">{{ selectedEvent.description }}</p>
            </div>
            <div v-if="selectedEvent.entityType">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('process.flowEntityType') }}</span>
              <p class="text-sm text-gray-900 dark:text-white">{{ selectedEvent.entityType }}</p>
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

const flow = ref(null);
const loading = ref(true);
const error = ref(null);
const selectedEvent = ref(null);

const hasActiveProcesses = computed(() => {
  if (!flow.value?.processes) return false;
  return flow.value.processes.some(p => p.status === 'active');
});

const timelineItems = computed(() => {
  if (!flow.value?.processes || flow.value.processes.length === 0) return [];

  const items = [];
  const processes = flow.value.processes || [];

  processes.forEach((process, index) => {
    const trigger = process.trigger || {};
    if (trigger.type === 'domain_event') {
      items.push({
        type: 'event',
        label: getEventLabel(trigger.eventType),
        description: getEventDescription(trigger.eventType),
        entityType: inferEntityType(process)
      });
    }

    items.push({
      type: 'process',
      process: process
    });

    if (index === processes.length - 1) {
      items.push({
        type: 'outcome',
        label: t('process.flowCompleteLabel'),
        description: t('process.flowCompleteDesc')
      });
    }
  });

  return items;
});

const getEventLabel = (eventType) => {
  const labels = {
    'record.created': t('process.eventRecordCreated'),
    'record.updated': t('process.eventRecordUpdated'),
    'status.changed': t('process.eventStatusChanged'),
    'stage.changed': t('process.eventStageChanged')
  };
  return labels[eventType] || eventType;
};

const getEventDescription = (eventType) => {
  const descriptions = {
    'record.created': t('process.eventDescRecordCreated'),
    'record.updated': t('process.eventDescRecordUpdated'),
    'status.changed': t('process.eventDescStatusChanged'),
    'stage.changed': t('process.eventDescStageChanged')
  };
  return descriptions[eventType] || t('process.eventDescGeneric', { eventType });
};

const inferEntityType = (process) => {
  if (!process.nodes || !Array.isArray(process.nodes)) return null;
  for (const node of process.nodes) {
    if (node.type === 'field_rule' || node.type === 'ownership_rule' || node.type === 'status_guard') {
      return node.config?.entityType || null;
    }
  }
  return null;
};

const getTriggerSummary = (process) => {
  const trigger = process.trigger || {};
  if (trigger.type === 'domain_event') {
    const eventType = trigger.eventType || '';
    if (eventType === 'record.created') return t('process.triggerOnRecordCreated');
    if (eventType === 'record.updated') return t('process.triggerOnRecordUpdated');
    if (eventType === 'status.changed') return t('process.triggerOnStatusChanged');
    if (eventType === 'stage.changed') return t('process.triggerOnStageChanged');
    return t('process.triggerOnEvent', { eventType });
  }
  return t('process.triggerManualSummary');
};

const getProcessActions = (process) => {
  if (!process.nodes || !Array.isArray(process.nodes)) return [];
  const actions = [];
  process.nodes.forEach(node => {
    if (node.type === 'action') {
      const actionType = node.config?.actionType;
      if (actionType === 'create_task') {
        actions.push(t('process.flowActionCreateTask', {
          title: node.config.params?.title || t('process.flowUntitledTask')
        }));
      } else if (actionType === 'notify_user') {
        actions.push(t('process.flowActionNotifyUser'));
      } else if (actionType === 'start_process') {
        actions.push(t('process.flowActionStartProcess'));
      }
    } else if (node.type === 'field_rule') {
      const rule = node.config?.rule;
      const fieldKey = node.config?.fieldKey;
      if (rule === 'mandatory') {
        actions.push(t('process.flowActionMandatoryField', { field: fieldKey }));
      } else if (rule === 'default') {
        actions.push(t('process.flowActionDefaultField', { field: fieldKey }));
      }
    } else if (node.type === 'ownership_rule') {
      actions.push(t('process.flowActionAssignOwnership'));
    } else if (node.type === 'status_guard') {
      actions.push(t('process.flowActionStatusGuard'));
    } else if (node.type === 'approval_gate') {
      actions.push(t('process.flowActionApproval'));
    }
  });
  return actions.slice(0, 3);
};

const loadFlow = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get(`/admin/business-flows/${route.params.id}`);
    flow.value = response.data;
  } catch (err) {
    error.value = err.message || t('process.flowDetailLoadFailed');
    console.error('Error loading business flow:', err);
  } finally {
    loading.value = false;
  }
};

const editFlow = () => {
  router.push(`/settings/automation/flows/${route.params.id}/edit`);
};

const viewHealth = () => {
  router.push(`/settings/automation/flows/${route.params.id}/health`);
};

const viewProcess = (process) => {
  router.push(`/settings/automation/processes?processId=${process._id}`);
};

const showEventDrawer = (event) => {
  selectedEvent.value = event;
};

onMounted(() => {
  document.title = t('process.flowDetailPageTitle');
  loadFlow();
});
</script>
