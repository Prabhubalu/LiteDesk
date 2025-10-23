<template>
  <div class="page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Import History</h1>
        <p class="page-subtitle">View and manage all data imports</p>
      </div>
      <div class="flex gap-4">
        <button v-if="canCreateImport" @click="showImportModal = true" class="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          New Import
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-brand-500 to-brand-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ stats.totalImports || 0 }}</p>
          <p class="stat-label">Total Imports</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ stats.totalRecordsCreated || 0 }}</p>
          <p class="stat-label">Records Created</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ stats.totalRecordsUpdated || 0 }}</p>
          <p class="stat-label">Records Updated</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-warning-500 to-warning-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ stats.totalErrors || 0 }}</p>
          <p class="stat-label">Total Errors</p>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Module</label>
          <select v-model="filters.module" class="input-field">
            <option value="">All Modules</option>
            <option value="contacts">Contacts</option>
            <option value="deals">Deals</option>
            <option value="tasks">Tasks</option>
            <option value="organizations">Organizations</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
          <select v-model="filters.status" class="input-field">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="processing">Processing</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Search by filename..."
            class="input-field"
          />
        </div>
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
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-medium">
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
          <div v-if="row.stats.created > 0" class="text-success-600 dark:text-success-400">
            ✓ {{ row.stats.created }} created
          </div>
          <div v-if="row.stats.updated > 0" class="text-blue-600 dark:text-blue-400">
            ↻ {{ row.stats.updated }} updated
          </div>
          <div v-if="row.stats.skipped > 0" class="text-gray-600 dark:text-gray-400">
            ⊘ {{ row.stats.skipped }} skipped
          </div>
          <div v-if="row.stats.failed > 0" class="text-danger-600 dark:text-danger-400">
            ✕ {{ row.stats.failed }} failed
          </div>
        </div>
      </template>

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <button 
          @click.stop="viewImport(row)" 
          class="px-3 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all hover:scale-105"
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import apiClient from '../utils/apiClient';
import DataTable from '../components/common/DataTable.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import UniversalImportModal from '../components/import/UniversalImportModal.vue';

// Router and auth
const router = useRouter();
const authStore = useAuthStore();

// Permission checks
const canCreateImport = computed(() => authStore.hasPermission('imports', 'create'));
const canDeleteImport = computed(() => authStore.hasPermission('imports', 'delete'));

// State
const imports = ref([]);
const loading = ref(false);
const showImportModal = ref(false);
const searchQuery = ref('');

const filters = reactive({
  module: '',
  status: ''
});

// Column definitions
const columns = [
  { key: 'fileName', label: 'File Name', sortable: true },
  { key: 'module', label: 'Module', sortable: true },
  { key: 'importedBy', label: 'Imported By', sortable: false },
  { key: 'createdAt', label: 'Date', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'stats', label: 'Records', sortable: false }
];

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
const viewImport = (importRecord) => {
  router.push(`/imports/${importRecord._id}`);
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

