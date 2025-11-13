<template>
  <div class="mx-auto">
    <ListView
      title="Organizations"
      description="Manage all customer organizations"
      module-key="organizations"
        create-label="New Organization"
      search-placeholder="Search organizations..."
      :data="organizations"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total Organizations', key: 'totalOrganizations', formatter: 'number' },
        { name: 'Active', key: 'activeOrganizations', formatter: 'number' },
        { name: 'On Trial', key: 'trialOrganizations', formatter: 'number' },
        { name: 'Paying Customers', key: 'paidOrganizations', formatter: 'number' }
      ]"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalOrganizations, limit: pagination.limit }"
      :filter-config="[
        {
          key: 'industry',
          label: 'All Industries',
          options: [
            { value: 'Technology', label: 'Technology' },
            { value: 'Finance', label: 'Finance' },
            { value: 'Healthcare', label: 'Healthcare' },
            { value: 'Education', label: 'Education' },
            { value: 'Retail', label: 'Retail' },
            { value: 'Manufacturing', label: 'Manufacturing' },
            { value: 'Other', label: 'Other' }
          ]
        },
        {
          key: 'tier',
          label: 'All Tiers',
          options: [
            { value: 'trial', label: 'Trial' },
            { value: 'starter', label: 'Starter' },
            { value: 'professional', label: 'Professional' },
            { value: 'enterprise', label: 'Enterprise' }
          ]
        },
        {
          key: 'status',
          label: 'All Statuses',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' }
          ]
        }
      ]"
      table-id="organizations-table"
      row-key="_id"
      empty-title="No organizations found"
      empty-message="Get started by creating your first organization"
        :show-import="false"
        @create="openCreateModal"
        @export="exportOrganizations"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchOrganizations(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.value.currentPage = p.currentPage; pagination.value.limit = p.limit || pagination.value.limit; fetchOrganizations(); }"
      @fetch="fetchOrganizations"
      @row-click="handleRowClick"
      @edit="editOrganization"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Organization Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :record="{
              name: row.name,
              avatar: row.avatar || row.logo || row.image
            }"
            size="md"
          />
          <div class="min-w-0">
            <div class="font-semibold text-gray-900 dark:text-white truncate">
              {{ row.name }}
            </div>
            <div v-if="row.domain" class="text-sm text-gray-500 dark:text-gray-400 truncate">
              {{ row.domain }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Industry Cell -->
      <template #cell-industry="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ value || '-' }}</span>
      </template>

      <!-- Custom Subscription Cell with Badge -->
      <template #cell-subscription="{ row }">
        <BadgeCell 
          :value="(row.subscription?.tier || 'trial').charAt(0).toUpperCase() + (row.subscription?.tier || 'trial').slice(1)" 
          :variant-map="{
            'Trial': 'warning',
            'Starter': 'info',
            'Professional': 'primary',
            'Enterprise': 'success'
          }"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-isActive="{ value }">
        <BadgeCell 
          :value="value ? 'Active' : 'Inactive'" 
          :variant-map="{
            'Active': 'success',
            'Inactive': 'danger'
          }"
        />
      </template>

      <!-- Custom Contact Count Cell -->
      <template #cell-contactCount="{ value }">
        <span class="text-gray-700 dark:text-gray-300 font-medium">{{ value || 0 }}</span>
      </template>

      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Custom Created By Cell -->
      <template #cell-createdBy="{ row }">
        <div v-if="row.createdBy" class="flex items-center gap-2">
          <Avatar
            v-if="typeof row.createdBy === 'object'"
            :user="{
              firstName: row.createdBy.firstName || row.createdBy.first_name,
              lastName: row.createdBy.lastName || row.createdBy.last_name,
              email: row.createdBy.email,
              avatar: row.createdBy.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.createdBy) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Assigned To Cell - handle different case variations -->
      <template #cell-assignedTo="{ row, value }">
        <!-- Debug: Log once per render -->
        <div v-if="false" style="display: none;">
          {{ console.log('🔍 assignedTo cell render:', { row: row?.assignedTo, value, isObject: typeof row?.assignedTo === 'object' }) }}
        </div>
        <div v-if="row.assignedTo && typeof row.assignedTo === 'object' && row.assignedTo !== null && !Array.isArray(row.assignedTo)" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.name || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>
      <!-- Also support lowercase variant -->
      <template #cell-assignedto="{ row, value }">
        <div v-if="row.assignedTo && typeof row.assignedTo === 'object' && row.assignedTo !== null && !Array.isArray(row.assignedTo)" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.name || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Account Manager Cells -->
      <template #cell-accountManager="{ row }">
        <div v-if="row.accountManager && typeof row.accountManager === 'object'" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.accountManager.firstName || row.accountManager.first_name || row.accountManager.name,
              lastName: row.accountManager.lastName || row.accountManager.last_name,
              email: row.accountManager.email,
              avatar: row.accountManager.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.accountManager) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.accountManager === 'string' ? getUserDisplayName(row.accountManager) : 'Unassigned' }}
        </span>
      </template>

      <template #cell-account_manager="{ row }">
        <div v-if="row.account_manager && typeof row.account_manager === 'object'" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.account_manager.firstName || row.account_manager.first_name || row.account_manager.name,
              lastName: row.account_manager.lastName || row.account_manager.last_name,
              email: row.account_manager.email,
              avatar: row.account_manager.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.account_manager) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.account_manager === 'string' ? getUserDisplayName(row.account_manager) : 'Unassigned' }}
        </span>
      </template>

    </ListView>

    <!-- Create/Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="organizations"
      :record="editingOrganization"
      @close="closeFormModal"
      @saved="handleOrganizationSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, onActivated } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useBulkActions } from '@/composables/useBulkActions';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import Avatar from '@/components/common/Avatar.vue';

const router = useRouter();
const route = useRoute();

// Use tabs composable
const { openTab } = useTabs();

// Use bulk actions composable with permissions
const { bulkActions: massActions } = useBulkActions('organizations');

// State
const organizations = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showFormModal = ref(false);
const editingOrganization = ref(null);
const moduleDefinition = ref(null);

// Mass Actions
const filters = reactive({
  industry: '',
  tier: '',
  status: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalOrganizations: 0,
  limit: 20
});

const usersById = ref({});
const usersLoaded = ref(false);

const upsertUsers = (users) => {
  if (!Array.isArray(users)) return;
  const map = { ...usersById.value };

  for (const user of users) {
    if (!user || typeof user !== 'object') continue;
    const id = user._id || user.id;
    if (!id) continue;
    map[id] = { ...map[id], ...user, _id: id };
  }

  usersById.value = map;
};

const loadUsers = async () => {
  if (usersLoaded.value && Object.keys(usersById.value).length > 0) {
    return;
  }

  try {
    const response = await apiClient.get('/users/list');

    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.success && Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.data && Array.isArray(response.data.users)) {
      users = response.data.users;
    } else if (response?.data && Array.isArray(response.data.data)) {
      users = response.data.data;
    }

    if (users.length > 0) {
      upsertUsers(users);
    }
  } catch (error) {
    console.error('Error loading users for organizations list:', error);
  } finally {
    usersLoaded.value = true;
  }
};

const resolveUserValue = (value) => {
  if (!value) return value;

  if (typeof value === 'string') {
    return usersById.value[value] || value;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const id = value._id || value.id;
    if (id && usersById.value[id]) {
      const merged = { ...usersById.value[id], ...value, _id: id };
      upsertUsers([merged]);
      return merged;
    }

    if (id) {
      upsertUsers([value]);
    }

    if (value.firstName || value.first_name || value.email || value.name) {
      return value;
    }

    return value;
  }

  return value;
};

const userFieldKeys = [
  'owner',
  'owner_id',
  'assignedTo',
  'assigned_to',
  'createdBy',
  'created_by',
  'accountManager',
  'account_manager',
  'accountmanager'
];

const normalizeOrganizationRecord = (record) => {
  if (!record || typeof record !== 'object') return record;

  const normalized = { ...record };

  userFieldKeys.forEach((key) => {
    if (!(key in normalized)) return;
    const resolved = resolveUserValue(normalized[key]);
    normalized[key] = resolved;

    if (key === 'accountManager' && resolved && typeof resolved === 'object') {
      normalized.account_manager = resolved;
    }

    if (key === 'account_manager' && resolved && typeof resolved === 'object') {
      normalized.accountManager = resolved;
    }
  });

  return normalized;
};

const normalizeOrganizationsArray = (records = []) => {
  if (!Array.isArray(records)) return [];
  return records.map((record) => normalizeOrganizationRecord(record));
};

const statistics = ref({
  totalOrganizations: 0,
  activeOrganizations: 0,
  trialOrganizations: 0,
  paidOrganizations: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.industry || '') !== '' || 
         (filters?.tier || '') !== '' || 
         (filters?.status || '') !== '';
});

// Fetch module definition to build columns dynamically
const fetchModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    const modules = response.data || [];
    const orgsModule = modules.find(m => m.key === 'organizations');
    if (orgsModule) {
      moduleDefinition.value = orgsModule;
      initializeColumnsFromModule(orgsModule);
    }
  } catch (error) {
    console.error('Error fetching module definition:', error);
  }
};

// Initialize columns from module definition
const initializeColumnsFromModule = (module) => {
  if (!module || !module.fields) return;
};

// Column definitions (dynamically generated from module fields)
const columns = computed(() => {
  if (!moduleDefinition.value) {
    // Fallback to basic columns while loading
    return [
      { key: 'name', label: 'Organization', sortable: true, minWidth: '200px' },
      { key: 'contactCount', label: 'Contacts', sortable: true, minWidth: '120px' },
      { key: 'createdAt', label: 'Created', sortable: true, minWidth: '140px' }
    ];
  }
  
  const cols = [
    { key: 'name', label: 'Organization', sortable: true, minWidth: '200px' },
    { key: 'contactCount', label: 'Contacts', sortable: true, minWidth: '120px' },
    { key: 'createdAt', label: 'Created', sortable: true, minWidth: '140px' }
  ];
  
  // Append fields from module definition
  const systemFieldKeys = new Set(['organizationid','createdat','updatedat','_id','__v','activitylogs','name','contactcount','createdat']);
  for (const field of moduleDefinition.value.fields || []) {
    const keyLower = field.key?.toLowerCase();
    if (!keyLower || systemFieldKeys.has(keyLower) || field.visibility?.list === false) continue;
          let minWidth = '120px';
    if (['Email', 'Phone', 'URL'].includes(field.dataType)) minWidth = '180px';
    else if (['Text-Area', 'Rich Text'].includes(field.dataType)) minWidth = '250px';
    else if (['Date', 'Date-Time'].includes(field.dataType)) minWidth = '140px';
    else if (['Picklist', 'Multi-Picklist'].includes(field.dataType)) minWidth = '150px';
    cols.push({
            key: field.key,
            label: field.label || field.key,
      sortable: !['Multi-Picklist','Text-Area','Rich Text','Formula','Rollup Summary'].includes(field.dataType),
            dataType: field.dataType,
      options: field.options || [],
            minWidth
    });
  }
  
  return cols;
});

// Event handlers
const handleRowClick = (row, event) => {
  viewOrganization(row._id, event);
};

const handleDelete = (row) => {
  deleteOrganization(row._id);
};

const handleSort = ({ key, order }) => {
  // If key is empty, reset to default sort
  sortField.value = key || 'createdAt';
  sortOrder.value = order || 'desc';
  fetchOrganizations();
};

// Methods
const fetchOrganizations = async () => {
  loading.value = true;
  console.log('🔍 Fetching organizations...');
  
  try {
    await loadUsers();

    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.industry) params.append('industry', filters.industry);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.status) params.append('status', filters.status);

    const data = await apiClient(`/admin/organizations/all?${params.toString()}`, {
      method: 'GET'
    });

    console.log('📦 Organizations data:', data);
    // Debug: Check if assignedTo is populated
    if (data.success && data.data && data.data.length > 0) {
      console.log('🔍 Sample organization assignedTo:', {
        org: data.data[0].name,
        assignedTo: data.data[0].assignedTo,
        assignedToType: typeof data.data[0].assignedTo,
        assignedToIsObject: typeof data.data[0].assignedTo === 'object' && data.data[0].assignedTo !== null
      });
    }
    
    if (data.success) {
      const normalized = normalizeOrganizationsArray(data.data);
      organizations.value = normalized;
      const discoveredUsers = [];
      normalized.forEach((org) => {
        userFieldKeys.forEach((key) => {
          const candidate = org[key];
          if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            const id = candidate._id || candidate.id;
            if (id) {
              discoveredUsers.push({ ...candidate, _id: id });
            }
          }
        });
      });
      if (discoveredUsers.length > 0) {
        upsertUsers(discoveredUsers);
      }
      pagination.value = data.pagination;
      
      // Calculate statistics
      statistics.value = {
        totalOrganizations: data.pagination.totalOrganizations,
        activeOrganizations: data.data.filter(o => o.isActive).length,
        trialOrganizations: data.data.filter(o => o.subscription?.status === 'trial').length,
        paidOrganizations: data.data.filter(o => o.subscription?.status === 'active').length
      };
      
      console.log(`✅ Loaded ${data.data.length} organizations`);
    }
  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchOrganizations();
  }, 500);
};

// Handle search query update
const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  debouncedSearch();
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchOrganizations();
};

const viewOrganization = (orgId, event = null) => {
  // Get organization details for tab title
  const org = organizations.value.find(o => o._id === orgId);
  const title = org ? org.name : 'Organization Detail';
  
  // Check if user wants to open in background
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(`/organizations/${orgId}`, {
    title,
    icon: 'building',
    params: { name: title },
    background: openInBackground
  });
};

const openCreateModal = () => {
  editingOrganization.value = null;
  showFormModal.value = true;
};

const editOrganization = (org) => {
  editingOrganization.value = org;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingOrganization.value = null;
};

const handleOrganizationSaved = (savedOrganization) => {
  closeFormModal();
  fetchOrganizations(); // Refresh the list
};

const deleteOrganization = async (orgId) => {
  try {
    await apiClient(`/admin/organizations/${orgId}`, {
      method: 'DELETE'
    });
    fetchOrganizations();
  } catch (error) {
    console.error('Error deleting organization:', error);
  }
};

// Bulk Actions Handlers
const handleSelect = (selectedRows) => {
  console.log(`${selectedRows.length} organizations selected`);
};

const handleBulkAction = async (actionId, selectedRows) => {
  const orgIds = selectedRows.map(org => org._id);
  
  try {
    if (actionId === 'bulk-delete' || actionId === 'delete') {
      await Promise.all(orgIds.map(id => 
        apiClient(`/admin/organizations/${id}`, { method: 'DELETE' })
      ));
      fetchOrganizations();
      
    } else if (actionId === 'bulk-export' || actionId === 'export') {
      exportOrganizationsToCSV(selectedRows);
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    alert('Error performing bulk action. Please try again.');
  }
};

const exportOrganizationsToCSV = (orgsToExport) => {
  const headers = ['Name', 'Industry', 'Tier', 'Status', 'Contacts', 'Created'];
  const rows = orgsToExport.map(o => [
    o.name,
    o.industry || '',
    o.subscription?.tier || '',
    o.isActive ? 'Active' : 'Inactive',
    o.contactCount || 0,
    new Date(o.createdAt).toLocaleDateString()
  ]);
  
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const exportOrganizations = () => {
  const headers = ['Name', 'Industry', 'Tier', 'Status', 'Contacts', 'Created'];
  const rows = organizations.value.map(o => [
    o.name,
    o.industry || '',
    o.subscription?.tier || 'trial',
    o.isActive ? 'Active' : 'Inactive',
    o.contactCount || 0,
    formatDate(o.createdAt)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `organizations-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.industry = '';
  filters.tier = '';
  filters.status = '';
  fetchOrganizations();
};

// Load column settings from localStorage
const loadColumnSettings = () => {
  try {
    const saved = localStorage.getItem('organizations-column-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load column settings:', e);
  }
  return null;
};

// Save column settings to localStorage
const saveColumnSettings = () => {
  try {
    // Save only the key and visible state for each column
    const settings = visibleColumns.value.map(col => ({
      key: col.key,
      visible: col.visible
    }));
    localStorage.setItem('organizations-column-settings', JSON.stringify(settings));
    console.log('Saved column settings:', settings);
  } catch (e) {
    console.error('Failed to save column settings:', e);
  }
};

// Column settings functions
const resetColumnSettings = () => {
  // Reset to default: respect module definition's visibility.list setting
  visibleColumns.value = visibleColumns.value.map(col => {
    const basicColumns = ['name', 'contactCount', 'createdAt'];
    
    // Basic columns are always visible
    if (basicColumns.includes(col.key)) {
      return { ...col, visible: true };
    }
    
    // For module fields, check the module definition's visibility.list setting
    const field = moduleDefinition.value?.fields?.find(f => 
      f.key?.toLowerCase() === col.key?.toLowerCase()
    );
    
    return { 
      ...col, 
      visible: field?.visibility?.list ?? false // Use module definition default
    };
  });
  
  // Save the reset
  saveColumnSettings();
};

const applyColumnSettings = async () => {
  // Save column settings to localStorage
  saveColumnSettings();
  
  // TODO: Optionally save to module definition on backend
  // This would persist across all users, but for now we'll use localStorage (per-user)
  
  showColumnSettings.value = false;
  console.log('Applied column settings:', visibleColumns.value);
};

const toggleColumnVisibility = (columnKey) => {
  const column = visibleColumns.value.find(col => col.key === columnKey);
  if (column) {
    column.visible = !column.visible;
  }
};

// Drag and drop functionality
const dragStartIndex = ref(null);

const handleDragStart = (event, index) => {
  dragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', event.target.outerHTML);
  event.target.style.opacity = '0.5';
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handleDragEnter = (event) => {
  event.preventDefault();
  event.target.classList.add('drag-over');
};

const handleDragLeave = (event) => {
  event.target.classList.remove('drag-over');
};

const handleDrop = (event, dropIndex) => {
  event.preventDefault();
  event.target.classList.remove('drag-over');
  
  if (dragStartIndex.value !== null && dragStartIndex.value !== dropIndex) {
    // Reorder the columns
    const draggedColumn = visibleColumns.value[dragStartIndex.value];
    visibleColumns.value.splice(dragStartIndex.value, 1);
    visibleColumns.value.splice(dropIndex, 0, draggedColumn);
  }
  
  dragStartIndex.value = null;
};

const handleDragEnd = (event) => {
  event.target.style.opacity = '1';
  dragStartIndex.value = null;
};

const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
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

  if (typeof user === 'string') {
    const cached = usersById.value[user];
    if (cached) return getUserDisplayName(cached);
    return user;
  }

  const firstName = user.firstName || user.first_name || user.name || '';
  const lastName = user.lastName || user.last_name || '';
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;

  if (user.email) return user.email;
  if (user.username) return user.username;

  const id = user._id || user.id;
  if (id && usersById.value[id]) {
    return getUserDisplayName(usersById.value[id]);
  }

  return 'Unknown User';
};

const getInitials = (name) => {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Lifecycle
onMounted(async () => {
  // Fetch module definition first to build columns dynamically
  await fetchModuleDefinition();
  await loadUsers();
  
  // Load saved sort state from localStorage before fetching
  const savedSort = localStorage.getItem('datatable-organizations-table-sort');
  if (savedSort) {
    try {
      const { by, order } = JSON.parse(savedSort);
      sortField.value = by;
      sortOrder.value = order;
      console.log('Loaded saved sort in Organizations:', { by, order });
    } catch (e) {
      console.error('Failed to parse saved sort:', e);
    }
  }
  
  fetchOrganizations();
});

// Refresh module definition when component is activated (e.g., returning from settings)
onActivated(async () => {
  await fetchModuleDefinition();
});

// Watch for route query changes (for refresh)
watch(() => route.query.refresh, () => {
  if (route.query.refresh) {
    fetchOrganizations();
  }
});

</script>


