<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import {
  ArrowRightIcon,
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  Squares2X2Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getIconComponent } from '@/utils/navigationIcons';
import {
  getPlatformHomeAppIcon,
  getPlatformHomeAppIconWrapClass
} from '@/utils/platformHomeApps';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';

const { t } = useI18n();
const router = useRouter();
const appShellStore = useAppShellStore();
const { openTab } = useTabs();

const loading = ref(true);
const enabledApps = ref([]);
const allAppDefinitions = ref([]);
const selectedApp = ref(null);
const showDetailModal = ref(false);

const APP_NAME_KEYS = {
  SALES: 'settings.appsNameSales',
  HELPDESK: 'settings.appsNameHelpdesk',
  PROJECTS: 'settings.appsNameProjects',
  PORTAL: 'settings.appsNamePortal',
  AUDIT: 'settings.appsNameAudit',
  LMS: 'settings.appsNameLms',
  INVENTORY: 'settings.appsNameInventory'
};

const APP_DESC_KEYS = {
  SALES: 'settings.appsDescSales',
  HELPDESK: 'settings.appsDescHelpdesk',
  PROJECTS: 'settings.appsDescProjects',
  PORTAL: 'settings.appsDescPortal',
  AUDIT: 'settings.appsDescAudit',
  LMS: 'settings.appsDescLms',
  INVENTORY: 'settings.appsDescInventory'
};

const CATEGORY_KEYS = {
  Sales: 'platform.appRegistryCategorySales',
  Operations: 'platform.appRegistryCategoryOperations',
  Support: 'platform.appRegistryCategorySupport',
  Audit: 'platform.appRegistryCategoryAudit',
  Platform: 'platform.appRegistryCategoryPlatform'
};

const allApps = computed(() => {
  const appsMap = new Map();

  enabledApps.value.forEach((app) => {
    if (app.appKey?.toUpperCase() === 'CONTROL_PLANE') return;
    appsMap.set(app.appKey?.toUpperCase(), {
      ...app,
      isEnabled: true,
      status: 'enabled'
    });
  });

  allAppDefinitions.value.forEach((def) => {
    const appKeyUpper = def.appKey?.toUpperCase();
    if (appKeyUpper === 'CONTROL_PLANE') return;
    if (def.category !== 'BUSINESS') return;

    if (!appsMap.has(appKeyUpper)) {
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

  return Array.from(appsMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
});

const activeApps = computed(() => allApps.value.filter((app) => app.isEnabled));
const discoverApps = computed(() => allApps.value.filter((app) => !app.isEnabled));

function getCategoryFromAppKey(appKey) {
  const upper = appKey?.toUpperCase();
  if (upper === 'SALES') return 'Sales';
  if (upper === 'PROJECTS') return 'Operations';
  if (upper === 'HELPDESK') return 'Support';
  if (upper === 'AUDIT') return 'Audit';
  if (upper === 'PORTAL') return 'Platform';
  if (upper === 'INVENTORY') return 'Operations';
  return 'Operations';
}

function getAppDisplayName(app) {
  const appKey = String(app?.appKey || '').toUpperCase();
  const nameKey = APP_NAME_KEYS[appKey];
  return nameKey ? t(nameKey) : app?.name || appKey;
}

function getAppDescription(app) {
  const appKey = String(app?.appKey || '').toUpperCase();
  const descKey = APP_DESC_KEYS[appKey];
  if (descKey) return t(descKey);
  if (app?.description) return app.description;
  return t('platform.appRegistryFallbackDescription', { app: getAppDisplayName(app) });
}

function getCategoryLabel(category) {
  const key = CATEGORY_KEYS[category];
  return key ? t(key) : category;
}

function resolveAppIcon(app) {
  const appKey = String(app?.appKey || '').toUpperCase();
  const fromKey = getPlatformHomeAppIcon(appKey);
  if (fromKey !== Squares2X2Icon) return fromKey;
  if (app?.icon && typeof app.icon === 'string' && !app.icon.startsWith('<')) {
    return getIconComponent(app.icon, app.appKey?.toLowerCase());
  }
  return fromKey;
}

function getAppStatus(app) {
  if (app.comingSoon) return 'comingSoon';
  if (app.beta && app.isEnabled) return 'beta';
  if (app.isEnabled) return 'enabled';
  return 'available';
}

function getStatusLabel(status) {
  switch (status) {
    case 'enabled':
      return t('settings.settingsAppsStatusEnabled');
    case 'comingSoon':
      return t('platform.appRegistryStatusComingSoon');
    case 'beta':
      return t('platform.appRegistryStatusBeta');
    default:
      return t('platform.appRegistryStatusAvailable');
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'comingSoon':
      return ClockIcon;
    case 'beta':
      return BeakerIcon;
    default:
      return CheckCircleIcon;
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'enabled':
      return 'bg-success-50 text-success-800 border-success-200/80 dark:bg-success-900/30 dark:text-success-200 dark:border-success-700/50';
    case 'beta':
      return 'bg-primary-50 text-primary-800 border-primary-200/80 dark:bg-primary-900/35 dark:text-primary-200 dark:border-primary-600/50';
    case 'comingSoon':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200/80 dark:bg-neutral-800/60 dark:text-neutral-300 dark:border-neutral-600/50';
    default:
      return 'bg-secondary-50 text-secondary-800 border-secondary-200/80 dark:bg-secondary-900/30 dark:text-secondary-200 dark:border-secondary-700/50';
  }
}

function getCtaConfig(app) {
  const status = getAppStatus(app);

  if (status === 'comingSoon') {
    return {
      label: t('platform.appRegistryStatusComingSoon'),
      disabled: true,
      action: null
    };
  }

  if (app.isEnabled) {
    return {
      label: t('platform.appPulseCardOpenApp'),
      disabled: false,
      action: 'open'
    };
  }

  return {
    label: t('platform.appRegistryActionView'),
    disabled: false,
    action: 'view'
  };
}

async function loadEnabledApps() {
  try {
    if (!appShellStore.isLoaded) {
      await appShellStore.loadUIMetadata();
    }
    enabledApps.value = appShellStore.availableApps || [];
  } catch (error) {
    console.error('[AppRegistry] Error loading enabled apps:', error);
    enabledApps.value = [];
  }
}

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

function handleAppClick(app) {
  const cta = getCtaConfig(app);
  if (cta.disabled || !cta.action) return;

  if (cta.action === 'open') {
    let route = app.defaultRoute || getDefaultRouteForApp(app.appKey);

    if (
      route
      && !route.startsWith('/dashboard')
      && !route.startsWith('/audit')
      && !route.startsWith('/portal')
      && !route.startsWith('/helpdesk')
      && !route.startsWith('/projects')
    ) {
      const appKeyLower = app.appKey?.toLowerCase();
      if (route.startsWith(`/${appKeyLower}/`)) {
        route = `/dashboard/${appKeyLower}`;
      } else if (route === `/${appKeyLower}`) {
        route = `/dashboard/${appKeyLower}`;
      }
    }

    const appKeyUpper = app.appKey?.toUpperCase();
    if (appKeyUpper === 'AUDIT') {
      openTab(route, {
        title: getAppDisplayName(app),
        icon: 'document'
      });
    } else {
      router.push(route);
    }
  } else if (cta.action === 'view') {
    selectedApp.value = app;
    showDetailModal.value = true;
  }
}

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

function getCapabilityLabels(capabilities) {
  const labels = [];
  if (capabilities?.usesPeople) labels.push(t('platform.appRegistryCapabilityPeople'));
  if (capabilities?.usesOrganization) labels.push(t('platform.appRegistryCapabilityOrganizations'));
  if (capabilities?.usesTransactions) labels.push(t('platform.appRegistryCapabilityTransactions'));
  if (capabilities?.usesAutomation) labels.push(t('platform.appRegistryCapabilityAutomation'));
  return labels;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-full w-full">
    <div class="mx-auto w-full max-w-5xl space-y-6 pb-2">
      <header>
        <h1 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
          {{ t('platform.appRegistryAppRegistry') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('platform.appRegistryDiscoverAndManageYourApplications') }}
        </p>
      </header>

      <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          v-for="i in 4"
          :key="i"
          class="h-36"
          :class="PLATFORM_HOME_SKELETON_CLASS"
        />
      </div>

      <div
        v-else-if="allApps.length === 0"
        :class="['flex flex-col items-center justify-center px-6 py-14 text-center', PLATFORM_HOME_CARD_CLASS]"
      >
        <Squares2X2Icon class="mb-3 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('platform.appRegistryNoApplicationsAvailable') }}
        </p>
      </div>

      <template v-else>
        <section v-if="activeApps.length > 0" class="space-y-3">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
            {{ t('platform.appRegistryActiveApps') }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              v-for="app in activeApps"
              :key="app.appKey"
              type="button"
              :disabled="getCtaConfig(app).disabled"
              :class="[
                'group flex min-h-[8.5rem] flex-col rounded-2xl p-4 text-left transition-all',
                PLATFORM_HOME_CARD_CLASS,
                getCtaConfig(app).disabled
                  ? 'cursor-not-allowed opacity-70'
                  : 'hover:border-primary-200/80 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:hover:border-primary-700/50'
              ]"
              @click="handleAppClick(app)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    :class="getPlatformHomeAppIconWrapClass(app.appKey)"
                  >
                    <component :is="resolveAppIcon(app)" class="h-5 w-5" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                      {{ getAppDisplayName(app) }}
                    </h3>
                    <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {{ getAppDescription(app) }}
                    </p>
                  </div>
                </div>
                <span
                  :class="[
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    getStatusClass(getAppStatus(app))
                  ]"
                >
                  <component :is="getStatusIcon(getAppStatus(app))" class="h-3 w-3" />
                  {{ getStatusLabel(getAppStatus(app)) }}
                </span>
              </div>

              <div class="mt-auto flex items-center justify-between gap-3 pt-4">
                <span
                  v-if="app.category"
                  class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500"
                >
                  {{ getCategoryLabel(app.category) }}
                </span>
                <span
                  v-if="!getCtaConfig(app).disabled"
                  class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-400"
                >
                  {{ getCtaConfig(app).label }}
                  <ArrowRightIcon class="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          </div>
        </section>

        <section v-if="discoverApps.length > 0" class="space-y-3">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
            {{ t('platform.appRegistryDiscoverApps') }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              v-for="app in discoverApps"
              :key="app.appKey"
              type="button"
              :disabled="getCtaConfig(app).disabled"
              :class="[
                'group flex min-h-[8.5rem] flex-col rounded-2xl p-4 text-left transition-all',
                PLATFORM_HOME_CARD_CLASS,
                getCtaConfig(app).disabled
                  ? 'cursor-not-allowed opacity-70'
                  : 'hover:border-primary-200/80 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:hover:border-primary-700/50'
              ]"
              @click="handleAppClick(app)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800/70 dark:text-neutral-300"
                  >
                    <component :is="resolveAppIcon(app)" class="h-5 w-5" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                      {{ getAppDisplayName(app) }}
                    </h3>
                    <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {{ getAppDescription(app) }}
                    </p>
                  </div>
                </div>
                <span
                  :class="[
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    getStatusClass(getAppStatus(app))
                  ]"
                >
                  <component :is="getStatusIcon(getAppStatus(app))" class="h-3 w-3" />
                  {{ getStatusLabel(getAppStatus(app)) }}
                </span>
              </div>

              <div class="mt-auto flex items-center justify-between gap-3 pt-4">
                <span
                  v-if="app.category"
                  class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500"
                >
                  {{ getCategoryLabel(app.category) }}
                </span>
                <span
                  v-if="!getCtaConfig(app).disabled"
                  class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-400"
                >
                  {{ getCtaConfig(app).label }}
                  <ArrowRightIcon class="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          </div>
        </section>
      </template>
    </div>

    <Dialog :open="showDetailModal" class="relative z-50" @close="showDetailModal = false">
      <div class="fixed inset-0 bg-neutral-900/40 backdrop-blur-[1px]" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          :class="['w-full max-w-lg overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
        >
          <div
            v-if="selectedApp"
            :class="['flex items-start justify-between gap-4 px-5 py-4', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]"
          >
            <div class="flex min-w-0 items-start gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                :class="getPlatformHomeAppIconWrapClass(selectedApp.appKey)"
              >
                <component :is="resolveAppIcon(selectedApp)" class="h-5 w-5" />
              </span>
              <div class="min-w-0">
                <DialogTitle class="text-base font-semibold text-neutral-900 dark:text-white">
                  {{ getAppDisplayName(selectedApp) }}
                </DialogTitle>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <span
                    v-if="selectedApp.category"
                    :class="['inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', PLATFORM_HOME_INSET_CONTROL_CLASS, 'text-neutral-600 dark:text-neutral-300']"
                  >
                    {{ getCategoryLabel(selectedApp.category) }}
                  </span>
                  <span
                    :class="[
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      getStatusClass(getAppStatus(selectedApp))
                    ]"
                  >
                    {{ getStatusLabel(getAppStatus(selectedApp)) }}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="showDetailModal = false"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div v-if="selectedApp" class="space-y-5 px-5 py-4">
            <p class="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {{ getAppDescription(selectedApp) }}
            </p>

            <div v-if="selectedApp.capabilities && getCapabilityLabels(selectedApp.capabilities).length">
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('settings.roleDrawerTabCapabilities') }}
              </h4>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="capability in getCapabilityLabels(selectedApp.capabilities)"
                  :key="capability"
                  :class="['inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', PLATFORM_HOME_INSET_CONTROL_CLASS, 'text-neutral-700 dark:text-neutral-200']"
                >
                  {{ capability }}
                </span>
              </div>
            </div>

            <div
              :class="['rounded-xl border border-warning-200/80 bg-warning-50 px-4 py-3 dark:border-warning-700/50 dark:bg-warning-900/25']"
            >
              <p class="text-sm text-warning-900 dark:text-warning-100">
                <span class="font-medium">{{ t('platform.appRegistryInstallationComingSoon') }}</span>
                {{ t('platform.appRegistryThisAppIsAvailableForDiscovery') }}
              </p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>
