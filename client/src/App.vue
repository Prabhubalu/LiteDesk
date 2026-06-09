<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { usePermissionSync } from '@/composables/usePermissionSync';
import { useColorMode } from '@/composables/useColorMode';
import { useNotifications } from '@/composables/useNotifications';
const PlatformShell = defineAsyncComponent(() => import('@/components/PlatformShell.vue'));
const NotificationSheet = defineAsyncComponent(() =>
  import('@/components/notifications/NotificationSheet.vue')
);
import NotificationContainer from '@/components/NotificationContainer.vue';
const GlobalSurfacesProvider = defineAsyncComponent(() =>
  import('@/components/global/GlobalSurfacesProvider.vue')
);
const ImportProgressBanner = defineAsyncComponent(() =>
  import('@/components/import/ImportProgressBanner.vue')
);
const BulkDeleteProgressBanner = defineAsyncComponent(() =>
  import('@/components/common/BulkDeleteProgressBanner.vue')
);
const EmailVerificationBanner = defineAsyncComponent(() =>
  import('@/components/auth/EmailVerificationBanner.vue')
);
const HelpdeskNotificationDevPanel = defineAsyncComponent(() =>
  import('@/components/dev/HelpdeskNotificationDevPanel.vue')
);
/** Opt-in dev UI — set VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL=true in client/.env.local */
const showHelpdeskNotificationDevPanel =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL === 'true';
import { useSidebarState } from '@/composables/useSidebarState';
import { identifyProductUser } from '@/config/posthogUser';
import {
  startNotificationRealtime,
  stopNotificationRealtime,
  refreshNotificationRealtimeConnections,
  onNotificationRouteChange
} from '@/services/notificationRealtimeService';
import { useActiveImportsStore } from '@/stores/activeImports';

const appDebugEnabled = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('arivu:debug:app') === '1';
  } catch (_e) {
    return false;
  }
};

const appLog = (...args) => {
  if (!appDebugEnabled()) return;
  console.log(...args);
};

function resetTabsStateFromModule() {
  void import('@/composables/useTabs').then((m) => m.resetTabsState());
}

const initDynamicRoutes = inject('arivuInitializeDynamicRoutes');
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const activeImportsStore = useActiveImportsStore();
const router = useRouter();
const route = useRoute();
const { warning } = useNotifications();
const { lastActiveAppId } = useSidebarState();

const recoverUnmatchedDynamicRoute = async () => {
  const currentPath = route.fullPath || route.path;
  if (!currentPath || route.matched.length > 0) return;

  const resolved = router.resolve(currentPath);
  if (!resolved?.matched?.length) return;

  try {
    await router.replace(currentPath);
  } catch (error) {
    console.warn('[App] Failed to recover unmatched dynamic route:', currentPath, error);
  }
};

// Store cleanup function for route watcher (popstate listener)
let cleanupRouteWatcher = null;

// Initialize color mode
const { colorMode } = useColorMode();

// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);
// Hide shell only for auth routes and routes with explicit hideShell meta
// Platform routes (/platform/*) should show the shell
const hideShell = computed(() => {
  // Check route meta first
  if (route.meta.hideShell) return true;
  // Hide for auth routes only
  if (route.path.startsWith('/login') || route.path.startsWith('/auth/')) return true;
  // Hide for audit routes (they use AuditLayout)
  if (route.path.startsWith('/audit/')) return true;
  // Portal routes now use standard PlatformShell layout
  // Platform routes show the shell
  return false;
});
const isPublicRoute = computed(() => route.meta.requiresAuth === false);

const DEFAULT_CONTENT_OFFSET = 0;
const EXTRA_OFFSET_LIGHT = '2rem';
const EXTRA_OFFSET_LARGE = '2rem';
const contentWrapperRef = ref(null);
const tableStickyOffset = ref(`calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`);
const salesNotificationSheetOpen = ref(false);

const handleSalesOpenNotifications = () => {
  if (!authStore.isAuthenticated) return;
  if (window.innerWidth < 1024) {
    salesNotificationSheetOpen.value = true;
  }
};

// Sidebar collapsed state - Load from localStorage, default to false
const sidebarCollapsed = ref(
  localStorage.getItem('arivu-sidebar-collapsed') === 'true'
);

// Save sidebar state to localStorage whenever it changes
watch(sidebarCollapsed, (newValue) => {
  localStorage.setItem('arivu-sidebar-collapsed', newValue.toString());
  queueContentOffsetUpdate();
});

const updateContentOffset = () => {
  const el = contentWrapperRef.value;

  if (!(el instanceof HTMLElement)) {
    tableStickyOffset.value = `calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`;
    return;
  }

  const rect = el.getBoundingClientRect();
  const baseOffset = Math.max(DEFAULT_CONTENT_OFFSET, Math.round(rect.top));
  const extraSpacing = window.innerWidth >= 1024 ? EXTRA_OFFSET_LARGE : EXTRA_OFFSET_LIGHT;

  tableStickyOffset.value = `calc(${baseOffset}px + ${extraSpacing})`;
};

const queueContentOffsetUpdate = () => {
  nextTick(() => {
    requestAnimationFrame(updateContentOffset);
  });
};

watch(
  () => route.fullPath,
  () => {
    queueContentOffsetUpdate();
  }
);

watch(hideShell, () => {
  queueContentOffsetUpdate();
});

const handleResize = () => {
  updateContentOffset();
};

// Cross-tab auth guard: if another tab logs in/out and changes localStorage.user,
// don't silently switch accounts in this tab.
const handleStorageEvent = (e) => {
  if (e.key !== 'user') return;
  if (!authStore.isAuthenticated || !authStore.user?._id) return;

  // User removed (logout in another tab)
  if (!e.newValue) {
    warning('You were signed out because your session changed in another tab.', 6000);
    authStore.logout();
    resetTabsStateFromModule();
    router.replace('/login');
    return;
  }

  try {
    const incoming = JSON.parse(e.newValue);
    const incomingId = incoming?._id;
    if (incomingId && String(incomingId) !== String(authStore.user._id)) {
      warning('You were signed out because you logged into a different account in another tab.', 6500);
      authStore.logout();
      resetTabsStateFromModule();
      router.replace('/login');
    }
  } catch (err) {
    console.warn('Failed to parse localStorage user in storage event:', err);
    // Safe fallback: logout rather than risk inconsistent state
    warning('You were signed out due to a session change in another tab.', 6000);
    authStore.logout();
    resetTabsStateFromModule();
    router.replace('/login');
  }
};

// Phase 2D: Detect active app from route path
const detectActiveAppFromRoute = (path) => {
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  if (path.startsWith('/sales/')) return 'SALES';
  if (path.startsWith('/helpdesk/')) return 'HELPDESK';
  if (path.startsWith('/projects/')) return 'PROJECTS';
  if (path.startsWith('/dashboard/')) {
    const appKey = String(path.split('/')[2] || '').toUpperCase();
    if (appKey) return appKey;
  }
  if (path.startsWith('/dashboard') || path.startsWith('/people') || path.startsWith('/organizations') || path.startsWith('/deals') || path.startsWith('/tasks') || path.startsWith('/events') || path.startsWith('/items') || path.startsWith('/forms')) return 'SALES';
  return 'SALES'; // Default to Sales
};

// Phase 2D: Watch route changes and update activeApp
watch(() => route.path, async (newPath) => {
  if (authStore.isAuthenticated && appShellStore.isLoaded) {
    const detectedApp = detectActiveAppFromRoute(newPath);
    if (appShellStore.activeApp !== detectedApp) {
      appLog(`[App] Route changed to ${newPath}, setting activeApp to ${detectedApp}`);
      appShellStore.setActiveApp(detectedApp);
    }
    // Persist last active app lens for sidebar fallback when route is ambiguous.
    lastActiveAppId.value = detectedApp;
  }
}, { immediate: true });

// Refresh permissions on app mount (page refresh)
onMounted(async () => {
  if (authStore.isAuthenticated) {
    activeImportsStore.init();
    const neededMetadata = !appShellStore.isLoaded;
    appLog('Auto-refreshing permissions on page load...');
    // Always force a profile re-fetch on mount. The 5-min freshness throttle
    // hides legitimate entitlement changes (app enable/disable, role edits)
    // when the user lands on the page right after the change.
    // Registry/UI caches are invalidated only from explicit settings events
    // (see Nav.vue onCoreModulesUpdated) to avoid a startup request storm.
    await Promise.all([
      authStore.refreshUser({ force: true }),
      neededMetadata ? appShellStore.loadUIMetadata() : Promise.resolve()
    ]);
    identifyProductUser({
      _id: authStore.user?._id,
      email: authStore.user?.email,
      organizationId: authStore.organization?._id
        ? String(authStore.organization._id)
        : undefined,
    });

    if (neededMetadata) {
      appLog('Initializing dynamic routes...');
      if (typeof initDynamicRoutes === 'function') {
        await initDynamicRoutes();
      }
    }
    await recoverUnmatchedDynamicRoute();
    
    // Phase 2D: Set initial activeApp based on current route
    const detectedApp = detectActiveAppFromRoute(route.path);
    if (detectedApp && appShellStore.activeApp !== detectedApp) {
      appLog(`[App] Initial route: ${route.path}, setting activeApp to ${detectedApp}`);
      appShellStore.setActiveApp(detectedApp);
    }

    // Only initialize tabs system for CRM routes (not audit or portal)
    // Audit and Portal have their own layouts. Settings now uses internal tabs.
    const isAuditRoute = route.path.startsWith('/audit/');
    const isPortalRoute = route.path.startsWith('/portal/');
    if (!isAuditRoute && !isPortalRoute) {
      // Tabs are scoped by instanceId + userId to prevent leakage across instances/users.
      const instanceId = authStore.organization?._id || authStore.organization?.instanceId;
      const userId = authStore.user?._id;

      if (instanceId && userId) {
        const { configureTabsStorage, useTabs } = await import('@/composables/useTabs');
        const { initTabs, setupRouteWatcher } = useTabs();
        configureTabsStorage({ instanceId, userId });
        initTabs();

        await nextTick();

        appLog('📊 [App] After initTabs, checking tabs state...');
        const { tabs: tabsRef } = useTabs();
        appLog('📊 [App] Tabs count:', tabsRef.value.length);
        appLog('📊 [App] Tabs:', tabsRef.value.map(t => ({ id: t.id, title: t.title, path: t.path })));

        cleanupRouteWatcher = setupRouteWatcher(route);
      } else {
        console.error('[Tabs] Skipping tab initialization: missing instanceId or userId', {
          instanceId,
          userId
        });
      }
    } else {
      appLog('📋 Audit/Portal route detected, skipping tabs initialization');
    }

    // Note: We don't need a router.beforeEach guard here because:
    // 1. Tab creation is handled by click handlers (Nav.vue, DataTables, etc.)
    // 2. Page refresh will restore tabs from localStorage
    // 3. Adding a guard here creates circular loops with openTab() calling router.replace()
  }

  queueContentOffsetUpdate();
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('sales-open-notifications', handleSalesOpenNotifications);
});

watch(salesNotificationSheetOpen, (val) => {
  appLog('[App] salesNotificationSheetOpen changed:', val);
});

onBeforeUnmount(() => {
  // Cleanup route watcher (removes popstate listener)
  if (typeof cleanupRouteWatcher === 'function') {
    cleanupRouteWatcher();
  }
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('storage', handleStorageEvent);
  window.removeEventListener('sales-open-notifications', handleSalesOpenNotifications);
});

// Watch for authentication changes to initialize tabs
watch(
  () => authStore.isAuthenticated,
  async (isAuthed, wasAuthed) => {
    if (wasAuthed && !isAuthed) {
      stopNotificationRealtime();
      activeImportsStore.reset();
      resetTabsStateFromModule();
      // Cleanup route watcher when logging out
      if (typeof cleanupRouteWatcher === 'function') {
        cleanupRouteWatcher();
        cleanupRouteWatcher = null;
      }
    } else if (!wasAuthed && isAuthed) {
      // User just logged in - initialize tabs (same as onMounted logic)
      appLog('🔄 [App] User authenticated, initializing tabs...');
      const instanceId = authStore.organization?._id || authStore.organization?.instanceId;
      const userId = authStore.user?._id;
      
      if (instanceId && userId) {
        // Cleanup any existing route watcher before setting up a new one
        if (typeof cleanupRouteWatcher === 'function') {
          cleanupRouteWatcher();
          cleanupRouteWatcher = null;
        }
        
        // Use the same initialization logic as onMounted
        // Use 'route' from useRoute() (same as onMounted) instead of router.currentRoute.value
        const isAuditRoute = route.path.startsWith('/audit/');
        const isPortalRoute = route.path.startsWith('/portal/');
        
        if (!isAuditRoute && !isPortalRoute) {
          const { configureTabsStorage, useTabs } = await import('@/composables/useTabs');
          const { initTabs, setupRouteWatcher } = useTabs();
          configureTabsStorage({ instanceId, userId });
          initTabs();

          await router.isReady();
          await nextTick();

          appLog('📊 [App] After login - After initTabs, checking tabs state...');
          const { tabs: tabsRef } = useTabs();
          appLog('📊 [App] After login - Tabs count:', tabsRef.value.length);
          appLog('📊 [App] After login - Tabs:', tabsRef.value.map(t => ({ id: t.id, title: t.title, path: t.path })));
          appLog('📊 [App] After login - Current route:', route.path, route.fullPath);

          // Setup route watcher for browser navigation (same as onMounted)
          // Use 'route' from useRoute() just like onMounted does
          // Store cleanup function to remove popstate listener on unmount
          appLog('🔧 [App] After login - Setting up route watcher on route:', route.path);
          cleanupRouteWatcher = setupRouteWatcher(route);
          
          if (typeof cleanupRouteWatcher === 'function') {
            appLog('✅ [App] After login - Route watcher successfully set up');
          } else {
            console.warn('⚠️ [App] After login - setupRouteWatcher did not return cleanup function');
          }
        } else {
          appLog('📋 [App] After login - Audit/Portal route detected, skipping tabs initialization');
        }
      }
    }
  },
  { immediate: false }
);

// Enable automatic permission sync every 2 minutes for real-time updates
usePermissionSync(2);

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    if (isAuthed) {
      startNotificationRealtime();
    } else {
      stopNotificationRealtime();
    }
  },
  { immediate: true }
);

watch(
  () => authStore.user?.allowedApps,
  () => {
    refreshNotificationRealtimeConnections();
  },
  { deep: true }
);

watch(
  () => authStore.user?.token,
  (token, prev) => {
    if (token && token !== prev && authStore.isAuthenticated) {
      refreshNotificationRealtimeConnections();
    }
  }
);

watch(
  () => route.path,
  () => {
    onNotificationRouteChange();
  }
);
</script>

<template>
  <!-- Public routes (no shell, no auth required) -->
  <div v-if="isPublicRoute">
    <RouterView />
  </div>

  <!-- Authenticated layout -->
  <div v-else-if="isAuthenticated">
    <EmailVerificationBanner v-if="hideShell" />
    <!-- Shell-less pages (e.g., Settings) -->
    <div v-if="hideShell" class="min-h-screen bg-gray-100/70 dark:bg-gray-900">
      <div class="flex-1 overflow-y-hidden overflow-x-hidden">
        <RouterView />
      </div>
    </div>

    <!-- Phase 1A: Platform Shell with dynamic UI composition -->
    <PlatformShell v-else />
  </div>

  <!-- Landing Page (no sidebar) -->
  <div v-else>
    <RouterView />
  </div>

  <!-- Global Notification Container -->
  <NotificationContainer />

  <ImportProgressBanner v-if="isAuthenticated" />
  <BulkDeleteProgressBanner v-if="isAuthenticated" />

  <!-- Sales Notification Sheet (mobile) -->
  <NotificationSheet
    :open="salesNotificationSheetOpen"
    app-key="SALES"
    :mark-all-disabled="false"
    @close="salesNotificationSheetOpen = false"
  />

  <!-- Global Surfaces Provider -->
  <!-- ARCHITECTURE NOTE: Mounted once at root level, app-agnostic -->
  <!-- Provides GlobalSearch and CommandPalette to all layouts (Sales, Audit, Portal, etc.) -->
  <GlobalSurfacesProvider />

  <!-- Dev-only: simulate helpdesk bell / toast / sound on /helpdesk/ routes -->
  <HelpdeskNotificationDevPanel v-if="showHelpdeskNotificationDevPanel" />
</template>

<style>
/* Global styles - prevent horizontal scroll */
html,
body {
  overflow-x: hidden;
  max-width: 100vw;
}

body {
  margin: 0;
  padding: 0;
}
</style>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
