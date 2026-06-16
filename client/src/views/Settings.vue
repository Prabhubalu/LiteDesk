<template>
    <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <!-- Split-pane layout: rail continues the active Settings tab surface -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        <!-- Left: Vertical Nav (collapsible like main nav) -->
        <aside
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          :class="[
            'settings-rail shrink-0 self-stretch flex-none transition-[width] duration-300',
            'border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900',
            'lg:border-b-0 lg:border-r',
            shouldShowExpanded ? 'lg:w-64' : 'lg:w-20',
            'w-full min-h-0 overflow-y-auto'
          ]"
        >
          <!-- Header with collapse/expand button -->
          <div class="flex min-h-[2.75rem] items-center justify-between border-b border-neutral-200/80 px-3 py-2 dark:border-neutral-700/80">
            <transition enter-active-class="transition-all duration-300" enter-from-class="opacity-0 w-0" enter-to-class="opacity-100 w-auto" leave-active-class="transition-all duration-300" leave-from-class="opacity-100 w-auto" leave-to-class="opacity-0 w-0">
              <h2 v-if="shouldShowExpanded" class="truncate text-[0.875rem] font-semibold text-neutral-900 dark:text-neutral-100">{{ t('navigation.settings') }}</h2>
            </transition>
            <button
              type="button"
              @click="toggleSidebar"
              :title="isCollapsed ? t('settings.expandSidebar') : t('settings.collapseSidebar')"
              class="flex-shrink-0 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <svg :class="shouldShowExpanded ? 'w-5 h-5' : 'w-6 h-6'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="shouldShowExpanded" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <nav class="px-2 py-2">
            <ul class="space-y-0.5">
              <!-- Overview / Landing Page Option -->
              <li>
                <button
                  @click="activeTab = null; router.push('/settings')"
                  :title="!shouldShowExpanded ? t('settings.navOverview') : ''"
                  :class="settingsRailItemClass(!activeTab)"
                >
                  <div class="flex h-[1.125rem] w-[1.125rem] items-center justify-center shrink-0">
                    <svg class="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 max-w-0" enter-to-class="opacity-100 max-w-xs" leave-active-class="transition-all duration-300 ease-in" leave-from-class="opacity-100 max-w-xs" leave-to-class="opacity-0 max-w-0">
                    <span v-if="shouldShowExpanded" class="truncate">{{ t('settings.navOverview') }}</span>
                  </transition>
                </button>
              </li>
              <template v-for="(tab, idx) in tabs" :key="tab.id">
                <li>
                  <button
                    @click="handleTabClick(tab)"
                    :title="!shouldShowExpanded ? t(tab.nameKey) : ''"
                    :class="settingsRailItemClass(activeTab === tab.id || (tab.id === 'notifications' && route.path.includes('/notifications')))"
                  >
                    <div class="flex h-[1.125rem] w-[1.125rem] items-center justify-center shrink-0">
                      <component :is="tab.icon" class="h-[1.125rem] w-[1.125rem]" />
                    </div>
                    <transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 max-w-0" enter-to-class="opacity-100 max-w-xs" leave-active-class="transition-all duration-300 ease-in" leave-from-class="opacity-100 max-w-xs" leave-to-class="opacity-0 max-w-0">
                      <span v-if="shouldShowExpanded" class="truncate">{{ t(tab.nameKey) }}</span>
                    </transition>
                  </button>
                </li>
                <!-- Visual separator between the personal "Your Profile" tab and the
                     workspace-level tabs below it. Only render when the next tab is the
                     first workspace tab, so we don't draw a divider if Profile is the
                     only entry visible. -->
                <li v-if="tab.id === 'profile' && idx < tabs.length - 1">
                  <hr class="my-2 border-neutral-200 dark:border-neutral-700" />
                  <div v-if="shouldShowExpanded" :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">
                    {{ t('settings.navWorkspace') }}
                  </div>
                </li>
              </template>
              
              <!-- Internal Section (Environment-Gated) -->
              <template v-if="isInternalEnvironment">
                <li>
                  <hr class="my-2 border-neutral-200 dark:border-neutral-700" />
                </li>
                <li>
                  <div v-if="shouldShowExpanded" :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">
                    {{ t('settings.navInternal') }}
                  </div>
                </li>
                <li v-for="internalTab in internalTabs" :key="internalTab.id">
                  <button
                    @click="handleTabClick(internalTab)"
                    :title="!shouldShowExpanded ? t(internalTab.nameKey) : ''"
                    :class="settingsRailItemClass(activeTab === internalTab.id || route.path.includes(internalTab.path))"
                  >
                    <div class="flex h-[1.125rem] w-[1.125rem] items-center justify-center shrink-0">
                      <component :is="internalTab.icon" class="h-[1.125rem] w-[1.125rem]" />
                    </div>
                    <transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 max-w-0" enter-to-class="opacity-100 max-w-xs" leave-active-class="transition-all duration-300 ease-in" leave-from-class="opacity-100 max-w-xs" leave-to-class="opacity-0 max-w-0">
                      <span v-if="shouldShowExpanded" class="truncate">{{ t(internalTab.nameKey) }}</span>
                    </transition>
                  </button>
                </li>
              </template>
            </ul>
          </nav>
        </aside>

        <!-- Right: Content -->
        <section
          :class="[
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-900',
            isDeepSettingsView ? 'p-4 lg:p-5' : 'p-5 lg:p-6'
          ]"
        >
          <AppsSettings
            v-if="activeTab === 'applications' && route.query.app"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <SettingsLandingPage
            v-else-if="!activeTab || activeTab === 'landing'"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <CoreModuleDetail
            v-else-if="activeTab === 'core-modules' && route.query.moduleKey"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <ApplicationDetail
            v-else-if="activeTab === 'applications' && route.query.appKey && !route.query.app"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <AppManagement
            v-else-if="activeTab === 'applications' && route.query.view === 'management'"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <SubscriptionDetail
            v-else-if="activeTab === 'subscriptions' && route.query.appKey"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <component
            v-else-if="activeTab === 'notifications' || route.path.includes('/notifications')"
            :is="currentTabComponent"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <component
            v-else
            :is="currentTabComponent"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
import { useAuthStore } from '@/stores/authRegistry';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';
import {
  SETTINGS_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_RAIL_ITEM_BASE_CLASS,
  SETTINGS_RAIL_ITEM_INACTIVE_CLASS,
  SETTINGS_RAIL_SECTION_LABEL_CLASS,
} from '@/components/settings/settingsSaveBar';
import { useColorMode } from '@/composables/useColorMode';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'

const ProfileSettings = defineAsyncComponent(() => import('@/components/settings/ProfileSettings.vue'));
const OrganizationSettings = defineAsyncComponent(() => import('@/components/settings/OrganizationSettings.vue'));
const SecuritySettings = defineAsyncComponent(() => import('@/components/settings/SecuritySettings.vue'));
const IntegrationsSettings = defineAsyncComponent(() => import('@/components/settings/IntegrationsSettings.vue'));
const UsersAccessSettings = defineAsyncComponent(() => import('@/components/settings/UsersAccessSettings.vue'));
const AppsSettings = defineAsyncComponent(() => import('@/components/settings/AppsSettings.vue'));
const SettingsLandingPage = defineAsyncComponent(() => import('@/components/settings/SettingsLandingPage.vue'));
const CoreModulesList = defineAsyncComponent(() => import('@/components/settings/CoreModulesList.vue'));
const CoreModuleDetail = defineAsyncComponent(() => import('@/components/settings/CoreModuleDetail.vue'));
const ApplicationsList = defineAsyncComponent(() => import('@/components/settings/ApplicationsList.vue'));
const ApplicationDetail = defineAsyncComponent(() => import('@/components/settings/ApplicationDetail.vue'));
const AppManagement = defineAsyncComponent(() => import('@/components/settings/AppManagement.vue'));
const SubscriptionsList = defineAsyncComponent(() => import('@/components/settings/SubscriptionsList.vue'));
const SubscriptionDetail = defineAsyncComponent(() => import('@/components/settings/SubscriptionDetail.vue'));
const NotificationSettings = defineAsyncComponent(() => import('@/components/settings/NotificationSettings.vue'));
const DemoRequests = defineAsyncComponent(() => import('@/views/DemoRequests.vue'));
const InstanceManagement = defineAsyncComponent(() => import('@/views/InstanceManagement.vue'));
const AutomationSettings = defineAsyncComponent(() => import('@/components/settings/AutomationSettings.vue'));
const PerformanceSettings = defineAsyncComponent(() => import('@/components/settings/PerformanceSettings.vue'));
const BusinessHoursSettings = defineAsyncComponent(() => import('@/components/settings/BusinessHoursSettings.vue'));

const authStore = useAuthStore();
const { colorMode, toggleColorMode } = useColorMode();

const SETTINGS_TAB_KEY = 'arivu-settings-active-tab';
const route = useRoute();
const router = useRouter();
const activeTab = ref(route.query.tab || null);

const isDeepAppConfig = computed(() =>
  activeTab.value === 'applications'
  && typeof route.query.app === 'string'
  && route.query.app.length > 0
);

const isDeepAutomationConfig = computed(() =>
  activeTab.value === 'automation'
  && (
    typeof route.query.automationView === 'string'
    || typeof route.query.assignmentApp === 'string'
  )
);

const isDeepSettingsView = computed(() =>
  isDeepAppConfig.value || isDeepAutomationConfig.value
);

// Navigate back function
const goBack = () => {
  // Check if we can go back in history
  // For new tabs, history.length might be 1, so check if there's a referrer
  const hasHistory = window.history.length > 1 || document.referrer;
  
  if (hasHistory && window.history.length > 1) {
    // Try to go back
    router.go(-1);
  } else {
    // If no history (e.g., opened in new tab), go to platform home
    router.push('/platform/home');
  }
};

// Collapsible left rail behavior (mirrors main nav)
const isCollapsed = ref(localStorage.getItem('arivu-settings-collapsed') === 'true');
const isHovering = ref(false);
const shouldShowExpanded = computed(() => !isCollapsed.value || isHovering.value);
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
};
const handleMouseEnter = () => { if (isCollapsed.value) isHovering.value = true; };
const handleMouseLeave = () => { isHovering.value = false; };

function settingsRailItemClass(active) {
  return [
    SETTINGS_RAIL_ITEM_BASE_CLASS,
    active ? SETTINGS_RAIL_ITEM_ACTIVE_CLASS : SETTINGS_RAIL_ITEM_INACTIVE_CLASS,
  ];
}

watch(isCollapsed, (v) => localStorage.setItem('arivu-settings-collapsed', v.toString()));

// Icon components as functions
const ProfileIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
  })
]);

const UsersIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  })
]);

const PlatformIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
  })
]);

const SecurityIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
  })
]);

const CRMIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
  }),
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  })
]);

const GroupsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
  })
]);

const AppsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  })
]);

const BusinessHoursIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  })
]);

const AutomationIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M13 10V3L4 14h7v7l9-11h-7z'
  })
]);

const PerformanceIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
  })
]);

const BellIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
  })
]);

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions,
}));

const tabs = computed(() => {
  const all = [
    { id: 'profile', nameKey: 'settings.tabProfile', icon: ProfileIcon, component: ProfileSettings },
    { id: 'organization', nameKey: 'settings.tabCompany', icon: PlatformIcon, component: OrganizationSettings },
    { id: 'business-hours', nameKey: 'settings.tabBusinessHours', icon: BusinessHoursIcon, component: BusinessHoursSettings },
    { id: 'users-access', nameKey: 'settings.tabUsersAccess', icon: UsersIcon, component: UsersAccessSettings },
    { id: 'core-modules', nameKey: 'settings.tabCoreModules', icon: CoreModulesIcon, component: CoreModulesList },
    { id: 'applications', nameKey: 'settings.tabApplications', icon: AppsIcon, component: ApplicationsList },
    { id: 'automation', nameKey: 'settings.tabAutomation', icon: AutomationIcon, component: AutomationSettings },
    { id: 'performance', nameKey: 'settings.tabPerformance', icon: PerformanceIcon, component: PerformanceSettings },
    { id: 'subscriptions', nameKey: 'settings.tabSubscriptions', icon: SubscriptionsIcon, component: SubscriptionsList },
    { id: 'notifications', nameKey: 'settings.tabNotifications', icon: BellIcon, component: NotificationSettings },
    { id: 'security', nameKey: 'settings.tabSecurity', icon: SecurityIcon, component: SecuritySettings },
    { id: 'integrations', nameKey: 'settings.tabIntegrations', icon: IntegrationsIcon, component: IntegrationsSettings },
  ];
  const ctx = settingsAccessCtx.value;
  return all.filter((tab) => canAccessSettingsTab(tab.id, ctx));
});

const SubscriptionsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
  })
]);

const IntegrationsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  })
]);

const CoreModulesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
  })
]);

// Internal section icons
const DemoRequestsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
  })
]);

const InstancesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  })
]);

// Internal tooling: dev build only AND master org (same intent as routes with requiresMasterOrganization)
const isInternalEnvironment = computed(() => {
  return import.meta.env.DEV === true && authStore.isMasterOrganization;
});

// Internal section tabs (environment-gated)
const internalTabs = computed(() => {
  if (!isInternalEnvironment.value) return [];
  
  return [
    {
      id: 'demo-requests',
      nameKey: 'settings.tabDemoRequests',
      icon: DemoRequestsIcon,
      component: DemoRequests,
      path: '/settings/demo-requests'
    },
    {
      id: 'instances',
      nameKey: 'settings.tabInstances',
      icon: InstancesIcon,
      component: InstanceManagement,
      path: '/settings/instances'
    }
  ];
});

// User dropdown actions
const toggleColorModeFromMenu = () => {
  const newMode = colorMode.value === 'light' ? 'dark' : 'light';
  toggleColorMode(newMode);
};

const handleLogout = () => {
  authStore.logout();
  router.replace('/login');
  authStore.error = null;
};

const userMenuItems = computed(() => [
  { name: `Mode: ${colorMode.value === 'light' ? '🌙 Light' : '☀️ Dark'}`, action: toggleColorModeFromMenu, isModeToggle: true },
  { name: 'Sign out', action: handleLogout, divider: true, isLogout: true },
]);

// Handle tab click - special handling for notifications and internal tabs
function handleTabClick(tab) {
  if (tab.id === 'notifications') {
    activeTab.value = 'notifications';
    // Use query parameters instead of route paths to stay within Settings
    router.replace({ path: '/settings', query: { ...route.query, tab: 'notifications', notificationPage: 'preferences' } });
  } else if (tab.id === 'automation') {
    activeTab.value = 'automation';
    router.replace({ path: '/settings', query: { tab: 'automation' } });
  } else if (tab.id === 'performance') {
    activeTab.value = 'performance';
    router.replace({ path: '/settings', query: { tab: 'performance' } });
  } else if (tab.path) {
    // Internal tabs use query parameters to stay within Settings layout
    activeTab.value = tab.id;
    router.replace({ path: '/settings', query: { ...route.query, tab: tab.id } });
  } else {
    activeTab.value = tab.id;
  }
}

const currentTabComponent = computed(() => {
  if (!activeTab.value) return null;
  
  // Handle detail views
  if (activeTab.value === 'core-modules' && route.query.moduleKey) {
    return CoreModuleDetail;
  }
  if (activeTab.value === 'applications' && route.query.appKey && !route.query.app) {
    return ApplicationDetail;
  }
  if (activeTab.value === 'subscriptions' && route.query.appKey) {
    return SubscriptionDetail;
  }
  
  // Check internal tabs first (environment-gated)
  const internalTab = internalTabs.value.find(t => t.id === activeTab.value);
  if (internalTab) {
    return internalTab.component;
  }
  
  // Then check regular tabs
  const tab = tabs.value.find(t => t.id === activeTab.value);
  return tab?.component || null;
});

// Sync tab with URL (?tab=roles)
const syncTabFromRoute = () => {
  const q = route.query.tab;
  if (typeof q === 'string') {
    const exists = tabs.value.some(t => t.id === q) || internalTabs.value.some(t => t.id === q);
    if (exists) {
      activeTab.value = q;
    } else {
      activeTab.value = null;
      const nextQuery = { ...route.query };
      delete nextQuery.tab;
      router.replace({ path: '/settings', query: nextQuery });
    }
  } else if (route.path.includes('/notifications') && !route.query.tab) {
    // If directly navigating to a notification route, set tab but don't change path
    activeTab.value = 'notifications';
  }
};
syncTabFromRoute();

watch(() => route.query.tab, () => {
  syncTabFromRoute();
});

watch(
  () => [route.query.tab, route.query.app, route.query.config],
  () => {
    if (
      route.query.tab === 'applications'
      && route.query.app === 'helpdesk'
      && route.query.config === 'execution-settings'
    ) {
      router.replace({ path: '/settings', query: { tab: 'automation', automationView: 'sla' } });
    }
  },
  { immediate: true },
);

watch(activeTab, (val) => {
  const current = route.query.tab;
  const normalizedCurrent = current == null || current === '' ? null : String(current);
  const normalizedVal = val == null || val === '' ? null : String(val);
  if (normalizedCurrent === normalizedVal) return;
  const nextQuery = { ...route.query };
  if (normalizedVal == null) {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = normalizedVal;
  }
  router.replace({ path: '/settings', query: nextQuery });
});

// Restore last active tab and persist changes
const restoreInitialTab = () => {
  // If there's a tab in the URL query, use it
  if (route.query.tab) {
    const validIds = new Set([...tabs.value.map(t => t.id), ...internalTabs.value.map(t => t.id)]);
    if (validIds.has(route.query.tab)) {
      activeTab.value = route.query.tab;
      return;
    }
  }
  
  // Check if we're on a notifications route (for direct navigation/bookmarks)
  if (route.path.includes('/notifications')) {
    activeTab.value = 'notifications';
    return;
  }
  
  // Otherwise, show landing page (no tab selected)
  activeTab.value = null;
};

restoreInitialTab();

watch(activeTab, (v) => {
  if (v) {
  localStorage.setItem(SETTINGS_TAB_KEY, v);
  }
});

// If available tabs change due to permission changes, keep the closest valid tab
watch([tabs, internalTabs], ([tabsList, internalTabsList]) => {
  if (activeTab.value) {
    const validIds = new Set([...tabsList.map(t => t.id), ...internalTabsList.map(t => t.id)]);
    if (!validIds.has(activeTab.value)) {
      activeTab.value = null; // Show landing page if tab is invalid
    }
  }
});
</script>
