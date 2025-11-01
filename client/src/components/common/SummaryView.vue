<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading {{ recordType }}...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading {{ recordType }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$emit('close')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
          Close
        </button>
      </div>
    </div>

    <!-- Main Summary View -->
    <div v-else-if="record" class="max-w-7xl mx-auto">
      <!-- Header Component - Fixed below TabBar -->
      <div 
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed z-40"
        :style="{ 
          top: '48px', // TabBar height
          left: headerLeft,
          right: '0px'
        }"
      >
        <div class="px-6 py-4">
          <div class="flex items-center justify-between">
            <!-- Left Group: Record Identity & Quick Actions -->
            <div class="flex items-center gap-4">
              <!-- Icon/Avatar -->
              <div class="flex-shrink-0">
                <div v-if="record.avatar" class="w-12 h-12 rounded-full overflow-hidden">
                  <img :src="record.avatar" :alt="record.name" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                  {{ getInitials(record.name) }}
                </div>
              </div>

              <!-- Record Name -->
              <div class="flex-1 min-w-0">
                <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {{ record.name }}
                </h1>
                <p v-if="record.subtitle" class="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {{ record.subtitle }}
                </p>
              </div>

              <!-- Action Icons -->
              <div class="flex items-center gap-2">
                <!-- Follow Toggle -->
                <button
                  @click="toggleFollow"
                  :class="[
                    'p-2 rounded-lg transition-colors',
                    isFollowing 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                  :title="isFollowing ? 'Unfollow' : 'Follow'"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                <!-- Tag Icon -->
                <button
                  @click="showTagModal = true"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Add Tag"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </button>

                <!-- Copy URL Link -->
                <button
                  @click="copyUrl"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Copy Link"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Right Group: Primary Record Actions -->
            <div class="flex items-center gap-3">
              <!-- Status/Lifecycle Stage Dropdown -->
              <select
                :value="record.status || record.lifecycleStage || 'Active'"
                @change="updateField('status', $event.target.value)"
                class="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
                <option value="Qualified">Qualified</option>
                <option value="Unqualified">Unqualified</option>
              </select>

              <!-- Add Relation Dropdown -->
              <button
                @click="showRelationModal = true"
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                + Add Relation
              </button>

              <!-- Record Edit Button -->
              <button
                @click="$emit('edit')"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>

              <!-- More Dropdown -->
              <Menu as="div" class="relative">
                <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </MenuButton>

                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                    <MenuItem v-slot="{ active }">
                      <button
                        @click="$emit('delete')"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-red-600 dark:text-red-400'
                        ]"
                      >
                        Delete Record
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>
        </div>

        <!-- Tabs Component - Fixed below header -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="px-6">
            <nav class="flex space-x-8" aria-label="Tabs">
              <!-- Fixed Default Tabs -->
              <button
                v-for="tab in fixedTabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                ]"
              >
                {{ tab.name }}
              </button>

            </nav>
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="p-6 pt-32">
        <!-- Summary Tab with GridStack Dashboard -->
        <div v-if="activeTab === 'summary'">
          <!-- GridStack Container -->
          <div ref="gridStackContainer" class="grid-stack">
            <!-- Widgets will be rendered here by GridStack -->
          </div>

          <!-- Floating Add Widget Button -->
          <div class="fixed bottom-6 right-6 z-50">
            <button
              @click="showWidgetModal = true"
              class="inline-flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors shadow-lg hover:shadow-xl"
              title="Add Custom Widget"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span class="hidden sm:inline">Add Widget</span>
            </button>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-else-if="activeTab === 'details'" class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Record Details</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-for="(value, key) in record" :key="key" class="space-y-1">
                <label class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {{ formatFieldName(key) }}
                </label>
                <div v-if="isEditableField(key)" class="flex items-center gap-2">
                  <input
                    :type="getInputType(key, value)"
                    :value="value"
                    @blur="updateField(key, $event.target.value)"
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    @click="saveField(key, $event.target.value)"
                    class="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
                <p v-else class="text-sm text-gray-900 dark:text-white">{{ formatFieldValue(value) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Updates/Timeline Tab -->
        <div v-else-if="activeTab === 'updates'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Activity Timeline</h2>
            <div class="space-y-4">
              <div v-for="(update, index) in timelineUpdates" :key="index" class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900 dark:text-white">
                    <span class="font-medium">{{ update.user }}</span> {{ update.action }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ formatDate(update.timestamp) }}</p>
                </div>
              </div>
              <div v-if="timelineUpdates.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                No activity yet
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Widget Management Modal -->
    <div v-if="showWidgetModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showWidgetModal = false"></div>
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div class="px-6 py-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Manage Widgets</h3>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <button
                v-for="widget in availableWidgets"
                :key="widget.type"
                @click="addWidget(widget.type)"
                class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ widget.name }}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ widget.description }}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
            <button @click="showWidgetModal = false" class="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showTagModal = false"></div>
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="px-6 py-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Tag</h3>
            <input
              v-model="newTag"
              @keyup.enter="addTag"
              type="text"
              placeholder="Enter tag name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
            <button @click="showTagModal = false" class="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
              Cancel
            </button>
            <button @click="addTag" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch, createApp, h } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import RelatedContactsWidget from '@/components/organizations/RelatedContactsWidget.vue';
import RelatedUsersWidget from '@/components/organizations/RelatedUsersWidget.vue';
import RelatedDealsWidget from '@/components/deals/RelatedDealsWidget.vue';
import OrganizationMetricsWidget from '@/components/organizations/OrganizationMetricsWidget.vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { openRecordInTab } from '@/utils/tabNavigation';

// Props
const props = defineProps({
  record: {
    type: Object,
    default: null
  },
  recordType: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({})
  }
});

// Emits
const emit = defineEmits(['close', 'update', 'edit', 'delete', 'addRelation', 'openRelatedRecord']);

// Dynamic positioning based on sidebar state
const headerLeft = computed(() => {
  const sidebarCollapsed = localStorage.getItem('litedesk-sidebar-collapsed') === 'true';
  return sidebarCollapsed ? '80px' : '256px';
});


// Get storage key for this record
const getStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-tab-${props.recordType}-${recordId}`;
};

// Get storage key for widget layout
const getLayoutStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-layout-${props.recordType}-${recordId}`;
};

// Load active tab from localStorage or default to 'summary'
const loadActiveTab = () => {
  try {
    const savedTab = localStorage.getItem(getStorageKey());
    if (savedTab) {
      // Check if it's a fixed tab
      if (fixedTabs.some(t => t.id === savedTab)) {
        return savedTab;
      }
      // For dynamic tabs, we'll validate when we load them
      // But we can still restore it if it was saved
      return savedTab;
    }
  } catch (e) {
    console.error('Error loading active tab:', e);
  }
  return 'summary';
};

// Save active tab to localStorage
const saveActiveTab = (tabId) => {
  try {
    localStorage.setItem(getStorageKey(), tabId);
  } catch (e) {
    console.error('Error saving active tab:', e);
  }
};

// State - initialize with summary, will be updated when record loads
const activeTab = ref('summary');
const isFollowing = ref(false);
const showTagModal = ref(false);
const showWidgetModal = ref(false);
const showRelationModal = ref(false);
const newTag = ref('');
const tags = ref([]);

// Fixed tabs
const fixedTabs = [
  { id: 'summary', name: 'Summary' },
  { id: 'details', name: 'Details' },
  { id: 'updates', name: 'Updates' }
];

// GridStack
const gridStackContainer = ref(null);
let gridStack = null;
let isInitializing = false;

// Timeline updates
const timelineUpdates = ref([
  {
    user: 'System',
    action: 'created this record',
    timestamp: new Date()
  }
]);

// Available widgets
const availableWidgets = [
  {
    type: 'related-records',
    name: 'Related Records',
    description: 'Show related contacts, deals, etc.',
  },
  {
    type: 'activity-stream',
    name: 'Activity Stream',
    description: 'Recent activities and interactions',
  },
  {
    type: 'lifecycle-stage',
    name: 'Lifecycle Stage',
    description: 'Current stage and progression',
  },
  {
    type: 'metrics',
    name: 'Metrics',
    description: 'Key performance indicators',
  },
  {
    type: 'touchpoints',
    name: 'Touchpoints',
    description: 'Communication history',
  },
  {
    type: 'key-fields',
    name: 'Key Fields',
    description: 'Important record fields',
  }
];

// Initialize GridStack
const initializeGridStack = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return;
  }
  
  // Wait for DOM to be ready
  await nextTick();
  await nextTick(); // Extra tick to ensure v-if has rendered
  
  // Check if container exists
  if (!gridStackContainer.value) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }
  
  // Destroy existing instance if any
  if (gridStack) {
    destroyGridStack();
  }
  
  // Additional check to ensure element is in DOM
  if (!document.contains(gridStackContainer.value)) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }

  isInitializing = true;
  
  try {
    gridStack = GridStack.init({
      column: 12,
      cellHeight: 70,
      margin: 8,
      animate: true,
      disableResize: false,
      disableDrag: false
    }, gridStackContainer.value);
    
    // Add event listeners to save layout on changes
    // Debounce saves to avoid too many API calls
    let saveTimeout = null;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveLayoutState();
      }, 500); // Wait 500ms after last change before saving
    };
    
    gridStack.on('change', (event, items) => {
      debouncedSave();
    });
    
    gridStack.on('added', () => {
      debouncedSave();
    });
    
    gridStack.on('removed', () => {
      debouncedSave();
    });
    
    // Ensure CSS variables are set for margins
    if (gridStackContainer.value) {
      gridStackContainer.value.style.setProperty('--gs-item-margin-top', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-bottom', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-left', '8px');
      gridStackContainer.value.style.setProperty('--gs-item-margin-right', '8px');
      
      // Also update GridStack margin directly if supported
      if (gridStack && typeof gridStack.opts === 'function') {
        gridStack.opts({ margin: 8 });
      }
    }

    // Load default widgets after a short delay to ensure GridStack is ready
    setTimeout(async () => {
      isInitializing = false;
      
      // Check if GridStack is initialized
      if (!gridStack) {
        console.warn('GridStack not initialized, retrying...');
        setTimeout(() => initializeGridStack(), 100);
        return;
      }
      
      try {
        // Check if there are any widgets already (by checking GridStack items)
        const existingWidgets = gridStack.getGridItems();
        if (existingWidgets.length === 0) {
          // Try to load saved layout first
          const savedLayout = await loadSavedLayout();
          if (savedLayout && savedLayout.length > 0) {
            loadSavedWidgets(savedLayout);
          } else {
            loadDefaultWidgets();
          }
        }
      } catch (err) {
        console.error('Error checking GridStack items:', err);
        // If error, try to load saved layout or default widgets
        const savedLayout = await loadSavedLayout();
        if (savedLayout && savedLayout.length > 0) {
          loadSavedWidgets(savedLayout);
        } else {
          loadDefaultWidgets();
        }
      }
    }, 150);
  } catch (err) {
    console.error('Error initializing GridStack:', err);
    isInitializing = false;
  }
};

// Destroy GridStack
const destroyGridStack = () => {
  // Unmount all Vue widget apps
  widgetApps.forEach((app, element) => {
    try {
      app.unmount();
    } catch (e) {
      console.error('Error unmounting widget:', e);
    }
  });
  widgetApps.clear();
  
  if (gridStack) {
    try {
      gridStack.destroy();
      gridStack = null;
    } catch (err) {
      console.error('Error destroying GridStack:', err);
    }
  }
  isInitializing = false;
};

// Save layout state to backend API
const saveLayoutState = async () => {
  if (!gridStack || !gridStackContainer.value || !props.record?._id) return;
  
  try {
    // Get all grid items with their elements
    const gridItems = gridStack.getGridItems();
    const layoutData = gridItems.map(gridItem => {
      // Get the actual widget element (the one with data-widget-type)
      const widgetElement = gridItem;
      const widgetType = widgetElement?.getAttribute('data-widget-type');
      
      // Get GridStack position and size
      const x = parseInt(gridItem.getAttribute('gs-x')) || 0;
      const y = parseInt(gridItem.getAttribute('gs-y')) || 0;
      const w = parseInt(gridItem.getAttribute('gs-w')) || 4;
      const h = parseInt(gridItem.getAttribute('gs-h')) || 3;
      
      return {
        x,
        y,
        w,
        h,
        type: widgetType || null
      };
    }).filter(item => item.type); // Only save widgets with valid types
    
    // Save to backend API (silently fail - don't log errors for 404s)
    try {
      await apiClient.post('/user-preferences/widget-layout', {
        recordType: props.recordType,
        recordId: props.record._id,
        widgets: layoutData
      });
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.error('Error saving layout to API:', apiError);
      }
      // Always fallback to localStorage if API fails
      localStorage.setItem(getLayoutStorageKey(), JSON.stringify(layoutData));
    }
  } catch (error) {
    console.error('Error saving layout state:', error);
  }
};

// Load saved layout from backend API or localStorage (fallback)
const loadSavedLayout = async () => {
  if (!props.record?._id) return null;
  
  try {
    // Try to load from backend API first
    try {
      const response = await apiClient.get('/user-preferences/widget-layout', {
        params: {
          recordType: props.recordType,
          recordId: props.record._id
        }
      });
      
      if (response.success && response.data) {
        return response.data;
      }
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.warn('Error loading layout from API, trying localStorage:', apiError);
      }
      // Fallback to localStorage
      const saved = localStorage.getItem(getLayoutStorageKey());
      if (saved) {
        return JSON.parse(saved);
      }
    }
    
    // Try localStorage as fallback
    const saved = localStorage.getItem(getLayoutStorageKey());
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading saved layout:', error);
  }
  return null;
};

// Load saved widgets with their positions and sizes
const loadSavedWidgets = (savedLayout) => {
  if (!gridStack) return;
  
  savedLayout.forEach(widgetData => {
    if (widgetData.type) {
      addWidgetToGrid(widgetData.type, widgetData.x, widgetData.y, widgetData.w, widgetData.h);
    }
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    setTimeout(() => {
      gridStack.compact();
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save after loading
    }, 100);
  }
};

// Load default widgets
const loadDefaultWidgets = () => {
  if (!gridStack) return;

  // Default widgets based on record type
  let defaultWidgets = [];
  
  if (props.recordType === 'organizations') {
    defaultWidgets = [
      { type: 'related-contacts', x: 0, y: 0, w: 6, h: 4 },
      { type: 'related-users', x: 6, y: 0, w: 6, h: 4 },
      { type: 'related-deals', x: 0, y: 4, w: 6, h: 4 },
      { type: 'metrics', x: 6, y: 4, w: 6, h: 4 },
      { type: 'lifecycle-stage', x: 0, y: 8, w: 4, h: 3 },
      { type: 'key-fields', x: 4, y: 8, w: 8, h: 3 }
    ];
  } else {
    // Default widgets for other record types
    defaultWidgets = [
      { type: 'related-records', x: 0, y: 0, w: 6, h: 4 },
      { type: 'activity-stream', x: 6, y: 0, w: 6, h: 4 },
      { type: 'lifecycle-stage', x: 0, y: 4, w: 4, h: 3 },
      { type: 'metrics', x: 4, y: 4, w: 4, h: 3 },
      { type: 'touchpoints', x: 8, y: 4, w: 4, h: 3 },
      { type: 'key-fields', x: 0, y: 7, w: 12, h: 3 }
    ];
  }

  defaultWidgets.forEach(widget => {
    addWidgetToGrid(widget.type, widget.x, widget.y, widget.w, widget.h);
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    // Force GridStack to recalculate with margins
    setTimeout(() => {
      gridStack.compact();
      // Update GridStack to recalculate positions with margins
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save default layout
    }, 100);
  }
};

// Add widget to GridStack
const addWidgetToGrid = (widgetType, x = 0, y = 0, w = 4, h = 3) => {
  if (!gridStack || !gridStackContainer.value) return;

  const widgetElement = createWidgetElement(widgetType);
  
  // Store widget type as data attribute for persistence
  widgetElement.setAttribute('data-widget-type', widgetType);
  
  // Set GridStack attributes before appending
  widgetElement.setAttribute('gs-x', x);
  widgetElement.setAttribute('gs-y', y);
  widgetElement.setAttribute('gs-w', w);
  widgetElement.setAttribute('gs-h', h);
  
  // Append element to grid container
  gridStackContainer.value.appendChild(widgetElement);
  
  // Convert to GridStack widget using makeWidget()
  const widget = gridStack.makeWidget(widgetElement);
  
  // Update GridStack layout
  gridStack.compact();

  return widget;
};

// Store widget app instances for cleanup
const widgetApps = new Map();

// Create widget DOM element
const createWidgetElement = (widgetType) => {
  // Create container div with card styling - this becomes the widget card
  const container = document.createElement('div');
  container.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4';
  container.style.margin = '4px';
  container.style.boxSizing = 'border-box';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-start';
  container.style.justifyContent = 'flex-start';
  
  // Determine which Vue component to use based on widget type and record type
  let Component = null;
  const componentProps = {};
  
  if (props.recordType === 'organizations' && props.record?._id) {
    switch (widgetType) {
      case 'related-contacts':
        Component = RelatedContactsWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        break;
      case 'related-users':
        Component = RelatedUsersWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        break;
      case 'metrics':
        Component = OrganizationMetricsWidget;
        componentProps.stats = props.stats || {};
        break;
      default:
        // Fallback to simple HTML widget
        container.innerHTML = getWidgetContent(widgetType);
        return container;
    }
  } else {
    // Fallback to simple HTML widget for other record types
    container.innerHTML = getWidgetContent(widgetType);
    return container;
  }
  
  // Mount Vue component
  if (Component) {
    // Create wrapper component that handles events
    // IMPORTANT: Since we're using createApp, events don't bubble to parent
    // So we need to call the handler function directly
    // We need to get the record data from the widget props/state
    // Since widgets emit just IDs, we'll fetch the name in handleOpenRelatedRecord
    const handleViewContact = (id) => {
      handleOpenRelatedRecord({ type: 'contacts', id });
    };
    const handleViewUser = (id) => {
      handleOpenRelatedRecord({ type: 'users', id });
    };
    const handleViewDeal = (id) => {
      handleOpenRelatedRecord({ type: 'deals', id });
    };
    
    const wrapperComponent = {
      setup() {
        return () => h(Component, {
          ...componentProps,
          onViewContact: handleViewContact,
          onViewUser: handleViewUser,
          onViewDeal: handleViewDeal,
          onCreateContact: () => {},
          onCreateUser: () => {},
          onCreateDeal: () => {}
        });
      }
    };
    
    const app = createApp(wrapperComponent);
    app.mount(container);
    
    // Store app instance for cleanup
    widgetApps.set(container, app);
  }
  
  return container;
};

// Get widget content based on type
const getWidgetContent = (widgetType) => {
  switch (widgetType) {
    case 'related-records':
      return '<p>No related records found.</p>';
    case 'activity-stream':
      return '<p>No recent activity.</p>';
    case 'lifecycle-stage':
      return `<p>Status: ${props.record?.status || 'Active'}</p>`;
    case 'metrics':
      return '<p>No metrics available.</p>';
    case 'touchpoints':
      return '<p>No touchpoints recorded.</p>';
    case 'key-fields':
      return '<p>Key fields will be displayed here.</p>';
    default:
      return '<p>Widget content</p>';
  }
};

// Add widget
const addWidget = (widgetType) => {
  addWidgetToGrid(widgetType);
  showWidgetModal.value = false;
};

// Toggle follow
const toggleFollow = () => {
  isFollowing.value = !isFollowing.value;
};

// Copy URL
const copyUrl = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('URL copied to clipboard!');
  });
};

// Add tag
const addTag = () => {
  if (newTag.value.trim()) {
    tags.value.push(newTag.value.trim());
    newTag.value = '';
    showTagModal.value = false;
  }
};

// Update field
const updateField = (field, value) => {
  emit('update', { field, value });
  if (props.record) {
    props.record[field] = value;
  }
};

// Save field
const saveField = (field, value) => {
  updateField(field, value);
};

// Format field name
const formatFieldName = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Format field value
const formatFieldValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Check if field is editable
const isEditableField = (key) => {
  const nonEditableFields = ['_id', 'id', 'createdAt', 'updatedAt', 'avatar'];
  return !nonEditableFields.includes(key);
};

// Get input type
const getInputType = (key, value) => {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (key.includes('email')) return 'email';
  if (key.includes('date')) return 'date';
  return 'text';
};

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Get initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

// Handler functions for dynamic tabs
const handleUpdate = (updateData) => {
  emit('update', updateData);
};

const handleEdit = () => {
  emit('edit');
};

const handleDelete = () => {
  emit('delete');
};

const handleAddRelation = (relationData) => {
  emit('addRelation', relationData);
};

const handleOpenRelatedRecord = async (relatedRecord) => {
  // Emit to parent for any additional handling
  emit('openRelatedRecord', relatedRecord);
  
  // Open record in global TabBar
  if (relatedRecord.type && relatedRecord.id) {
    const path = `/${relatedRecord.type}/${relatedRecord.id}`;
    const icon = relatedRecord.type === 'deals' ? 'briefcase' : 
                 relatedRecord.type === 'contacts' ? 'users' : 
                 relatedRecord.type === 'users' ? 'users' : 'document';
    
    // If we don't have the name, fetch it first
    let title = relatedRecord.name || 'Record';
    
    if (!relatedRecord.name) {
      try {
        // Determine API endpoint based on record type
        let endpoint = '';
        if (relatedRecord.type === 'organizations') {
          const authStore = useAuthStore();
          const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
          endpoint = isAdmin 
            ? `/admin/organizations/${relatedRecord.id}`
            : `/organization`;
        } else if (relatedRecord.type === 'contacts') {
          const authStore = useAuthStore();
          const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
          endpoint = isAdmin 
            ? `/admin/contacts/${relatedRecord.id}`
            : `/contacts/${relatedRecord.id}`;
        } else {
          endpoint = `/${relatedRecord.type}/${relatedRecord.id}`;
        }
        
        const response = await apiClient.get(endpoint);
        
        // Extract name from response
        if (response.success && response.data) {
          const record = response.data;
          // Different record types have different name fields
          if (relatedRecord.type === 'contacts') {
            title = `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email || 'Contact';
          } else if (relatedRecord.type === 'users') {
            title = record.name || record.email || 'User';
          } else {
            title = record.name || 'Record';
          }
        }
      } catch (err) {
        console.error('Error fetching record name:', err);
        // Use default title if fetch fails
      }
    }
    
    // Open tab - openTab already handles router.push which will trigger component load
    openRecordInTab(path, {
      title: title,
      icon: icon,
      params: { name: title } // Pass name in params for potential title updates
    });
  }
};


// Watch for tab changes to initialize/destroy GridStack and save active tab
watch(activeTab, (newTab, oldTab) => {
  // Save active tab to localStorage
  saveActiveTab(newTab);
  
  if (newTab === 'summary') {
    // Initialize GridStack when switching to summary tab
    // Wait a bit longer to ensure the tab content is rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  } else if (oldTab === 'summary' && newTab !== 'summary') {
    // Destroy GridStack when leaving summary tab
    destroyGridStack();
  }
});

// Watch for record changes to reload saved tab
watch(() => props.record, (newRecord) => {
  if (newRecord && (newRecord._id || newRecord.id)) {
    const savedTab = loadActiveTab();
    // Validate that the saved tab still exists
    const isValidTab = fixedTabs.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== activeTab.value) {
      activeTab.value = savedTab;
    }
  }
});

// Lifecycle hooks
onMounted(() => {
  // Load saved tab if record is already loaded
  if (props.record && (props.record._id || props.record.id)) {
    const savedTab = loadActiveTab();
    const isValidTab = fixedTabs.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== 'summary') {
      activeTab.value = savedTab;
    }
  }
  
  // Validate current tab
  const currentTab = activeTab.value;
  const isValidTab = fixedTabs.some(t => t.id === currentTab);
  if (!isValidTab) {
    activeTab.value = 'summary';
  }
  
  if (activeTab.value === 'summary') {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  }
});

onUnmounted(() => {
  destroyGridStack();
});

</script>
