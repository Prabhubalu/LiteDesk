<script setup>
import { useAuthStore } from '@/stores/auth';
import { usePermissionSync } from '@/composables/usePermissionSync';
import LandingPage from '@/views/LandingPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Nav from '@/components/Nav.vue';
import { computed, onMounted, ref, watch } from 'vue';

const authStore = useAuthStore();
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
  }
});

// Enable automatic permission sync every 2 minutes for real-time updates
usePermissionSync(2);
</script>

<template>
  <!-- Layout with Sidebar -->
  <div v-if="isAuthenticated" class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar Navigation - v-model binds collapsed state -->
    <Nav v-model="sidebarCollapsed" />
    
    <!-- Main Content Area - Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'transition-all duration-300 min-h-screen',
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      ]"
    >
      <!-- Mobile top spacing -->
      <div class="lg:hidden h-16"></div>
      
      <!-- Content wrapper with padding -->
      <div class="p-4 lg:p-6">
        <RouterView />
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
