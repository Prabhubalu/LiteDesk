<template>
  <SettingsScrollPanel>
    <template #header>
      <button
        @click="goBack"
        class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>{{ t('settings.settingsAppMgmtBack') }}</span>
      </button>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.settingsAppMgmtTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.settingsAppMgmtSubtitle') }}
        </p>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <!-- App List -->
    <div v-else class="space-y-4">
      <div
        v-for="app in allApps"
        :key="app.appKey"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800"
      >
        <div class="flex items-start justify-between">
          <!-- App Info -->
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ getAppDisplayName(app) }}
              </h3>
              <!-- Status Badge -->
              <span
                :class="[
                  'px-2.5 py-0.5 rounded-full text-xs font-medium',
                  getStatusBadgeClass(app.status)
                ]"
              >
                {{ getStatusDisplay(app.status) }}
              </span>
            </div>

            <!-- App Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ getAppDescription(app) }}
            </p>

            <!-- Seat Usage Info (for PER_USER apps) -->
            <div v-if="app.seatInfo && app.seatInfo.limit !== null" class="mb-4">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('settings.settingsAppMgmtSeatUsage') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ app.seatInfo.used }}/{{ app.seatInfo.limit }}
                </span>
                <span
                  :class="[
                    'text-xs px-2 py-0.5 rounded',
                    app.seatInfo.available === 0
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  ]"
                >
                  {{ app.seatInfo.available === null ? t('settings.settingsAppMgmtUnlimited') : t('settings.settingsAppMgmtSeatsAvailable', { count: app.seatInfo.available }) }}
                </span>
              </div>
            </div>

            <!-- Billing Warning for SUSPENDED apps -->
            <div
              v-if="app.status === 'SUSPENDED'"
              class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            >
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {{ t('settings.settingsAppMgmtSuspendedTitle') }}
                  </p>
                  <p class="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    {{ t('settings.settingsAppMgmtSuspendedBody') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Cannot Enable Reason -->
            <div
              v-if="app.status === 'DISABLED' && app.seatInfo && !app.seatInfo.canAdd && app.seatInfo.reason"
              class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p class="text-sm text-red-800 dark:text-red-300">
                <strong>{{ t('settings.settingsAppMgmtCannotEnable') }}</strong> {{ app.seatInfo.reason }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 ml-4">
            <!-- Enable Button -->
            <button
              v-if="app.status === 'DISABLED' || app.status === 'SUSPENDED'"
              @click="handleEnable(app)"
              :disabled="processing === app.appKey || (app.seatInfo && !app.seatInfo.canAdd)"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span v-if="processing === app.appKey">{{ t('settings.settingsAppMgmtEnabling') }}</span>
              <span v-else>{{ t('settings.salesPlayEnable') }}</span>
            </button>

            <!-- Disable Button (hidden for Sales) -->
            <button
              v-if="app.status === 'ACTIVE' && app.appKey !== 'SALES'"
              @click="handleDisable(app)"
              :disabled="processing === app.appKey"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span v-if="processing === app.appKey">{{ t('settings.settingsAppMgmtDisabling') }}</span>
              <span v-else>{{ t('settings.settingsAppMgmtDisable') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="allApps.length === 0" class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">{{ t('settings.settingsAppMgmtEmpty') }}</p>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();

// After enabling/disabling an app the organization.enabledApps snapshot held in
// authStore is stale, the cached app registry response is stale, and the
// browser may have a previous /ui/registry response in disk cache. Without a
// hard refresh of all three, the App Switcher fails to reflect changes.
async function syncAppEntitlementCaches() {
  try {
    appShellStore.invalidateAppRegistryCache();
    invalidateTenantSchemaCaches();
    await authStore.refreshUser({ force: true });
  } catch (err) {
    console.warn('[AppManagement] Failed to refresh entitlement caches:', err);
  }
}

const loading = ref(true);
const error = ref('');
const organization = ref(null);
const applicationsCatalog = ref([]);
const capabilities = ref([]);
const processing = ref(null);

const APP_NAME_KEYS = {
  SALES: 'settings.appsNameSales',
  HELPDESK: 'settings.appsNameHelpdesk',
  PROJECTS: 'settings.appsNameProjects',
  PORTAL: 'settings.appsNamePortal',
  AUDIT: 'settings.appsNameAudit',
  LMS: 'settings.appsNameLms',
  INVENTORY: 'settings.appsNameInventory',
  MARKETING: 'settings.appsNameMarketing',
};

const APP_DESC_KEYS = {
  SALES: 'settings.settingsAppMgmtDescSales',
  HELPDESK: 'settings.settingsAppMgmtDescHelpdesk',
  PROJECTS: 'settings.settingsAppMgmtDescProjects',
  PORTAL: 'settings.settingsAppMgmtDescPortal',
  AUDIT: 'settings.settingsAppMgmtDescAudit',
  LMS: 'settings.settingsAppMgmtDescLms',
  INVENTORY: 'settings.settingsAppMgmtDescInventory',
  MARKETING: 'settings.settingsAppMgmtDescMarketing',
};

const STATUS_KEYS = {
  ACTIVE: 'settings.settingsSubsPlanActive',
  SUSPENDED: 'settings.settingsAppsStatusSuspended',
  DISABLED: 'settings.settingsAppsStatusDisabled'
};

/** Map GET /settings/applications status to enable/disable UI status. */
function mapCatalogStatusToMgmt(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ENABLED' || normalized === 'TRIAL') return 'ACTIVE';
  if (normalized === 'SUSPENDED') return 'SUSPENDED';
  return 'DISABLED';
}

// Server-driven app catalog + seat capabilities from add-capabilities
const allApps = computed(() => {
  const capabilitiesMap = {};
  for (const cap of capabilities.value) {
    capabilitiesMap[cap.appKey] = cap;
  }

  return applicationsCatalog.value.map((app) => {
    const appKey = String(app.appKey || '').toUpperCase();
    const cap = capabilitiesMap[appKey];
    return {
      appKey,
      name: app.name,
      description: app.description,
      status: mapCatalogStatusToMgmt(app.status),
      roles: cap?.roles || [],
      userTypesAllowed: cap?.userTypesAllowed || [],
      seatInfo: cap?.seatInfo || null
    };
  });
});

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([fetchApplications(), fetchCapabilities()]);
  } finally {
    loading.value = false;
  }
});

const fetchApplications = async ({ bypassCache = false } = {}) => {
  try {
    const data = await apiClient('/settings/applications', {
      method: 'GET',
      ...(bypassCache ? { params: { noCache: 'true' } } : {}),
    });
    applicationsCatalog.value = Array.isArray(data?.applications) ? data.applications : [];
  } catch (err) {
    console.error('Error fetching applications catalog:', err);
    applicationsCatalog.value = [];
    error.value = t('settings.settingsAppMgmtLoadFailed');
  }
};

const fetchOrganization = async () => {
  try {
    const response = await apiClient.get('/organization');
    if (response.success) {
      organization.value = response.data;
    }
  } catch (err) {
    console.error('Error fetching organization:', err);
    error.value = t('settings.settingsAppMgmtLoadFailed');
  }
};

const fetchCapabilities = async () => {
  try {
    const response = await apiClient.get('/users/add-capabilities');
    if (response.success) {
      capabilities.value = response.data.apps || [];
    }
  } catch (err) {
    console.error('Error fetching capabilities:', err);
  }
};

const getAppDisplayName = (app) => {
  const appKey = typeof app === 'string' ? app : app?.appKey;
  const labelKey = APP_NAME_KEYS[appKey];
  if (labelKey) return t(labelKey);
  if (typeof app === 'object' && app?.name) return app.name;
  return appKey || '';
};

const getAppDescription = (app) => {
  const appKey = typeof app === 'string' ? app : app?.appKey;
  const descKey = APP_DESC_KEYS[appKey];
  if (descKey) return t(descKey);
  if (typeof app === 'object' && app?.description) return app.description;
  return t('settings.settingsAppMgmtNoDesc');
};

const getStatusDisplay = (status) => {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
};

const getStatusBadgeClass = (status) => {
  const classMap = {
    ACTIVE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    SUSPENDED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    DISABLED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  };
  return classMap[status] || classMap.DISABLED;
};

const handleEnable = async (app) => {
  if (!confirm(t('settings.settingsAppMgmtEnableConfirm', { app: getAppDisplayName(app) }))) {
    return;
  }

  processing.value = app.appKey;
  error.value = '';

  try {
    const response = await apiClient.post('/organization/apps/enable', {
      appKey: app.appKey
    });

    if (response.success) {
      if (authStore.organization && Array.isArray(response.data?.enabledApps)) {
        authStore.organization = {
          ...authStore.organization,
          enabledApps: response.data.enabledApps,
        };
      }
      await Promise.all([
        fetchApplications({ bypassCache: true }),
        fetchCapabilities(),
        fetchOrganization(),
      ]);
      await syncAppEntitlementCaches();
    } else {
      error.value = response.message || t('settings.settingsAppMgmtEnableFailed');
    }
  } catch (err) {
    const code = err.response?.data?.code || err.code;
    const alreadyEnabled =
      code === 'APP_ALREADY_ENABLED' ||
      String(err.message || '').toLowerCase().includes('already enabled');
    if (alreadyEnabled) {
      await Promise.all([
        fetchApplications({ bypassCache: true }),
        fetchCapabilities(),
        fetchOrganization(),
      ]);
      await syncAppEntitlementCaches();
      return;
    }
    console.error('Error enabling app:', err);
    error.value = err.message || t('settings.settingsAppMgmtEnableFailed');
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    }
  } finally {
    processing.value = null;
  }
};

const handleDisable = async (app) => {
  if (!confirm(t('settings.settingsAppMgmtDisableConfirm', { app: getAppDisplayName(app) }))) {
    return;
  }

  processing.value = app.appKey;
  error.value = '';

  try {
    const response = await apiClient.post('/organization/apps/disable', {
      appKey: app.appKey
    });

    if (response.success) {
      if (authStore.organization && Array.isArray(response.data?.enabledApps)) {
        authStore.organization = {
          ...authStore.organization,
          enabledApps: response.data.enabledApps,
        };
      }
      await Promise.all([
        fetchApplications({ bypassCache: true }),
        fetchCapabilities(),
        fetchOrganization(),
      ]);
      await syncAppEntitlementCaches();
    } else {
      error.value = response.message || t('settings.settingsAppMgmtDisableFailed');
    }
  } catch (err) {
    console.error('Error disabling app:', err);
    error.value = err.message || t('settings.settingsAppMgmtDisableFailed');
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    }
  } finally {
    processing.value = null;
  }
};

const goBack = () => {
  router.push({ path: '/settings', query: { tab: 'applications' } });
};
</script>
