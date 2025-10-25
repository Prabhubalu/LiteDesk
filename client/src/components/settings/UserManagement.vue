<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage users, roles, and permissions for your organization
        </p>
      </div>
      <button
        @click="openInviteModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>Invite User</span>
      </button>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Users</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.total || 0 }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Active</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{{ stats.active || 0 }}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Inactive</p>
            <p class="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-1">{{ stats.inactive || 0 }}</p>
          </div>
          <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Admins</p>
            <p class="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{{ stats.admins || 0 }}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Users DataTable -->
    <DataTable
      :columns="tableColumns"
      :data="users"
      :loading="loading"
      :server-side="true"
      :total-records="totalUsers"
      :current-page="currentPage"
      :per-page="perPage"
      @update:page="handlePageChange"
      @update:per-page="handlePerPageChange"
      @update:search="handleSearch"
      @update:sort="handleSort"
      @edit="openEditModal"
      @delete="handleDeleteUser"
      @bulk-action="handleBulkAction"
      :selectable="true"
      :column-settings="true"
      :resizable="true"
      :mass-actions="massActions"
      table-id="users-table"
      row-key="_id"
    >
      <!-- Custom User Cell -->
      <template #cell-user="{ row }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {{ row.firstName?.[0] || 'U' }}{{ row.lastName?.[0] || '' }}
          </div>
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ row.firstName }} {{ row.lastName }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ row.email }}</p>
          </div>
        </div>
      </template>

      <!-- Custom Role Cell -->
      <template #cell-role="{ row }">
        <span 
          v-if="row.roleId"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white"
          :style="{ backgroundColor: row.roleId.color || '#6049E7' }"
        >
          <span v-if="row.roleId.icon">{{ getIcon(row.roleId.icon) }}</span>
          {{ row.roleId.name }}
        </span>
        <span v-else :class="getRoleBadgeClass(row.role)">
          {{ row.role }}
        </span>
      </template>

      <!-- Custom Status Cell -->
      <template #cell-status="{ row }">
        <span :class="getStatusBadgeClass(row.status)">
          {{ row.status || 'active' }}
        </span>
      </template>

      <!-- Custom Last Login Cell -->
      <template #cell-lastLogin="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ formatDate(row.lastLogin) }}
        </span>
      </template>
    </DataTable>

    <!-- Invite User Modal -->
    <InviteUserModal
      :is-open="showInviteModal"
      @close="showInviteModal = false"
      @user-invited="handleUserInvited"
    />

    <!-- Edit User Modal -->
    <EditUserModal
      :is-open="showEditModal"
      :user="selectedUser"
      @close="showEditModal = false"
      @user-updated="handleUserUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import DataTable from '@/components/common/DataTable.vue';
import InviteUserModal from './InviteUserModal.vue';
import EditUserModal from './EditUserModal.vue';

const users = ref([]);
const loading = ref(false);
const totalUsers = ref(0);
const currentPage = ref(1);
const perPage = ref(20);
const searchQuery = ref('');
const sortField = ref('createdAt');
const sortOrder = ref('desc');
const stats = ref({});

const showInviteModal = ref(false);
const showEditModal = ref(false);
const selectedUser = ref(null);

// Table columns
const tableColumns = [
  { key: 'user', label: 'User', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastLogin', label: 'Last Login', sortable: true },
  { key: 'createdAt', label: 'Joined', sortable: true }
];

// Mass actions
const massActions = [
  {
    label: 'Activate',
    action: 'bulk-activate',
    variant: 'success'
  },
  {
    label: 'Deactivate',
    action: 'bulk-deactivate',
    variant: 'warning'
  },
  {
    label: 'Delete',
    icon: 'trash',
    action: 'bulk-delete',
    variant: 'danger'
  }
];

// Fetch users
const fetchUsers = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: perPage.value,
      sortBy: sortField.value,
      sortOrder: sortOrder.value
    });

    if (searchQuery.value) {
      params.append('search', searchQuery.value);
    }

    const response = await apiClient.get(`/users?${params.toString()}`);
    
    if (response.success) {
      users.value = response.data;
      totalUsers.value = response.total || response.data.length;
      
      // Calculate stats
      stats.value = {
        total: response.total || response.data.length,
        active: response.data.filter(u => u.status === 'active' || !u.status).length,
        inactive: response.data.filter(u => u.status === 'inactive').length,
        admins: response.data.filter(u => u.role === 'admin' || u.role === 'owner').length
      };
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    loading.value = false;
  }
};

// Event handlers
const handlePageChange = (page) => {
  currentPage.value = page;
  fetchUsers();
};

const handlePerPageChange = (limit) => {
  perPage.value = limit;
  currentPage.value = 1;
  fetchUsers();
};

const handleSearch = (query) => {
  searchQuery.value = query;
  currentPage.value = 1;
  fetchUsers();
};

const handleSort = ({ field, order }) => {
  sortField.value = field;
  sortOrder.value = order;
  fetchUsers();
};

// Get icon emoji for role
const getIcon = (iconName) => {
  const icons = {
    crown: '👑',
    shield: '🛡️',
    users: '👥',
    user: '👤',
    eye: '👁️',
    star: '⭐',
    rocket: '🚀'
  };
  return icons[iconName] || '👤';
};

const openInviteModal = () => {
  showInviteModal.value = true;
};

const openEditModal = (user) => {
  selectedUser.value = user;
  showEditModal.value = true;
};

const handleUserInvited = () => {
  showInviteModal.value = false;
  fetchUsers();
};

const handleUserUpdated = () => {
  showEditModal.value = false;
  selectedUser.value = null;
  fetchUsers();
};

const handleDeleteUser = async (user) => {
  if (!confirm(`Delete user ${user.firstName} ${user.lastName}? This action cannot be undone.`)) return;
  
  try {
    const response = await apiClient.delete(`/users/${user._id}`);
    
    if (response.success) {
      fetchUsers();
    } else {
      alert('Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Failed to delete user');
  }
};

// Bulk action handler
const handleBulkAction = ({ action, selectedRows }) => {
  switch (action) {
    case 'bulk-activate':
      bulkActivate(selectedRows);
      break;
    case 'bulk-deactivate':
      bulkDeactivate(selectedRows);
      break;
    case 'bulk-delete':
      bulkDelete(selectedRows);
      break;
    default:
      console.warn('Unknown bulk action:', action);
  }
};

// Bulk actions
const bulkActivate = async (selectedRows) => {
  if (!confirm(`Activate ${selectedRows.length} user(s)?`)) return;
  
  try {
    await Promise.all(
      selectedRows.map(row => 
        apiClient.put(`/users/${row._id}`, { status: 'active' })
      )
    );
    fetchUsers();
  } catch (error) {
    console.error('Error activating users:', error);
    alert('Failed to activate users');
  }
};

const bulkDeactivate = async (selectedRows) => {
  if (!confirm(`Deactivate ${selectedRows.length} user(s)?`)) return;
  
  try {
    await Promise.all(
      selectedRows.map(row => 
        apiClient.put(`/users/${row._id}`, { status: 'inactive' })
      )
    );
    fetchUsers();
  } catch (error) {
    console.error('Error deactivating users:', error);
    alert('Failed to deactivate users');
  }
};

const bulkDelete = async (selectedRows) => {
  if (!confirm(`Delete ${selectedRows.length} user(s)? This action cannot be undone.`)) return;
  
  try {
    await Promise.all(
      selectedRows.map(row => 
        apiClient.delete(`/users/${row._id}`)
      )
    );
    fetchUsers();
  } catch (error) {
    console.error('Error deleting users:', error);
    alert('Failed to delete users');
  }
};

// Utility functions
const getRoleBadgeClass = (role) => {
  const classes = {
    owner: 'px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium',
    admin: 'px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    manager: 'px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    user: 'px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    viewer: 'px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium'
  };
  return classes[role?.toLowerCase()] || classes.user;
};

const getStatusBadgeClass = (status) => {
  const classes = {
    active: 'px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    inactive: 'px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    suspended: 'px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium'
  };
  return classes[status] || classes.active;
};

const formatDate = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchUsers();
});
</script>

