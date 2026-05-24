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

    <!-- Trial/Subscription Banner -->
    <div
      v-if="showTrialBanner"
      class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-blue-900 dark:text-blue-200">
              Trial Period: {{ trialDaysRemaining }} days remaining
            </p>
            <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">{{ t('audit.portalDashboardYourTrialWillExpireSoonContact') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Welcome Banner -->
    <div class="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl p-6 lg:p-8 shadow-sm">
      <h1 class="text-2xl lg:text-3xl font-bold text-white mb-2">
        Welcome back, {{ userName }}!
      </h1>
      <p class="text-blue-100 text-lg">{{ t('audit.portalDashboardTrackYourAuditsAndManageCorrective') }}</p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
      <!-- Total Audits Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <div v-if="loading" class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
        <p v-else class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ stats.totalAudits || 0 }}</p>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('audit.portalDashboardTotalAudits') }}</p>
      </div>

      <!-- Open Corrective Actions Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div v-if="loading" class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
        <p v-else class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ stats.openActions || 0 }}</p>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('audit.portalDashboardOpenCorrectiveActions') }}</p>
      </div>

      <!-- Closed Audits Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div v-if="loading" class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
        <p v-else class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ stats.closedAudits || 0 }}</p>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('audit.portalDashboardCompletedAudits') }}</p>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('audit.portalDashboardRecentAuditActivity') }}</h2>
        <router-link
          to="/portal/audits"
          class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >{{ t('audit.portalDashboardViewAll') }}</router-link>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="recentActivity.length === 0" class="text-center py-12">
        <svg class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-gray-600 dark:text-gray-400 mb-2">{{ t('audit.portalDashboardNoAuditActivityYet') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">{{ t('audit.portalDashboardAuditsWillAppearHereOnceThey') }}</p>
      </div>

      <!-- Activity List -->
      <div v-else class="space-y-4">
        <div
          v-for="activity in recentActivity"
          :key="activity.id"
          class="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          @click="navigateToAudit(activity.auditId)"
        >
          <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {{ activity.title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {{ activity.description }}
            </p>
            <div class="flex items-center gap-4">
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(activity.date) }}
              </span>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="getStatusBadgeClass(activity.status)"
              >
                {{ activity.status }}
              </span>
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
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import portalApiClient from '@/utils/portalApiClient';

const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref(null);
const stats = ref({
  totalAudits: 0,
  openActions: 0,
  closedAudits: 0
});
const recentActivity = ref([]);
const trialDaysRemaining = ref(0);

// Computed
const userName = computed(() => {
  const user = authStore.user;
  if (user?.firstName) {
    return user.firstName;
  }
  return user?.email?.split('@')[0] || 'there';
});

const showTrialBanner = computed(() => {
  // Check if organization is on trial
  const org = authStore.organization;
  if (org?.subscription?.status === 'trial') {
    return true;
  }
  return false;
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

const getStatusBadgeClass = (status) => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('completed') || statusLower.includes('closed')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (statusLower.includes('in progress') || statusLower.includes('open')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
  if (statusLower.includes('waiting') || statusLower.includes('pending')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const navigateToAudit = (auditId) => {
  if (auditId) {
    router.push(`/portal/audits/${auditId}`);
  }
};

const fetchDashboardData = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Fetch dashboard summary using portalApiClient
    const data = await portalApiClient.get('/portal/audits', {
      params: { summary: true }
    });

    if (data.success) {
      // Update stats
      stats.value = {
        totalAudits: data.data?.totalAudits || 0,
        openActions: data.data?.openActions || 0,
        closedAudits: data.data?.closedAudits || 0
      };

      // Update recent activity
      recentActivity.value = (data.data?.recentActivity || []).map(activity => ({
        id: activity._id || activity.id,
        auditId: activity.eventId || activity._id,
        title: activity.name || activity.title || 'Audit',
        description: activity.description || `${activity.type || 'Audit'} conducted`,
        status: activity.status || activity.auditState || 'Unknown',
        date: activity.updatedAt || activity.createdAt || new Date()
      }));
    }

    // Calculate trial days if applicable
    if (authStore.organization?.subscription?.status === 'trial') {
      const trialEnd = new Date(authStore.organization.subscription.trialEnd || authStore.organization.subscription.endDate);
      const today = new Date();
      const diffTime = trialEnd - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      trialDaysRemaining.value = Math.max(0, diffDays);
    }
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    
    // Show the actual error message from the backend if available
    if (err.response?.data) {
      const errorData = err.response.data;
      error.value = errorData.message || errorData.error || 'Failed to load dashboard data. Please contact your administrator.';
      
      // Handle specific error codes
      if (errorData.code === 'APP_NOT_ENABLED' || errorData.code === 'APP_ENTITLEMENT_REQUIRED') {
        error.value = 'Portal access is not enabled for your account. Please contact your administrator to enable Portal access.';
      } else if (errorData.code === 'PORTAL_APP_REQUIRED') {
        error.value = 'This endpoint requires Portal application access. Please access from the Portal application.';
      }
    } else if (err.status === 402) {
      error.value = 'Portal access is not active. Please contact your administrator.';
    } else if (err.status === 403) {
      error.value = 'Access denied. You may not have permission to access the Portal application. Please contact your administrator.';
    } else {
      error.value = err.message || 'Failed to load dashboard data. Please try again later.';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDashboardData();
});
</script>

