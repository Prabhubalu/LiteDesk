<template>
  <div class="mx-auto">
    <ListView
      title="People"
      description="Manage your customer relationships"
      module-key="people"
        create-label="New Contact"
      search-placeholder="Search contacts..."
      :data="contacts"
      :columns="tableColumns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total People', key: 'totalContacts', formatter: 'number' },
        { name: 'Leads', key: 'leadContacts', formatter: 'number' },
        { name: 'Customers', key: 'customerContacts', formatter: 'number' },
        { name: 'Active This Month', key: 'activeThisMonth', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalContacts, limit: pagination.limit }"
      :filter-config="[
        {
          key: 'lifecycle_stage',
          label: 'All Stages',
          options: [
            { value: 'Lead', label: 'Lead' },
            { value: 'Qualified', label: 'Qualified' },
            { value: 'Opportunity', label: 'Opportunity' },
            { value: 'Customer', label: 'Customer' },
            { value: 'Lost', label: 'Lost' }
          ]
        },
        {
          key: 'status',
          label: 'All Status',
          options: [
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'Archived', label: 'Archived' }
          ]
        },
        {
          key: 'owner_id',
          label: 'All Owners',
          options: [
            { value: 'me', label: 'My Contacts' }
          ]
        }
      ]"
      table-id="contacts-table"
      row-key="_id"
      empty-title="No people yet"
      empty-message="Start building your network by adding your first person"
        @create="openCreateModal"
        @import="showImportModal = true"
        @export="exportContacts"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchContacts(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.value.currentPage = p.currentPage; pagination.value.limit = p.limit || pagination.value.limit; fetchContacts(); }"
      @fetch="fetchContacts"
      @row-click="handleRowClick"
      @edit="editContact"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >

      <!-- Custom Name Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-semibold flex-shrink-0 mt-0">
            {{ getInitials(row) }}
          </div>
          <span class="font-semibold text-gray-900 dark:text-white">{{ row.first_name }} {{ row.last_name }}</span>
        </div>
      </template>

      <!-- Custom Organization Cell -->
      <template #cell-organization="{ row }">
        <span class="font-medium text-gray-900 dark:text-white">
          <template v-if="row.organization && typeof row.organization === 'object' && row.organization.name">
            {{ row.organization.name }}
          </template>
          <template v-else-if="row.organization && typeof row.organization === 'string'">
            {{ row.organization }}
          </template>
          <template v-else>
            <span class="text-gray-400 dark:text-gray-500">-</span>
          </template>
        </span>
      </template>

      <!-- Custom Email Cell -->
      <template #cell-email="{ value }">
        <a :href="`mailto:${value}`" class="text-brand-600 dark:text-brand-400 hover:underline" @click.stop>
          {{ value }}
        </a>
      </template>

      <!-- Custom Phone Cell -->
      <template #cell-phone="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ row.phone || row.mobile || '-' }}</span>
      </template>

      <!-- Custom Company Cell -->
      <template #cell-account_id="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ row.account_id?.name || '-' }}</span>
      </template>

      <!-- Custom Stage Cell with Badge -->
      <template #cell-lifecycle_stage="{ value }">
        <BadgeCell 
          :value="value || 'Lead'" 
          :variant-map="{
            'Lead': 'warning',
            'Qualified': 'info',
            'Opportunity': 'primary',
            'Customer': 'success',
            'Lost': 'danger'
          }"
        />
      </template>

      <!-- Custom Owner Cell -->
      <template #cell-owner_id="{ row }">
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.owner_id?.firstName || 'Unassigned' }}</span>
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <div v-if="row.assignedTo.avatar" class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img :src="row.assignedTo.avatar" :alt="getUserDisplayName(row.assignedTo)" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {{ getUserInitials(row.assignedTo) }}
          </div>
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Created By Cell -->
      <template #cell-createdBy="{ row }">
        <div v-if="row.createdBy" class="flex items-center gap-2">
          <template v-if="typeof row.createdBy === 'object'">
            <div v-if="row.createdBy.avatar" class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img :src="row.createdBy.avatar" :alt="getUserDisplayName(row.createdBy)" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {{ getUserInitials(row.createdBy) }}
            </div>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.createdBy) }}</span>
          </template>
          <template v-else>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ row.createdBy }}</span>
          </template>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Last Contact Cell -->
      <template #cell-last_contacted_at="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Dynamic Picklist/Multi-Picklist cells with colors -->
      <template v-for="field in picklistFields" :key="field.key" #[`cell-${field.key}`]="{ value, row }">
        <div v-if="field.dataType === 'Picklist' || field.dataType === 'Multi-Picklist'" class="flex flex-wrap gap-1">
          <template v-if="Array.isArray(value) && value.length > 0">
            <BadgeCell 
              v-for="(item, index) in value" 
              :key="index"
              :value="item" 
              :options="field.options || []"
            />
          </template>
          <BadgeCell 
            v-else-if="value && !Array.isArray(value)"
            :value="value" 
            :options="field.options || []"
          />
          <span v-else class="text-gray-400 dark:text-gray-500">-</span>
        </div>
        <span v-else class="text-gray-700 dark:text-gray-300">{{ value || '-' }}</span>
      </template>
    </ListView>

    

    <!-- Create/Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="people"
      :record="editingContact"
      @close="closeFormModal"
      @saved="handleContactSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Contacts"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBulkActions } from '@/composables/useBulkActions';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Use tabs composable
const { openTab } = useTabs();

// Use bulk actions composable with permissions
const { bulkActions: massActions } = useBulkActions('people');

// State
const contacts = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const selectedContacts = ref([]);
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingContact = ref(null);
const moduleDefinition = ref(null);


const filters = reactive({
  lifecycle_stage: '',
  status: '',
  owner_id: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalContacts: 0,
  limit: 20
});

// Computed admin check
const isAdmin = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'owner');

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.lifecycle_stage || '') !== '' || 
         (filters?.status || '') !== '' || 
         (filters?.owner_id || '') !== '';
});

// Fetch module definition to build columns dynamically
const fetchModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    const modules = response.data || [];
    const peopleModule = modules.find(m => m.key === 'people');
    if (peopleModule) {
      moduleDefinition.value = peopleModule;
      initializeColumnsFromModule(peopleModule);
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
const tableColumns = computed(() => {
  if (!moduleDefinition.value) {
    // Fallback to basic columns while loading
    return [
      { 
        key: 'name', 
        label: 'Name', 
        sortable: true,
        sortValue: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
      }
    ];
  }
  
  const baseColumns = [
    { 
      key: 'name', 
      label: 'Name', 
      sortable: true,
      sortValue: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      minWidth: '180px'
    },
  ];
  
  // Always include Organization column
  baseColumns.push({ key: 'organization', label: 'Organization', sortable: false, minWidth: '180px' });
  
  // Append fields from module definition
  const systemFieldKeys = new Set(['organizationid','createdat','updatedat','_id','__v','activitylogs','name','organization']);
  for (const field of moduleDefinition.value.fields || []) {
    const keyLower = field.key?.toLowerCase();
    if (!keyLower || systemFieldKeys.has(keyLower) || field.visibility?.list === false) continue;
        let minWidth = '120px';
    if (['Email', 'Phone', 'URL'].includes(field.dataType)) minWidth = '180px';
    else if (['Text-Area', 'Rich Text'].includes(field.dataType)) minWidth = '250px';
    else if (['Date', 'Date-Time'].includes(field.dataType)) minWidth = '140px';
    else if (['Picklist', 'Multi-Picklist'].includes(field.dataType)) minWidth = '150px';
    baseColumns.push({
          key: field.key,
          label: field.label || field.key,
      sortable: !['Multi-Picklist','Text-Area','Rich Text','Formula','Rollup Summary'].includes(field.dataType),
          dataType: field.dataType,
      options: field.options || [],
          minWidth
        });
      }
  
  return baseColumns;
});

// Picklist fields for dynamic cell rendering
const picklistFields = computed(() => {
  if (!moduleDefinition.value?.fields) return [];
  return moduleDefinition.value.fields.filter(f => 
    (f.dataType === 'Picklist' || f.dataType === 'Multi-Picklist') && 
    f.visibility?.list !== false
  );
});

// Event handlers
const handleRowClick = (row, event) => {
  viewContact(row._id, event);
};

const handleDelete = (row) => {
  deleteContact(row._id);
};

const handlePageChange = (page) => {
  pagination.value.currentPage = page;
  fetchContacts();
};

const handleSort = ({ key, order }) => {
  // Map frontend column keys to backend sort fields
  const sortMap = {
    'name': 'first_name', // Sort by first name when name column is clicked
    'email': 'email',
    'phone': 'phone',
    'account_id': 'account_id',
    'lifecycle_stage': 'lifecycle_stage',
    'owner_id': 'owner_id',
    'last_contacted_at': 'last_contacted_at'
  };
  
  // If key is empty, reset to default sort
  if (!key) {
    sortField.value = 'createdAt';
    sortOrder.value = 'desc';
  } else {
    sortField.value = sortMap[key] || key;
    sortOrder.value = order;
  }
  
  fetchContacts();
};

const handleSelect = (selected) => {
  selectedContacts.value = selected.map(row => row._id);
};

const handleBulkAction = (actionId, selectedRows) => {
  if (actionId === 'delete') {
    bulkDelete();
  } else if (actionId === 'export') {
    bulkExport();
  }
};

const statistics = ref({
  totalContacts: 0,
  leadContacts: 0,
  customerContacts: 0,
  activeThisMonth: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Computed

// Methods
const fetchContacts = async () => {
  loading.value = true;
  console.log('🔍 Fetching people...');
  console.log('👤 Is Admin:', isAdmin.value);
  
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage);
    params.append('limit', pagination.value.limit);
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filters.lifecycle_stage) params.append('lifecycle_stage', filters.lifecycle_stage);
    if (filters.status) params.append('status', filters.status);
    if (filters.owner_id === 'me') params.append('owner', 'me');

    // Admins/Owners see ALL contacts across organizations
    const endpoint = isAdmin.value
      ? `/admin/contacts/all?${params.toString()}`
      : `/people?${params.toString()}`;

    console.log('🌐 API Endpoint:', endpoint);

    const data = await apiClient(endpoint, {
      method: 'GET'
    });

    console.log('📦 People data:', data);
    
    if (data.success) {
      contacts.value = data.data;
      // Handle both 'pagination' and 'meta' response formats
      if (data.pagination) {
        pagination.value = data.pagination;
      } else if (data.meta) {
        pagination.value = {
          currentPage: data.meta.page || 1,
          totalPages: Math.ceil((data.meta.total || 0) / (data.meta.limit || 20)),
          totalContacts: data.meta.total || 0,
          limit: data.meta.limit || 20
        };
      }
      statistics.value = data.statistics || statistics.value;
      console.log(`✅ Loaded ${data.data.length} contacts`);
      
      // Debug: Check organization field in contacts
      if (data.data.length > 0) {
        console.log('🔍 Checking organization data in contacts...');
        data.data.forEach((contact, idx) => {
          if (idx < 3) { // Log first 3 contacts
            console.log(`Contact ${idx + 1}:`, {
              name: `${contact.first_name} ${contact.last_name}`,
              organization: contact.organization,
              orgType: typeof contact.organization,
              orgIsNull: contact.organization === null,
              orgIsUndefined: contact.organization === undefined,
              orgName: contact.organization?.name,
              orgId: contact.organization?._id,
              fullOrg: JSON.stringify(contact.organization)
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchContacts();
  }, 500);
};

// Handle search query update
const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  debouncedSearch();
};

const viewContact = (contactId, event = null) => {
  // Get contact details for tab title
  const contact = contacts.value.find(c => c._id === contactId);
  const title = contact 
    ? `${contact.first_name} ${contact.last_name}` 
    : 'Person Detail';
  
  // Check if user wants to open in background
  // Middle click (button 1) OR Cmd/Ctrl + click
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(`/people/${contactId}`, {
    title,
    icon: 'users',
    params: { name: title },
    background: openInBackground
  });
};

const openCreateModal = () => {
  editingContact.value = null;
  showFormModal.value = true;
};

const editContact = (contact) => {
  editingContact.value = contact;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingContact.value = null;
};

const handleContactSaved = () => {
  closeFormModal();
  fetchContacts();
};

const handleImportComplete = () => {
  showImportModal.value = false;
  fetchContacts();
};

const deleteContact = async (contactId) => {
  if (!confirm('Are you sure you want to delete this contact?')) return;
  
  try {
    await apiClient(`/people/${contactId}`, {
      method: 'DELETE'
    });
    fetchContacts();
  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Failed to delete contact');
  }
};


const bulkDelete = async () => {
  if (!confirm(`Are you sure you want to delete ${selectedContacts.value.length} contact(s)?`)) return;
  
  try {
    for (const id of selectedContacts.value) {
      await apiClient(`/people/${id}`, { method: 'DELETE' });
    }
    selectedContacts.value = [];
    fetchContacts();
  } catch (error) {
    console.error('Error bulk deleting contacts:', error);
    alert('Failed to delete contacts');
  }
};

const bulkExport = () => {
  const selectedData = contacts.value.filter(c => selectedContacts.value.includes(c._id));
  exportToCSV(selectedData);
};

const exportContacts = async () => {
  try {
    // Use backend CSV export endpoint
    const response = await fetch('/api/csv/export/contacts', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting contacts:', error);
    alert('Error exporting contacts. Please try again.');
  }
};

const exportToCSV = (data) => {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Job Title', 'Stage', 'Status'];
  const rows = data.map(c => [
    c.first_name,
    c.last_name,
    c.email,
    c.phone || c.mobile || '',
    c.account_id?.name || '',
    c.job_title || '',
    c.lifecycle_stage,
    c.status
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts_${new Date().toISOString()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csv = e.target.result;
    // TODO: Parse CSV and import contacts
    console.log('CSV content:', csv);
    alert('Import functionality coming soon!');
    showImportModal.value = false;
  };
  reader.readAsText(file);
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.lifecycle_stage = '';
  filters.status = '';
  filters.owner_id = '';
  fetchContacts();
};

// Column settings functions
const resetColumnSettings = () => {
  // Reset to default column configuration
  visibleColumns.value = visibleColumns.value.map(col => ({ ...col, visible: true }));
};

const applyColumnSettings = () => {
  // Apply column settings
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

const getInitials = (contact) => {
  return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
};

const getUserInitials = (user) => {
  if (!user) return 'U';
  const firstInitial = user.firstName?.[0] || '';
  const lastInitial = user.lastName?.[0] || '';
  return `${firstInitial}${lastInitial}`.toUpperCase() || 'U';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unassigned';
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || user.email || 'Unassigned';
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
  
  // Load saved sort state from localStorage before fetching
  const savedSort = localStorage.getItem('datatable-contacts-table-sort');
  if (savedSort) {
    try {
      const { by, order } = JSON.parse(savedSort);
      
      // Map frontend column keys to backend sort fields
      const sortMap = {
        'name': 'first_name',
        'email': 'email',
        'phone': 'phone',
        'account_id': 'account_id',
        'lifecycle_stage': 'lifecycle_stage',
        'owner_id': 'owner_id',
        'last_contacted_at': 'last_contacted_at'
      };
      
      sortField.value = sortMap[by] || by;
      sortOrder.value = order;
      console.log('Loaded saved sort in Contacts:', { by, order, mapped: sortField.value });
    } catch (e) {
      console.error('Failed to parse saved sort:', e);
    }
  }
  
  fetchContacts();
});

// Watch for route query changes (for refresh)
watch(() => route.query.refresh, () => {
  if (route.query.refresh) {
    fetchContacts();
  }
});
</script>

