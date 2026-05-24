<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <!-- Mobile Top Bar -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 lg:hidden">
      <div class="flex items-center gap-x-6 px-4 py-3 h-16 sm:px-6">
        <button
          @click="drawerOpen = !drawerOpen"
          class="-m-2.5 p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
          :aria-label="t('navigation.toggleMenu')"
        >
          <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!drawerOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h1 class="flex-1 text-base font-semibold text-gray-900 dark:text-white truncate">{{ mobileHeaderTitle }}</h1>

        <div class="flex h-full items-center gap-3 pl-2 sm:pl-3">
          <!-- Mobile only: tablet uses TabBar bell (matches main shell TabBar styling) -->
          <NotificationBell
            class="md:hidden !min-h-9 !min-w-9 !p-1.5 rounded-md !border-0 !bg-transparent shadow-none hover:!bg-gray-100 dark:hover:!bg-gray-700 [&_svg]:!w-6 [&_svg]:!h-6"
            :show-count-on-desktop="true"
            @toggle="notificationSheetOpen = true"
          />
          
          <button
            v-if="pendingCount > 0"
            @click="syncDrawerOpen = true"
            class="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :aria-label="t('navigation.syncStatus')"
          >
            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">{{ pendingCount }}</span>
          </button>
          
          <Menu as="div" class="relative">
            <MenuButton
              class="inline-flex items-center justify-center rounded-full overflow-hidden w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <img
                :src="auditHeaderAvatarUrl"
                :alt="authStore.user?.username || 'User'"
                class="w-full h-full object-cover"
              />
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
                class="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 z-50"
              >
                <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ authStore.user?.username || 'User' }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ authStore.userRole || 'Auditor' }}</p>
                </div>
                <MenuItem v-if="hasSalesAccess" v-slot="{ active }">
                  <button
                    @click="router.push('/settings')"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
                      'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    {{ t('navigation.settings') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="toggleColorModeFromMenu"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
                      'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    {{ colorModeLabel }}
                  </button>
                </MenuItem>
                <hr class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleLogout"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
                      'text-red-600 dark:text-red-400'
                    ]"
                  >
                    {{ t('navigation.signOut') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </header>

    <!-- Desktop Sidebar -->
    <!-- ARCHITECTURE NOTE: GlobalSearch is owned by GlobalSurfacesProvider. -->
    <!-- Sidebar search click dispatches arivu:open-global-search custom event. -->
    <aside 
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      :class="[
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40',
        'transition-all duration-300 ease-in-out'
      ]"
    >
      <AppSidebar
        v-if="sidebarStructure"
        :sidebar-structure="sidebarStructure"
        :collapsed="!shouldShowExpanded"
        :on-toggle-collapse="toggleSidebar"
      />
      <AppSidebarSkeleton
        v-else-if="loadingSidebar && !sidebarStructure"
        :collapsed="!shouldShowExpanded"
      />
      <div
        v-else-if="!loadingSidebar && !sidebarStructure"
        class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('navigation.noNav') }}
      </div>
    </aside>

    <!-- Mobile Drawer -->
    <TransitionRoot as="template" :show="drawerOpen">
      <Dialog class="relative z-50 lg:hidden" @close="drawerOpen = false">
        <TransitionChild
          as="template"
          enter="transition-opacity ease-linear duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild
            as="template"
            enter="transition ease-in-out duration-300 transform"
            enter-from="-translate-x-full"
            enter-to="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leave-from="translate-x-0"
            leave-to="-translate-x-full"
          >
            <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
              <TransitionChild
                as="template"
                enter="ease-in-out duration-300"
                enter-from="opacity-0"
                enter-to="opacity-100"
                leave="ease-in-out duration-300"
                leave-from="opacity-100"
                leave-to="opacity-0"
              >
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <button type="button" class="-m-2.5 p-2.5" @click="drawerOpen = false">
                    <span class="sr-only">{{ t('navigation.closeSidebar') }}</span>
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </TransitionChild>

              <div class="relative flex grow flex-col overflow-y-auto bg-white dark:bg-gray-900 ring ring-gray-200 dark:ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-gray-50 dark:before:bg-black/10">
                <div class="relative flex grow">
                  <AppSidebar
                    v-if="sidebarStructure"
                    :sidebar-structure="sidebarStructure"
                    :collapsed="false"
                    embedded
                  />

                  <AppSidebarSkeleton
                    v-else-if="loadingSidebar && !sidebarStructure"
                    :collapsed="false"
                  />

                  <div v-if="!loadingSidebar && !sidebarStructure" class="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {{ t('navigation.noNav') }}
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Main Content - Phase 2D: Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'flex-1 transition-all duration-300',
        shouldShowExpanded ? 'lg:pl-[15.833rem]' : 'lg:pl-[4rem]'
      ]"
    >
      <!-- Tab Bar - Hidden on mobile, visible on tablet and up -->
      <TabBar class="hidden md:block" />
      
      <div class="min-h-screen pt-[var(--tabbar-offset,64px)]">
        <RouterView v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" :key="$route.fullPath" />
          </keep-alive>
        </RouterView>
      </div>
    </main>

    <!-- Sync Drawer (Mobile) -->
    <SyncDrawer v-model="syncDrawerOpen" />

    <!-- Notification Drawer (Desktop) -->
    <NotificationDrawer
      :open="notificationDrawerOpen"
      app-key="AUDIT"
      :mark-all-disabled="false"
      @close="notificationDrawerOpen = false"
    />

    <!-- Notification Sheet (Mobile) -->
    <NotificationSheet
      :open="notificationSheetOpen"
      app-key="AUDIT"
      :mark-all-disabled="false"
      @close="notificationSheetOpen = false"
    />
  </div>
</template>

<script setup>
/**
 * ARCHITECTURE NOTE: GlobalSearch is NOT imported here.
 * 
 * GlobalSearch is owned by GlobalSurfacesProvider (mounted in App.vue).
 * This layout triggers search via custom events only (arivu:open-global-search).
 * App layouts must NEVER own global surfaces - see GlobalSurfacesProvider.vue.
 */

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router';
import { Dialog, DialogPanel, Menu, MenuButton, MenuItem, MenuItems, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useColorMode } from '@/composables/useColorMode';
import { useSidebarState } from '@/composables/useSidebarState';
import { buildSidebarStructureForSession } from '@/utils/buildSidebarForSession';
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import SyncDrawer from '@/components/audit/SyncDrawer.vue';
import { getPendingCount } from '@/services/offlineQueue.js';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import NotificationSheet from '@/components/notifications/NotificationSheet.vue';
import NotificationDrawer from '@/components/notifications/NotificationDrawer.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarSkeleton from '@/components/AppSidebarSkeleton.vue';
import TabBar from '@/components/TabBar.vue';
import { configureTabsStorage, useTabs } from '@/composables/useTabs';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=128&h=128&q=80';

const auditHeaderAvatarUrl = computed(
  () => authStore.user?.avatar || DEFAULT_AVATAR
);
const appShellStore = useAppShellStore();
const { colorMode, toggleColorMode } = useColorMode();
const { collapsed } = useSidebarState();
const { initTabs, setupRouteWatcher } = useTabs();

const drawerOpen = ref(false);
const syncDrawerOpen = ref(false);
const pendingCount = ref(0);
const notificationSheetOpen = ref(false);
const notificationDrawerOpen = ref(false);

// Sidebar collapsed state (shared)
const isCollapsed = collapsed;
const isHovering = ref(false);

// Computed to determine if sidebar should show expanded
const shouldShowExpanded = computed(() => {
  return !isCollapsed.value || isHovering.value;
});

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
  window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
    detail: { collapsed: isCollapsed.value } 
  }));
};

const handleMouseEnter = () => {
  if (isCollapsed.value) {
    isHovering.value = true;
  }
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

const sidebarStructure = ref(null);
const loadingSidebar = ref(false);
const pendingCountIntervalId = ref(null);

const buildSidebar = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    sidebarStructure.value = null;
    return;
  }

  loadingSidebar.value = true;
  try {
    if (!authStore.user || !authStore.isAuthenticated) return;
    const { structure } = await buildSidebarStructureForSession(
      authStore.user,
      authStore.hasAppAccess
    );
    sidebarStructure.value = structure;
  } catch (e) {
    console.error('[AuditLayout] Failed to build sidebar:', e);
    sidebarStructure.value = null;
  } finally {
    loadingSidebar.value = false;
  }
};

const onCoreModulesUpdated = () => {
  if (authStore.user && authStore.isAuthenticated) {
    appShellStore.invalidateAppRegistryCache();
    invalidateTenantSchemaCaches();
    buildSidebar();
  }
};

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && authStore.isAuthenticated) {
      buildSidebar();
    } else {
      sidebarStructure.value = null;
    }
  }
);

watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && authStore.user) {
    buildSidebar();
  } else {
    sidebarStructure.value = null;
  }
});

watch(() => route.path, () => {
  drawerOpen.value = false;
});

// Desktop: notification drawer; mobile: sheet (TabBar dispatches this event)
const handleNotificationsClick = () => {
  if (window.innerWidth >= 1024) {
    notificationDrawerOpen.value = true;
  } else {
    notificationSheetOpen.value = true;
  }
};

onMounted(async () => {
  // Phase 2D: Load UI metadata if not already loaded (App.vue also does this, but safe to check)
  if (!appShellStore.isLoaded && authStore.isAuthenticated) {
    await appShellStore.loadUIMetadata();
  }
  
  // Initialize tabs for audit layout
  if (authStore.isAuthenticated && authStore.user && authStore.organization) {
    const instanceId = authStore.organization?._id || authStore.organization?.instanceId;
    const userId = authStore.user?._id;
    
    if (instanceId && userId) {
      configureTabsStorage({ instanceId, userId });
      initTabs();
      setupRouteWatcher(router);
    } else {
      console.error('[AuditLayout] Skipping tab initialization: missing instanceId or userId', {
        instanceId,
        userId,
        organization: authStore.organization,
        user: authStore.user
      });
    }
  }
  
  await buildSidebar();
  window.addEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.addEventListener('arivu:open-notifications-panel', handleNotificationsClick);
  
  // Load pending count
  updatePendingCount();
  pendingCountIntervalId.value = setInterval(updatePendingCount, 5000);
});

onBeforeUnmount(() => {
  window.removeEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.removeEventListener('arivu:open-notifications-panel', handleNotificationsClick);
  if (pendingCountIntervalId.value != null) {
    clearInterval(pendingCountIntervalId.value);
    pendingCountIntervalId.value = null;
  }
});

const handleLogout = () => {
  authStore.logout();
  router.replace('/login');
  authStore.error = null;
};

const toggleColorModeFromMenu = () => {
  const newMode = colorMode.value === 'light' ? 'dark' : 'light';
  toggleColorMode(newMode);
};

const colorModeLabel = computed(() =>
  colorMode.value === 'light' ? `🌙 ${t('common.darkMode')}` : `☀️ ${t('common.lightMode')}`
);

const mobileHeaderTitle = computed(() => {
  const path = route.path || '';

  if (path.startsWith('/audit/dashboard')) return 'Dashboard';
  if (path.startsWith('/audit/audits')) return 'My Audits';
  if (path.startsWith('/audit/schedule')) return 'Schedule';
  if (path.startsWith('/audit/findings')) return 'Findings';
  if (path.startsWith('/audit/responses')) return 'Responses';
  if (path.startsWith('/audit/settings/notifications')) return 'Notifications';
  return 'Dashboard';
});

// Check if user has Sales access (for Settings link)
const hasSalesAccess = computed(() => {
  return authStore.hasAppAccess('SALES');
});

const updatePendingCount = async () => {
  try {
    pendingCount.value = await getPendingCount();
  } catch (err) {
    console.error('[AuditLayout] Error getting pending count:', err);
  }
};


</script>
