<template>
  <div class="w-full">
    <!-- Header -->
    <header class="mb-6">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('records.approvalHistoryApprovalHistory') }}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        History of approvals for {{ entityType }}: {{ entityName }}
      </p>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="approvals.length === 0" class="text-center py-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('records.approvalHistoryNoApprovalHistoryFound') }}</p>
    </div>

    <!-- History Timeline -->
    <div v-else class="space-y-4">
      <div
        v-for="approval in approvals"
        :key="approval._id"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  approval.status === 'approved'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : approval.status === 'rejected'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : approval.status === 'timed_out'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                ]"
              >
                {{ approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Rejected' : approval.status === 'timed_out' ? 'Timed Out' : 'Pending' }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(approval.decidedAt || approval.createdAt) }}
              </span>
            </div>

            <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div v-if="approval.decidedBy">
                <span class="font-medium">{{ t('records.approvalHistoryDecidedBy') }}</span>
                {{ getDeciderName(approval) }}
              </div>
              <div v-if="approval.reason">
                <span class="font-medium">{{ t('records.approvalHistoryReason') }}</span>
                {{ approval.reason }}
              </div>
              <div v-if="approval.processId?.name">
                <span class="font-medium">{{ t('records.approvalHistoryProcess') }}</span>
                {{ approval.processId.name }}
              </div>
            </div>

            <!-- Escalation History -->
            <div v-if="approval.escalatedApprovers && approval.escalatedApprovers.length > 0" class="mt-2 text-xs text-blue-600 dark:text-blue-400">{{ t('records.approvalHistoryEscalatedToNewApprovers') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  entityName: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();

const approvals = ref([]);
const loading = ref(true);

const loadHistory = async () => {
  loading.value = true;
  try {
    // For now, load all approvals for this entity (including resolved)
    // In future, API could support entityType/entityId filter
    const response = await apiClient.get('/approvals');
    approvals.value = (response.data || [])
      .filter(a => 
        a.entityType === props.entityType && 
        a.entityId === props.entityId &&
        a.status !== 'pending'
      )
      .sort((a, b) => new Date(b.decidedAt || b.createdAt) - new Date(a.decidedAt || a.createdAt));
  } catch (err) {
    console.error('Error loading approval history:', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const getDeciderName = (approval) => {
  if (approval.decidedBy) {
    if (typeof approval.decidedBy === 'object' && approval.decidedBy.firstName) {
      return `${approval.decidedBy.firstName} ${approval.decidedBy.lastName || ''}`.trim() || approval.decidedBy.email;
    }
  }
  return 'System';
};

onMounted(() => {
  loadHistory();
});
</script>
