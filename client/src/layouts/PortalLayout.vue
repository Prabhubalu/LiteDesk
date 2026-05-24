<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <!-- Mobile Top Bar -->
    <header class="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:hidden">
      <div class="flex items-center justify-between px-4 h-14">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ organizationName }}
          </h1>
        </div>
        <div class="flex items-center gap-3 pl-2">
          <NotificationBell
            :show-count-on-desktop="true"
            class="!min-h-9 !min-w-9 !p-1.5 rounded-md !border-0 !bg-transparent shadow-none hover:!bg-gray-100 dark:hover:!bg-gray-700 [&_svg]:!w-6 [&_svg]:!h-6"
            @toggle="notificationSheetOpen = true"
          />
          <button
            type="button"
            @click="showUserMenu = !showUserMenu"
            class="rounded-full overflow-hidden w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :aria-label="t('navigation.userMenu')"
          >
            <img :src="portalAvatarUrl" alt="" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>
      
      <!-- User Menu Dropdown (Mobile) -->
      <div
        v-if="showUserMenu"
        class="absolute top-14 right-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
      >
        <div class="p-2 space-y-1">
          <button
            @click="toggleColorMode(colorMode === 'light' ? 'dark' : 'light'); showUserMenu = false"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="colorMode === 'light' ? 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' : 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'" />
            </svg>
            {{ colorMode === 'light' ? `🌙 ${t('common.darkMode')}` : `☀️ ${t('common.lightMode')}` }}
          </button>
          <button
            @click="handleLogout"
            class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {{ t('navigation.signOut') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Desktop Top Bar -->
    <header class="hidden lg:flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ organizationName }}
        </h1>
      </div>
      <div class="flex items-center gap-3 pl-3">
        <NotificationBell
          class="!min-h-9 !min-w-9 !p-1.5 rounded-md !border-0 !bg-transparent shadow-none hover:!bg-gray-100 dark:hover:!bg-gray-700 [&_svg]:!w-6 [&_svg]:!h-6"
          :show-count-on-desktop="true"
          @toggle="notificationDrawerOpen = true"
        />
        <div class="relative">
          <button
            type="button"
            @click="showUserMenu = !showUserMenu"
            class="rounded-full overflow-hidden w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :aria-label="t('navigation.userMenu')"
          >
            <img :src="portalAvatarUrl" alt="" class="w-full h-full object-cover" />
          </button>
          
          <!-- User Menu Dropdown (Desktop) -->
          <div
            v-if="showUserMenu"
            class="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
          >
            <div class="p-2 space-y-1">
              <router-link
                to="/portal/profile"
                @click="showUserMenu = false"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {{ t('navigation.profile') }}
              </router-link>
              <button
                @click="toggleColorMode(colorMode === 'light' ? 'dark' : 'light'); showUserMenu = false"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="colorMode === 'light' ? 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' : 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'" />
                </svg>
                {{ colorMode === 'light' ? `🌙 ${t('common.darkMode')}` : `☀️ ${t('common.lightMode')}` }}
              </button>
              <button
                @click="handleLogout"
                class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {{ t('navigation.signOut') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Desktop Sidebar -->
    <aside 
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      :class="[
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:pt-16 lg:z-30',
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700',
        'transition-all duration-300 ease-in-out',
        shouldShowExpanded ? 'lg:w-64' : 'lg:w-16'
      ]"
    >
      <!-- Logo Section (above top bar) -->
      <div class="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <transition
          enter-active-class="transition-all duration-300"
          enter-from-class="opacity-0 w-0"
          enter-to-class="opacity-100 w-auto"
          leave-active-class="transition-all duration-300"
          leave-from-class="opacity-100 w-auto"
          leave-to-class="opacity-0 w-0"
        >
          <img 
            v-if="shouldShowExpanded"
            class="h-8 w-auto transition-all duration-300" 
            :src="logoSrc" 
            alt="Arivu Logo" 
          />
        </transition>
        
        <!-- Collapse/Expand Button -->
        <button
          @click="toggleSidebar"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white transition-all duration-300 flex-shrink-0"
          :class="{ 'mx-auto': !shouldShowExpanded }"
        >
          <ChevronLeftIcon v-if="shouldShowExpanded" class="w-5 h-5 transition-transform duration-300" />
          <ChevronRightIcon v-else class="w-5 h-5 transition-transform duration-300" />
        </button>
      </div>
      
      <!-- Navigation - rendered by AppSidebar -->
      <!-- ARCHITECTURE NOTE: GlobalSearch is owned by GlobalSurfacesProvider. -->
      <!-- Sidebar search click dispatches arivu:open-global-search custom event. -->
      <div class="flex-1 pt-16 overflow-y-auto">
        <AppSidebar
          v-if="sidebarStructure"
          :sidebar-structure="sidebarStructure"
          :collapsed="!shouldShowExpanded"
          embedded
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
      </div>
    </aside>

    <!-- Main Content - Phase 2D: Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'flex-1 transition-all duration-300 lg:pt-16 pb-20 lg:pb-0',
        shouldShowExpanded ? 'lg:pl-64' : 'lg:pl-16'
      ]"
    >
      <div class="min-h-screen">
        <RouterView />
      </div>
    </main>

    <!-- Notification Drawer (Desktop) -->
    <NotificationDrawer
      :open="notificationDrawerOpen"
      app-key="PORTAL"
      @close="notificationDrawerOpen = false"
    />

    <!-- Notification Sheet (Mobile) -->
    <NotificationSheet
      :open="notificationSheetOpen"
      app-key="PORTAL"
      :mark-all-disabled="false"
      @close="notificationSheetOpen = false"
    />

    <!-- Mobile Bottom Tab Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 lg:hidden">
      <div class="flex items-center justify-around h-16">
        <router-link
          to="/portal/dashboard"
          class="flex flex-col items-center justify-center flex-1 min-h-[44px] transition-colors"
          :class="[
            $route.path === '/portal/dashboard' || $route.path.startsWith('/portal/dashboard/')
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          <component :is="$route.path === '/portal/dashboard' ? HomeIconSolid : HomeIcon" class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">{{ t('navigation.home') }}</span>
        </router-link>
        <router-link
          to="/portal/audits"
          class="flex flex-col items-center justify-center flex-1 min-h-[44px] transition-colors"
          :class="[
            $route.path.startsWith('/portal/audits')
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          <component :is="$route.path.startsWith('/portal/audits') ? DocumentTextIconSolid : DocumentTextIcon" class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">{{ t('navigation.portalAudits') }}</span>
        </router-link>
        <router-link
          to="/portal/actions"
          class="flex flex-col items-center justify-center flex-1 min-h-[44px] transition-colors"
          :class="[
            $route.path.startsWith('/portal/actions')
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          <component :is="$route.path.startsWith('/portal/actions') ? ClipboardDocumentCheckIconSolid : ClipboardDocumentCheckIcon" class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">{{ t('navigation.portalActions') }}</span>
        </router-link>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { RouterView, useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useColorMode } from '@/composables/useColorMode';
import { useSidebarState } from '@/composables/useSidebarState';
import { buildSidebarStructureForSession } from '@/utils/buildSidebarForSession';
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import { 
  HomeIcon, 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon,
  UserIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';
import {
  HomeIcon as HomeIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
  UserIcon as UserIconSolid
} from '@heroicons/vue/24/solid';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import NotificationDrawer from '@/components/notifications/NotificationDrawer.vue';
import NotificationSheet from '@/components/notifications/NotificationSheet.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarSkeleton from '@/components/AppSidebarSkeleton.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const { colorMode, toggleColorMode } = useColorMode();
const { collapsed } = useSidebarState();
const showUserMenu = ref(false);
const notificationDrawerOpen = ref(false);
const notificationSheetOpen = ref(false);

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
    console.error('[PortalLayout] Failed to build sidebar:', e);
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

onMounted(async () => {
  // Phase 2D: Load UI metadata if not already loaded (App.vue also does this, but safe to check)
  if (!appShellStore.isLoaded && authStore.isAuthenticated) {
    await appShellStore.loadUIMetadata();
  }
  await buildSidebar();
  window.addEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
});

// Close menu when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.relative')) {
    showUserMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  document.removeEventListener('click', handleClickOutside);
});

const organizationName = computed(() => {
  return authStore.organization?.name || 'Portal';
});

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=128&h=128&q=80';

const portalAvatarUrl = computed(() => authStore.user?.avatar || DEFAULT_AVATAR);

const handleLogout = () => {
  showUserMenu.value = false;
  authStore.logout();
  router.replace('/login');
};

// Phase 2D: Logo source (same as Nav.vue)
const logoSrc = computed(() => {
  if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    return '/public/assets/nurtura_logo_white.svg';
  } else {
    return '/public/assets/nurtura_logo_plain.svg';
  }
});

</script>
