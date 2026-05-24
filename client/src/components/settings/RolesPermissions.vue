<template>
  <div class="p-6">
    <!-- Header with Tabs -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.usersTabRoles') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.rolesPageSubtitle') }}
      </p>
      
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
            {{ tab.name }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div>
      <!-- Roles List Tab -->
      <div v-if="activeTab === 'roles'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.rolesCount', { count: roles.length }) }}</p>
          <div class="flex gap-2">
            <button
              @click="initializeDefaultRoles"
              v-if="roles.length === 0"
              class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-all"
            >
              {{ t('settings.rolesInitDefaults') }}
            </button>
            <button
              @click="openCreateRoleModal"
              class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>{{ t('settings.rolesCreate') }}</span>
            </button>
          </div>
        </div>

        <!-- Roles Grid -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>

        <div v-else-if="roles.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.rolesEmptyTitle') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('settings.rolesEmptyBody') }}</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="role in roles"
            :key="role._id"
            :class="[
              'bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5 transition-all',
              selectedRole?._id === role._id && showRoleDrawer
                ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                : 'border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
            ]"
          >
            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div
                  :style="{ backgroundColor: role.color || '#6366f1' }"
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                >
                  <svg v-if="role.icon === 'crown'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <svg v-else-if="role.icon === 'shield'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else-if="role.icon === 'users'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <svg v-else-if="role.icon === 'eye'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {{ role.name }}
                    <span v-if="role.isSystemRole" class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs font-medium">
                      {{ t('settings.rolesSystemBadge') }}
                    </span>
                  </h3>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.rolesLevel', { level: role.level }) }}</p>
                </div>
              </div>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{{ role.description || t('settings.rolesNoDescription') }}</p>

            <!-- Actions -->
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                @click="openEditRoleModal(role)"
                class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-xs transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {{ t('actions.edit') }}
              </button>
              <button
                @click.stop="viewRoleUsers(role)"
                class="flex-1 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg font-medium text-xs transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{{ t('settings.rolesUsersCount', { count: role.userCount || 0 }) }}</span>
              </button>
              <button
                @click.stop="viewRolePermissions(role)"
                class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-xs transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ t('settings.rolesPermissionsBtn') }}</span>
              </button>
              <button
                v-if="!role.isSystemRole"
                @click.stop="deleteRole(role)"
                class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg font-medium text-xs transition-colors"
                :title="t('settings.rolesDeleteTitle')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Organization Hierarchy Tab -->
      <div v-if="activeTab === 'hierarchy'">
        <OrganizationHierarchy :roles="roles" @refresh="fetchRoles" />
      </div>
    </div>

    <!-- Create/Edit Role Drawer -->
    <RoleFormDrawer
      :open="showRoleDrawer"
      :role="selectedRole"
      :initial-tab="drawerInitialTab"
      @close="showRoleDrawer = false"
      @saved="handleRoleSaved"
    />

    <!-- Role Users Modal -->
    <RoleUsersModal
      :is-open="showUsersModal"
      :role="selectedRoleForUsers"
      @close="showUsersModal = false"
      @edit-user="handleEditUser"
      @change-role="handleChangeRole"
      @refresh="fetchRoles"
    />

    <!-- Edit User Modal -->
    <EditUserModal
      v-if="showEditUserModal"
      :is-open="showEditUserModal"
      :user="selectedUserToEdit"
      @close="showEditUserModal = false"
      @user-updated="handleUserUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import RoleFormDrawer from './RoleFormDrawer.vue';
import OrganizationHierarchy from './OrganizationHierarchy.vue';
import RoleUsersModal from './RoleUsersModal.vue';
import EditUserModal from './EditUserModal.vue';

const { t } = useI18n();

const ROLES_PERMS_TAB_KEY = 'arivu-settings-rolesperms-tab';
const activeTab = ref(localStorage.getItem(ROLES_PERMS_TAB_KEY) || 'roles');
const roles = ref([]);
const loading = ref(false);
const showRoleDrawer = ref(false);
const drawerInitialTab = ref('overview');
const selectedRole = ref(null);
const showUsersModal = ref(false);
const selectedRoleForUsers = ref(null);
const showEditUserModal = ref(false);
const selectedUserToEdit = ref(null);

const tabs = computed(() => [
  { id: 'roles', name: t('settings.rolesTabManagement') },
  { id: 'hierarchy', name: t('settings.rolesTabHierarchy') }
]);

// Fetch roles
const fetchRoles = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/roles');
    
    if (response.success) {
      roles.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
  } finally {
    loading.value = false;
  }
};

// Initialize default roles
const initializeDefaultRoles = async () => {
  if (!confirm(t('settings.rolesInitConfirm'))) return;
  
  try {
    const response = await apiClient.post('/roles/initialize');
    
    if (response.success) {
      alert(t('settings.rolesInitSuccess'));
      fetchRoles();
    }
  } catch (error) {
    console.error('Error initializing roles:', error);
    alert(t('settings.rolesInitFailed'));
  }
};

// Open create role modal
const openCreateRoleModal = () => {
  selectedRole.value = null;
  drawerInitialTab.value = 'overview';
  showRoleDrawer.value = true;
};

// Open edit role drawer
const openEditRoleModal = (role, tab = 'overview') => {
  selectedRole.value = role;
  drawerInitialTab.value = tab;
  showRoleDrawer.value = true;
};

// Handle role saved
const handleRoleSaved = () => {
  showRoleDrawer.value = false;
  selectedRole.value = null;
  fetchRoles();
  
  // Notify admin that changes will be reflected automatically
  console.log('Role updated successfully. Users will see changes on their next page refresh or within 2 minutes.');
};

// Delete role
const deleteRole = async (role) => {
  if (!confirm(t('settings.rolesDeleteConfirm', { name: role.name }))) return;
  
  try {
    const response = await apiClient.delete(`/roles/${role._id}`);
    
    if (response.success) {
      fetchRoles();
    } else {
      alert(response.message || t('settings.rolesDeleteFailed'));
    }
  } catch (error) {
    console.error('Error deleting role:', error);
    const errorMessage = error.response?.message || t('settings.rolesDeleteFailed');
    alert(errorMessage);
  }
};

// View users for a role
const viewRoleUsers = (role) => {
  console.log('Opening users modal for role:', role.name);
  selectedRoleForUsers.value = role;
  showUsersModal.value = true;
};

const viewRolePermissions = (role) => {
  openEditRoleModal(role, 'permissions');
};

// Handle edit user from role users modal
const handleEditUser = (user) => {
  console.log('Opening edit modal for user:', user);
  selectedUserToEdit.value = user;
  showEditUserModal.value = true;
};

// Handle change role from role users modal
const handleChangeRole = (user) => {
  console.log('Opening edit modal to change role for user:', user);
  selectedUserToEdit.value = user;
  showEditUserModal.value = true;
};

// Handle user updated
const handleUserUpdated = () => {
  showEditUserModal.value = false;
  selectedUserToEdit.value = null;
  fetchRoles(); // Refresh to update user counts
};

onMounted(() => {
  fetchRoles();
});

// Persist sub-tab selection and validate against available tabs
watch(activeTab, (v) => {
  localStorage.setItem(ROLES_PERMS_TAB_KEY, v);
});
</script>
