<template>
  <div class="w-full relative">
    <!-- Bulk Actions Floating Bar -->
    <Transition name="slide-up">
      <div v-if="selectable && selectedRows.length > 0" class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div class="bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-700 dark:to-brand-800 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-brand-500 dark:border-brand-600 backdrop-blur-sm">
          <div class="flex items-center gap-6">
            <!-- Selection Count -->
            <div class="flex items-center gap-2">
              <div class="bg-white/20 px-3 py-1.5 rounded-lg font-semibold">
                {{ selectedRows.length }} selected
              </div>
              <button
                @click="clearSelection"
                class="p-2 hover:bg-white/20 rounded-lg transition-all"
                title="Clear selection"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Divider -->
            <div class="h-8 w-px bg-white/30"></div>

            <!-- Mass Actions -->
            <div class="flex items-center gap-2">
              <!-- Custom Mass Actions -->
              <button
                v-for="action in massActions"
                :key="action.action"
                @click="handleBulkAction(action.action)"
                :class="[
                  'px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center gap-2',
                  action.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                  action.variant === 'success' ? 'bg-green-500 hover:bg-green-600' :
                  action.variant === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                  'bg-white/20 hover:bg-white/30'
                ]"
              >
                <svg v-if="action.icon === 'trash'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <svg v-else-if="action.icon === 'edit'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <svg v-else-if="action.icon === 'export'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <svg v-else-if="action.icon === 'archive'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {{ action.label }}
              </button>

              <!-- Default Delete Action (if no custom actions) -->
              <button
                v-if="massActions.length === 0"
                @click="handleBulkAction('delete')"
                class="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-all hover:scale-105 flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Table Controls -->
    <div v-if="showControls" class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <!-- Search -->
      <div v-if="searchable" class="relative flex-1 min-w-[280px] max-w-md">
        <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-600 transition-all shadow-sm"
          @input="handleSearch"
        />
      </div>

      <!-- Actions Slot -->
      <div class="flex items-center gap-3">
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- Table Wrapper -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <!-- Table Container with Horizontal Scroll -->
      <div class="overflow-x-auto">
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16">
        <div class="animate-spin rounded-full h-14 w-14 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500"></div>
        <p class="mt-5 text-base font-medium text-gray-600 dark:text-gray-400">{{ loadingText }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!data || data.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
        <slot name="empty">
          <svg class="w-20 h-20 text-gray-300 dark:text-gray-600 mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">{{ emptyTitle }}</h3>
          <p class="text-base text-gray-500 dark:text-gray-400 text-center max-w-md">{{ emptyMessage }}</p>
        </slot>
      </div>

      <!-- Data Table -->
      <table v-else class="w-full min-w-full">
        <thead class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-600">
          <tr>
            <!-- Selection Column -->
            <th v-if="selectable" class="w-14 px-4 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="toggleSelectAll"
                class="w-4 h-4 text-brand-600 dark:text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer transition-all"
              />
            </th>

            <!-- Data Columns -->
            <th
              v-for="column in columns"
              :key="column.key"
              :class="['px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap', column.headerClass]"
              @click="column.sortable !== false ? handleSort(column.key) : null"
              :style="{ cursor: column.sortable !== false ? 'pointer' : 'default', minWidth: column.minWidth || 'auto', maxWidth: column.maxWidth || 'none' }"
            >
              <div class="flex items-center gap-2 select-none">
                <span>{{ column.label }}</span>
                <span v-if="column.sortable !== false && sortBy === column.key" class="flex items-center text-brand-600 dark:text-brand-500">
                  <svg v-if="sortOrder === 'asc'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </span>
              </div>
            </th>
          </tr>
        </thead>

        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          <tr
            v-for="(row, index) in displayData"
            :key="getRowKey(row, index)"
            :class="[
              'hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 cursor-pointer group',
              isSelected(row) ? 'bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/40' : '',
              rowClass
            ]"
            @click="handleRowClick(row)"
          >
            <!-- Selection Column -->
            <td v-if="selectable" class="px-4 py-4 text-sm text-gray-900 dark:text-white">
              <input
                type="checkbox"
                :checked="isSelected(row)"
                @change="toggleSelect(row)"
                @click.stop
                class="w-4 h-4 text-brand-600 dark:text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer transition-all"
              />
            </td>

            <!-- Data Columns -->
            <td
              v-for="(column, colIndex) in columns"
              :key="column.key"
              :class="['px-6 py-4 text-sm text-gray-900 dark:text-white', column.cellClass, colIndex === columns.length - 1 && hasActions ? 'relative pr-48' : '']"
              :style="{ minWidth: column.minWidth || 'auto', maxWidth: column.maxWidth || 'none' }"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="getCellValue(row, column.key)">
                <component
                  v-if="column.component"
                  :is="column.component"
                  :value="getCellValue(row, column.key)"
                  :row="row"
                />
                <span v-else-if="column.format">
                  {{ column.format(getCellValue(row, column.key), row) }}
                </span>
                <span v-else>
                  {{ getCellValue(row, column.key) }}
                </span>
              </slot>
              
              <!-- Actions Overlay (in last column) -->
              <div 
                v-if="hasActions && colIndex === columns.length - 1" 
                class="action-overlay"
              >
                <slot name="actions" :row="row">
                  <button
                    v-if="!hideEdit"
                    @click.stop="$emit('edit', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    title="Edit"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    v-if="!hideDelete"
                    @click.stop="$emit('delete', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    title="Delete"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </slot>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="paginated && !loading && data && data.length > 0" class="flex items-center justify-between mt-6 px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
        <span>
          Showing {{ startRecord }} to {{ endRecord }} of {{ totalRecords }} results
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-all shadow-sm',
              page === currentPage
                ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white border-brand-600 hover:from-brand-700 hover:to-brand-800 shadow-md'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md hover:scale-105'
            ]"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          Next
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  // Data
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  
  // Features
  searchable: {
    type: Boolean,
    default: false
  },
  sortable: {
    type: Boolean,
    default: true
  },
  paginated: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  
  // Pagination
  perPage: {
    type: Number,
    default: 10
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  
  // Actions
  hasActions: {
    type: Boolean,
    default: true
  },
  hideEdit: {
    type: Boolean,
    default: false
  },
  hideDelete: {
    type: Boolean,
    default: false
  },
  
  // Mass Actions
  massActions: {
    type: Array,
    default: () => []
    // Example: [{ label: 'Delete', icon: 'trash', action: 'bulk-delete', variant: 'danger' }]
  },
  
  // States
  loading: {
    type: Boolean,
    default: false
  },
  
  // Customization
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  emptyTitle: {
    type: String,
    default: 'No data found'
  },
  emptyMessage: {
    type: String,
    default: 'Get started by adding your first item'
  },
  loadingText: {
    type: String,
    default: 'Loading...'
  },
  rowClass: {
    type: [String, Function],
    default: ''
  },
  showControls: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['row-click', 'edit', 'delete', 'select', 'sort', 'search', 'page-change', 'bulk-action']);

// Internal state
const searchQuery = ref('');
const sortBy = ref('');
const sortOrder = ref('asc');
const currentPage = ref(1);
const selectedRows = ref([]);

// Computed
const displayData = computed(() => {
  let result = props.data || [];
  
  // Client-side search
  if (props.searchable && searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(row => {
      return props.columns.some(column => {
        const value = getCellValue(row, column.key);
        return String(value).toLowerCase().includes(query);
      });
    });
  }
  
  // Client-side sort
  if (props.sortable && sortBy.value) {
    result = [...result].sort((a, b) => {
      const aVal = getCellValue(a, sortBy.value);
      const bVal = getCellValue(b, sortBy.value);
      
      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // Client-side pagination
  if (props.paginated) {
    const start = (currentPage.value - 1) * props.perPage;
    const end = start + props.perPage;
    result = result.slice(start, end);
  }
  
  return result;
});

const totalPages = computed(() => {
  const total = props.totalRecords || props.data?.length || 0;
  return Math.ceil(total / props.perPage);
});

const startRecord = computed(() => {
  return ((currentPage.value - 1) * props.perPage) + 1;
});

const endRecord = computed(() => {
  const end = currentPage.value * props.perPage;
  const total = props.totalRecords || props.data?.length || 0;
  return Math.min(end, total);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const allSelected = computed(() => {
  return displayData.value.length > 0 && 
         displayData.value.every(row => isSelected(row));
});

// Methods
const getCellValue = (row, key) => {
  if (key.includes('.')) {
    return key.split('.').reduce((obj, k) => obj?.[k], row);
  }
  return row[key];
};

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row);
  }
  return row[props.rowKey] || index;
};

const handleSort = (key) => {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = key;
    sortOrder.value = 'asc';
  }
  emit('sort', { key, order: sortOrder.value });
};

const handleSearch = () => {
  currentPage.value = 1;
  emit('search', searchQuery.value);
};

const handleRowClick = (row) => {
  emit('row-click', row);
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    emit('page-change', currentPage.value);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    emit('page-change', currentPage.value);
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  emit('page-change', page);
};

const isSelected = (row) => {
  return selectedRows.value.some(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
};

const toggleSelect = (row) => {
  const index = selectedRows.value.findIndex(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
  
  if (index > -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(row);
  }
  
  emit('select', selectedRows.value);
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedRows.value = [];
  } else {
    selectedRows.value = [...displayData.value];
  }
  emit('select', selectedRows.value);
};

const handleBulkAction = (action) => {
  emit('bulk-action', {
    action: action,
    selectedRows: selectedRows.value
  });
};

const clearSelection = () => {
  selectedRows.value = [];
  emit('select', []);
};

// Watch for data changes
watch(() => props.data, () => {
  currentPage.value = 1;
});
</script>

<style scoped>
/* Smooth scrolling for horizontal overflow */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Dark mode scrollbar */
.dark .overflow-x-auto {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}

/* Action overlay styling */
.action-overlay {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  align-items: center;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  opacity: 0;
  transition: opacity 200ms;
  pointer-events: none;
  z-index: 50;
}

.dark .action-overlay {
  background: #1f2937;
  border-color: #374151;
}

tr:hover .action-overlay {
  opacity: 1;
  pointer-events: auto;
}

/* Slide up transition for bulk actions bar */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translate(-50%, 20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>

