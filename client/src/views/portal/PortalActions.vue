<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <!-- Error Banner -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
      </div>
    </div>

    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('forms.reportCorrectiveActions') }}</h1>
      <p class="text-gray-600 dark:text-gray-400">{{ t('audit.portalActionsTrackAndManageAllCorrectiveActions') }}</p>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap gap-4">
      <select
        v-model="filters.status"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
      >
        <option value="">{{ t('audit.portalActionsAllStatuses') }}</option>
        <option value="OPEN">{{ t('settings.salesPipeStatusOpen') }}</option>
        <option value="IN_PROGRESS">{{ t('forms.hubExecutionInProgress') }}</option>
        <option value="COMPLETED">{{ t('process.execCompleted') }}</option>
      </select>

      <button
        v-if="hasFilters"
        @click="resetFilters"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >{{ t('audit.portalActionsClearFilters') }}</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 5" :key="i" class="h-32 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="actions.length === 0" class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
      <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ t('audit.portalActionsNoCorrectiveActions') }}</h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ hasFilters ? 'Try adjusting your filters' : 'All corrective actions have been completed' }}
      </p>
    </div>

    <!-- Actions List -->
    <div v-else class="space-y-4">
      <div
        v-for="action in actions"
        :key="action._id || action.id"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 lg:p-6 hover:shadow-md transition-shadow"
      >
        <div class="flex flex-col gap-4">
          <!-- Header -->
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-start justify-between gap-4 mb-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ action.question || action.issue || action.description || 'Corrective Action' }}
                </h3>
                <span
                  class="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                  :class="getStatusBadgeClass(action.status)"
                >
                  {{ formatStatus(action.status) }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span v-if="action.auditName" class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {{ action.auditName }}
                </span>
                <span v-if="action.dueDate || action.dueAt" class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Due: {{ formatDate(action.dueDate || action.dueAt) }}
                </span>
              </div>

              <p v-if="action.description && action.description !== action.question" class="text-sm text-gray-600 dark:text-gray-400">
                {{ action.description }}
              </p>
            </div>
          </div>

          <!-- Evidence Upload (CUSTOMER role only, OPEN status only) -->
          <div
            v-if="canUploadEvidence && action.status === 'OPEN'"
            class="pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('audit.portalActionsUploadEvidence2') }}</h4>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('audit.portalActionsFiles') }}</label>
                <input
                  type="file"
                  :ref="el => fileInputs[action._id || action.id] = el"
                  multiple
                  @change="handleFileSelect(action, $event)"
                  class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('records.activityFilterComments') }}</label>
                <textarea
                  v-model="actionComments[action._id || action.id]"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  :placeholder="t('audit.portalActionsAddAnyAdditionalComments')"
                ></textarea>
              </div>

              <button
                @click="uploadEvidence(action)"
                :disabled="uploadingEvidence[action._id || action.id]"
                class="w-full lg:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span v-if="uploadingEvidence[action._id || action.id]">{{ t('common.formUploading') }}</span>
                <span v-else>{{ t('audit.portalActionsUploadEvidence') }}</span>
              </button>
            </div>
          </div>

          <!-- Evidence List -->
          <div v-if="action.evidence && action.evidence.length > 0" class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('audit.portalActionsUploadedEvidence') }}</h4>
            <div class="space-y-2">
              <div
                v-for="(evidence, idx) in action.evidence"
                :key="idx"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ evidence.filename || evidence.name || 'File' }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(evidence.uploadedAt || evidence.createdAt) }}</p>
                  </div>
                </div>
                <a
                  v-if="evidence.url"
                  :href="evidence.url"
                  target="_blank"
                  class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >{{ t('audit.portalActionsDownload') }}</a>
              </div>
            </div>
          </div>

          <!-- View Audit Link -->
          <div v-if="action.auditId || action.eventId" class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <router-link
              :to="`/portal/audits/${action.auditId || action.eventId}`"
              class="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >{{ t('audit.portalActionsViewAudit') }}<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
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
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';

const router = useRouter();
const authStore = useAuthStore();

// Portal-specific API client (for /portal/* routes)
const portalApiClient = async (url, options = {}) => {
  const token = authStore.user?.token;

  if (!token) {
    console.error('No authentication token available');
    throw new Error('Authentication required. Please log in again.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body,
    });

    if (response.status === 401) {
      console.error('401 Unauthorized - token may be invalid or expired');
      authStore.logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error.status !== undefined) {
      throw error;
    }
    const wrappedError = new Error(error.message || 'Network error');
    wrappedError.status = 0;
    throw wrappedError;
  }
};

// State
const loading = ref(true);
const error = ref(null);
const actions = ref([]);
const filters = ref({
  status: ''
});
const actionComments = ref({});
const uploadingEvidence = ref({});
const actionFiles = ref({});
const fileInputs = ref({});

// Computed
const hasFilters = computed(() => {
  return filters.value.status;
});

const canUploadEvidence = computed(() => {
  // Only CUSTOMER role can upload (not VIEWER)
  const user = authStore.user;
  if (!user) return false;
  return true; // Simplified for now
});

// Methods
const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatStatus = (status) => {
  if (!status) return 'Unknown';
  const statusMap = {
    'OPEN': 'Open',
    'IN_PROGRESS': 'In Progress',
    'COMPLETED': 'Completed',
    'CLOSED': 'Closed'
  };
  return statusMap[status] || status;
};

const getStatusBadgeClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  if (status === 'OPEN') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
  if (status === 'IN_PROGRESS') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  if (status === 'COMPLETED' || status === 'CLOSED') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const handleFileSelect = (action, event) => {
  const actionId = action._id || action.id;
  if (!actionFiles.value[actionId]) {
    actionFiles.value[actionId] = [];
  }
  actionFiles.value[actionId] = Array.from(event.target.files);
};

const uploadEvidence = async (action) => {
  const actionId = action._id || action.id;
  const files = actionFiles.value[actionId] || [];
  const comment = actionComments.value[actionId] || '';

  if (files.length === 0 && !comment) {
    error.value = 'Please select files or add a comment';
    return;
  }

  uploadingEvidence.value[actionId] = true;
  error.value = null;

  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (comment) {
      formData.append('comment', comment);
    }

    const response = await fetch(`/portal/actions/${actionId}/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload evidence: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Refresh actions
      await fetchActions();
      
      // Clear form
      actionFiles.value[actionId] = [];
      actionComments.value[actionId] = '';
      const fileInput = fileInputs.value[actionId];
      if (fileInput) {
        fileInput.value = '';
      }
    } else {
      error.value = data.message || 'Failed to upload evidence';
    }
  } catch (err) {
    console.error('Error uploading evidence:', err);
    error.value = 'Failed to upload evidence. Please try again.';
  } finally {
    uploadingEvidence.value[actionId] = false;
  }
};

const applyFilters = () => {
  fetchActions();
};

const resetFilters = () => {
  filters.value = {
    status: ''
  };
  fetchActions();
};

const fetchActions = async () => {
  loading.value = true;
  error.value = null;

  try {
    const queryParams = new URLSearchParams();
    if (filters.value.status) {
      queryParams.append('status', filters.value.status);
    }

    const url = `/portal/actions${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    if (!authStore.user?.token) {
      error.value = 'Authentication required. Please log in again.';
      loading.value = false;
      router.push('/login');
      return;
    }

    const data = await portalApiClient(url, {
      method: 'GET'
    });

    if (data.success) {
      // Handle both data.actions and data.data.actions
      const actionsData = data.data?.actions || data.data || data.actions || [];
      actions.value = Array.isArray(actionsData) ? actionsData : [];
      console.log('Fetched corrective actions:', actions.value); // Debug log
    } else {
      error.value = data.message || 'Failed to load actions';
    }
  } catch (err) {
    console.error('Error fetching actions:', err);
    if (err.status === 401) {
      error.value = 'Session expired. Please log in again.';
      router.push('/login');
    } else if (err.status === 402) {
      error.value = 'Portal access is not active. Please contact your administrator.';
    } else {
      error.value = err.message || 'Failed to load actions. Please try again later.';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchActions();
});
</script>

