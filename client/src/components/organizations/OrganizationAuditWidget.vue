<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Audit History</h3>
      <button
        v-if="audits.length > 0"
        @click="viewAllAudits"
        class="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-500 font-medium"
      >
        View All
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <div class="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading audit history...</p>
    </div>

    <!-- Summary KPIs -->
    <div v-else-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Audits</p>
        <p class="text-xl font-bold text-gray-900 dark:text-white">{{ summary.totalAudits }}</p>
      </div>
      <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Compliance</p>
        <p class="text-xl font-bold text-green-600 dark:text-green-400">{{ summary.avgCompliance }}%</p>
      </div>
      <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Pass Rate</p>
        <p class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ summary.passRate }}%</p>
      </div>
      <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Trend</p>
        <div class="flex items-center justify-center gap-1">
          <svg
            v-if="summary.trend === 'improving'"
            class="w-5 h-5 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <svg
            v-else-if="summary.trend === 'declining'"
            class="w-5 h-5 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          <svg
            v-else
            class="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />
          </svg>
          <span
            class="text-sm font-semibold"
            :class="{
              'text-green-600 dark:text-green-400': summary.trend === 'improving',
              'text-red-600 dark:text-red-400': summary.trend === 'declining',
              'text-gray-600 dark:text-gray-400': summary.trend === 'stable'
            }"
          >
            {{ summary.trend === 'improving' ? 'Improving' : summary.trend === 'declining' ? 'Declining' : 'Stable' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Audit List -->
    <div v-if="audits.length > 0" class="space-y-3">
      <div
        v-for="audit in audits.slice(0, limit)"
        :key="audit.auditId"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
        @click="viewAudit(audit)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ audit.formName }}</h4>
              <BadgeCell
                :value="audit.formType"
                :variant-map="{
                  'Audit': 'warning',
                  'Survey': 'info',
                  'Feedback': 'success',
                  'Inspection': 'danger',
                  'Custom': 'default'
                }"
              />
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-2">
              <span>{{ formatDate(audit.auditDate) }}</span>
              <span v-if="audit.auditor">by {{ audit.auditor.name }}</span>
            </div>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">Score:</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ audit.score }}%</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500 dark:text-gray-400">Compliance:</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ audit.compliance }}%</span>
              </div>
              <BadgeCell
                :value="audit.status"
                :variant-map="{
                  'Approved': 'success',
                  'Pending Corrective Action': 'warning',
                  'Needs Auditor Review': 'warning',
                  'Rejected': 'danger',
                  'Closed': 'default',
                  'Submitted': 'info'
                }"
              />
            </div>
            <div v-if="audit.hasCorrectiveActions" class="mt-2">
              <span class="text-xs text-orange-600 dark:text-orange-400 font-medium">
                {{ audit.correctiveActionsCount }} corrective action{{ audit.correctiveActionsCount !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <button
              v-if="audit.reportUrl"
              @click.stop="downloadReport(audit.reportUrl)"
              class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Download Report"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No audit history available</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';

const props = defineProps({
  organizationId: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    default: 5
  }
});

const router = useRouter();
const { openTab } = useTabs();

const audits = ref([]);
const summary = ref(null);
const loading = ref(false);

const fetchAudits = async () => {
  loading.value = true;
  try {
    const response = await apiClient(`/forms/organization/${props.organizationId}/audits`, {
      method: 'GET'
    });

    if (response.success && response.data) {
      audits.value = response.data.audits || [];
      summary.value = response.data.summary || null;
    }
  } catch (error) {
    console.error('Error fetching organization audits:', error);
    audits.value = [];
    summary.value = null;
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const viewAudit = (audit) => {
  if (audit.formId && audit.auditId) {
    openTab(`/forms/${audit.formId}/responses/${audit.auditId}`, {
      title: `Audit: ${audit.formName}`,
      icon: 'clipboard-document'
    });
    router.push(`/forms/${audit.formId}/responses/${audit.auditId}`);
  }
};

const downloadReport = (reportUrl) => {
  if (reportUrl) {
    window.open(reportUrl, '_blank');
  }
};

const viewAllAudits = () => {
  // Navigate to a full audits view for this organization
  // For now, we can navigate to forms list filtered by organization
  router.push('/forms');
};

onMounted(() => {
  fetchAudits();
});

watch(() => props.organizationId, () => {
  fetchAudits();
});
</script>

