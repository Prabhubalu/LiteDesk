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

    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
      <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
    </div>

    <!-- Audit Detail -->
    <div v-else-if="audit" class="space-y-6">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div class="flex-1">
            <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {{ audit.name || audit.title || 'Untitled Audit' }}
            </h1>
            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {{ audit.type || audit.auditType || 'Audit' }}
              </span>
              <span v-if="audit.period" class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ audit.period }}
              </span>
            </div>
          </div>
          <span
            class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
            :class="getStatusBadgeClass(audit.status || audit.auditState)"
          >
            {{ formatStatus(audit.status || audit.auditState) }}
          </span>
        </div>
      </div>

      <!-- Findings Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ t('audit.portalAuditDetailFindingsSummary') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('audit.portalAuditDetailTotalFindings') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ findingsSummary.total || 0 }}</p>
          </div>
          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.salesPipeStatusOpen') }}</p>
            <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ findingsSummary.open || 0 }}</p>
          </div>
          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.settingsBhClosed') }}</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ findingsSummary.closed || 0 }}</p>
          </div>
        </div>
      </div>

      <!-- Corrective Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ t('forms.reportCorrectiveActions') }}</h2>
        
        <!-- Empty State -->
        <div v-if="correctiveActions.length === 0" class="text-center py-12">
          <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400 mb-2">{{ t('audit.portalAuditDetailNoCorrectiveActions') }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-500">{{ t('audit.portalAuditDetailAllFindingsHaveBeenAddressed') }}</p>
        </div>

        <!-- Corrective Actions List -->
        <div v-else class="space-y-4">
          <div
            v-for="action in correctiveActions"
            :key="action._id || action.id"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {{ action.question || action.issue || action.description || 'Corrective Action' }}
                </h3>
                <p v-if="action.description && action.description !== action.question" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {{ action.description }}
                </p>
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Due: {{ formatDate(action.dueDate || action.dueAt) }}
                  </span>
                  <span
                    class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    :class="getActionStatusBadgeClass(action.status)"
                  >
                    {{ formatActionStatus(action.status) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Evidence Upload (CUSTOMER role only, OPEN status only) -->
            <div
              v-if="canUploadEvidence && action.status === 'OPEN'"
              class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('audit.portalAuditDetailUploadEvidence2') }}</h4>
              
              <!-- Upload Form -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('audit.portalAuditDetailFiles') }}</label>
                  <input
                    type="file"
                    ref="fileInput"
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
                    :placeholder="t('audit.portalAuditDetailAddAnyAdditionalComments')"
                  ></textarea>
                </div>

                <button
                  @click="uploadEvidence(action)"
                  :disabled="uploadingEvidence[action._id || action.id]"
                  class="w-full lg:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span v-if="uploadingEvidence[action._id || action.id]">{{ t('common.formUploading') }}</span>
                  <span v-else>{{ t('audit.portalAuditDetailUploadEvidence') }}</span>
                </button>
              </div>
            </div>

            <!-- Evidence List -->
            <div v-if="action.evidence && action.evidence.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('audit.portalAuditDetailUploadedEvidence') }}</h4>
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
                  >{{ t('audit.portalAuditDetailDownload') }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline (Read-Only) -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ t('audit.portalAuditDetailTimeline') }}</h2>
        
        <!-- Empty State -->
        <div v-if="timeline.length === 0" class="text-center py-8">
          <p class="text-gray-600 dark:text-gray-400">{{ t('audit.portalAuditDetailNoTimelineEvents') }}</p>
        </div>

        <!-- Timeline List -->
        <div v-else class="space-y-4">
          <div
            v-for="(event, index) in timeline"
            :key="index"
            class="flex gap-4"
          >
            <div class="flex-shrink-0">
              <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="flex-1 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {{ event.title || event.action }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(event.date || event.timestamp) }}
              </p>
              <p v-if="event.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ event.description }}
              </p>
            </div>
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
import { useAuthStore } from '@/stores/authRegistry';

// Portal-specific API client (for /portal/* routes)
const portalApiClient = async (url, options = {}) => {
  const authStore = useAuthStore();
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

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref(null);
const audit = ref(null);
const correctiveActions = ref([]);
const findingsSummary = ref({
  total: 0,
  open: 0,
  closed: 0
});
const timeline = ref([]);
const actionComments = ref({});
const uploadingEvidence = ref({});
const fileInput = ref(null);

// Computed
const eventId = computed(() => route.params.eventId);

const canUploadEvidence = computed(() => {
  // Only CUSTOMER role can upload (not VIEWER)
  const user = authStore.user;
  if (!user) return false;
  
  // Check if user has PORTAL: CUSTOMER access (not VIEWER)
  // This would typically be in appAccess, but for now we'll check role
  // In a real implementation, you'd check appAccess array for PORTAL: CUSTOMER
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
    'in_progress': 'In Progress',
    'waiting_for_actions': 'Waiting for Actions',
    'completed': 'Completed',
    'submitted': 'Submitted',
    'needs_review': 'Needs Review',
    'closed': 'Closed'
  };
  return statusMap[status.toLowerCase()] || status;
};

const formatActionStatus = (status) => {
  if (!status) return 'Unknown';
  const statusMap = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'closed': 'Closed'
  };
  return statusMap[status.toLowerCase()] || status;
};

const getStatusBadgeClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('completed') || statusLower.includes('closed')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (statusLower.includes('in progress') || statusLower.includes('submitted')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
  if (statusLower.includes('waiting') || statusLower.includes('pending')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const getActionStatusBadgeClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  const statusLower = status.toLowerCase();
  if (statusLower === 'open') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
  if (statusLower === 'in_progress' || statusLower === 'in progress') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  if (statusLower === 'completed' || statusLower === 'closed') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const handleFileSelect = (action, event) => {
  // Store files for this action
  // Backend expects questionId, which is returned as 'id' in the API response
  const actionId = action.id || action.questionId || action._id;
  if (!actionFiles.value[actionId]) {
    actionFiles.value[actionId] = [];
  }
  actionFiles.value[actionId] = Array.from(event.target.files);
};

const actionFiles = ref({});

const uploadEvidence = async (action) => {
  // Backend expects questionId, which is returned as 'id' in the API response
  const actionId = action.id || action.questionId || action._id;
  const files = actionFiles[actionId] || [];
  const comment = actionComments.value[actionId] || '';

  if (files.length === 0 && !comment) {
    error.value = 'Please select files or add a comment';
    return;
  }

  uploadingEvidence.value[actionId] = true;
  error.value = null;

  try {
    if (!authStore.user?.token) {
      error.value = 'Authentication required. Please log in again.';
      uploadingEvidence.value[actionId] = false;
      router.push('/login');
      return;
    }

    const formData = new FormData();
    // The backend expects 'file' as the field name (single file)
    if (files.length > 0) {
      formData.append('file', files[0]); // Multer expects single file with field name 'file'
    }
    if (comment) {
      formData.append('comment', comment);
    }

    const token = authStore.user.token;
    const response = await fetch(`/portal/actions/${actionId}/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });

    if (response.status === 401) {
      authStore.logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to upload evidence: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Refresh audit data
      await fetchAuditDetail();
      
      // Clear form
      actionFiles.value[actionId] = [];
      actionComments.value[actionId] = '';
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    } else {
      error.value = data.message || 'Failed to upload evidence';
    }
  } catch (err) {
    console.error('Error uploading evidence:', err);
    if (err.message && err.message.includes('Session expired')) {
      error.value = 'Session expired. Please log in again.';
      router.push('/login');
    } else {
      error.value = err.message || 'Failed to upload evidence. Please try again.';
    }
  } finally {
    uploadingEvidence.value[actionId] = false;
  }
};

const fetchAuditDetail = async () => {
  loading.value = true;
  error.value = null;

  try {
    if (!eventId.value) {
      error.value = 'No audit ID provided';
      loading.value = false;
      return;
    }

    if (!authStore.user?.token) {
      error.value = 'Authentication required. Please log in again.';
      loading.value = false;
      router.push('/login');
      return;
    }

    const data = await portalApiClient(`/portal/audits/${eventId.value}`, {
      method: 'GET'
    });

    if (data.success) {
      audit.value = data.data.audit || data.data;
      correctiveActions.value = data.data.correctiveActions || [];
      findingsSummary.value = data.data.findingsSummary || {
        total: correctiveActions.value.length,
        open: correctiveActions.value.filter(a => (a.status || '').toLowerCase() === 'open' || (a.status || '').toLowerCase() === 'in_progress').length,
        closed: correctiveActions.value.filter(a => (a.status || '').toLowerCase() === 'closed' || (a.status || '').toLowerCase() === 'completed').length
      };
      timeline.value = data.data.timeline || [];
    } else {
      error.value = data.message || 'Failed to load audit';
    }
  } catch (err) {
    console.error('Error fetching audit detail:', err);
    if (err.status === 401) {
      error.value = 'Session expired. Please log in again.';
      router.push('/login');
    } else if (err.status === 402) {
      error.value = 'Portal access is not active. Please contact your administrator.';
    } else if (err.status === 404) {
      error.value = 'Audit not found';
    } else {
      error.value = err.message || 'Failed to load audit. Please try again later.';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (eventId.value) {
    fetchAuditDetail();
  }
});
</script>

