<script setup>
import { useAuthStore } from '@/stores/auth';
import { usePermissionSync } from '@/composables/usePermissionSync';
import { useTabs } from '@/composables/useTabs';
import { useColorMode } from '@/composables/useColorMode';
import LandingPage from '@/views/LandingPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { initTabs, setupRouteWatcher } = useTabs();

// Initialize color mode
const { colorMode } = useColorMode();

// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);
const hideShell = computed(() => !!route.meta.hideShell);
const isPublicRoute = computed(() => route.meta.requiresAuth === false);

const DEFAULT_CONTENT_OFFSET = 0;
const EXTRA_OFFSET_LIGHT = '2rem';
const EXTRA_OFFSET_LARGE = '2rem';
const contentWrapperRef = ref(null);
const tableStickyOffset = ref(`calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`);

// Sidebar collapsed state - Load from localStorage, default to false
const sidebarCollapsed = ref(
  localStorage.getItem('litedesk-sidebar-collapsed') === 'true'
);

// Save sidebar state to localStorage whenever it changes
watch(sidebarCollapsed, (newValue) => {
  localStorage.setItem('litedesk-sidebar-collapsed', newValue.toString());
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

// Refresh permissions on app mount (page refresh)
onMounted(async () => {
  if (authStore.isAuthenticated) {
    console.log('Auto-refreshing permissions on page load...');
    await authStore.refreshUser();
    
    // Initialize tabs system
    initTabs();
    
    // Setup route watcher for browser navigation (pass route from setup context)
    setupRouteWatcher(route);
    
    // Note: We don't need a router.beforeEach guard here because:
    // 1. Tab creation is handled by click handlers (Nav.vue, DataTables, etc.)
    // 2. Page refresh will restore tabs from localStorage
    // 3. Adding a guard here creates circular loops with openTab() calling router.replace()
  }

  queueContentOffsetUpdate();
  window.addEventListener('resize', handleResize, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

// Enable automatic permission sync every 2 minutes for real-time updates
usePermissionSync(2);
</script>

<template>
  <!-- Public routes (no shell, no auth required) -->
  <div v-if="isPublicRoute">
    <RouterView />
  </div>

  <!-- Authenticated layout -->
  <div v-else-if="isAuthenticated">
    <!-- Shell-less pages (e.g., Settings) -->
    <div v-if="hideShell" class="min-h-screen bg-gray-100/70 dark:bg-gray-900">
      <div class="flex-1 overflow-y-hidden overflow-x-hidden">
        <RouterView />
      </div>
    </div>

    <!-- Default shell with Sidebar/Tabbar -->
    <div v-else class="min-h-screen bg-gray-100/70 dark:bg-gray-900 flex overflow-x-hidden">
    <!-- Sidebar Navigation - v-model binds collapsed state -->
    <Nav v-model="sidebarCollapsed" />
    
    <!-- Main Content Area - Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'flex-1 flex flex-col transition-all duration-300 min-h-screen overflow-x-hidden',
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      ]"
    >
      <!-- Tab Bar - Hidden on mobile, visible on tablet and up -->
      <TabBar class="hidden md:block" />
      
      <!-- Content wrapper with padding -->
      <div
        ref="contentWrapperRef"
        class="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden mt-16 md:mt-30 lg:mt-14"
        :style="{ '--table-sticky-offset': tableStickyOffset }"
      >
        <!-- Keep-alive caches component instances to prevent remounting on tab switch -->
        <RouterView v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" :key="$route.fullPath" />
          </keep-alive>
        </RouterView>
      </div>
    </main>
    </div>
  </div>

  <!-- Landing Page (no sidebar) -->
  <div v-else>
    <RouterView />
  </div>
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
