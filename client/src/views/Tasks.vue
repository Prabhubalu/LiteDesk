<template>
  <div class="page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="page-subtitle">Manage your tasks and to-dos</p>
      </div>
      <div class="flex gap-4">
        <button @click="showImportModal = true" class="btn-secondary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import
        </button>
        <button @click="exportTasks" class="btn-secondary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Export
        </button>
        <button @click="openCreateModal" class="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-brand-500 to-brand-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.total || 0 }}</p>
          <p class="stat-label">Total Tasks</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-warning-500 to-warning-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.overdue || 0 }}</p>
          <p class="stat-label">Overdue</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.dueToday || 0 }}</p>
          <p class="stat-label">Due Today</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="stat-value">{{ statistics.byStatus?.completed || 0 }}</p>
          <p class="stat-label">Completed</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="card-body">
        <!-- Search Bar -->
        <div class="relative mb-4">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search tasks..."
            @input="debouncedSearch"
            class="input pl-10"
          />
        </div>

        <!-- Filter Row -->
        <div class="flex flex-wrap gap-3">
          <select v-model="filters.status" @change="fetchTasks" class="input flex-1 min-w-[150px]">
            <option value="">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select v-model="filters.priority" @change="fetchTasks" class="input flex-1 min-w-[150px]">
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select v-model="filters.assignedTo" @change="fetchTasks" class="input flex-1 min-w-[150px]">
            <option value="">All Assignees</option>
            <option value="me">My Tasks</option>
          </select>

          <button v-if="filters.status || filters.priority || filters.assignedTo" @click="clearFilters" class="btn-secondary flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Tasks Table -->
    <DataTable
      :data="tasks"
      :columns="columns"
      :loading="loading"
      :paginated="true"
      :per-page="20"
      :total-records="pagination.totalTasks"
      :show-controls="false"
      :selectable="true"
      :resizable="true"
      :column-settings="true"
      :server-side="true"
      table-id="tasks-table"
      :mass-actions="massActions"
      row-key="_id"
      empty-title="No tasks yet"
      empty-message="Create your first task to get started"
      @select="handleSelect"
      @bulk-action="handleBulkAction"
      @row-click="openDetailModal"
      @edit="openEditModal"
      @delete="handleDelete"
      @page-change="handlePageChange"
      @sort="handleSort"
    >
      <!-- Custom Title Cell with checkbox -->
      <template #cell-title="{ row }">
        <div class="flex items-center gap-3">
          <input 
            type="checkbox" 
            :checked="row.status === 'completed'"
            @click.stop="toggleTaskStatus(row)"
            class="w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
          />
          <span :class="['font-semibold', row.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white']">
            {{ row.title }}
          </span>
        </div>
      </template>

      <!-- Custom Priority Cell with Badge -->
      <template #cell-priority="{ value }">
        <BadgeCell 
          :value="value.charAt(0).toUpperCase() + value.slice(1)" 
          :variant-map="{
            'Urgent': 'danger',
            'High': 'warning',
            'Medium': 'info',
            'Low': 'default'
          }"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="formatStatus(value)" 
          :variant-map="{
            'To Do': 'default',
            'In Progress': 'info',
            'Waiting': 'warning',
            'Completed': 'success',
            'Cancelled': 'danger'
          }"
        />
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-medium">
            {{ row.assignedTo.firstName?.[0] || '?' }}{{ row.assignedTo.lastName?.[0] || '' }}
          </div>
          <span class="text-sm text-gray-900 dark:text-white">{{ row.assignedTo.firstName }} {{ row.assignedTo.lastName }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Due Date Cell with highlighting -->
      <template #cell-dueDate="{ row }">
        <span v-if="row.dueDate" :class="[
          'text-sm font-medium',
          isOverdue(row.dueDate) && row.status !== 'completed' ? 'text-danger-600 dark:text-danger-400' :
          isDueToday(row.dueDate) && row.status !== 'completed' ? 'text-warning-600 dark:text-warning-400' :
          'text-gray-700 dark:text-gray-300'
        ]">
          <DateCell :value="row.dueDate" format="short" />
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">No due date</span>
      </template>

      <!-- Custom Tags Cell -->
      <template #cell-tags="{ value }">
        <div v-if="value && value.length > 0" class="flex flex-wrap gap-1">
          <span 
            v-for="tag in value.slice(0, 2)" 
            :key="tag"
            class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
          >
            {{ tag }}
          </span>
          <span v-if="value.length > 2" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
            +{{ value.length - 2 }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <button 
          @click.stop="openDetailModal(row)" 
          class="p-2 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all hover:scale-110" 
          title="View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button 
          @click.stop="openEditModal(row)" 
          class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all hover:scale-110" 
          title="Edit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button 
          @click.stop="deleteTask(row._id)" 
          class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all hover:scale-110" 
          title="Delete"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </template>
    </DataTable>

    <!-- Task Form Modal -->
    <TaskFormModal 
      v-if="showFormModal"
      :task="editingTask"
      @close="closeFormModal"
      @save="handleTaskSave"
    />

    <!-- Task Detail Modal -->
    <TaskDetailModal 
      v-if="showDetailModal"
      :task="selectedTask"
      @close="closeDetailModal"
      @edit="handleEdit"
      @delete="handleDelete"
      @statusChange="handleStatusChange"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Tasks"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../utils/apiClient';
import DataTable from '../components/common/DataTable.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import DateCell from '../components/common/table/DateCell.vue';
import TaskFormModal from '../components/tasks/TaskFormModal.vue';
import TaskDetailModal from '../components/tasks/TaskDetailModal.vue';
import CSVImportModal from '../components/import/CSVImportModal.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// State
const tasks = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showFormModal = ref(false);
const showDetailModal = ref(false);
const showImportModal = ref(false);
const editingTask = ref(null);
const selectedTask = ref(null);

const filters = reactive({
  status: '',
  priority: '',
  assignedTo: ''
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalTasks: 0,
  tasksPerPage: 20
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

const statistics = reactive({
  total: 0,
  overdue: 0,
  dueToday: 0,
  byStatus: {},
  byPriority: {}
});

// Mass Actions
const massActions = [
  { label: 'Mark Complete', icon: 'edit', action: 'bulk-complete', variant: 'success' },
  { label: 'Delete', icon: 'trash', action: 'bulk-delete', variant: 'danger' },
  { label: 'Export', icon: 'export', action: 'bulk-export' }
];

// Column definitions
const columns = [
  { key: 'title', label: 'Task', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { 
    key: 'assignedTo', 
    label: 'Assigned To', 
    sortable: false,  // Server doesn't support sorting by populated field
    sortValue: (row) => {
      if (!row.assignedTo) return '';
      return `${row.assignedTo.firstName || ''} ${row.assignedTo.lastName || ''}`.trim();
    }
  },
  { key: 'dueDate', label: 'Due Date', sortable: true },
  { key: 'tags', label: 'Tags', sortable: false }
];

// Helper functions for dates
const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
};

const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate).toDateString() === new Date().toDateString();
};

// Event handlers
const handlePageChange = (page) => {
  pagination.currentPage = page;
  fetchTasks();
};

const handleSort = ({ key, order }) => {
  const sortMap = {
    'title': 'title',
    'priority': 'priority',
    'status': 'status',
    'dueDate': 'dueDate'
  };
  
  // If key is empty, reset to default sort
  if (!key) {
    sortField.value = 'createdAt';
    sortOrder.value = 'desc';
  } else {
    sortField.value = sortMap[key] || 'createdAt';
    sortOrder.value = order;
  }
  
  fetchTasks();
};

// Fetch tasks
const fetchTasks = async () => {
  try {
    loading.value = true;
    const params = {
      page: pagination.currentPage,
      limit: 20,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
      ...filters
    };

    if (searchQuery.value) {
      params.search = searchQuery.value;
    }

    console.log('Fetching tasks with params:', params);
    const response = await apiClient.get('/tasks', { params });
    console.log('Tasks response:', response);

    if (response.success) {
      tasks.value = response.data;
      pagination.currentPage = response.pagination.currentPage;
      pagination.totalPages = response.pagination.totalPages;
      pagination.totalTasks = response.pagination.totalTasks;
      console.log('Tasks loaded:', tasks.value.length);
    } else {
      console.error('Response not successful:', response);
      tasks.value = [];
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    console.error('Error details:', error.message, error.stack);
    tasks.value = [];
  } finally {
    loading.value = false;
  }
};

// Fetch statistics
const fetchStatistics = async () => {
  try {
    const response = await apiClient.get('/tasks/stats/summary');
    if (response.success) {
      Object.assign(statistics, response.data);
    }
  } catch (error) {
    console.error('Error fetching task statistics:', error);
  }
};

// Debounced search
let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.currentPage = 1;
    fetchTasks();
  }, 300);
};

// Clear filters
const clearFilters = () => {
  filters.status = '';
  filters.priority = '';
  filters.assignedTo = '';
  searchQuery.value = '';
  pagination.currentPage = 1;
  fetchTasks();
};

// Page navigation
const changePage = (page) => {
  pagination.currentPage = page;
  fetchTasks();
};

// Toggle task status (quick complete/incomplete)
const toggleTaskStatus = async (task) => {
  try {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    await apiClient.patch(`/tasks/${task._id}/status`, { status: newStatus });
    await fetchTasks();
    await fetchStatistics();
  } catch (error) {
    console.error('Error toggling task status:', error);
  }
};

// Modal handlers
const openCreateModal = () => {
  editingTask.value = null;
  showFormModal.value = true;
};

const openDetailModal = (task) => {
  selectedTask.value = task;
  showDetailModal.value = true;
};

const openEditModal = (task) => {
  editingTask.value = task;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingTask.value = null;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedTask.value = null;
};

const handleTaskSave = async () => {
  closeFormModal();
  // Reset to page 1 to see the new/updated task
  pagination.currentPage = 1;
  await fetchTasks();
  await fetchStatistics();
};

const handleEdit = (task) => {
  closeDetailModal();
  editingTask.value = task;
  showFormModal.value = true;
};

const handleDelete = async (row) => {
  const taskId = row._id || row;
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  try {
    await apiClient.delete(`/tasks/${taskId}`);
    closeDetailModal();
    await fetchTasks();
    await fetchStatistics();
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

// Bulk Actions Handlers
const handleSelect = (selectedRows) => {
  console.log(`${selectedRows.length} tasks selected`);
};

const handleBulkAction = async ({ action, selectedRows }) => {
  const taskIds = selectedRows.map(task => task._id);
  
  try {
    if (action === 'bulk-delete') {
      if (!confirm(`Delete ${selectedRows.length} tasks?`)) return;
      
      await Promise.all(taskIds.map(id => apiClient.delete(`/tasks/${id}`)));
      await fetchTasks();
      await fetchStatistics();
      
    } else if (action === 'bulk-complete') {
      if (!confirm(`Mark ${selectedRows.length} tasks as complete?`)) return;
      
      await Promise.all(taskIds.map(id => 
        apiClient.patch(`/tasks/${id}`, { status: 'completed' })
      ));
      await fetchTasks();
      await fetchStatistics();
      
    } else if (action === 'bulk-export') {
      exportTasksToCSV(selectedRows);
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    alert('Error performing bulk action. Please try again.');
  }
};

const exportTasksToCSV = (tasksToExport) => {
  const csv = [
    ['Title', 'Status', 'Priority', 'Due Date', 'Assigned To'].join(','),
    ...tasksToExport.map(task => [
      task.title,
      task.status,
      task.priority,
      task.dueDate || '',
      task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const deleteTask = async (taskId) => {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  try {
    await apiClient.delete(`/tasks/${taskId}`);
    await fetchTasks();
    await fetchStatistics();
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

const handleStatusChange = async () => {
  await fetchTasks();
  await fetchStatistics();
  closeDetailModal();
};

// Export tasks
const exportTasks = async () => {
  try {
    const response = await fetch('/api/csv/export/tasks', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting tasks:', error);
    alert('Error exporting tasks. Please try again.');
  }
};

const handleImportComplete = () => {
  showImportModal.value = false;
  fetchTasks();
  fetchStatistics();
};

// Utility functions
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const formatStatus = (status) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Initialize
onMounted(() => {
  // Load saved sort state from localStorage before fetching
  const savedSort = localStorage.getItem('datatable-tasks-table-sort');
  if (savedSort) {
    try {
      const { by, order } = JSON.parse(savedSort);
      
      // Map frontend column keys to backend sort fields
      const sortMap = {
        'title': 'title',
        'priority': 'priority',
        'status': 'status',
        'dueDate': 'dueDate'
      };
      
      // If the saved sort key is valid, use it; otherwise default to createdAt
      if (by && sortMap[by]) {
        sortField.value = sortMap[by];
        sortOrder.value = order;
        console.log('Loaded saved sort in Tasks:', { by, order, mapped: sortField.value });
      } else {
        sortField.value = 'createdAt';
        sortOrder.value = 'desc';
        console.log('Saved sort invalid or empty, using default:', { by, order });
        // Clear invalid saved sort
        localStorage.removeItem('datatable-tasks-table-sort');
      }
    } catch (e) {
      console.error('Failed to parse saved sort:', e);
      sortField.value = 'createdAt';
      sortOrder.value = 'desc';
    }
  }
  
  fetchTasks();
  fetchStatistics();
});
</script>

