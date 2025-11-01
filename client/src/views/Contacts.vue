<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">People</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">Manage your customer relationships</p>
      </div>
      <ModuleActions 
        module="contacts"
        create-label="New Contact"
        @create="openCreateModal"
        @import="showImportModal = true"
        @export="exportContacts"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.totalContacts || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total People</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.leadContacts || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Leads</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.customerContacts || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Customers</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.activeThisMonth || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active This Month</p>
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
            placeholder="Search contacts..."
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 flex-1">
        <select v-model="filters.lifecycle_stage" @change="fetchContacts" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Stages</option>
          <option value="Lead">Lead</option>
          <option value="Qualified">Qualified</option>
          <option value="Opportunity">Opportunity</option>
          <option value="Customer">Customer</option>
          <option value="Lost">Lost</option>
        </select>

        <select v-model="filters.status" @change="fetchContacts" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Archived">Archived</option>
        </select>

        <select v-model="filters.owner_id" @change="fetchContacts" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Owners</option>
          <option value="me">My Contacts</option>
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

    <!-- Contacts Table -->
    <DataTable
      :data="contacts"
      :columns="tableColumns"
      :loading="loading"
      :paginated="true"
      :per-page="20"
      :total-records="pagination.totalContacts"
      :selectable="true"
      :resizable="true"
      :column-settings="false"
      :server-side="true"
      table-id="contacts-table"
      :mass-actions="massActions"
      :show-controls="false"
      row-key="_id"
      empty-title="No people yet"
      empty-message="Start building your network by adding your first person"
      @row-click="handleRowClick"
      @edit="editContact"
      @delete="handleDelete"
      @page-change="handlePageChange"
      @sort="handleSort"
      @select="handleSelect"
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

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <RowActions 
          :row="row"
          module="contacts"
          @view="viewContact(row._id)"
          @edit="editContact(row)"
          @delete="deleteContact(row._id)"
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

    <!-- Create/Edit Modal -->
    <ContactFormModal 
      v-if="showFormModal"
      :contact="editingContact"
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
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import ContactFormModal from '@/components/contacts/ContactFormModal.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';

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
const showColumnSettings = ref(false);
const moduleDefinition = ref(null);

// Column settings state - will be populated from module definition
const visibleColumns = ref([]);

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
  
  const fields = module.fields || [];
  const systemFieldKeys = ['createdby', 'organizationid', 'createdat', 'updatedat', '_id', '__v'];
  
  // Filter out system fields and build visible columns
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
  
  // Always include 'name' column at the beginning
  const nameColumn = { key: 'name', label: 'Name', visible: true, sortable: true };
  const initialColumns = [nameColumn];
  
  // Add organization column (always visible)
  initialColumns.push({ key: 'organization', label: 'Organization', visible: true, sortable: false });
  
  // Merge with module columns, avoiding duplicates
  const existingKeys = new Set(initialColumns.map(c => c.key.toLowerCase()));
  moduleColumns.forEach(col => {
    if (!existingKeys.has(col.key.toLowerCase())) {
      initialColumns.push(col);
      existingKeys.add(col.key.toLowerCase());
    }
  });
  
  visibleColumns.value = initialColumns;
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
      sortValue: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
    },
  ];
  
  // Add organization column if it's in visibleColumns and visible
  const orgColumn = visibleColumns.value.find(col => col.key === 'organization' && col.visible);
  if (orgColumn) {
    baseColumns.push({ 
      key: 'organization', 
      label: 'Organization', 
      sortable: false 
    });
  }
  
  // Build columns from visibleColumns, respecting order
  const orderedColumns = [];
  visibleColumns.value.forEach(visibleCol => {
    if (visibleCol.visible && visibleCol.key !== 'name' && visibleCol.key !== 'organization') {
      const field = moduleDefinition.value.fields?.find(f => 
        f.key?.toLowerCase() === visibleCol.key?.toLowerCase()
      );
      
      if (field) {
        orderedColumns.push({
          key: field.key,
          label: field.label || field.key,
          sortable: visibleCol.sortable !== false && !['Multi-Picklist', 'Text-Area', 'Rich Text', 'Formula', 'Rollup Summary'].includes(field.dataType),
          dataType: field.dataType
        });
      }
    }
  });
  
  baseColumns.push(...orderedColumns);
  
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

