<script setup>
import { useAuthStore } from '@/stores/auth';
import LandingPage from '@/views/LandingPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Nav from '@/components/Nav.vue';
import { computed } from 'vue';

const authStore = useAuthStore();
// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);
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
