<template>
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div class="mx-auto sm:px-6 lg:px-4 py-6 h-screen box-border flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your account and organization settings</p>
        </div>
        <!-- User Menu (mode + sign out) -->
        <Menu as="div" class="relative">
          <MenuButton class="flex items-center gap-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <img 
              class="w-8 h-8 rounded-full ring-2 ring-white/10 dark:ring-white/10"
              :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'"
              alt="User avatar"
            />
            <span class="hidden sm:block text-sm font-medium text-gray-900 dark:text-white">{{ authStore.user?.username || 'User' }}</span>
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10"
            >
              <template v-for="(item, index) in userMenuItems" :key="index">
                <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="item.action()"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
                      item.isLogout ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    {{ item.name }}
                  </button>
                </MenuItem>
              </template>
            </MenuItems>
          </transition>
        </Menu>
      </div>

      <!-- Vertical Tabs Layout with collapsible left rail -->
      <div class="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
        <!-- Left: Vertical Nav (collapsible like main nav) -->
        <aside
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          :class="[
            'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex-none transition-all duration-300',
            shouldShowExpanded ? 'lg:w-64' : 'lg:w-20',
            'w-full h-full overflow-y-auto'
          ]"
        >
          <!-- Header with collapse/expand button -->
          <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/10 min-h-[3rem]">
            <transition enter-active-class="transition-all duration-300" enter-from-class="opacity-0 w-0" enter-to-class="opacity-100 w-auto" leave-active-class="transition-all duration-300" leave-from-class="opacity-100 w-auto" leave-to-class="opacity-0 w-0">
              <h2 v-if="shouldShowExpanded" class="text-sm font-semibold text-gray-900 dark:text-white truncate">Settings</h2>
            </transition>
          </div>

          <nav class="p-2">
            <ul class="space-y-1">
              <li v-for="tab in tabs" :key="tab.id">
                <button
                  @click="activeTab = tab.id"
                  :title="!shouldShowExpanded ? tab.name : ''"
                  :class="[
                    'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                  ]"
                >
                  <div class="flex items-center justify-center w-5">
                    <component :is="tab.icon" class="w-5 h-5" />
                  </div>
                  <transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 max-w-0" enter-to-class="opacity-100 max-w-xs" leave-active-class="transition-all duration-300 ease-in" leave-from-class="opacity-100 max-w-xs" leave-to-class="opacity-0 max-w-0">
                    <span v-if="shouldShowExpanded" class="truncate">{{ tab.name }}</span>
                  </transition>
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <!-- Right: Content -->
        <section class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex-1 min-w-0 h-full overflow-y-auto">
          <component :is="currentTabComponent" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useColorMode } from '@/composables/useColorMode';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import UserManagement from '@/components/settings/UserManagement.vue';
import RolesPermissions from '@/components/settings/RolesPermissions.vue';
import ModulesAndFields from '@/components/settings/ModulesAndFields.vue';

const authStore = useAuthStore();
const { colorMode, toggleColorMode } = useColorMode();

const SETTINGS_TAB_KEY = 'litedesk-settings-active-tab';
const route = useRoute();
const router = useRouter();
const activeTab = ref('users');

// Collapsible left rail behavior (mirrors main nav)
const isCollapsed = ref(localStorage.getItem('litedesk-settings-collapsed') === 'true');
const isHovering = ref(false);
const shouldShowExpanded = computed(() => !isCollapsed.value || isHovering.value);
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
};
const handleMouseEnter = () => { if (isCollapsed.value) isHovering.value = true; };
const handleMouseLeave = () => { isHovering.value = false; };
watch(isCollapsed, (v) => localStorage.setItem('litedesk-settings-collapsed', v.toString()));

// Icon components as functions
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

const tabs = computed(() => {
  const allTabs = [
    { id: 'users', name: 'User Management', icon: UsersIcon, component: UserManagement },
    { id: 'roles', name: 'Roles & Permissions', icon: SecurityIcon, component: RolesPermissions },
    { id: 'modules', name: 'Modules & Fields', icon: CRMIcon, component: ModulesAndFields },
    { id: 'organization', name: 'Organization', icon: OrganizationIcon, component: 'div' },
    { id: 'security', name: 'Security', icon: SecurityIcon, component: 'div' },
    { id: 'crm', name: 'CRM Settings', icon: CRMIcon, component: 'div' }
  ];

  // Only show User Management and Roles to admins and owners (case-insensitive)
  const role = (authStore.user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'owner') {
    return allTabs.filter(tab => tab.id !== 'users' && tab.id !== 'roles');
  }

  return allTabs;
});
// User dropdown actions
const toggleColorModeFromMenu = () => {
  const newMode = colorMode.value === 'light' ? 'dark' : 'light';
  toggleColorMode(newMode);
};

const handleLogout = () => {
  authStore.logout();
  router.push('/');
  authStore.error = null;
};

const userMenuItems = computed(() => [
  { name: `Mode: ${colorMode.value === 'light' ? '🌙 Light' : '☀️ Dark'}`, action: toggleColorModeFromMenu, isModeToggle: true },
  { name: 'Sign out', action: handleLogout, divider: true, isLogout: true },
]);

const currentTabComponent = computed(() => {
  const tab = tabs.value.find(t => t.id === activeTab.value);
  return tab?.component || 'div';
});

// Sync tab with URL (?tab=roles)
const syncTabFromRoute = () => {
  const q = route.query.tab;
  if (typeof q === 'string') {
    const exists = tabs.value.some(t => t.id === q);
    if (exists) activeTab.value = q;
  }
};
syncTabFromRoute();

watch(() => route.query.tab, () => {
  syncTabFromRoute();
});

watch(activeTab, (val) => {
  const current = route.query.tab;
  if (current !== val) {
    router.replace({ query: { ...route.query, tab: val } });
  }
});

// Restore last active tab and persist changes
const restoreInitialTab = () => {
  const stored = localStorage.getItem(SETTINGS_TAB_KEY);
  if (stored) activeTab.value = stored;
  // Ensure the stored tab is valid given current permissions
  const validIds = new Set(tabs.value.map(t => t.id));
  if (!validIds.has(activeTab.value)) {
    activeTab.value = tabs.value[0]?.id || 'users';
  }
};

restoreInitialTab();

watch(activeTab, (v) => {
  localStorage.setItem(SETTINGS_TAB_KEY, v);
});

// If available tabs change due to permission changes, keep the closest valid tab
watch(tabs, (list) => {
  const validIds = new Set(list.map(t => t.id));
  if (!validIds.has(activeTab.value)) {
    activeTab.value = list[0]?.id || 'users';
  }
});
</script>
