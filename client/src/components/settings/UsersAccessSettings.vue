<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header with Tabs -->
    <div class="mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabUsersAccess') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.usersAccessSubtitle') }}
        </p>
      </div>
      
      <!-- Sub-tabs -->
      <div class="mt-4 border-b border-gray-200 dark:border-gray-700">
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
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <!-- User Management Tab -->
      <div v-if="activeTab === 'users'">
        <UserManagement />
      </div>

      <!-- Roles & Permissions Tab -->
      <div v-if="activeTab === 'roles'">
        <RolesPermissions />
      </div>

      <!-- Groups & Teams Tab -->
      <div v-if="activeTab === 'groups'">
        <GroupsSettings />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import UserManagement from './UserManagement.vue';
import RolesPermissions from './RolesPermissions.vue';
import GroupsSettings from './GroupsSettings.vue';

const USERS_ACCESS_TAB_KEY = 'arivu-users-access-tab';
const activeTab = ref(localStorage.getItem(USERS_ACCESS_TAB_KEY) || 'users');

const tabs = [
  { id: 'users', nameKey: 'settings.usersTabManagement' },
  { id: 'roles', nameKey: 'settings.usersTabRoles' },
  { id: 'groups', nameKey: 'settings.usersTabGroups' }
];

// Persist sub-tab selection
watch(activeTab, (v) => {
  localStorage.setItem(USERS_ACCESS_TAB_KEY, v);
});
</script>

