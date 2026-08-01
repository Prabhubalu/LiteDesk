<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <!-- Offline Banner -->
    <div v-if="isOfflineMode" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 10m9.9 2.9a3 3 0 11-5.196-5.196" />
          </svg>
          <p class="text-sm text-red-800 dark:text-red-200">You're offline — changes will sync later</p>
        </div>
        <span v-if="pendingActionsCount > 0" class="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">
          {{ pendingActionsCount }} pending
        </span>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
      </div>
    </div>

    <!-- Loading State (Skeleton) -->
    <div v-if="loading" class="space-y-6">
      <!-- Stats Skeleton -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3 animate-pulse"></div>
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse"></div>
        </div>
      </div>
      <!-- List Skeleton -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
        </div>
        <div class="p-4 space-y-4">
          <div v-for="i in 3" :key="i" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 animate-pulse"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard Content -->
    <div v-else>
      <!-- Page Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('audit.auditDashboardAuditDashboard') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardViewYourAssignedAuditsAndTrack') }}</p>
      </div>

      <!-- Stats Cards (Mobile: Stacked, Desktop: Grid) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardAssigned') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.assigned || 0 }}</p>
            </div>
            <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardDueToday') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.dueToday || 0 }}</p>
            </div>
            <div class="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardOverdue') }}</p>
              <p class="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{{ stats.overdue || 0 }}</p>
            </div>
            <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardNeedsReview') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.needsReview || 0 }}</p>
            </div>
            <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Audits Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('audit.auditDashboardRecentAudits') }}</h2>
        </div>
        
        <!-- Empty State -->
        <div v-if="assignments.length === 0" class="p-8 text-center">
          <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400">{{ t('audit.auditDashboardNoAuditsAssignedYet') }}</p>
        </div>

        <!-- Audit Cards (Mobile: Stacked, Desktop: Table) -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.appsNameAudit') }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.modFieldsValidationType') }}</th>
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

        <!-- Mobile Card View -->
        <div class="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="assignment in assignments"
            :key="assignment.assignmentId"
            class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ assignment.auditName || 'Audit' }}</h3>
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ assignment.auditType || 'N/A' }}</p>
              </div>
              <span :class="getStatusBadgeClass(assignment.auditState)" class="px-2 py-1 text-xs font-medium rounded-full ml-2">
                {{ assignment.auditState || 'Unknown' }}
              </span>
            </div>
            <div class="flex items-center justify-between mt-3">
              <p class="text-xs text-gray-600 dark:text-gray-400">Due: {{ formatDate(assignment.dueAt) }}</p>
              <router-link
                :to="`/audit/audits/${assignment.eventId}`"
                class="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >{{ t('common.viewRecord') }}</router-link>
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { formatUserDate } from '@/utils/localeFormat';
import { useOffline } from '@/composables/useOffline';
import { initDB, getAssignments, saveAssignments } from '@/services/offlineDb.js';
import { getPendingCount } from '@/services/offlineQueue.js';

const { isOnline } = useOffline();
const loading = ref(true);
const error = ref(null);
const isOfflineMode = computed(() => !isOnline.value);
const stats = ref({
  assigned: 0,
  dueToday: 0,
  overdue: 0,
  needsReview: 0
});
const assignments = ref([]);
const pendingActionsCount = ref(0);

// Initialize IndexedDB
const initOfflineDb = async () => {
  try {
    await initDB();
  } catch (err) {
    console.error('[AuditDashboard] Failed to initialize IndexedDB:', err);
  }
};

const fetchDashboard = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // Initialize offline DB
    await initOfflineDb();

    // If offline, load from IndexedDB
    if (isOfflineMode.value) {
      console.log('[AuditDashboard] Offline mode - loading from IndexedDB');
      const cachedAssignments = await getAssignments();
      assignments.value = cachedAssignments;
      calculateStats();
      loading.value = false;
      return;
    }

    // Online: Fetch from API
    const response = await apiClient.get('/audit/assignments', {
      params: {
        page: 1,
        limit: 10,
        sortBy: 'dueAt',
        sortOrder: 'asc'
      }
    });

    if (response.success) {
      assignments.value = response.data.assignments || [];
      
      // Save to IndexedDB for offline access
      await saveAssignments(assignments.value);
      
      calculateStats();
    }
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    
    // If network error and offline, try IndexedDB
    if (isOfflineMode.value || err.status === 0) {
      try {
        const cachedAssignments = await getAssignments();
        if (cachedAssignments.length > 0) {
          assignments.value = cachedAssignments;
          calculateStats();
          loading.value = false;
          return;
        }
      } catch (dbError) {
        console.error('[AuditDashboard] IndexedDB error:', dbError);
      }
    }
    
    if (err.status === 403) {
      // Check if error message mentions CRM (wrong app context)
      if (err.message && err.message.includes('CRM')) {
        error.value = 'Application access error. Please refresh the page.';
      } else {
        error.value = err.message || 'You do not have access to the Audit App.';
      }
    } else if (err.status === 402) {
      error.value = 'Subscription required. Please contact your administrator.';
    } else if (err.status === 404) {
      error.value = 'Audit API endpoint not found. Please contact support.';
    } else {
      error.value = err.message || 'Failed to load dashboard. Please try again.';
    }
  } finally {
    loading.value = false;
  }
};

const calculateStats = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  stats.value.assigned = assignments.value.length;
  stats.value.dueToday = assignments.value.filter(a => {
    const dueDate = new Date(a.dueAt);
    return dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }).length;
  stats.value.overdue = assignments.value.filter(a => {
    const dueDate = new Date(a.dueAt);
    return dueDate < today && a.auditState !== 'closed';
  }).length;
  stats.value.needsReview = assignments.value.filter(a => a.auditState === 'needs_review').length;
};

const updatePendingCount = async () => {
  try {
    pendingActionsCount.value = await getPendingCount();
  } catch (err) {
    console.error('[AuditDashboard] Error getting pending count:', err);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return formatUserDate(dateString) || 'N/A';
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

// Register cleanup hook synchronously (before any await)
let pendingCountInterval = null;
onBeforeUnmount(() => {
  if (pendingCountInterval) {
    clearInterval(pendingCountInterval);
  }
});

onMounted(async () => {
  await initOfflineDb();
  await fetchDashboard();
  await updatePendingCount();
  
  // Update pending count when online status changes
  if (isOnline.value) {
    pendingCountInterval = setInterval(updatePendingCount, 5000);
  }
});
</script>

