<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Import History</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">View and manage all data imports</p>
      </div>
      <div class="flex gap-4">
        <button v-if="canCreateImport" @click="showImportModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          New Import
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalImports || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Imports</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalRecordsCreated || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Records Created</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalRecordsUpdated || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Records Updated</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalErrors || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Errors</p>
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
            placeholder="Search by filename..."
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 flex-1">
        <select v-model="filters.module" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Modules</option>
          <option value="contacts">Contacts</option>
          <option value="deals">Deals</option>
          <option value="tasks">Tasks</option>
          <option value="organizations">Organizations</option>
        </select>

        <select v-model="filters.status" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
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

    <!-- Import History List -->
    <DataTable
      :data="filteredImports"
      :columns="columns"
      :loading="loading"
      :paginated="true"
      :per-page="pagination.limit"
      :total-records="pagination.total"
      :show-controls="false"
      :selectable="true"
      :resizable="true"
      :column-settings="false"
      table-id="imports-table"
      row-key="_id"
      empty-title="No imports yet"
      empty-message="Start importing data to see history here"
      @row-click="viewImport"
      @page-change="changePage"
    >
      <!-- Custom File Name Cell -->
      <template #cell-fileName="{ value }">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="font-medium">{{ value }}</span>
        </div>
      </template>

      <!-- Custom Module Cell with Badge -->
      <template #cell-module="{ value }">
        <BadgeCell 
          :value="formatModule(value)" 
          :variant-map="{
            'Contacts': 'primary',
            'Deals': 'success',
            'Tasks': 'warning',
            'Organizations': 'info'
          }"
        />
      </template>

      <!-- Custom Imported By Cell -->
      <template #cell-importedBy="{ row }">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
            {{ (row.importedBy?.firstName?.[0] || '') + (row.importedBy?.lastName?.[0] || '') }}
          </div>
          <span>{{ row.importedBy?.firstName }} {{ row.importedBy?.lastName }}</span>
        </div>
      </template>

      <!-- Custom Date Cell -->
      <template #cell-createdAt="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ formatDate(value) }}</span>
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="formatStatus(value)" 
          :variant-map="{
            'Completed': 'success',
            'Partial': 'warning',
            'Failed': 'danger',
            'Processing': 'info'
          }"
        />
      </template>

      <!-- Custom Stats Cell -->
      <template #cell-stats="{ row }">
        <div class="text-sm space-y-0.5">
          <div v-if="row.stats.created > 0" class="text-green-600 dark:text-green-400">
            ✓ {{ row.stats.created }} created
          </div>
          <div v-if="row.stats.updated > 0" class="text-blue-600 dark:text-blue-400">
            ↻ {{ row.stats.updated }} updated
          </div>
          <div v-if="row.stats.skipped > 0" class="text-gray-600 dark:text-gray-400">
            ⊘ {{ row.stats.skipped }} skipped
          </div>
          <div v-if="row.stats.failed > 0" class="text-red-600 dark:text-red-400">
            ✕ {{ row.stats.failed }} failed
          </div>
        </div>
      </template>

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <button 
          @click.stop="viewImport(row)" 
          class="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-105"
        >
          View Details
        </button>
      </template>
    </DataTable>

    <!-- Universal Import Modal -->
    <UniversalImportModal 
      v-if="showImportModal"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />

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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTabs } from '@/composables/useTabs';
import apiClient from '../utils/apiClient';
import DataTable from '../components/common/DataTable.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import UniversalImportModal from '../components/import/UniversalImportModal.vue';

// Router and auth
const router = useRouter();
const authStore = useAuthStore();

// Use tabs composable
const { openTab } = useTabs();

// Permission checks
const canCreateImport = computed(() => authStore.hasPermission('imports', 'create'));
const canDeleteImport = computed(() => authStore.hasPermission('imports', 'delete'));

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.module || '') !== '' || 
         (filters?.status || '') !== '';
});

// State
const imports = ref([]);
const loading = ref(false);
const showImportModal = ref(false);
const showColumnSettings = ref(false);
const searchQuery = ref('');

const filters = reactive({
  module: '',
  status: ''
});

// Column settings state
const visibleColumns = ref([
  { key: 'fileName', label: 'File Name', visible: true },
  { key: 'module', label: 'Module', visible: true },
  { key: 'importedBy', label: 'Imported By', visible: true },
  { key: 'createdAt', label: 'Date', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'stats', label: 'Records', visible: true }
]);

// Column definitions
const columns = computed(() => {
  const allColumns = [
    { key: 'fileName', label: 'File Name', sortable: true },
    { key: 'module', label: 'Module', sortable: true },
    { key: 'importedBy', label: 'Imported By', sortable: true },
    { key: 'createdAt', label: 'Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'stats', label: 'Records', sortable: false }
  ];
  
  // Filter and order columns based on visibleColumns settings
  const orderedColumns = [];
  
  // Add columns in the order specified by visibleColumns
  visibleColumns.value.forEach(visibleCol => {
    if (visibleCol.visible) {
      const column = allColumns.find(col => col.key === visibleCol.key);
      if (column) {
        orderedColumns.push(column);
      }
    }
  });
  
  return orderedColumns;
});

// Filtered imports (client-side filtering for search)
const filteredImports = computed(() => {
  let result = imports.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(imp => 
      imp.fileName.toLowerCase().includes(query)
    );
  }
  
  return result;
});

const stats = reactive({
  totalImports: 0,
  recentImports: 0,
  totalRecordsCreated: 0,
  totalRecordsUpdated: 0,
  totalErrors: 0,
  avgProcessingTime: 0
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  total: 0,
  limit: 20
});

// Fetch imports
const fetchImports = async () => {
  try {
    loading.value = true;
    const response = await apiClient.get('/imports', {
      params: {
        module: filters.module,
        status: filters.status,
        page: pagination.currentPage,
        limit: pagination.limit
      }
    });
    
    if (response.success) {
      imports.value = response.data;
      Object.assign(pagination, response.pagination);
    }
  } catch (error) {
    console.error('Error fetching imports:', error);
  } finally {
    loading.value = false;
  }
};

// Fetch statistics
const fetchStats = async () => {
  try {
    const response = await apiClient.get('/imports/stats/summary');
    if (response.success) {
      Object.assign(stats, response.data);
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};

// View import details
const viewImport = (importRecord, event = null) => {
  const title = `Import: ${importRecord.fileName || 'Unknown'}`;
  
  // Check if user wants to open in background
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(`/imports/${importRecord._id}`, {
    title,
    icon: 'download',
    params: { fileName: importRecord.fileName },
    background: openInBackground
  });
};

// Handle import complete
const handleImportComplete = () => {
  showImportModal.value = false;
  fetchImports();
  fetchStats();
};

// Pagination
const changePage = (page) => {
  pagination.currentPage = page;
  fetchImports();
};

// Format helpers
const formatModule = (module) => {
  return module.charAt(0).toUpperCase() + module.slice(1);
};

const formatStatus = (status) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const getStatusClass = (status) => {
  const classes = {
    completed: 'badge badge-success',
    partial: 'badge badge-warning',
    failed: 'badge badge-danger',
    processing: 'badge badge-info'
  };
  return classes[status] || 'badge';
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

// Watch filters
watch([() => filters.module, () => filters.status], () => {
  pagination.currentPage = 1;
  fetchImports();
});

// Initialize
onMounted(() => {
  fetchImports();
  fetchStats();
});
</script>

