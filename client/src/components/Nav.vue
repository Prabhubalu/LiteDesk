<script setup>
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import NotificationDrawer from '@/components/notifications/NotificationDrawer.vue';
import { computed, inject, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getTabTitleMetaForPath, resolveTabTitle } from '@/utils/navigationLabels';
import { buildSidebarStructureForSession } from '@/utils/buildSidebarForSession';

const { t, te } = useI18n();
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import { createPermissionSnapshot, hasPermission as hasSnapshotPermission } from '@/types/permission-snapshot.types';
import { useColorMode } from '@/composables/useColorMode';
import { useSidebarState } from '@/composables/useSidebarState';
import { useUserStatus } from '@/composables/useUserStatus';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarSkeleton from '@/components/AppSidebarSkeleton.vue';
import UserMenu from '@/components/UserMenu.vue';
import clickOutside from '@/directives/clickOutside';
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { 
  Bars3Icon, 
  BellIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'

const vClickOutside = clickOutside;

// Define props and emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const initDynamicRoutes = inject('arivuInitializeDynamicRoutes');
const router = useRouter();
const route = useRoute();
const { colorMode } = useColorMode();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const { lastActiveAppId } = useSidebarState();
const appRegistry = ref({});
const sidebarStructure = ref(null);
const loadingSidebar = ref(false);

const showDrawer = ref(false);
const isCollapsed = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const sidebarOpen = ref(false);
const isHovering = ref(false);

// Computed to determine if sidebar should show expanded
const shouldShowExpanded = computed(() => {
  return !isCollapsed.value || isHovering.value;
});

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
  
  // Dispatch custom event so TabBar can react to sidebar state change
  window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
    detail: { collapsed: isCollapsed.value } 
  }));
};

const toggleMobileMenu = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const handleMouseEnter = () => {
  if (isCollapsed.value) {
    isHovering.value = true;
  }
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

const FORBIDDEN_APP_NAV_MODULE_KEYS = new Set(['people', 'tasks', 'events', 'forms', 'items', 'organizations']);

const detectAppFromRoute = (path) => {
  const normalizedPath = String(path || '');
  if (normalizedPath.startsWith('/dashboard/')) {
    return String(normalizedPath.split('/')[2] || '').toUpperCase() || null;
  }
  if (normalizedPath.startsWith('/audit/')) return 'AUDIT';
  if (normalizedPath.startsWith('/portal/')) return 'PORTAL';
  if (normalizedPath.startsWith('/helpdesk/')) return 'HELPDESK';
  if (normalizedPath.startsWith('/projects/')) return 'PROJECTS';
  if (normalizedPath.startsWith('/sales/')) return 'SALES';
  return null;
};

const canAccessSidebarModule = (permission) => {
  if (!permission) return true;
  try {
    const snapshot = createPermissionSnapshot(authStore.user);
    return hasSnapshotPermission(snapshot, permission);
  } catch {
    return false;
  }
};

const applyAppLensToSidebarStructure = (targetAppKey) => {
  const registry = appRegistry.value || {};
  const app = registry[targetAppKey];
  if (!app || !sidebarStructure.value) return false;

  const modules = (app.modules || [])
    .filter((m) => {
      if (m.navigationCore === true) return false;
      if (m.navigationEntity === true) return false;
      if (m.excludeFromApps === true) return false;
      if (m.appKey && String(m.appKey).toLowerCase() === 'platform') return false;
      if (FORBIDDEN_APP_NAV_MODULE_KEYS.has(String(m.moduleKey || '').toLowerCase())) return false;
      return canAccessSidebarModule(m.permission);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((m) => ({
      kind: 'app',
      id: `${targetAppKey}:${m.moduleKey}`,
      label: m.label,
      route: m.route,
      icon: m.icon,
      moduleKey: m.moduleKey
    }));

  sidebarStructure.value = {
    ...sidebarStructure.value,
    appSwitcher: {
      ...sidebarStructure.value.appSwitcher,
      activeAppId: targetAppKey
    },
    appNav: {
      appId: targetAppKey,
      dashboard: {
        kind: 'app',
        id: targetAppKey,
        label: 'Dashboard',
        route: app.dashboardRoute,
        icon: targetAppKey === 'AUDIT' ? 'presentation-chart' : 'squares'
      },
      modules
    }
  };
  lastActiveAppId.value = targetAppKey;
  return true;
};

// Close mobile menu + keep sidebar lens in sync with route transitions.
watch(
  () => route.path,
  async (newPath) => {
    sidebarOpen.value = false;

    if (!authStore.user || !authStore.isAuthenticated || !sidebarStructure.value) return;

    const routeAppKey = detectAppFromRoute(newPath);
    if (!routeAppKey) return;

    const activeLens = String(sidebarStructure.value?.appSwitcher?.activeAppId || '').toUpperCase();
    if (activeLens === routeAppKey) return;

    // Fast path: switch the lens in-memory from loaded registry.
    const switchedInMemory = applyAppLensToSidebarStructure(routeAppKey);
    if (switchedInMemory) return;

    // Fallback: full rebuild when registry state is unavailable.
    await buildSidebar();
  }
);

// ============================================================================
// PLATFORM UI: Sidebar from Registry (Phase 1A - Full Cutover)
// ============================================================================
// 
// Removed:
// - AppSwitcher component
// - Per-app navigation logic
// - Hardcoded module lists
// - Inline permission checks
//
// Replaced with:
// - buildSidebarFromRegistry(registry, permissionSnapshot)
// - SidebarStructure rendering
// ============================================================================

// ARCHITECTURE NOTE: GlobalSearch is now handled by GlobalSurfacesProvider in App.vue
// This component can dispatch 'arivu:open-global-search' event to open search if needed

// Build sidebar from registry
const buildSidebar = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    sidebarStructure.value = null;
    return;
  }
  
  loadingSidebar.value = true;
  try {
    // Check if component is still mounted and user is still authenticated
    if (!authStore.user || !authStore.isAuthenticated) {
      return;
    }

    const { structure, entitlementScopedRegistry } = await buildSidebarStructureForSession(
      authStore.user,
      authStore.hasAppAccess
    );

    appRegistry.value = entitlementScopedRegistry;

    // Double-check before setting (component might have unmounted)
    if (authStore.user && authStore.isAuthenticated) {
      sidebarStructure.value = structure;
    }
  } catch (error) {
    console.error('[Nav] Error building sidebar:', error);
    // Only set to null if still authenticated (might have logged out)
    if (authStore.isAuthenticated) {
      sidebarStructure.value = null;
    }
  } finally {
    if (authStore.isAuthenticated) {
      loadingSidebar.value = false;
    }
  }
};

// Single watcher: user reference updates on login, logout, and refreshUser (permissions).
watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && authStore.isAuthenticated) {
      buildSidebar();
    } else {
      sidebarStructure.value = null;
    }
  },
  { immediate: true }
);

// Global search handlers
// ARCHITECTURE NOTE: GlobalSearch keyboard shortcuts and event listeners
// are now handled by GlobalSurfacesProvider in App.vue
// This component can dispatch custom events if needed for UI triggers

// Refresh sidebar and dynamic routes when modules change (e.g. Settings → Module details, or new custom module)
const onCoreModulesUpdated = async () => {
  if (authStore.user && authStore.isAuthenticated) {
    appShellStore.invalidateAppRegistryCache();
    invalidateTenantSchemaCaches();
    buildSidebar();
    try {
      if (typeof initDynamicRoutes === 'function') {
        await initDynamicRoutes();
      }
    } catch (e) {
      console.warn('[Nav] Failed to refresh dynamic routes:', e);
    }
  }
};

const handleNotificationClick = () => {
  const width = window.innerWidth || 0;
  if (width >= 1024) {
    // lg+: in-app drawer (tablet top bar shares this path only when viewport ≥1024)
    showDrawer.value = true;
  } else {
    // Below lg breakpoint: bottom sheet (App.vue)
    window.dispatchEvent(new CustomEvent('sales-open-notifications'));
  }
};

onMounted(() => {
  window.addEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.addEventListener('arivu:open-notifications-panel', handleNotificationClick);
});

onUnmounted(() => {
  window.removeEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.removeEventListener('arivu:open-notifications-panel', handleNotificationClick);
});

// User info and handlers (avatar + menu parity with TabBar)
const userName = computed(() => authStore.user?.username || 'User');
const userVertical = computed(() => authStore.user?.vertical || 'N/A');
const workspaceName = computed(() => authStore.organization?.name || `${userName.value}'s Space`);

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=128&h=128&q=80';

const workspaceAvatar = computed(() => authStore.user?.avatar || DEFAULT_AVATAR);

// Mobile-top-bar account dropdown is now a shared <UserMenu>. Track open state +
// surface the current presence dot on the avatar so the menu and the trigger
// stay visually in sync (mirrors TabBar's desktop treatment).
const showProfileDropdown = ref(false);
const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
};
const closeProfileDropdown = () => {
  showProfileDropdown.value = false;
};
const currentUserId = computed(() => authStore.user?._id || null);
const { currentPreset: userStatusPreset } = useUserStatus(currentUserId);

/** Same compact bell treatment as TabBar (mobile / tablet top bar). */
const shellTopBarBellClass =
  '!min-h-9 !min-w-9 !p-1.5 rounded-md !border-0 !bg-transparent shadow-none hover:!bg-gray-100 dark:hover:!bg-gray-700 [&_svg]:!w-6 [&_svg]:!h-6';

const mobileHeaderTitle = computed(() => {
  const path = route.path || '/';

  if (
    path === '/sales/dashboard' ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/')
  ) {
    return te('navigation.home') ? t('navigation.home') : 'Home';
  }

  const meta = getTabTitleMetaForPath(path, route.params || {});
  return resolveTabTitle(
    {
      path,
      params: route.params || {},
      titleKey: meta.titleKey,
      titleParams: meta.titleParams,
    },
    t,
    te
  );
});

const logoSrc = computed(() => {
    // If colorMode is 'dark' or 'system' (and system is dark), use the light-colored logo
    if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        // IMPORTANT: Update this path to your actual logo file for dark backgrounds
        return '/public/assets/nurtura_logo_white.svg'; 
    } else {
        // Use the dark-colored logo for light backgrounds
        // IMPORTANT: Update this path to your actual logo file for light backgrounds
        return '/public/assets/nurtura_logo_plain.svg'; 
    }
});
</script>

<template>
  <div>
    <!-- Keep NotificationBell mounted (store + realtime), but render notifications row in sidebar list -->
    <div class="hidden">
      <NotificationBell />
    </div>

    <!-- Mobile sidebar -->
    <TransitionRoot as="template" :show="sidebarOpen">
      <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
        <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild as="template" enter="transition ease-in-out duration-300 transform" enter-from="-translate-x-full" enter-to="translate-x-0" leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0" leave-to="-translate-x-full">
            <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
              <TransitionChild as="template" enter="ease-in-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-300" leave-from="opacity-100" leave-to="opacity-0">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">{{ t('navigation.closeSidebar') }}</span>
                    <XMarkIcon class="size-6 text-white dark:text-white" aria-hidden="true" />
                  </button>
                </div>
              </TransitionChild>

              <!-- Mobile Sidebar component -->
              <div class="relative flex grow flex-col overflow-y-auto bg-white dark:bg-gray-900 ring ring-gray-200 dark:ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-gray-50 dark:before:bg-black/10">
                <div class="relative flex grow">
                  <AppSidebar
                    v-if="sidebarStructure"
                    :sidebar-structure="sidebarStructure"
                    :collapsed="false"
                    :on-toggle-collapse="toggleSidebar"
                    embedded
                  />

                  <AppSidebarSkeleton
                    v-else-if="loadingSidebar && !sidebarStructure"
                    :collapsed="false"
                  />

                  <!-- Empty State -->
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

    <!-- Desktop Sidebar Container with expand/collapse functionality -->
    <div 
      data-onboarding-target="sidebar"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      :class="[
        'fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out',
        // AppSidebar owns the visual container (Figma-accurate).
        'bg-transparent border-0 flex flex-col',
        // Desktop
        'hidden lg:flex',
        // Width based on expanded state (click or hover)
        // Responsive: 15.833rem (190px) expanded, 4rem collapsed (matches AppSidebar w-[4rem])
        shouldShowExpanded ? 'lg:w-[15.833rem]' : 'lg:w-[4rem]',
        // Z-index only (shadow handled by AppSidebar)
        'z-50'
      ]"
    >
      <!-- Navigation Links - Rendered by AppSidebar (locked SidebarStructure) -->
      <div class="flex-1 overflow-y-auto">
        <AppSidebar
          v-if="sidebarStructure"
          :sidebar-structure="sidebarStructure"
          :collapsed="!shouldShowExpanded"
          :on-toggle-collapse="toggleSidebar"
          embedded
        />

        <AppSidebarSkeleton
          v-else-if="loadingSidebar && !sidebarStructure"
          :collapsed="!shouldShowExpanded"
        />

        <!-- Empty State -->
        <div v-if="!loadingSidebar && !sidebarStructure" class="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('navigation.noNav') }}
        </div>
      </div>

    </div>

    <!-- Mobile top bar -->
    <div class="fixed top-0 left-0 right-0 z-50 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 py-3 h-16 after:pointer-events-none after:absolute after:inset-0 after:border-b after:border-gray-200 dark:after:border-white/10 dark:after:bg-black/10 sm:px-6 lg:hidden">
      <button type="button" class="-m-2.5 p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden" @click="sidebarOpen = true">
        <span class="sr-only">{{ t('navigation.openSidebar') }}</span>
        <Bars3Icon class="size-6 text-gray-900 dark:text-gray-400" aria-hidden="true" />
      </button>
      <div class="flex-1 text-base font-semibold text-gray-900 dark:text-white">{{ mobileHeaderTitle }}</div>
      <div
        v-if="authStore.user"
        class="flex h-full items-center gap-3 pl-2 sm:pl-3"
      >
        <NotificationBell
          :connect-stream="false"
          :show-count-on-desktop="true"
          :class="shellTopBarBellClass"
          @toggle="handleNotificationClick"
        />

        <div
          v-click-outside="closeProfileDropdown"
          class="relative flex items-center"
        >
          <button
            type="button"
            class="relative inline-flex items-center justify-center rounded-full w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-haspopup="true"
            :aria-expanded="showProfileDropdown"
            @click.stop="toggleProfileDropdown"
          >
            <img :src="workspaceAvatar" alt="" class="w-full h-full rounded-full object-cover" />
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900',
                userStatusPreset.dotClass
              ]"
              aria-hidden="true"
            />
          </button>
          <UserMenu :open="showProfileDropdown" align="right" @close="closeProfileDropdown" />
        </div>
      </div>
    </div>
  </div>
  <NotificationDrawer
    :open="showDrawer"
    app-key="SALES"
    @close="showDrawer = false"
  />
  
  <!-- ARCHITECTURE NOTE: GlobalSearch is rendered by GlobalSurfacesProvider in App.vue -->
  <!-- This ensures it's available across all layouts (Sales, Audit, Portal, etc.) -->
</template>
