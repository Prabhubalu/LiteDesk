<template>
  <SettingsScrollPanel>
    <template #header>
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('settings.tabNotifications') }}
        </h1>
        <div class="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ pageDescription }}
          </p>
          <div class="flex items-center gap-3 text-xs sm:text-sm shrink-0">
            <span
              v-if="saving"
              class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
            >
              <span
                class="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              ></span>
              {{ t('settings.integrationsSavingGmailOAuth') }}
            </span>
            <span
              v-else-if="lastSavedAt && !error"
              class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
            >
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z"
                  fill="currentColor"
                />
              </svg>
              {{ t('states.saved') }}
            </span>
            <span
              v-if="error"
              class="inline-flex items-center gap-1 text-red-600 dark:text-red-400"
            >
              {{ t('common.notificationPreferencesCouldntSaveChangesPleaseTryAgain') }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template #tabs>
      <nav
        class="flex gap-1 overflow-x-auto -mx-1 px-1"
        aria-label="Notification settings sections"
      >
        <button
          v-for="item in visibleNavItems"
          :key="item.id"
          type="button"
          :class="[
            'shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
            currentPage === item.id
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
          ]"
          :aria-current="currentPage === item.id ? 'page' : undefined"
          @click="navigateTo(item.id)"
        >
          {{ t(item.labelKey) }}
          <span
            v-if="item.adminOnly"
            class="ml-1.5 text-[10px] uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400"
          >
            {{ t('settings.notificationsNavAdminBadge') }}
          </span>
        </button>
      </nav>
    </template>

    <NotificationPreferences v-if="currentPage === 'preferences'" />
    <NotificationChannels v-else-if="currentPage === 'channels'" />
    <NotificationDigests v-else-if="currentPage === 'digests'" />
    <NotificationRules v-else-if="currentPage === 'rules'" />
    <NotificationOverview v-else-if="currentPage === 'learn'" />
    <NotificationHealth v-else-if="currentPage === 'health'" />
    <NotificationPreferences v-else />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotificationPreferencesStore } from '@/stores/notificationPreferences';
import { useNotificationPreferencesPage } from '@/composables/useNotificationPreferencesPage';
import NotificationOverview from '@/views/settings/NotificationOverview.vue';
import NotificationPreferences from '@/views/settings/NotificationPreferences.vue';
import NotificationChannels from '@/views/settings/NotificationChannels.vue';
import NotificationDigests from '@/views/settings/NotificationDigests.vue';
import NotificationRules from '@/views/settings/NotificationRules.vue';
import NotificationHealth from '@/views/settings/NotificationHealth.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const prefsStore = useNotificationPreferencesStore();
const { saving, error, lastSavedAt } = storeToRefs(prefsStore);
const { ensureLoaded, scrollToHighlightedEvent } = useNotificationPreferencesPage();

const PREF_DATA_PAGES = new Set(['preferences', 'channels', 'digests']);

const NAV_ITEMS = [
  { id: 'preferences', labelKey: 'settings.notificationsNavPreferences', descKey: 'settings.notificationsPagePreferencesDesc' },
  { id: 'channels', labelKey: 'settings.notificationsNavChannels', descKey: 'settings.notificationsPageChannelsDesc' },
  { id: 'digests', labelKey: 'settings.notificationsNavDigests', descKey: 'settings.notificationsPageDigestsDesc' },
  { id: 'rules', labelKey: 'settings.notificationsNavRules', descKey: 'settings.notificationsPageRulesDesc' },
  { id: 'learn', labelKey: 'settings.notificationsNavLearn', descKey: 'settings.notificationsPageLearnDesc' },
  { id: 'health', labelKey: 'settings.notificationsNavHealth', descKey: 'settings.notificationsPageHealthDesc', adminOnly: true }
];

const visibleNavItems = computed(() =>
  NAV_ITEMS.filter((item) => !item.adminOnly || authStore.isAdminLike)
);

const currentPage = computed(() => {
  const page = route.query.notificationPage;
  if (page === 'overview') return 'learn';
  if (page === 'health') return 'health';
  if (page === 'rules') return 'rules';
  if (page === 'channels') return 'channels';
  if (page === 'digests') return 'digests';
  if (page === 'learn') return 'learn';
  if (page === 'preferences') return 'preferences';

  const path = route.path;
  if (path.includes('/notifications/health')) return 'health';
  if (path.includes('/notifications/rules')) return 'rules';
  if (path.includes('/notifications/overview')) return 'learn';
  if (path.includes('/notifications/channels')) return 'channels';
  if (path.includes('/notifications/digests')) return 'digests';
  if (path.includes('/notifications')) return 'preferences';

  return 'preferences';
});

const pageDescription = computed(() => {
  const item = NAV_ITEMS.find((nav) => nav.id === currentPage.value);
  return item ? t(item.descKey) : t('settings.tabNotificationsDesc');
});

function navigateTo(pageId) {
  router.replace({
    path: '/settings',
    query: { ...route.query, tab: 'notifications', notificationPage: pageId }
  });
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'notifications' && !route.query.notificationPage) {
      router.replace({
        path: '/settings',
        query: { ...route.query, tab: 'notifications', notificationPage: 'preferences' }
      });
    }
  },
  { immediate: true }
);

async function loadPreferencesIfNeeded() {
  if (!PREF_DATA_PAGES.has(currentPage.value)) return;
  await ensureLoaded();
  const highlight = route.query.highlight;
  if (typeof highlight === 'string' && highlight) {
    scrollToHighlightedEvent(highlight);
  }
}

onMounted(() => {
  loadPreferencesIfNeeded();
});

watch(currentPage, () => {
  loadPreferencesIfNeeded();
});
</script>
