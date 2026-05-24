<template>
  <div v-if="loading" class="flex items-center justify-center min-h-screen">
    <div class="text-gray-500 dark:text-gray-400">{{ t('organizations.groupDetailLoadingGroup') }}</div>
  </div>
  
  <div v-else-if="group" class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div 
            class="w-16 h-16 rounded-xl text-white flex items-center justify-center font-bold text-xl flex-shrink-0"
            :style="{ backgroundColor: group.color || '#3B82F6' }"
          >
            {{ getInitials(group.name) }}
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ group.name }}</h1>
            <p v-if="group.description" class="text-lg text-gray-600 dark:text-gray-400 mt-1">{{ group.description }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="editGroup"
            class="px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors"
          >{{ t('settings.groupsEditGroupBtn') }}</button>
          <button
            @click="deleteGroup"
            class="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
          >{{ t('settings.modFieldsDelete') }}</button>
        </div>
      </div>
    </div>

    <!-- Group Info Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsValidationType') }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ group.type || 'Team' }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.groupsLabelMembers') }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ group.memberCount || (group.members?.length || 0) }}
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.settingsBhFieldStatus') }}</div>
        <div class="text-lg font-semibold" :class="group.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          {{ group.isActive ? 'Active' : 'Inactive' }}
        </div>
      </div>
    </div>

    <!-- Group Lead -->
    <div v-if="group.lead" class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.groupFormGroupLead') }}</h2>
      <div class="flex items-center gap-3">
        <div 
          v-if="group.lead.avatar"
          class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
        >
          <img :src="group.lead.avatar" :alt="getUserDisplayName(group.lead)" class="w-full h-full object-cover" />
        </div>
        <div 
          v-else
          class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0"
        >
          {{ getUserInitials(group.lead) }}
        </div>
        <div>
          <div class="font-semibold text-gray-900 dark:text-white">{{ getUserDisplayName(group.lead) }}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">{{ group.lead.email }}</div>
        </div>
      </div>
    </div>

    <!-- Members Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Members ({{ group.memberCount || (group.members?.length || 0) }})
        </h2>
        <button
          @click="showAddMemberModal = true"
          class="px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors text-sm"
        >{{ t('organizations.groupDetailAddMember2') }}</button>
      </div>
      
      <div v-if="group.members && group.members.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="member in group.members"
          :key="member._id"
          class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div 
            v-if="member.avatar"
            class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
          >
            <img :src="member.avatar" :alt="getUserDisplayName(member)" class="w-full h-full object-cover" />
          </div>
          <div 
            v-else
            class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
          >
            {{ getUserInitials(member) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ getUserDisplayName(member) }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ member.email }}</div>
          </div>
          <button
            @click="removeMember(member._id)"
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
            :title="t('organizations.groupDetailRemoveMember')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">{{ t('organizations.groupDetailNoMembersYetAddMembersTo') }}</div>
    </div>

    <!-- Edit Modal -->
    <GroupFormModal
      v-if="showEditModal"
      :group="group"
      @close="showEditModal = false"
      @saved="handleGroupSaved"
    />

    <!-- Add Member Modal -->
    <Teleport to="body">
      <div
        v-if="showAddMemberModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
        @click="showAddMemberModal = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl" @click.stop>
          <div class="p-6">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ t('organizations.groupDetailAddMember') }}</h3>
            <select
              v-model="selectedUserId"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
            >
              <option value="">{{ t('organizations.groupDetailSelectAUser') }}</option>
              <option
                v-for="user in availableUsers.filter(u => !group.members?.find(m => (m._id || m) === u._id))"
                :key="user._id"
                :value="user._id"
              >
                {{ getUserDisplayName(user) }}
              </option>
            </select>
            <div class="flex justify-end gap-3">
              <button
                @click="showAddMemberModal = false"
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                @click="addMember"
                :disabled="!selectedUserId"
                class="px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-50"
              >{{ t('actions.add') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import GroupFormModal from '@/components/groups/GroupFormModal.vue';

const route = useRoute();
const router = useRouter();

const group = ref(null);
const loading = ref(true);
const availableUsers = ref([]);
const showEditModal = ref(false);
const showAddMemberModal = ref(false);
const selectedUserId = ref('');

// Fetch group details
const fetchGroup = async () => {
  loading.value = true;
  try {
    const data = await apiClient.get(`/api/groups/${route.params.id}`);
    if (data.success) {
      group.value = data.data;
    }
  } catch (error) {
    console.error('Error fetching group:', error);
    alert(t('common.groupDetailToastFailedToLoadGroup'));
  } finally {
    loading.value = false;
  }
};

// Fetch available users
const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/api/users/list');
    // Handle different response formats
    if (response && (response.success || Array.isArray(response))) {
      availableUsers.value = Array.isArray(response) 
        ? response 
        : (Array.isArray(response.data) ? response.data : (response.data || []));
    } else {
      availableUsers.value = [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

const editGroup = () => {
  showEditModal.value = true;
};

const handleGroupSaved = (updatedGroup) => {
  showEditModal.value = false;
  fetchGroup();
};

const addMember = async () => {
  if (!selectedUserId.value) return;
  
  try {
    const data = await apiClient.post(`/api/groups/${route.params.id}/members`, {
      userId: selectedUserId.value
    });
    if (data.success) {
      group.value = data.data;
      showAddMemberModal.value = false;
      selectedUserId.value = '';
    }
  } catch (error) {
    console.error('Error adding member:', error);
    alert(t('common.groupDetailToastFailedToAddMember'));
  }
};

const removeMember = async (userId) => {
  if (!confirm('Remove this member from the group?')) return;
  
  try {
    const data = await apiClient.delete(`/api/groups/${route.params.id}/members`, {
      data: { userId }
    });
    if (data.success) {
      group.value = data.data;
    }
  } catch (error) {
    console.error('Error removing member:', error);
    alert(t('common.groupDetailToastFailedToRemoveMember'));
  }
};

const deleteGroup = async () => {
  if (!confirm(`Are you sure you want to delete "${group.value.name}"? This action cannot be undone.`)) return;
  
  try {
    await apiClient.delete(`/api/groups/${route.params.id}`);
    router.push('/groups');
  } catch (error) {
    console.error('Error deleting group:', error);
    alert(t('common.groupDetailToastFailedToDeleteGroup'));
  }
};

const getInitials = (name) => {
  if (!name) return '?';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

onMounted(() => {
  fetchGroup();
  fetchUsers();
});
</script>

