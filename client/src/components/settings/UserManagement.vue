<template>
  <div :class="embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-6'">
    <div
      v-if="!embedded"
      class="mb-6 shrink-0"
    >
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.usersTabManagement') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.usersPageSubtitle') }}
      </p>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
      <!-- Stats -->
      <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <button
          v-for="card in statCards"
          :key="card.id"
          type="button"
          :class="[
            'group rounded-xl border p-4 text-left transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
            activeStatFilter === card.id
              ? 'border-indigo-500 bg-indigo-50/60 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/40'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-gray-600 dark:hover:bg-gray-800'
          ]"
          @click="applyStatFilter(card.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ card.label }}
              </p>
              <p
                class="mt-1 text-2xl font-bold tabular-nums"
                :class="card.valueClass"
              >
                {{ statsLoading ? '—' : card.value }}
              </p>
            </div>
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors"
              :class="card.iconWrapClass"
            >
              <component :is="card.icon" class="h-5 w-5" :class="card.iconClass" aria-hidden="true" />
            </div>
          </div>
        </button>
      </div>

      <!-- Users table -->
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <DataTable
          :columns="tableColumns"
          :data="users"
          :loading="loading"
          :server-side="true"
          :searchable="true"
          :total-records="totalUsers"
          :current-page="currentPage"
          :per-page="perPage"
          :search-placeholder="t('settings.usersSearchPlaceholder')"
          :empty-title="hasActiveFilters ? t('settings.usersEmptyFilteredTitle') : t('settings.usersEmptyTitle')"
          :empty-message="hasActiveFilters ? t('settings.usersEmptyFilteredBody') : t('settings.usersEmptyBody')"
          :selectable="true"
          :column-settings="true"
          :resizable="true"
          :mass-actions="massActions"
          :selection-bar-title="t('settings.usersMassBarTitle')"
          table-id="users-table"
          row-key="_id"
          @update:page="handlePageChange"
          @update:per-page="handlePerPageChange"
          @update:search="handleSearch"
          @update:sort="handleSort"
          @edit="openEditModal"
          @delete="handleDeleteUser"
          @bulk-action="handleBulkAction"
          @row-click="handleRowClick"
        >
          <template #toolbar-actions>
            <HeadlessSelect
              v-model="roleFilter"
              :options="roleFilterOptions"
              allow-empty
              :empty-label="t('settings.usersFilterRole')"
              empty-value=""
              teleport
              wrapper-class="w-44"
              button-class="!rounded-xl !border !border-gray-300 !bg-white !px-3 !py-2.5 !text-sm !shadow-sm focus:!outline-none focus-visible:!ring-2 focus-visible:!ring-indigo-500/30 focus-visible:!ring-offset-1 dark:!border-gray-600 dark:!bg-gray-800 dark:focus-visible:!ring-offset-gray-900"
              @update:model-value="handleRoleFilterChange"
            />

            <button
              v-if="hasActiveFilters"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
              @click="clearFilters"
            >
              <XMarkIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('settings.usersClearFilters') }}
            </button>

            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              @click="openInviteModal"
            >
              <UserPlusIcon class="h-5 w-5" aria-hidden="true" />
              {{ t('settings.usersInvite') }}
            </button>
          </template>

          <template #empty>
            <UserGroupIcon class="mb-5 h-20 w-20 text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              {{ hasActiveFilters ? t('settings.usersEmptyFilteredTitle') : t('settings.usersEmptyTitle') }}
            </h3>
            <p class="mb-6 max-w-md text-center text-base text-gray-500 dark:text-gray-400">
              {{ hasActiveFilters ? t('settings.usersEmptyFilteredBody') : t('settings.usersEmptyBody') }}
            </p>
            <button
              v-if="!hasActiveFilters"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
              @click="openInviteModal"
            >
              <UserPlusIcon class="h-5 w-5" aria-hidden="true" />
              {{ t('settings.usersEmptyCta') }}
            </button>
            <button
              v-else
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="clearFilters"
            >
              {{ t('settings.usersClearFilters') }}
            </button>
          </template>

          <template #cell-user="{ row }">
            <div class="flex items-center gap-3 py-0.5">
              <div class="relative shrink-0">
                <img
                  v-if="row.avatar"
                  :src="row.avatar"
                  :alt="userDisplayName(row)"
                  class="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                />
                <div
                  v-else
                  class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white dark:ring-gray-800"
                  :style="{ backgroundColor: avatarColor(row.email) }"
                >
                  {{ userInitials(row) }}
                </div>
                <span
                  v-if="isUserOnline(row)"
                  class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-800"
                  :title="t('settings.usersStatusActive')"
                />
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate font-semibold text-gray-900 dark:text-white">
                    {{ userDisplayName(row) }}
                  </p>
                  <span
                    v-if="row.isOwner"
                    class="inline-flex items-center rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                  >
                    {{ t('settings.usersStatAdmins') }}
                  </span>
                  <span
                    v-if="!row.emailVerifiedAt && row.status !== 'invited'"
                    class="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {{ t('settings.usersEmailUnverified') }}
                  </span>
                </div>
                <p class="truncate text-sm text-gray-500 dark:text-gray-400">{{ row.email }}</p>
              </div>
            </div>
          </template>

          <template #cell-role="{ row }">
            <span
              v-if="row.roleId"
              class="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1 text-xs font-medium text-white"
              :style="{ backgroundColor: row.roleId.color || '#6049E7' }"
            >
              {{ row.roleId.name }}
            </span>
            <span v-else :class="getRoleBadgeClass(row.role)">
              {{ formatRoleLabel(row.role) }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <span :class="getStatusBadgeClass(row.status)">
              <span class="inline-block h-1.5 w-1.5 rounded-full" :class="getStatusDotClass(row.status)" />
              {{ formatStatusLabel(row.status) }}
            </span>
          </template>

          <template #cell-userType="{ row }">
            <span :class="getUserTypeBadgeClass(row.userType)">
              {{ formatUserTypeLabel(row.userType) }}
            </span>
          </template>

          <template #cell-lastLogin="{ row }">
            <span
              class="text-sm text-gray-600 dark:text-gray-400"
              :title="formatAbsoluteDate(row.lastLogin)"
            >
              {{ formatLastLogin(row.lastLogin) }}
            </span>
          </template>

          <template #cell-createdAt="{ row }">
            <span
              class="text-sm text-gray-600 dark:text-gray-400"
              :title="formatAbsoluteDate(row.createdAt)"
            >
              {{ formatAbsoluteDate(row.createdAt) }}
            </span>
          </template>
        </DataTable>
      </div>
    </div>

    <InviteUserDrawer
      :is-open="showInviteModal"
      @close="showInviteModal = false"
      @user-invited="handleUserInvited"
    />

    <EditUserModal
      :is-open="showEditModal"
      :user="selectedUser"
      @close="showEditModal = false"
      @user-updated="handleUserUpdated"
    />
  </div>
</template>

<script setup>
defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
});

import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  UserGroupIcon,
  UserPlusIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import DataTable from '@/components/common/DataTable.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import InviteUserDrawer from './InviteUserDrawer.vue';
import EditUserModal from './EditUserModal.vue';
import { useNotifications } from '@/composables/useNotifications';
import { formatRelativeTime } from '@/utils/relativeTime';

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();

const users = ref([]);
const loading = ref(false);
const statsLoading = ref(false);
const totalUsers = ref(0);
const currentPage = ref(1);
const perPage = ref(20);
const searchQuery = ref('');
const sortField = ref('createdAt');
const sortOrder = ref('desc');
const stats = ref({
  total: 0,
  active: 0,
  inactive: 0,
  invited: 0,
  admins: 0
});

const activeStatFilter = ref('all');
const roleFilter = ref('');
const availableRoles = ref([]);

const showInviteModal = ref(false);
const showEditModal = ref(false);
const selectedUser = ref(null);

const tableColumns = computed(() => [
  { key: 'user', label: t('settings.usersColUser'), sortable: true, minWidth: '16rem' },
  { key: 'role', label: t('settings.usersColRole'), sortable: true },
  { key: 'status', label: t('settings.usersColStatus'), sortable: true },
  { key: 'userType', label: t('settings.usersColType'), sortable: false },
  { key: 'lastLogin', label: t('settings.usersColLastLogin'), sortable: true },
  { key: 'createdAt', label: t('settings.usersColJoined'), sortable: true }
]);

const massActions = computed(() => [
  {
    label: t('settings.usersBulkActivate'),
    action: 'bulk-activate',
    variant: 'success',
    icon: 'activate'
  },
  {
    label: t('settings.usersBulkDeactivate'),
    action: 'bulk-deactivate',
    variant: 'warning',
    icon: 'deactivate'
  },
  {
    label: t('actions.delete'),
    icon: 'trash',
    action: 'bulk-delete',
    variant: 'danger'
  }
]);

const roleFilterOptions = computed(() =>
  availableRoles.value.map((role) => ({
    value: role._id,
    label: role.name
  }))
);

const statCards = computed(() => [
  {
    id: 'all',
    label: t('settings.usersStatTotal'),
    value: stats.value.total || 0,
    valueClass: 'text-gray-900 dark:text-white',
    icon: UserGroupIcon,
    iconWrapClass: 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200/80 dark:group-hover:bg-blue-900/50',
    iconClass: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'active',
    label: t('settings.usersStatActive'),
    value: stats.value.active || 0,
    valueClass: 'text-green-600 dark:text-green-400',
    icon: CheckCircleIcon,
    iconWrapClass: 'bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200/80 dark:group-hover:bg-green-900/50',
    iconClass: 'text-green-600 dark:text-green-400'
  },
  {
    id: 'invited',
    label: t('settings.usersStatPending'),
    value: stats.value.invited || 0,
    valueClass: 'text-amber-600 dark:text-amber-400',
    icon: EnvelopeIcon,
    iconWrapClass: 'bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200/80 dark:group-hover:bg-amber-900/50',
    iconClass: 'text-amber-600 dark:text-amber-400'
  },
  {
    id: 'inactive',
    label: t('settings.usersStatInactive'),
    value: stats.value.inactive || 0,
    valueClass: 'text-gray-600 dark:text-gray-400',
    icon: NoSymbolIcon,
    iconWrapClass: 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600',
    iconClass: 'text-gray-600 dark:text-gray-400'
  },
  {
    id: 'admins',
    label: t('settings.usersStatAdmins'),
    value: stats.value.admins || 0,
    valueClass: 'text-purple-600 dark:text-purple-400',
    icon: ShieldCheckIcon,
    iconWrapClass: 'bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200/80 dark:group-hover:bg-purple-900/50',
    iconClass: 'text-purple-600 dark:text-purple-400'
  }
]);

const hasActiveFilters = computed(() =>
  Boolean(
    searchQuery.value
    || roleFilter.value
    || (activeStatFilter.value && activeStatFilter.value !== 'all')
  )
);

const userDisplayName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

const userInitials = (user) => {
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (user.email?.[0] || 'U').toUpperCase();
};

const avatarColor = (email = '') => {
  const palette = ['#6049E7', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'];
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const isUserOnline = (user) => {
  if (!user.lastLogin) return false;
  const lastLoginMs = new Date(user.lastLogin).getTime();
  if (Number.isNaN(lastLoginMs)) return false;
  return Date.now() - lastLoginMs < 15 * 60 * 1000;
};

const buildListParams = () => {
  const params = new URLSearchParams({
    page: String(currentPage.value),
    limit: String(perPage.value),
    sortBy: sortField.value,
    sortOrder: sortOrder.value
  });

  if (searchQuery.value) {
    params.append('search', searchQuery.value);
  }

  if (roleFilter.value) {
    params.append('roleId', roleFilter.value);
  }

  if (activeStatFilter.value === 'active') {
    params.append('status', 'active');
  } else if (activeStatFilter.value === 'inactive') {
    params.append('status', 'inactive');
  } else if (activeStatFilter.value === 'invited') {
    params.append('status', 'invited');
  } else if (activeStatFilter.value === 'admins') {
    params.append('adminOnly', 'true');
  }

  return params;
};

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const response = await apiClient.get('/users?limit=500&page=1&sortBy=createdAt&sortOrder=desc');
    if (response.success) {
      const all = Array.isArray(response.data) ? response.data : [];
      stats.value = {
        total: response.total ?? all.length,
        active: all.filter((u) => u.status === 'active' || !u.status).length,
        inactive: all.filter((u) => u.status === 'inactive').length,
        invited: all.filter((u) => u.status === 'invited').length,
        admins: all.filter((u) => u.isOwner || u.role === 'admin' || u.role === 'owner').length
      };
    }
  } catch (error) {
    console.error('Error fetching user stats:', error);
  } finally {
    statsLoading.value = false;
  }
};

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
  }
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get(`/users?${buildListParams().toString()}`);

    if (response.success) {
      users.value = response.data;
      totalUsers.value = response.total || response.data.length;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchUsers(), fetchStats()]);
};

const applyStatFilter = (filterId) => {
  activeStatFilter.value = filterId;
  currentPage.value = 1;
  fetchUsers();
};

const handleRoleFilterChange = () => {
  currentPage.value = 1;
  fetchUsers();
};

const clearFilters = () => {
  searchQuery.value = '';
  roleFilter.value = '';
  activeStatFilter.value = 'all';
  currentPage.value = 1;
  fetchUsers();
};

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

const openInviteModal = () => {
  showInviteModal.value = true;
};

const openEditModal = (user) => {
  selectedUser.value = user;
  showEditModal.value = true;
};

const handleRowClick = (row, event) => {
  const target = event?.target;
  if (target instanceof Element && target.closest('input, button, a, label, [role="checkbox"]')) {
    return;
  }
  openEditModal(row);
};

const handleUserInvited = () => {
  showInviteModal.value = false;
  refreshAll();
  notifySuccess(t('settings.inviteSuccessCreated'));
};

const handleUserUpdated = () => {
  showEditModal.value = false;
  selectedUser.value = null;
  refreshAll();
};

const handleDeleteUser = async (user) => {
  if (!confirm(t('settings.usersDeleteConfirm', { name: userDisplayName(user) }))) return;

  try {
    const response = await apiClient.delete(`/users/${user._id}`);

    if (response.success) {
      notifySuccess(t('settings.usersDeletedSuccess'));
      refreshAll();
    } else {
      notifyError(t('settings.usersDeleteFailed'));
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    notifyError(t('settings.usersDeleteFailed'));
  }
};

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

const bulkActivate = async (selectedRows) => {
  if (!confirm(t('settings.usersBulkActivateConfirm', { count: selectedRows.length }))) return;

  try {
    await Promise.all(
      selectedRows.map((row) => apiClient.put(`/users/${row._id}`, { status: 'active' }))
    );
    notifySuccess(t('settings.usersBulkActivatedSuccess', { count: selectedRows.length }));
    refreshAll();
  } catch (error) {
    console.error('Error activating users:', error);
    notifyError(t('settings.usersBulkActivateFailed'));
  }
};

const bulkDeactivate = async (selectedRows) => {
  if (!confirm(t('settings.usersBulkDeactivateConfirm', { count: selectedRows.length }))) return;

  try {
    await Promise.all(
      selectedRows.map((row) => apiClient.put(`/users/${row._id}`, { status: 'inactive' }))
    );
    notifySuccess(t('settings.usersBulkDeactivatedSuccess', { count: selectedRows.length }));
    refreshAll();
  } catch (error) {
    console.error('Error deactivating users:', error);
    notifyError(t('settings.usersBulkDeactivateFailed'));
  }
};

const bulkDelete = async (selectedRows) => {
  if (!confirm(t('settings.usersBulkDeleteConfirm', { count: selectedRows.length }))) return;

  try {
    await Promise.all(
      selectedRows.map((row) => apiClient.delete(`/users/${row._id}`))
    );
    notifySuccess(t('settings.usersBulkDeletedSuccess', { count: selectedRows.length }));
    refreshAll();
  } catch (error) {
    console.error('Error deleting users:', error);
    notifyError(t('settings.usersBulkDeleteFailed'));
  }
};

const formatStatusLabel = (status) => {
  const normalized = status || 'active';
  const labels = {
    active: t('settings.editUserStatusActive'),
    inactive: t('settings.editUserStatusInactive'),
    suspended: t('settings.editUserStatusSuspended'),
    invited: t('settings.usersStatusInvited')
  };
  return labels[normalized] || normalized;
};

const formatRoleLabel = (role) => {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const formatUserTypeLabel = (userType) => {
  if (userType === 'EXTERNAL') return t('settings.inviteExternal');
  if (userType === 'INTERNAL') return t('settings.inviteInternal');
  return userType || t('settings.inviteInternal');
};

const getRoleBadgeClass = (role) => {
  const classes = {
    owner: 'inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    admin: 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300',
    manager: 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    user: 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300',
    viewer: 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  };
  return classes[role?.toLowerCase()] || classes.user;
};

const getStatusBadgeClass = (status) => {
  const normalized = status || 'active';
  const classes = {
    active: 'inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    suspended: 'inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300',
    invited: 'inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  };
  return classes[normalized] || classes.active;
};

const getStatusDotClass = (status) => {
  const normalized = status || 'active';
  const classes = {
    active: 'bg-green-500',
    inactive: 'bg-gray-400',
    suspended: 'bg-red-500',
    invited: 'bg-amber-500'
  };
  return classes[normalized] || classes.active;
};

const getUserTypeBadgeClass = (userType) => {
  if (userType === 'EXTERNAL') {
    return 'inline-flex items-center rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  }
  return 'inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300';
};

const formatAbsoluteDate = (date) => {
  if (!date) return t('settings.usersLastLoginNever');
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatLastLogin = (date) => {
  if (!date) return t('settings.usersLastLoginNever');
  const relative = formatRelativeTime(date, t);
  return relative || formatAbsoluteDate(date);
};

onMounted(() => {
  fetchRoles();
  refreshAll();
});
</script>
