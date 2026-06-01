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
          @click="activeTab = tab.id"
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

    <div v-if="activeTab === 'groups'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GroupsSettings embedded />
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import UserManagement from './UserManagement.vue';
import RolesPermissions from './RolesPermissions.vue';
import GroupsSettings from './GroupsSettings.vue';

const { t } = useI18n();

const USERS_ACCESS_TAB_KEY = 'arivu-users-access-tab';
const activeTab = ref(localStorage.getItem(USERS_ACCESS_TAB_KEY) || 'users');

const tabs = [
  { id: 'users', nameKey: 'settings.usersTabManagement' },
  { id: 'roles', nameKey: 'settings.usersTabRoles' },
  { id: 'groups', nameKey: 'settings.usersTabGroups' }
];

watch(activeTab, (v) => {
  localStorage.setItem(USERS_ACCESS_TAB_KEY, v);
});
</script>
