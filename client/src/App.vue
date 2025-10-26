<script setup>
import { useAuthStore } from '@/stores/auth';
import { usePermissionSync } from '@/composables/usePermissionSync';
import { useTabs } from '@/composables/useTabs';
import LandingPage from '@/views/LandingPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const { initTabs } = useTabs();

// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Sidebar collapsed state - Load from localStorage, default to false
const sidebarCollapsed = ref(
  localStorage.getItem('litedesk-sidebar-collapsed') === 'true'
);

// Save sidebar state to localStorage whenever it changes
watch(sidebarCollapsed, (newValue) => {
  localStorage.setItem('litedesk-sidebar-collapsed', newValue.toString());
});

// Refresh permissions on app mount (page refresh)
onMounted(async () => {
  if (authStore.isAuthenticated) {
    console.log('Auto-refreshing permissions on page load...');
    await authStore.refreshUser();
    
    // Initialize tabs system
    initTabs();
    
    // Note: We don't need a router.beforeEach guard here because:
    // 1. Tab creation is handled by click handlers (Nav.vue, DataTables, etc.)
    // 2. Page refresh will restore tabs from localStorage
    // 3. Adding a guard here creates circular loops with openTab() calling router.replace()
  }
});

// Enable automatic permission sync every 2 minutes for real-time updates
usePermissionSync(2);
</script>

<template>
  <!-- Layout with Sidebar -->
  <div v-if="isAuthenticated" class="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
    <!-- Sidebar Navigation - v-model binds collapsed state -->
    <Nav v-model="sidebarCollapsed" />
    
    <!-- Main Content Area - Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'flex-1 flex flex-col transition-all duration-300 min-h-screen',
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      ]"
    >
      <!-- Mobile top spacing -->
      <div class="lg:hidden h-16"></div>
      
      <!-- Tab Bar -->
      <TabBar />
      
      <!-- Content wrapper with padding -->
      <div class="flex-1 p-4 lg:p-6 overflow-auto">
        <!-- Keep-alive caches component instances to prevent remounting on tab switch -->
        <RouterView v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" :key="$route.fullPath" />
          </keep-alive>
        </RouterView>
      </div>
    </main>
  </div>

  <!-- Landing Page (no sidebar) -->
  <div v-else>
    <RouterView />
  </div>
</template>

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
