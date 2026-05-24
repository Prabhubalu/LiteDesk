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
      <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('navigation.portalAudits') }}</h1>
      <p class="text-gray-600 dark:text-gray-400">{{ t('audit.portalAuditListViewAuditsConductedOnYourOrganization') }}</p>
    </div>

    <!-- Filters (Desktop) -->
    <div class="hidden lg:flex gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <select
        v-model="filters.status"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">{{ t('audit.portalAuditListAllStatuses2') }}</option>
        <option value="in_progress">{{ t('forms.hubExecutionInProgress') }}</option>
        <option value="waiting_for_actions">{{ t('audit.portalAuditListWaitingForCorrectiveActions2') }}</option>
        <option value="completed">{{ t('process.execCompleted') }}</option>
      </select>

      <select
        v-model="filters.auditType"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">{{ t('settings.groupsFilterAllTypes') }}</option>
        <option value="Internal Audit">{{ t('settings.modFieldsEventTypeInternalAudit') }}</option>
        <option value="External Audit">{{ t('audit.portalAuditListExternalAudit2') }}</option>
        <option value="Compliance Audit">{{ t('audit.portalAuditListComplianceAudit2') }}</option>
      </select>

      <button
        @click="resetFilters"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >{{ t('audit.portalAuditListClearFilters3') }}</button>
    </div>

    <!-- Mobile Filter Button -->
    <button
      @click="showFilters = !showFilters"
      class="lg:hidden mb-4 w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>{{ t('common.listFilters') }}</button>

    <!-- Mobile Filter Panel -->
    <div
      v-if="showFilters"
      class="lg:hidden mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.settingsBhFieldStatus') }}</label>
        <select
          v-model="filters.status"
          @change="applyFilters"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{{ t('audit.portalAuditListAllStatuses') }}</option>
          <option value="in_progress">{{ t('forms.hubExecutionInProgress') }}</option>
          <option value="waiting_for_actions">{{ t('audit.portalAuditListWaitingForCorrectiveActions') }}</option>
          <option value="completed">{{ t('process.execCompleted') }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.modFieldsValidationType') }}</label>
        <select
          v-model="filters.auditType"
          @change="applyFilters"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{{ t('settings.groupsFilterAllTypes') }}</option>
          <option value="Internal Audit">{{ t('settings.modFieldsEventTypeInternalAudit') }}</option>
          <option value="External Audit">{{ t('audit.portalAuditListExternalAudit') }}</option>
          <option value="Compliance Audit">{{ t('audit.portalAuditListComplianceAudit') }}</option>
        </select>
      </div>

      <button
        @click="resetFilters"
        class="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >{{ t('audit.portalAuditListClearFilters2') }}</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 5" :key="i" class="h-24 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="audits.length === 0" class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
      <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ t('audit.portalAuditListNoAuditsYet') }}</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ hasFilters ? 'No audits match your filters. Try adjusting them to see more results.' : 'Audits will appear here once they\'re assigned to you or your organization.' }}
      </p>
      <button
        v-if="hasFilters"
        @click="resetFilters"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
      >{{ t('audit.portalAuditListClearFilters') }}</button>
    </div>

    <!-- Audit List -->
    <div v-else class="space-y-4">
      <div
        v-for="audit in audits"
        :key="audit.id || audit.eventId || audit._id"
        @click="navigateToAudit(audit.id || audit.eventId || audit._id)"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 lg:p-6 hover:shadow-md transition-shadow cursor-pointer"
      >
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <!-- Left: Audit Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-4 mb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {{ audit.name || audit.title || 'Untitled Audit' }}
              </h3>
              <span
                class="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                :class="getStatusBadgeClass(audit.status || audit.auditState)"
              >
                {{ formatStatus(audit.status || audit.auditState) }}
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{{ audit.type || audit.auditType || 'Audit' }}</span>
              </div>

              <div v-if="audit.dueDate || audit.dueAt" class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Due: {{ formatDate(audit.dueDate || audit.dueAt) }}</span>
              </div>

              <div v-if="audit.auditorName" class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{{ audit.auditorName }}</span>
              </div>
            </div>

            <div v-if="audit.description" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {{ audit.description }}
            </div>
          </div>

          <!-- Right: Action Arrow (Mobile) -->
          <div class="lg:hidden flex items-center justify-end">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
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

  console.log('Portal API request:', {
    url,
    method: options.method || 'GET',
    hasAuthHeader: !!headers['Authorization'],
    tokenLength: token?.length || 0
  });

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
const audits = ref([]);
const showFilters = ref(false);
const filters = ref({
  status: '',
  auditType: ''
});

// Computed
const hasFilters = computed(() => {
  return filters.value.status || filters.value.auditType;
});

// Methods
const formatDate = (dateString) => {
  if (!dateString) return '';
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

const getStatusBadgeClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('completed') || statusLower.includes('closed')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (statusLower.includes('in progress') || statusLower.includes('submitted')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
  if (statusLower.includes('waiting') || statusLower.includes('pending') || statusLower.includes('needs_review')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const navigateToAudit = (auditId) => {
  console.log('Navigating to audit:', auditId); // Debug log
  if (auditId) {
    router.push(`/portal/audits/${auditId}`);
  } else {
    console.warn('No audit ID provided for navigation');
  }
};

const applyFilters = () => {
  fetchAudits();
};

const resetFilters = () => {
  filters.value = {
    status: '',
    auditType: ''
  };
  showFilters.value = false;
  fetchAudits();
};

const fetchAudits = async () => {
  loading.value = true;
  error.value = null;

  try {
    const queryParams = new URLSearchParams();
    if (filters.value.status) {
      queryParams.append('status', filters.value.status);
    }
    if (filters.value.auditType) {
      queryParams.append('type', filters.value.auditType);
    }

    const url = `/portal/audits${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    // Check if token exists
    if (!authStore.user?.token) {
      console.error('No token found in authStore.user:', authStore.user);
      error.value = 'Authentication required. Please log in again.';
      loading.value = false;
      router.push('/login');
      return;
    }

    console.log('Making request to:', url, 'with token:', authStore.user.token ? 'Token present' : 'No token');
    const data = await portalApiClient(url, {
      method: 'GET'
    });

    if (data.success) {
      // Handle both data.audits (from list endpoint) and data.data (from summary endpoint)
      const auditsData = data.data?.audits || data.data || data.audits || [];
      audits.value = Array.isArray(auditsData) ? auditsData : [];
      console.log('Fetched audits:', audits.value); // Debug log
    } else {
      error.value = data.message || 'Failed to load audits';
    }
  } catch (err) {
    console.error('Error fetching audits:', err);
    if (err.status === 401) {
      error.value = 'Session expired. Please log in again.';
      router.push('/login');
    } else if (err.status === 402) {
      error.value = 'Portal access is not active. Please contact your administrator.';
    } else {
      error.value = err.message || 'Failed to load audits. Please try again later.';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAudits();
});
</script>

