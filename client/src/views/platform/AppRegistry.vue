<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import {
  BuildingOfficeIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  FolderIcon,
  CheckCircleIcon,
  ClockIcon,
  BeakerIcon
} from '@heroicons/vue/24/outline';

const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const { openTab } = useTabs();

const loading = ref(true);
const enabledApps = ref([]);
const allAppDefinitions = ref([]);
const selectedApp = ref(null);
const showDetailModal = ref(false);

// Category mapping
const categoryLabels = {
  Sales: 'Sales',
  Operations: 'Operations',
  Support: 'Support',
  Audit: 'Audit',
  Platform: 'Platform'
};

// App icon mapping (fallback)
const appIcons = {
  SALES: BuildingOfficeIcon,
  HELPDESK: LifebuoyIcon,
  PROJECTS: FolderIcon,
  AUDIT: ShieldCheckIcon,
  PORTAL: UserGroupIcon
};

// Status badge configuration
const statusBadgeConfig = {
  enabled: {
    label: 'Enabled',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: CheckCircleIcon
  },
  available: {
    label: 'Available',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: CheckCircleIcon
  },
  comingSoon: {
    label: 'Coming Soon',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    icon: ClockIcon
  },
  beta: {
    label: 'Beta',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: BeakerIcon
  }
};

// Computed: Merge enabled apps with all app definitions
const allApps = computed(() => {
  const appsMap = new Map();
  
  // First, add enabled apps
  enabledApps.value.forEach(app => {
    if (app.appKey?.toUpperCase() === 'CONTROL_PLANE') return; // Skip CONTROL_PLANE
    appsMap.set(app.appKey?.toUpperCase(), {
      ...app,
      isEnabled: true,
      status: 'enabled'
    });
  });
  
  // Then, add all app definitions (to show available apps)
  allAppDefinitions.value.forEach(def => {
    const appKeyUpper = def.appKey?.toUpperCase();
    if (appKeyUpper === 'CONTROL_PLANE') return; // Skip CONTROL_PLANE - platform-only
    
    // Only include BUSINESS category apps (SYSTEM apps like CONTROL_PLANE are platform-only)
    if (def.category !== 'BUSINESS') return;
    
    if (!appsMap.has(appKeyUpper)) {
      // App exists in definition but not enabled
      appsMap.set(appKeyUpper, {
        appKey: appKeyUpper,
        name: def.name,
        description: def.marketplace?.shortDescription || def.description,
        icon: def.ui?.icon || def.icon,
        defaultRoute: def.ui?.defaultRoute || '/dashboard',
        category: def.marketplace?.category || getCategoryFromAppKey(appKeyUpper),
        isEnabled: false,
        status: def.marketplace?.comingSoon ? 'comingSoon' : 'available',
        beta: def.marketplace?.beta || false,
        comingSoon: def.marketplace?.comingSoon || false,
        capabilities: def.capabilities,
        marketplace: def.marketplace,
        order: def.order || def.ui?.sidebarOrder || 0
      });
    } else {
      // Merge marketplace metadata into enabled app
      const existingApp = appsMap.get(appKeyUpper);
      appsMap.set(appKeyUpper, {
        ...existingApp,
        category: def.marketplace?.category || getCategoryFromAppKey(appKeyUpper),
        beta: def.marketplace?.beta || false,
        comingSoon: def.marketplace?.comingSoon || false,
        capabilities: def.capabilities,
        marketplace: def.marketplace,
        order: def.order || def.ui?.sidebarOrder || existingApp.order || 0
      });
    }
  });
  
  // Convert to array and sort by order
  return Array.from(appsMap.values()).sort((a, b) => {
    return (a.order || 0) - (b.order || 0);
  });
});

// Get category from app key (fallback)
function getCategoryFromAppKey(appKey) {
  const upper = appKey?.toUpperCase();
  if (upper === 'SALES') return 'Sales';
  if (upper === 'PROJECTS') return 'Operations';
  if (upper === 'HELPDESK') return 'Support';
  if (upper === 'AUDIT') return 'Audit';
  if (upper === 'PORTAL') return 'Platform';
  return 'Operations';
}

// Get app status for display
function getAppStatus(app) {
  if (app.comingSoon) return 'comingSoon';
  if (app.beta && app.isEnabled) return 'beta';
  if (app.isEnabled) return 'enabled';
  return 'available';
}

// Get CTA button config
function getCtaConfig(app) {
  const status = getAppStatus(app);
  
  if (status === 'comingSoon') {
    return {
      label: 'Coming Soon',
      disabled: true,
      action: null
    };
  }
  
  if (app.isEnabled) {
    return {
      label: 'Open',
      disabled: false,
      action: 'open'
    };
  }
  
  return {
    label: 'View',
    disabled: false,
    action: 'view'
  };
}

// Load enabled apps
async function loadEnabledApps() {
  try {
    if (!appShellStore.isLoaded) {
      await appShellStore.loadUIMetadata();
    }
    
    // Get apps from store (already filtered to exclude CONTROL_PLANE)
    enabledApps.value = appShellStore.availableApps || [];
  } catch (error) {
    console.error('[AppRegistry] Error loading enabled apps:', error);
    enabledApps.value = [];
  }
}

// Load all app definitions (for marketplace catalog)
async function loadAllAppDefinitions() {
  try {
    const response = await apiClient('/ui/app-definitions', {
      method: 'GET'
    });
    
    if (response.success && response.data) {
      allAppDefinitions.value = response.data;
    } else {
      allAppDefinitions.value = [];
    }
  } catch (error) {
    console.error('[AppRegistry] Error loading app definitions:', error);
    allAppDefinitions.value = [];
  }
}

// Load all data
async function loadData() {
  loading.value = true;
  try {
    await Promise.all([
      loadEnabledApps(),
      loadAllAppDefinitions()
    ]);
  } catch (error) {
    console.error('[AppRegistry] Error loading data:', error);
  } finally {
    loading.value = false;
  }
}

// Handle app click
function handleAppClick(app) {
  const cta = getCtaConfig(app);
  
  if (cta.disabled || !cta.action) return;
  
  if (cta.action === 'open') {
    // Navigate to app's default route
    let route = app.defaultRoute || getDefaultRouteForApp(app.appKey);
    
    // Normalize legacy routes to standard dashboard format
    if (route && !route.startsWith('/dashboard') && !route.startsWith('/audit') && !route.startsWith('/portal') && !route.startsWith('/helpdesk') && !route.startsWith('/projects')) {
      const appKeyLower = app.appKey?.toLowerCase();
      if (route.startsWith(`/${appKeyLower}/`)) {
        // Convert /sales/people -> /dashboard/sales
        route = `/dashboard/${appKeyLower}`;
      } else if (route === `/${appKeyLower}`) {
        // Convert /sales -> /dashboard/sales
        route = `/dashboard/${appKeyLower}`;
      }
    }
    
    // For Audit app, open in a new internal tab
    const appKeyUpper = app.appKey?.toUpperCase();
    if (appKeyUpper === 'AUDIT') {
      openTab(route, {
        title: app.name || 'Audit Dashboard',
        icon: 'document'
      });
    } else {
      router.push(route);
    }
  } else if (cta.action === 'view') {
    // Show app detail modal
    selectedApp.value = app;
    showDetailModal.value = true;
  }
}

// Get default route for app
function getDefaultRouteForApp(appKey) {
  const upperKey = appKey?.toUpperCase();
  switch (upperKey) {
    case 'SALES':
      return '/sales/dashboard';
    case 'HELPDESK':
      return '/helpdesk/cases';
    case 'PROJECTS':
      return '/projects/projects';
    case 'AUDIT':
      return '/audit/dashboard';
    case 'PORTAL':
      return '/portal/dashboard';
    default:
      return '/sales/dashboard';
  }
}

// Get capability labels
function getCapabilityLabels(capabilities) {
  const labels = [];
  if (capabilities?.usesPeople) labels.push('People');
  if (capabilities?.usesOrganization) labels.push('Organizations');
  if (capabilities?.usesTransactions) labels.push('Transactions');
  if (capabilities?.usesAutomation) labels.push('Automation');
  return labels;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('platform.appRegistryAppRegistry') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('platform.appRegistryDiscoverAndManageYourApplications') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="i in 6"
          :key="i"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
        >
          <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="allApps.length === 0" class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">{{ t('platform.appRegistryNoApplicationsAvailable') }}</p>
      </div>

      <!-- App Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="app in allApps"
          :key="app.appKey"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
        >
          <!-- App Icon -->
          <div class="mb-4">
            <span v-if="app.icon && typeof app.icon === 'string' && !app.icon.startsWith('<')" class="text-5xl">
              {{ app.icon }}
            </span>
            <component
              v-else
              :is="appIcons[app.appKey] || BuildingOfficeIcon"
              class="w-12 h-12 text-indigo-600 dark:text-indigo-400"
            />
          </div>

          <!-- App Name -->
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {{ app.name || app.appKey }}
          </h3>

          <!-- App Description -->
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 min-h-[3rem]">
            {{ app.description || `Access the ${app.name || app.appKey} application` }}
          </p>

          <!-- Category and Status Badges -->
          <div class="flex flex-wrap gap-2 mb-4">
            <!-- Category Badge -->
            <span
              v-if="app.category"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            >
              {{ categoryLabels[app.category] || app.category }}
            </span>
            
            <!-- Status Badge -->
            <span
              :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusBadgeConfig[getAppStatus(app)]?.color || statusBadgeConfig.available.color
              ]"
            >
              <component
                :is="statusBadgeConfig[getAppStatus(app)]?.icon || CheckCircleIcon"
                class="w-3 h-3 mr-1"
              />
              {{ statusBadgeConfig[getAppStatus(app)]?.label || 'Available' }}
            </span>
          </div>

          <!-- CTA Button -->
          <button
            :disabled="getCtaConfig(app).disabled"
            @click="handleAppClick(app)"
            :class="[
              'w-full px-4 py-2 rounded-md text-sm font-medium transition-colors',
              getCtaConfig(app).disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-600'
            ]"
          >
            {{ getCtaConfig(app).label }}
          </button>
        </div>
      </div>
    </div>

    <!-- App Detail Modal -->
    <Dialog :open="showDetailModal" @close="showDetailModal = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <DialogTitle class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ selectedApp?.name || selectedApp?.appKey }}
            </DialogTitle>
            <button
              @click="showDetailModal = false"
              class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div v-if="selectedApp" class="space-y-6">
            <!-- App Icon and Status -->
            <div class="flex items-center gap-4">
              <div>
                <span v-if="selectedApp.icon && typeof selectedApp.icon === 'string' && !selectedApp.icon.startsWith('<')" class="text-6xl">
                  {{ selectedApp.icon }}
                </span>
                <component
                  v-else
                  :is="appIcons[selectedApp.appKey] || BuildingOfficeIcon"
                  class="w-16 h-16 text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div>
                <div class="flex flex-wrap gap-2 mb-2">
                  <span
                    v-if="selectedApp.category"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {{ categoryLabels[selectedApp.category] || selectedApp.category }}
                  </span>
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      statusBadgeConfig[getAppStatus(selectedApp)]?.color || statusBadgeConfig.available.color
                    ]"
                  >
                    {{ statusBadgeConfig[getAppStatus(selectedApp)]?.label || 'Available' }}
                  </span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ selectedApp.description || `Access the ${selectedApp.name || selectedApp.appKey} application` }}
                </p>
              </div>
            </div>

            <!-- Capabilities -->
            <div v-if="selectedApp.capabilities">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.roleDrawerTabCapabilities') }}</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="capability in getCapabilityLabels(selectedApp.capabilities)"
                  :key="capability"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                >
                  {{ capability }}
                </span>
              </div>
            </div>

            <!-- Read-only Warning -->
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{{ t('platform.appRegistryInstallationComingSoon') }}</strong>{{ t('platform.appRegistryThisAppIsAvailableForDiscovery') }}</p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>

