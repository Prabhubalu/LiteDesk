<template>
  <div class="mx-auto">
    <ListView
      title="Tasks"
      description="Manage your tasks and to-dos"
      module-key="tasks"
      create-label="New Task"
      search-placeholder="Search tasks..."
      :data="tasks"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total Tasks', key: 'total', formatter: 'number' },
        { name: 'Overdue', key: 'overdue', formatter: 'number' },
        { name: 'Due Today', key: 'dueToday', formatter: 'number' },
        { name: 'Completed', key: 'byStatus.completed', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalTasks, limit: pagination.tasksPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :filter-config="[
        {
          key: 'status',
          label: 'All Status',
          options: [
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'waiting', label: 'Waiting' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }
          ]
        },
        {
          key: 'priority',
          label: 'All Priorities',
          options: [
            { value: 'urgent', label: 'Urgent' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' }
          ]
        },
        {
          key: 'assignedTo',
          label: 'All Assignees',
          options: [
            { value: 'me', label: 'My Tasks' }
          ]
        }
      ]"
      table-id="tasks-table"
      row-key="_id"
      empty-title="No tasks yet"
      empty-message="Create your first task to get started"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportTasks"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchTasks(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.tasksPerPage = p.limit || pagination.tasksPerPage; fetchTasks(); }"
      @fetch="fetchTasks"
      @row-click="openDetailModal"
      @edit="openEditModal"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Title Cell with checkbox -->
      <template #cell-title="{ row }">
        <div class="flex items-center gap-3">
          <input 
            type="checkbox" 
            :checked="row.status === 'completed'"
            @click.stop="toggleTaskStatus(row)"
            class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
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
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName,
              lastName: row.assignedTo.lastName,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.assignedTo.firstName }} {{ row.assignedTo.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Due Date Cell with highlighting -->
      <template #cell-dueDate="{ row }">
        <span v-if="row.dueDate" :class="[
          'text-sm font-medium',
          isOverdue(row.dueDate) && row.status !== 'completed' ? 'text-red-600 dark:text-red-400' :
          isDueToday(row.dueDate) && row.status !== 'completed' ? 'text-yellow-600 dark:text-yellow-400' :
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

    </ListView>

    <!-- Task Form Modal -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="tasks"
      :record="editingTask"
      @close="closeFormModal"
      @saved="handleTaskSave"
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
import { useAuthStore } from '../stores/auth';
import { useBulkActions } from '@/composables/useBulkActions';
import apiClient from '../utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import DateCell from '../components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '../components/import/CSVImportModal.vue';
import Avatar from '@/components/common/Avatar.vue';

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
// Use bulk actions composable with permissions
const { bulkActions: baseMassActions } = useBulkActions('tasks');

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.status || '') !== '' || 
         (filters?.priority || '') !== '' || 
         (filters?.assignedTo || '') !== '';
});

// Add custom "Mark Complete" action for tasks
const massActions = computed(() => {
  const actions = [];
  
  // Add Mark Complete action if user can edit
  if (authStore.can('tasks', 'edit')) {
    actions.push({ label: 'Mark Complete', icon: 'edit', action: 'bulk-complete', variant: 'success' });
  }
  
  // Add base actions (Delete, Export) based on permissions
  actions.push(...baseMassActions.value);
  
  return actions;
});

// Column definitions
const columns = computed(() => {
  const allColumns = [
    { key: 'title', label: 'Task', sortable: true, minWidth: '250px' },
    { key: 'priority', label: 'Priority', sortable: true, minWidth: '120px' },
    { key: 'status', label: 'Status', sortable: true, minWidth: '150px' },
    { 
      key: 'assignedTo', 
      label: 'Assigned To', 
      sortable: false,  // Server doesn't support sorting by populated field
      minWidth: '180px',
      sortValue: (row) => {
        if (!row.assignedTo) return '';
        return `${row.assignedTo.firstName || ''} ${row.assignedTo.lastName || ''}`.trim();
      }
    },
    { key: 'dueDate', label: 'Due Date', sortable: true, minWidth: '140px' },
    { key: 'tags', label: 'Tags', sortable: false, minWidth: '150px' }
  ];
  
  return allColumns;
});

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

// Handle search query update
const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  debouncedSearch();
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

const handleBulkAction = async (actionId, selectedRows) => {
  const taskIds = selectedRows.map(task => task._id);
  
  try {
    if (actionId === 'bulk-delete' || actionId === 'delete') {
      await Promise.all(taskIds.map(id => apiClient.delete(`/tasks/${id}`)));
      await fetchTasks();
      await fetchStatistics();
      
    } else if (actionId === 'bulk-complete') {
      if (!confirm(`Mark ${selectedRows.length} tasks as complete?`)) return;
      
      await Promise.all(taskIds.map(id => 
        apiClient.patch(`/tasks/${id}`, { status: 'completed' })
      ));
      await fetchTasks();
      await fetchStatistics();
      
    } else if (actionId === 'bulk-export' || actionId === 'export') {
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

// Column settings handled by ListView component

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

