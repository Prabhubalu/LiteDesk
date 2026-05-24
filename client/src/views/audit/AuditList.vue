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
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('audit.auditListMyAudits') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('audit.auditListViewAndManageYourAuditAssignments') }}</p>
      </div>
      
      <!-- Mobile Filter Button -->
      <button
        @click="showFilters = !showFilters"
        class="lg:hidden px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>{{ t('common.listFilters') }}</button>
    </div>

    <!-- Desktop Filters -->
    <div class="hidden lg:flex gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <select
        v-model="filters.auditState"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">{{ t('audit.auditListAllStates2') }}</option>
        <option value="Ready to start">{{ t('audit.auditListReadyToStart2') }}</option>
        <option value="checked_in">{{ t('audit.auditListCheckedIn2') }}</option>
        <option value="submitted">{{ t('forms.hubExecutionSubmitted') }}</option>
        <option value="needs_review">{{ t('audit.auditListNeedsReview2') }}</option>
        <option value="closed">{{ t('settings.settingsBhClosed') }}</option>
      </select>
      
      <select
        v-model="filters.auditType"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">{{ t('settings.groupsFilterAllTypes') }}</option>
        <option value="Internal Audit">{{ t('settings.modFieldsEventTypeInternalAudit') }}</option>
        <option value="External Audit">{{ t('audit.auditListExternalAudit2') }}</option>
        <option value="Compliance Audit">{{ t('audit.auditListComplianceAudit2') }}</option>
      </select>
      
      <select
        v-model="filters.sortBy"
        @change="applyFilters"
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="dueAt">{{ t('audit.auditListSortByDueDate') }}</option>
        <option value="createdAt">{{ t('audit.auditListSortByCreated') }}</option>
        <option value="auditState">{{ t('audit.auditListSortByStatus') }}</option>
      </select>
    </div>

    <!-- Mobile Filter Panel -->
    <div
      v-if="showFilters"
      class="lg:hidden mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('audit.auditListState') }}</label>
        <select
          v-model="filters.auditState"
          @change="applyFilters"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{{ t('audit.auditListAllStates') }}</option>
          <option value="Ready to start">{{ t('audit.auditListReadyToStart') }}</option>
          <option value="checked_in">{{ t('audit.auditListCheckedIn') }}</option>
          <option value="submitted">{{ t('forms.hubExecutionSubmitted') }}</option>
          <option value="needs_review">{{ t('audit.auditListNeedsReview') }}</option>
          <option value="closed">{{ t('settings.settingsBhClosed') }}</option>
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
          <option value="External Audit">{{ t('audit.auditListExternalAudit') }}</option>
          <option value="Compliance Audit">{{ t('audit.auditListComplianceAudit') }}</option>
        </select>
      </div>
      
      <button
        @click="applyFilters"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >{{ t('audit.auditListApplyFilters') }}</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading && assignments.length === 0" class="flex items-center justify-center min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="assignments.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
      <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400 text-lg mb-2">{{ t('audit.auditListNoAuditsYet') }}</p>
      <p class="text-sm text-gray-500 dark:text-gray-500">{{ t('audit.auditListAuditsWillAppearHereOnceTheyre') }}</p>
    </div>

    <!-- Audit List -->
    <div v-else class="space-y-4">
      <!-- Mobile Card View -->
      <div
        v-for="assignment in assignments"
        :key="assignment.assignmentId"
        class="lg:hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ assignment.auditName || 'Audit' }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ formatDate(assignment.scheduledAt) }}</p>
          </div>
          <span :class="getStatusBadgeClass(assignment.auditState)" class="px-2 py-1 text-xs font-medium rounded-full">
            {{ assignment.auditState || 'Unknown' }}
          </span>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">Due: {{ formatDate(assignment.dueAt) }}</p>
          <router-link
            :to="`/audit/audits/${assignment.eventId}`"
            class="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >{{ t('common.viewRecord') }}</router-link>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.appsNameAudit') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.modFieldsValidationType') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.assignRulesTriggerScheduled') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('forms.correctiveDueDate') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.settingsBhFieldStatus') }}</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('navigation.portalActions') }}</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="assignment in assignments" :key="assignment.assignmentId" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ assignment.auditName || 'Audit' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ assignment.auditType || 'N/A' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ formatDate(assignment.scheduledAt) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ formatDate(assignment.dueAt) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusBadgeClass(assignment.auditState)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ assignment.auditState || 'Unknown' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <router-link
                  :to="`/audit/audits/${assignment.eventId}`"
                  class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                >{{ t('common.viewRecord') }}</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination (Desktop) -->
      <div v-if="pagination.totalPages > 1" class="hidden lg:flex items-center justify-between mt-6">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} results
        </div>
        <div class="flex gap-2">
          <button
            @click="loadPage(pagination.page - 1)"
            :disabled="pagination.page === 1"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ t('actions.previous') }}</button>
          <button
            @click="loadPage(pagination.page + 1)"
            :disabled="pagination.page >= pagination.totalPages"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ t('actions.next') }}</button>
        </div>
      </div>

      <!-- Infinite Scroll Loader (Mobile) -->
      <div v-if="loadingMore" class="flex justify-center py-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted, onUnmounted } from 'vue';
import apiClient from '@/utils/apiClient';

const loading = ref(true);
const loadingMore = ref(false);
const error = ref(null);
const showFilters = ref(false);
const assignments = ref([]);
const filters = ref({
  auditState: '',
  auditType: '',
  sortBy: 'dueAt',
  sortOrder: 'asc'
});
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
});

const fetchAudits = async (page = 1, append = false) => {
  if (append) {
    loadingMore.value = true;
  } else {
    loading.value = true;
  }
  error.value = null;
  
  try {
    const params = {
      page,
      limit: pagination.value.limit,
      sortBy: filters.value.sortBy,
      sortOrder: filters.value.sortOrder
    };
    
    if (filters.value.auditState) {
      params.auditState = filters.value.auditState;
    }
    if (filters.value.auditType) {
      params.auditType = filters.value.auditType;
    }

    const response = await apiClient.get('/audit/assignments', { params });

    if (response.success) {
      if (append) {
        assignments.value = [...assignments.value, ...(response.data.assignments || [])];
      } else {
        assignments.value = response.data.assignments || [];
      }
      pagination.value = response.data.pagination || pagination.value;
    }
  } catch (err) {
    console.error('Error fetching audits:', err);
    if (err.status === 403) {
      error.value = 'You do not have access to the Audit App.';
    } else if (err.status === 402) {
      error.value = 'Subscription required. Please contact your administrator.';
    } else {
      error.value = err.message || 'Failed to load audits. Please try again.';
    }
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const applyFilters = () => {
  pagination.value.page = 1;
  fetchAudits(1, false);
  showFilters.value = false;
};

const loadPage = (page) => {
  pagination.value.page = page;
  fetchAudits(page, false);
};

// Infinite scroll for mobile
let scrollObserver = null;

const setupInfiniteScroll = () => {
  if (window.innerWidth >= 1024) return; // Desktop uses pagination
  
  const handleScroll = () => {
    if (loadingMore.value) return;
    if (pagination.value.page >= pagination.value.totalPages) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    if (scrollTop + windowHeight >= documentHeight - 100) {
      loadPage(pagination.value.page + 1);
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  scrollObserver = handleScroll;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getStatusBadgeClass = (state) => {
  const stateLower = (state || '').toLowerCase();
  if (stateLower.includes('ready') || stateLower.includes('start')) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
  } else if (stateLower.includes('checked_in') || stateLower.includes('in_progress')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
  } else if (stateLower.includes('submitted') || stateLower.includes('needs_review')) {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
  } else if (stateLower.includes('closed') || stateLower.includes('approved')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
  } else if (stateLower.includes('rejected')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
};

onMounted(() => {
  fetchAudits();
  setupInfiniteScroll();
});

onUnmounted(() => {
  if (scrollObserver) {
    window.removeEventListener('scroll', scrollObserver);
  }
});
</script>

