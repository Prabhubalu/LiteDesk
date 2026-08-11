<template>
  <div class="border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
    <nav class="flex flex-wrap gap-1" :aria-label="t('telephony.workspaceNavLabel')">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium leading-none transition"
        :class="isActive(tab.to)
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();

const tabs = computed(() => [
  { to: '/telephony/calls', label: t('telephony.navCalls') },
  { to: '/telephony/phone-numbers', label: t('telephony.navPhoneNumbers') },
  { to: '/telephony/queues', label: t('telephony.navQueues') },
  { to: '/telephony/agents', label: t('telephony.navAgents') },
  { to: '/telephony/ivr', label: t('telephony.navIvr') },
  { to: '/telephony/campaigns', label: t('telephony.navCampaigns') },
  { to: '/telephony/analytics', label: t('telephony.navAnalytics') },
  { to: '/telephony/recordings', label: t('telephony.navRecordings') },
  { to: '/telephony/settings', label: t('telephony.navSettings') },
]);

function isActive(to) {
  if (to === '/telephony/calls') {
    return route.path === '/telephony/calls' || route.path.startsWith('/telephony/calls/');
  }
  if (to === '/telephony/ivr') {
    return route.path === '/telephony/ivr' || route.path.startsWith('/telephony/ivr/');
  }
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>
