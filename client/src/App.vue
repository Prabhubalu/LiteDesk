<script setup>
import { useAuthStore } from '@/stores/auth';
import { usePermissionSync } from '@/composables/usePermissionSync';
import LandingPage from '@/views/LandingPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Nav from '@/components/Nav.vue';
import { computed, onMounted } from 'vue';

const authStore = useAuthStore();
// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);

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
<Nav v-if="isAuthenticated" />

  <main>
    <RouterView />
  </main>
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
