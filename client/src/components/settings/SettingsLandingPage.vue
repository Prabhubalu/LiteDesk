<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('navigation.settings') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.landingSubtitle') }}
      </p>
    </div>

    <!-- Sections Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="section in sections"
        :key="section.id"
        @click="navigateToSection(section.id)"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
      >
        <!-- Icon -->
        <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
          <component :is="section.icon" class="w-6 h-6" />
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {{ t(section.nameKey) }}
        </h3>

        <!-- Description -->
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t(section.descriptionKey) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
import { useAuthStore } from '@/stores/authRegistry';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';

const router = useRouter();
const authStore = useAuthStore();

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions,
}));

// Icon components
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

const OrganizationIcon = () => h('svg', {
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

const UsersAccessIcon = () => h('svg', {
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

const ApplicationsIcon = () => h('svg', {
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

const BellIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  }),
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

// Sections configuration (filtered by the same rules as the Settings sidebar)
const sections = computed(() => {
  const all = [
    {
      id: 'profile',
      nameKey: 'settings.tabProfile',
      descriptionKey: 'settings.tabProfileDesc',
      icon: ProfileIcon,
      route: '/settings?tab=profile',
    },
    {
      id: 'organization',
      nameKey: 'settings.tabCompany',
      descriptionKey: 'settings.tabCompanyDesc',
      icon: OrganizationIcon,
      route: '/settings?tab=organization',
    },
    {
      id: 'business-hours',
      nameKey: 'settings.tabBusinessHoursFull',
      descriptionKey: 'settings.tabBusinessHoursDesc',
      icon: BusinessHoursIcon,
      route: '/settings?tab=business-hours',
    },
    {
      id: 'users-access',
      nameKey: 'settings.tabUsersAccess',
      descriptionKey: 'settings.tabUsersAccessDesc',
      icon: UsersAccessIcon,
      route: '/settings?tab=users-access',
    },
    {
      id: 'core-modules',
      nameKey: 'settings.tabCoreModules',
      descriptionKey: 'settings.tabCoreModulesDesc',
      icon: CoreModulesIcon,
      route: '/settings?tab=core-modules',
    },
    {
      id: 'applications',
      nameKey: 'settings.tabApplications',
      descriptionKey: 'settings.tabApplicationsDesc',
      icon: ApplicationsIcon,
      route: '/settings?tab=applications',
    },
    {
      id: 'automation',
      nameKey: 'settings.tabAutomation',
      descriptionKey: 'settings.tabAutomationDesc',
      icon: AutomationIcon,
      route: '/settings?tab=automation',
    },
    {
      id: 'performance',
      nameKey: 'settings.tabPerformance',
      descriptionKey: 'settings.tabPerformanceDesc',
      icon: PerformanceIcon,
      route: '/settings?tab=performance',
    },
    {
      id: 'subscriptions',
      nameKey: 'settings.tabSubscriptions',
      descriptionKey: 'settings.tabSubscriptionsDesc',
      icon: SubscriptionsIcon,
      route: '/settings?tab=subscriptions',
    },
    {
      id: 'notifications',
      nameKey: 'settings.tabNotifications',
      descriptionKey: 'settings.tabNotificationsDesc',
      icon: BellIcon,
      route: '/settings?tab=notifications',
    },
    {
      id: 'security',
      nameKey: 'settings.tabSecurity',
      descriptionKey: 'settings.tabSecurityDesc',
      icon: SecurityIcon,
      route: '/settings?tab=security',
    },
    {
      id: 'integrations',
      nameKey: 'settings.tabIntegrations',
      descriptionKey: 'settings.tabIntegrationsDesc',
      icon: IntegrationsIcon,
      route: '/settings?tab=integrations',
    },
  ];
  const ctx = settingsAccessCtx.value;
  return all.filter((s) => canAccessSettingsTab(s.id, ctx));
});

const navigateToSection = (sectionId) => {
  const section = sections.value.find(s => s.id === sectionId);
  if (section) {
    router.push(section.route);
  }
};
</script>

