<template>
  <div class="border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
    <nav class="flex gap-1" :aria-label="t('liveChat.workspaceNavLabel')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="relative rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="tab.isActive
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
          : tab.hasAlert
            ? 'bg-amber-100 text-amber-950 hover:bg-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
        @click="tab.onClick"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.badgeCount > 0"
          class="ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white dark:bg-indigo-500"
        >
          {{ tab.badgeCount > 9 ? '9+' : tab.badgeCount }}
        </span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLiveChatTabNavigation } from '@/composables/useLiveChatTabNavigation';
import { useLiveChatWorkspaceAlerts } from '@/composables/useLiveChatWorkspaceAlerts';

const { t } = useI18n();
const {
  goToSessions,
  goToClosed,
  goToReports,
  isSessionsActive,
  isClosedActive,
  isReportsActive,
} = useLiveChatTabNavigation();
const { sessionsAlertCount } = useLiveChatWorkspaceAlerts();

const tabs = computed(() => [
  {
    id: 'sessions',
    label: t('liveChat.navSessions'),
    isActive: isSessionsActive.value,
    hasAlert: !isSessionsActive.value && sessionsAlertCount.value > 0,
    badgeCount: !isSessionsActive.value ? sessionsAlertCount.value : 0,
    onClick: goToSessions,
  },
  {
    id: 'closed',
    label: t('liveChat.navClosed'),
    isActive: isClosedActive.value,
    hasAlert: false,
    badgeCount: 0,
    onClick: goToClosed,
  },
  {
    id: 'reports',
    label: t('liveChat.navReports'),
    isActive: isReportsActive.value,
    hasAlert: false,
    badgeCount: 0,
    onClick: goToReports,
  },
]);
</script>
