<template>
  <div class="w-full h-full">
    <NotificationOverview v-if="currentPage === 'overview'" />
    <NotificationPreferences v-else-if="currentPage === 'preferences'" />
    <NotificationRules v-else-if="currentPage === 'rules'" />
    <NotificationHealth v-else-if="currentPage === 'health'" />
    <NotificationOverview v-else />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NotificationOverview from '@/views/settings/NotificationOverview.vue';
import NotificationPreferences from '@/views/settings/NotificationPreferences.vue';
import NotificationRules from '@/views/settings/NotificationRules.vue';
import NotificationHealth from '@/views/settings/NotificationHealth.vue';

const route = useRoute();
const router = useRouter();

// Determine which notification page to show based on query parameter
const currentPage = computed(() => {
  // Check query parameter first (when in Settings)
  const page = route.query.notificationPage;
  if (page === 'health') return 'health';
  if (page === 'rules') return 'rules';
  if (page === 'overview') return 'overview';
  if (page === 'preferences') return 'preferences';
  
  // Fallback to route path for direct navigation (bookmarks, etc.)
  const path = route.path;
  if (path.includes('/notifications/health')) return 'health';
  if (path.includes('/notifications/rules')) return 'rules';
  if (path.includes('/notifications/overview')) return 'overview';
  if (path.includes('/notifications')) return 'preferences';
  
  return 'overview'; // default
});

// When notifications tab is activated via query param, ensure we have a page
watch(() => route.query.tab, (tab) => {
  if (tab === 'notifications' && !route.query.notificationPage) {
    router.replace({ path: '/settings', query: { ...route.query, notificationPage: 'overview' } });
  }
}, { immediate: true });
</script>
