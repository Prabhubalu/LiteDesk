<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Tasks</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">Manage your tasks and to-dos</p>
      </div>
      <ModuleActions 
        module="tasks"
        create-label="New Task"
        @create="openCreateModal"
        @import="showImportModal = true"
        @export="exportTasks"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.total || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tasks</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.overdue || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.dueToday || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Due Today</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.byStatus?.completed || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
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
            placeholder="Search tasks..."
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 flex-1">
        <select v-model="filters.status" @change="fetchTasks" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select v-model="filters.priority" @change="fetchTasks" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select v-model="filters.assignedTo" @change="fetchTasks" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Assignees</option>
          <option value="me">My Tasks</option>
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
      :column-settings="false"
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
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
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

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <RowActions 
          :row="row"
          module="tasks"
          @view="openDetailModal(row)"
          @edit="openEditModal(row)"
          @delete="deleteTask(row._id)"
        />
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useBulkActions } from '@/composables/useBulkActions';
import apiClient from '../utils/apiClient';
import DataTable from '../components/common/DataTable.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import DateCell from '../components/common/table/DateCell.vue';
import TaskFormModal from '../components/tasks/TaskFormModal.vue';
import TaskDetailModal from '../components/tasks/TaskDetailModal.vue';
import CSVImportModal from '../components/import/CSVImportModal.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';

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
const showColumnSettings = ref(false);

const filters = reactive({
  status: '',
  priority: '',
  assignedTo: ''
});

// Column settings state
const visibleColumns = ref([
  { key: 'title', label: 'Task', visible: true },
  { key: 'priority', label: 'Priority', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'assignedTo', label: 'Assigned To', visible: true },
  { key: 'dueDate', label: 'Due Date', visible: true },
  { key: 'tags', label: 'Tags', visible: true }
]);

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

