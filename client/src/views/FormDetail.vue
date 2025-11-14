<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ form?.name || 'Loading...' }}</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ form?.formType || '' }} • {{ form?.status || '' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="openResponses"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            View Responses
          </button>
          <button
            @click="editForm"
            class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            Edit Form
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading form details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-800 dark:text-red-200">{{ error }}</p>
      </div>

      <!-- Main Content -->
      <div v-else-if="form" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex space-x-6 px-4">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ tab.name }}
              <span v-if="tab.count !== undefined && tab.count > 0" class="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700">
                {{ tab.count }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <!-- KPI Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Responses</p>
                <p class="text-3xl font-bold text-blue-900 dark:text-blue-100">{{ analytics?.statistics?.totalResponses || 0 }}</p>
                <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">All time submissions</p>
              </div>
              <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <p class="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Avg Compliance</p>
                <p class="text-3xl font-bold text-green-900 dark:text-green-100">
                  {{ Math.round(analytics?.statistics?.avgCompliance || 0) }}%
                </p>
                <p class="text-xs text-green-600 dark:text-green-400 mt-1">Average compliance rate</p>
              </div>
              <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <p class="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Avg Rating</p>
                <p class="text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {{ Math.round(analytics?.statistics?.avgRating || 0) }}
                </p>
                <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">Average rating score</p>
              </div>
              <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <p class="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Response Rate</p>
                <p class="text-3xl font-bold text-orange-900 dark:text-orange-100">
                  {{ Math.round(analytics?.form?.responseRate || 0) }}%
                </p>
                <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">Completion rate</p>
              </div>
            </div>

            <!-- Quick Stats -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Pass/Fail Summary -->
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pass/Fail Summary</h3>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600 dark:text-gray-400">Passed</span>
                    <div class="flex items-center gap-2">
                      <div class="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          class="bg-green-600 h-2 rounded-full"
                          :style="{ width: `${passPercentage}%` }"
                        ></div>
                      </div>
                      <span class="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                        {{ analytics?.statistics?.passed || 0 }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600 dark:text-gray-400">Failed</span>
                    <div class="flex items-center gap-2">
                      <div class="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          class="bg-red-600 h-2 rounded-full"
                          :style="{ width: `${failPercentage}%` }"
                        ></div>
                      </div>
                      <span class="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                        {{ analytics?.statistics?.failed || 0 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Last Submission -->
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                <div v-if="analytics?.recentSubmissions && analytics.recentSubmissions.length > 0" class="space-y-2">
                  <div class="text-sm">
                    <p class="text-gray-900 dark:text-white font-medium">
                      Last submission: {{ formatDate(analytics.recentSubmissions[0].submittedAt) }}
                    </p>
                    <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      By {{ getSubmitterName(analytics.recentSubmissions[0]) }}
                    </p>
                  </div>
                  <div class="text-sm">
                    <p class="text-gray-600 dark:text-gray-400">
                      Score: <span class="font-semibold text-gray-900 dark:text-white">
                        {{ analytics.recentSubmissions[0].kpis?.finalScore || 'N/A' }}%
                      </span>
                    </p>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                  No submissions yet
                </div>
              </div>
            </div>

            <!-- Recent Submissions Table -->
            <div v-if="analytics?.recentSubmissions && analytics.recentSubmissions.length > 0" class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Submissions</h3>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Response ID</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Submitted By</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Score</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="submission in analytics.recentSubmissions" :key="submission._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {{ submission.responseId }}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {{ getSubmitterName(submission) }}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {{ formatDate(submission.submittedAt) }}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                        {{ submission.kpis?.finalScore || 'N/A' }}%
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        <span
                          class="px-2 py-1 text-xs font-medium rounded-full"
                          :class="getStatusClass(submission.status)"
                        >
                          {{ submission.status || 'Submitted' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          @click="viewResponse(submission._id)"
                          class="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-500 font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Analytics Tab -->
          <div v-if="activeTab === 'analytics'" class="space-y-6">
            <FormAnalytics
              :form-id="form._id"
              :form="form"
            />
          </div>

          <!-- Responses Tab -->
          <div v-if="activeTab === 'responses'" class="space-y-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Form Responses</h3>
              <button
                @click="openResponses"
                class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
              >
                View All Responses
              </button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Click the button above to view all responses for this form, or use the "View Responses" button in the header.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import FormAnalytics from '@/components/forms/FormAnalytics.vue';

const route = useRoute();
const router = useRouter();
const { openTab } = useTabs();

const form = ref(null);
const analytics = ref(null);
const loading = ref(true);
const error = ref(null);
const activeTab = ref('overview');

const tabs = computed(() => [
  { id: 'overview', name: 'Overview' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'responses', name: 'Responses', count: analytics.value?.statistics?.totalResponses || 0 }
]);

const passPercentage = computed(() => {
  const total = (analytics.value?.statistics?.passed || 0) + (analytics.value?.statistics?.failed || 0);
  if (total === 0) return 0;
  return Math.round((analytics.value?.statistics?.passed / total) * 100);
});

const failPercentage = computed(() => {
  const total = (analytics.value?.statistics?.passed || 0) + (analytics.value?.statistics?.failed || 0);
  if (total === 0) return 0;
  return Math.round((analytics.value?.statistics?.failed / total) * 100);
});

const fetchForm = async () => {
  try {
    loading.value = true;
    const response = await apiClient(`/forms/${route.params.id}`, { method: 'GET' });
    if (response.success) {
      form.value = response.data;
    } else {
      error.value = 'Form not found';
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = err.message || 'Failed to load form';
  } finally {
    loading.value = false;
  }
};

const fetchAnalytics = async () => {
  try {
    const response = await apiClient(`/forms/${route.params.id}/analytics`, { method: 'GET' });
    if (response.success) {
      analytics.value = response.data;
    }
  } catch (err) {
    console.error('Error fetching analytics:', err);
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getSubmitterName = (submission) => {
  if (submission.submittedBy) {
    return `${submission.submittedBy.firstName || ''} ${submission.submittedBy.lastName || ''}`.trim() || submission.submittedBy.email || 'Unknown';
  }
  return 'Unknown';
};

const getStatusClass = (status) => {
  const classes = {
    'Submitted': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Pending Corrective Action': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Needs Auditor Review': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Approved': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'Rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Closed': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  };
  return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const goBack = () => {
  router.push('/forms');
};

const editForm = () => {
  openTab(`/forms/builder/${form.value._id}`, {
    title: `Edit: ${form.value.name}`,
    icon: 'clipboard-document'
  });
};

const openResponses = () => {
  openTab(`/forms/${form.value._id}/responses`, {
    title: `Responses: ${form.value.name}`,
    icon: 'clipboard-document'
  });
};

const viewResponse = (responseId) => {
  openTab(`/forms/${form.value._id}/responses/${responseId}`, {
    title: `Response: ${responseId}`,
    icon: 'clipboard-document'
  });
};

onMounted(async () => {
  await fetchForm();
  await fetchAnalytics();
});
</script>

