<template>
  <SettingsScrollPanel embed>
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabUsersAccess') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.usersAccessSubtitle') }}
        </p>
      </div>
    </template>

    <template #tabs>
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          :class="[
            activeTab === tab.id
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
          ]"
        >
          {{ t(tab.nameKey) }}
        </button>
      </nav>
    </template>

    <div v-if="activeTab === 'users'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <UserManagement embedded />
    </div>

    <div v-if="activeTab === 'roles'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolesPermissions embedded />
    </div>

    <div v-if="activeTab === 'profiles'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProfilesSettings embedded />
    </div>

    <div v-if="activeTab === 'sharing'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SharingRulesSettings embedded />
    </div>

    <div v-if="activeTab === 'groups'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GroupsSettings embedded />
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { isRbacV2Enabled, isSharingV1Enabled } from '@/utils/rbacFeatureFlags';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import UserManagement from './UserManagement.vue';
import RolesPermissions from './RolesPermissions.vue';
import ProfilesSettings from './ProfilesSettings.vue';
import SharingRulesSettings from './SharingRulesSettings.vue';
import GroupsSettings from './GroupsSettings.vue';

const { t } = useI18n();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const USERS_ACCESS_TAB_KEY = 'arivu-users-access-tab';
const activeTab = ref(localStorage.getItem(USERS_ACCESS_TAB_KEY) || 'users');

const rbacV2 = computed(() => isRbacV2Enabled(authStore.organization));
const sharingV1 = computed(() => isSharingV1Enabled(authStore.organization));

const tabs = computed(() => {
  const items = [
    { id: 'users', nameKey: 'settings.usersTabManagement' },
    { id: 'roles', nameKey: 'settings.usersTabRoles' }
  ];
  if (rbacV2.value) {
    items.push({ id: 'profiles', nameKey: 'settings.usersTabProfiles' });
  }
  if (sharingV1.value) {
    items.push({ id: 'sharing', nameKey: 'settings.usersTabSharing' });
  }
  items.push({ id: 'groups', nameKey: 'settings.usersTabGroups' });
  return items;
});

const validTabIds = computed(() => new Set(tabs.value.map((tab) => tab.id)));

function resolveTabFromQuery() {
  const view = route.query.usersAccessView;
  if (typeof view === 'string' && validTabIds.value.has(view)) {
    return view;
  }
  return null;
}

function setActiveTab(tabId) {
  activeTab.value = tabId;
  const query = { ...route.query, tab: 'users-access' };
  if (tabId === 'users') {
    delete query.usersAccessView;
  } else {
    query.usersAccessView = tabId;
  }
  router.replace({ path: '/settings', query });
}

watch(tabs, (items) => {
  if (!items.some((tab) => tab.id === activeTab.value)) {
    activeTab.value = 'users';
  }
}, { immediate: true });

watch(
  () => [route.query.usersAccessView, validTabIds.value] as const,
  () => {
    const fromQuery = resolveTabFromQuery();
    if (fromQuery) {
      if (fromQuery !== activeTab.value) activeTab.value = fromQuery;
      return;
    }
  },
  { immediate: true }
);

watch(activeTab, (v) => {
  localStorage.setItem(USERS_ACCESS_TAB_KEY, v);
});
</script>
