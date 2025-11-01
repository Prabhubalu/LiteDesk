<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Organizations</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">Manage all customer organizations</p>
      </div>
      <ModuleActions 
        module="organizations"
        create-label="New Organization"
        :show-import="false"
        @create="openCreateModal"
        @export="exportOrganizations"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.totalOrganizations || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Organizations</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.activeOrganizations || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.trialOrganizations || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">On Trial</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.paidOrganizations || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Paying Customers</p>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col lg:flex-row gap-4 mb-6">
      <div class="w-full lg:w-80">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search organizations..."
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 flex-1">
        <select v-model="filters.industry" @change="fetchOrganizations" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Industries</option>
          <option value="Technology">Technology</option>
          <option value="Finance">Finance</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Education">Education</option>
          <option value="Retail">Retail</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Other">Other</option>
        </select>

        <select v-model="filters.tier" @change="fetchOrganizations" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Tiers</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select v-model="filters.status" @change="fetchOrganizations" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button 
          @click="clearFilters" 
          :disabled="!hasActiveFilters"
          class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      </div>

      <!-- Columns Button -->
      <div class="flex items-center">
        <button
          @click="showColumnSettings = !showColumnSettings"
          class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
          title="Column Settings"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span>Columns</span>
        </button>
      </div>
    </div>

    <!-- Organizations Table -->
    <DataTable
      :data="organizations"
      :columns="columns"
      :loading="loading"
      :paginated="true"
      :per-page="pagination.limit"
      :total-records="pagination.totalOrganizations"
      :show-controls="false"
      :selectable="true"
      :resizable="true"
      :column-settings="false"
      :server-side="true"
      table-id="organizations-table"
      :mass-actions="massActions"
      row-key="_id"
      empty-title="No organizations found"
      empty-message="Get started by creating your first organization"
      @select="handleSelect"
      @bulk-action="handleBulkAction"
      @row-click="handleRowClick"
      @edit="editOrganization"
      @delete="handleDelete"
      @page-change="changePage"
      @sort="handleSort"
    >
      <!-- Custom Organization Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {{ getInitials(row.name) }}
          </div>
          <span class="font-semibold text-gray-900 dark:text-white">{{ row.name }}</span>
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

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <RowActions 
          :row="row"
          module="organizations"
          @view="viewOrganization(row._id)"
          @edit="editOrganization(row)"
          @delete="deleteOrganization(row._id)"
        />
      </template>
    </DataTable>

    <!-- Column Settings Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showColumnSettings"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showColumnSettings = false"
        >
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Column Settings</h3>
              <button
                @click="showColumnSettings = false"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="flex-1 overflow-y-auto p-6">
              <div class="space-y-4">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose which columns to display in the table. You can drag to reorder them.
                </p>
                
                <div class="space-y-3">
                  <div 
                    v-for="(column, index) in visibleColumns" 
                    :key="column.key"
                    :draggable="true"
                    @dragstart="handleDragStart($event, index)"
                    @dragover="handleDragOver"
                    @dragenter="handleDragEnter"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop($event, index)"
                    @dragend="handleDragEnd"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors drag-over:bg-blue-50 dark:drag-over:bg-blue-900/20"
                  >
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5 text-gray-400 cursor-move" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                      </svg>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ column.label }}</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        :checked="column.visible"
                        @change="toggleColumnVisibility(column.key)"
                        class="sr-only peer"
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="resetColumnSettings"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Reset to Default
              </button>
              <div class="flex items-center gap-3">
                <button
                  @click="showColumnSettings = false"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="applyColumnSettings"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Organization Form Modal -->
    <OrganizationFormModal
      v-if="showFormModal"
      :organization="editingOrganization"
      @close="closeFormModal"
      @saved="handleOrganizationSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useBulkActions } from '@/composables/useBulkActions';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
import OrganizationFormModal from '@/components/organizations/OrganizationFormModal.vue';

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
const showColumnSettings = ref(false);
const moduleDefinition = ref(null);

// Column settings state - will be populated from module definition
const visibleColumns = ref([]);

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
  
  const fields = module.fields || [];
  const systemFieldKeys = ['createdby', 'organizationid', 'createdat', 'updatedat', '_id', '__v'];
  
  // Special columns that should always be included
  const specialColumns = [
    { key: 'name', label: 'Organization', visible: true, sortable: true },
    { key: 'contactCount', label: 'Contacts', visible: true, sortable: true },
    { key: 'createdAt', label: 'Created', visible: true, sortable: true }
  ];
  
  // Filter out system fields and build visible columns from module
  const moduleColumns = fields
    .filter(field => {
      const key = field.key?.toLowerCase();
      return key && !systemFieldKeys.includes(key) && field.visibility?.list !== false;
    })
    .map(field => ({
      key: field.key,
      label: field.label || field.key,
      visible: true,
      dataType: field.dataType,
      sortable: !['Multi-Picklist', 'Text-Area', 'Rich Text', 'Formula', 'Rollup Summary'].includes(field.dataType)
    }));
  
  // Merge special columns with module columns
  const initialColumns = [...specialColumns];
  const existingKeys = new Set(specialColumns.map(c => c.key.toLowerCase()));
  
  moduleColumns.forEach(col => {
    if (!existingKeys.has(col.key.toLowerCase())) {
      initialColumns.push(col);
      existingKeys.add(col.key.toLowerCase());
    }
  });
  
  visibleColumns.value = initialColumns;
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
  
  // Build columns from visibleColumns, respecting order
  const orderedColumns = [];
  visibleColumns.value.forEach(visibleCol => {
    if (visibleCol.visible) {
      // Handle special columns
      if (visibleCol.key === 'name' || visibleCol.key === 'contactCount' || visibleCol.key === 'createdAt') {
        const minWidth = visibleCol.key === 'name' ? '200px' : '120px';
        orderedColumns.push({
          key: visibleCol.key,
          label: visibleCol.label,
          sortable: visibleCol.sortable !== false,
          minWidth
        });
      } else {
        // Regular module fields
        const field = moduleDefinition.value.fields?.find(f => 
          f.key?.toLowerCase() === visibleCol.key?.toLowerCase()
        );
        
        if (field) {
          // Determine minWidth based on data type
          let minWidth = '120px';
          if (['Email', 'Phone', 'URL'].includes(field.dataType)) {
            minWidth = '180px';
          } else if (['Text-Area', 'Rich Text'].includes(field.dataType)) {
            minWidth = '250px';
          } else if (['Currency', 'Integer', 'Decimal'].includes(field.dataType)) {
            minWidth = '120px';
          } else if (['Date', 'Date-Time'].includes(field.dataType)) {
            minWidth = '140px';
          } else if (['Picklist', 'Multi-Picklist'].includes(field.dataType)) {
            minWidth = '150px';
          }
          
          orderedColumns.push({
            key: field.key,
            label: field.label || field.key,
            sortable: visibleCol.sortable !== false && !['Multi-Picklist', 'Text-Area', 'Rich Text', 'Formula', 'Rollup Summary'].includes(field.dataType),
            dataType: field.dataType,
            minWidth
          });
        }
      }
    }
  });
  
  return orderedColumns;
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
    
    if (data.success) {
      organizations.value = data.data;
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
  if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) return;
  
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

const handleBulkAction = async ({ action, selectedRows }) => {
  const orgIds = selectedRows.map(org => org._id);
  
  try {
    if (action === 'bulk-delete') {
      if (!confirm(`Delete ${selectedRows.length} organizations? This action cannot be undone.`)) return;
      
      await Promise.all(orgIds.map(id => 
        apiClient(`/admin/organizations/${id}`, { method: 'DELETE' })
      ));
      fetchOrganizations();
      
    } else if (action === 'bulk-export') {
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

// Watch for route query changes (for refresh)
watch(() => route.query.refresh, () => {
  if (route.query.refresh) {
    fetchOrganizations();
  }
});
</script>


