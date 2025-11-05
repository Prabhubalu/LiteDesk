<template>
  <div class="mx-auto">
    <ListView
      title="Import History"
      description="View and manage all data imports"
      module-key="imports"
      create-label="New Import"
      search-placeholder="Search by filename..."
      :data="filteredImports"
      :columns="columns"
      :loading="loading"
      :statistics="stats"
      :stats-config="[
        { name: 'Total Imports', key: 'totalImports', formatter: 'number' },
        { name: 'Records Created', key: 'totalRecordsCreated', formatter: 'number' },
        { name: 'Records Updated', key: 'totalRecordsUpdated', formatter: 'number' },
        { name: 'Total Errors', key: 'totalErrors', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.total, limit: pagination.limit }"
      :filter-config="[
        {
          key: 'module',
          label: 'All Modules',
          options: [
            { value: 'contacts', label: 'Contacts' },
            { value: 'deals', label: 'Deals' },
            { value: 'tasks', label: 'Tasks' },
            { value: 'organizations', label: 'Organizations' }
          ]
        },
        {
          key: 'status',
          label: 'All Statuses',
          options: [
            { value: 'completed', label: 'Completed' },
            { value: 'partial', label: 'Partial' },
            { value: 'failed', label: 'Failed' },
            { value: 'processing', label: 'Processing' }
          ]
        }
      ]"
      table-id="imports-table"
      row-key="_id"
      empty-title="No imports yet"
      empty-message="Start importing data to see history here"
      :show-import="false"
      :show-export="false"
      @create="showImportModal = true"
      @update:searchQuery="(q) => { searchQuery.value = q; }"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.limit = p.limit || pagination.limit; fetchImports(); }"
      @fetch="fetchImports"
      @row-click="viewImport"
    >
      <template #header-actions>
        <button v-if="canCreateImport" @click="showImportModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          New Import
        </button>
      </template>
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
    </ListView>

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
import { useTabs } from '@/composables/useTabs';
import apiClient from '../utils/apiClient';
import ListView from '@/components/common/ListView.vue';
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
const columns = computed(() => {
  return [
    { key: 'fileName', label: 'File Name', sortable: true },
    { key: 'module', label: 'Module', sortable: true },
    { key: 'importedBy', label: 'Imported By', sortable: true },
    { key: 'createdAt', label: 'Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'stats', label: 'Records', sortable: false }
  ];
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

// Pagination handled by ListView component

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

// Column settings handled by ListView component

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

