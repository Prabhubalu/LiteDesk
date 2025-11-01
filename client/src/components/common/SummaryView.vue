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
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-[65px] md:top-[113px] lg:top-[49px] z-40 transition-all duration-300 ease-in-out"
        :style="{ 
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
                <div v-if="record.avatar" class="w-12 h-12 rounded-lg overflow-hidden">
                  <img :src="record.avatar" :alt="record.name" class="w-full h-full object-cover" />
                </div>
                <div v-else :class="['w-12 h-12 rounded-lg flex items-center justify-center text-xl font-medium', getColorForName(record.name).bg, getColorForName(record.name).text]">
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
                  <HeartIconSolid v-if="isFollowing" class="w-5 h-5" />
                  <HeartIcon v-else class="w-5 h-5" />
                </button>

                <!-- Tag Dropdown -->
                <Menu as="div" class="relative">
                  <MenuButton 
                    :class="[
                      'p-2 rounded-lg transition-colors',
                      tags.length > 0
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    ]"
                    :title="tags.length > 0 ? 'Manage Tags' : 'Add Tag'"
                  >
                    <TagIconSolid v-if="tags.length > 0" class="w-5 h-5" />
                    <TagIcon v-else class="w-5 h-5" />
                  </MenuButton>

                  <transition
                    enter-active-class="transition ease-out duration-100"
                    enter-from-class="transform opacity-0 scale-95"
                    enter-to-class="transform opacity-100 scale-100"
                    leave-active-class="transition ease-in duration-75"
                    leave-from-class="transform opacity-100 scale-100"
                    leave-to-class="transform opacity-0 scale-95"
                  >
                    <MenuItems class="absolute left-0 mt-2 w-64 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                      <!-- Existing Tags -->
                      <div v-if="tags.length > 0" class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tags</p>
                        <div class="flex flex-wrap gap-1">
                          <span 
                            v-for="(tag, index) in tags" 
                            :key="index"
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm"
                          >
                            {{ tag }}
                            <button
                              @click="removeTag(index)"
                              class="ml-1 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded p-0.5"
                            >
                              <XMarkIcon class="w-3 h-3" />
                            </button>
                          </span>
                        </div>
                      </div>
                      
                      <!-- Empty State or Add New -->
                      <div class="px-3 py-2">
                        <div v-if="tags.length === 0" class="text-center py-2 mb-2">
                          <p class="text-sm text-gray-500 dark:text-gray-400">No tags yet</p>
                        </div>
                        <MenuItem v-slot="{ active }">
                          <button
                            @click="showTagModal = true"
                            :class="[
                              'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                              active ? 'bg-gray-100 dark:bg-gray-700' : ''
                            ]"
                          >
                            <PlusIcon class="w-4 h-4" />
                            {{ tags.length > 0 ? 'Add Another Tag' : 'Add Tag' }}
                          </button>
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </transition>
                </Menu>

                <!-- Copy URL Link -->
                <button
                  @click="copyUrl"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Copy Link"
                >
                  <LinkIcon class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Right Group: Primary Record Actions -->
            <div class="flex items-center gap-3">
              <!-- Status/Lifecycle Stage Dropdowns (Dynamic based on module) -->
              <select
                v-for="field in getLifecycleStatusFields"
                :key="field.key"
                :value="field.value"
                @change="updateField(field.key, $event.target.value)"
                class="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">{{ field.label }}</option>
                <option v-for="option in field.options" :key="option" :value="option">
                  {{ option }}
                </option>
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
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors inline-flex items-center"
              >
                <PencilSquareIcon class="w-4 h-4 mr-2" />
                Edit
              </button>

              <!-- More Dropdown -->
              <Menu as="div" class="relative">
                <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <EllipsisVerticalIcon class="w-5 h-5" />
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
              <PlusIcon class="w-5 h-5" />
              <span class="hidden sm:inline">Add Widget</span>
            </button>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-else-if="activeTab === 'details'" class="space-y-6">
                        <!-- Top Bar: Search, Toggle, and Manage Button -->
                        <div class="flex items-center justify-between mb-4">
              <!-- Search Field -->
              <div class="relative w-100">
                <input
                  v-model="detailsSearch"
                  type="text"
                  placeholder="Search fields..."
                  class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                />
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <!-- Right Side: Toggle and Manage Button -->
              <div class="flex items-center gap-3">
                <!-- Show empty fields toggle -->
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="showEmptyFields"
                    class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Show empty fields</span>
                </label>
                
                <!-- Manage Fields Button (only if user has permission) -->
                <PermissionButton
                  v-if="hasManageFieldsPermission"
                  module="settings"
                  action="edit"
                  variant="secondary"
                  icon="cog"
                  @click="goToManageFields"
                >
                  Manage Fields
                </PermissionButton>
              </div>
            </div>
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">

            
            <!-- Fields Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-for="(value, key) in filteredRecordFields" :key="key">
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  {{ formatFieldName(key) }}
                </label>
                <div v-if="isEditableField(key)" class="mt-2">
                  <select
                    v-if="isPicklistField(key)"
                    :value="value"
                    @change="updateField(key, $event.target.value)"
                    class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                  >
                    <option value="">-- Select --</option>
                    <option v-for="option in getPicklistOptions(key)" :key="option.value || option" :value="option.value || option">
                      {{ option.label || option }}
                    </option>
                  </select>
                  <textarea
                    v-else-if="isTextAreaField(key)"
                    :value="value"
                    @focus="originalFieldValues[key] = value"
                    @blur="updateField(key, $event.target.value)"
                    @keydown.esc="discardField(key, $event)"
                    @keydown.enter="updateField(key, $event.target.value); $event.target.blur()"
                    rows="3"
                    class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 resize-none"
                  ></textarea>
                  <input
                    v-else
                    :type="getInputType(key, value)"
                    :value="value"
                    @focus="originalFieldValues[key] = value"
                    @blur="updateField(key, $event.target.value)"
                    @keydown.esc="discardField(key, $event)"
                    @keydown.enter="updateField(key, $event.target.value); $event.target.blur()"
                    class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                  />
                </div>
                <p v-else class="mt-2 text-sm text-gray-900 dark:text-white">{{ formatFieldValue(value) }}</p>
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
                    <ClockIcon class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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
                    <LinkIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
import { useTabs } from '@/composables/useTabs';
import PermissionButton from '@/components/common/PermissionButton.vue';
import { useRouter } from 'vue-router';
import {
  MagnifyingGlassIcon,
  HeartIcon,
  TagIcon,
  LinkIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { HeartIcon as HeartIconSolid, TagIcon as TagIconSolid } from '@heroicons/vue/24/solid';

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

// Get openTab from useTabs
const { openTab } = useTabs();

// Initialize router and auth store
const router = useRouter();
const authStore = useAuthStore();

// Force recompute trigger (similar to TabBar viewportWidth)
const recomputeTrigger = ref(0);

// Viewport width for responsive calculations
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);

// Handle resize for viewport width
const handleResize = () => {
  viewportWidth.value = window.innerWidth;
};

// Listen for sidebar toggle custom event
const handleSidebarToggle = (e) => {
  // Force recompute by toggling trigger value
  // This causes headerLeft computed to recalculate
  recomputeTrigger.value++;
};

// Dynamic positioning based on sidebar state (reads localStorage like TabBar)
const headerLeft = computed(() => {
  // Force dependency on recomputeTrigger
  const _ = recomputeTrigger.value;
  
  // On mobile/tablet (< 1024px), always at left: 0 (like TabBar)
  if (viewportWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop (≥ 1024px), position based on sidebar state
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

// Module definitions
const moduleDefinition = ref(null);

// Field values tracking for discard functionality
const originalFieldValues = ref({});

// Details tab search
const detailsSearch = ref('');
const showEmptyFields = ref(true); // Show empty fields by default

// Permission check for managing fields
const hasManageFieldsPermission = computed(() => {
  return authStore.can('settings', 'edit');
});

// Filtered record fields for details tab based on search and empty fields toggle
const filteredRecordFields = computed(() => {
  if (!props.record) return {};
  
  let fields = { ...props.record };
  
  // Filter empty fields if toggle is off
  if (!showEmptyFields.value) {
    fields = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) => 
        value !== null && value !== undefined && value !== '' && 
        !(Array.isArray(value) && value.length === 0)
      )
    );
  }
  
  // Apply search filter
  if (detailsSearch.value) {
    const searchLower = detailsSearch.value.toLowerCase();
    const filtered = {};
    
    for (const [key, value] of Object.entries(fields)) {
      const fieldName = formatFieldName(key).toLowerCase();
      const fieldValue = String(value || '').toLowerCase();
      
      if (fieldName.includes(searchLower) || fieldValue.includes(searchLower)) {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }
  
  return fields;
});

// Navigate to manage fields in a new tab
const goToManageFields = () => {
  window.open(`/settings?tab=modules&module=${props.recordType}`, '_blank');
};

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
      disableDrag: false,
      columnOpts: {
        breakpoints: [
          { w: 600, c: 1 },  // Mobile: 1 column (< 600px)
          { w: 1024, c: 2 }  // Tablet: 2 columns (< 1024px)
        ]
      }
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
      handleOpenRelatedRecord({ type: 'people', id });
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

// Remove tag
const removeTag = (index) => {
  tags.value.splice(index, 1);
};

// Update field (auto-saves on blur)
const updateField = (field, value) => {
  emit('update', { field, value });
  if (props.record) {
    props.record[field] = value;
  }
};

// Discard field changes (revert to original value)
const discardField = (field, event) => {
  // Restore original value
  if (props.record) {
    props.record[field] = originalFieldValues.value[field];
  }
  // Update the input/textarea element
  if (event && event.target) {
    event.target.value = originalFieldValues.value[field] || '';
  }
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

// Fetch module definition
const fetchModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    const modules = response.data || [];
    const module = modules.find(m => m.key === props.recordType);
    if (module) {
      moduleDefinition.value = module;
    }
  } catch (error) {
    console.error('Error fetching module definition:', error);
  }
};

// Get field definition for a given key
const getFieldDefinition = (key) => {
  if (!moduleDefinition.value?.fields) return null;
  return moduleDefinition.value.fields.find(f => 
    f.key?.toLowerCase() === key.toLowerCase()
  );
};

// Get input type based on field definition and value
const getInputType = (key, value) => {
  const fieldDef = getFieldDefinition(key);
  
  if (fieldDef) {
    switch (fieldDef.dataType) {
      case 'Date':
        return 'date';
      case 'DateTime':
        return 'datetime-local';
      case 'Number':
      case 'Currency':
        return 'number';
      case 'Checkbox':
      case 'Boolean':
        return 'checkbox';
      case 'Email':
        return 'email';
      case 'Phone':
        return 'tel';
      case 'URL':
      case 'Website':
        return 'url';
      case 'Text':
      case 'Text-Area':
      case 'Rich Text':
        return 'text';
      default:
        return 'text';
    }
  }
  
  // Fallback to value-based detection
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (key.includes('email')) return 'email';
  if (key.includes('date')) return 'date';
  if (key.includes('phone')) return 'tel';
  if (key.includes('url')) return 'url';
  return 'text';
};

// Check if field is a picklist
const isPicklistField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Picklist' || fieldDef.dataType === 'Multi-Picklist';
};

// Check if field is a text area
const isTextAreaField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Text-Area' || fieldDef.dataType === 'Rich Text';
};

// Get picklist options
const getPicklistOptions = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef || !fieldDef.options) return [];
  return fieldDef.options;
};

// Get lifecycle and status fields for display in header
const getLifecycleStatusFields = computed(() => {
  if (!moduleDefinition.value?.fields || !props.record) return [];
  
  const statusFields = [];
  const record = props.record;
  
  // For People module, show type + lead_status/contact_status
  if (props.recordType === 'people') {
    // Type field
    const typeField = getFieldDefinition('type');
    if (typeField) {
      statusFields.push({
        key: 'type',
        label: 'Type',
        value: record.type,
        options: typeField.options || [],
        fieldDef: typeField
      });
    }
    
    // Lead status (if type is Lead)
    if (record.type === 'Lead') {
      const leadStatusField = getFieldDefinition('lead_status');
      if (leadStatusField) {
        statusFields.push({
          key: 'lead_status',
          label: 'Lead Status',
          value: record.lead_status,
          options: leadStatusField.options || [],
          fieldDef: leadStatusField
        });
      }
    }
    
    // Contact status (if type is Contact)
    if (record.type === 'Contact') {
      const contactStatusField = getFieldDefinition('contact_status');
      if (contactStatusField) {
        statusFields.push({
          key: 'contact_status',
          label: 'Contact Status',
          value: record.contact_status,
          options: contactStatusField.options || [],
          fieldDef: contactStatusField
        });
      }
    }
  } else if (props.recordType === 'organizations') {
    // For Organizations module, show types + relevant status fields
    // Note: types is a Multi-Picklist (array), so we'll show it as a display field and show status fields
    // Show relevant status fields based on types
    if (Array.isArray(record.types) && record.types.length > 0) {
      // Customer status (if Customer is in types)
      if (record.types.includes('Customer')) {
        const customerStatusField = getFieldDefinition('customerStatus');
        if (customerStatusField) {
          statusFields.push({
            key: 'customerStatus',
            label: 'Customer Status',
            value: record.customerStatus,
            options: customerStatusField.options || [],
            fieldDef: customerStatusField
          });
        }
      }
      
      // Partner status (if Partner is in types)
      if (record.types.includes('Partner')) {
        const partnerStatusField = getFieldDefinition('partnerStatus');
        if (partnerStatusField) {
          statusFields.push({
            key: 'partnerStatus',
            label: 'Partner Status',
            value: record.partnerStatus,
            options: partnerStatusField.options || [],
            fieldDef: partnerStatusField
          });
        }
      }
      
      // Vendor status (if Vendor is in types)
      if (record.types.includes('Vendor')) {
        const vendorStatusField = getFieldDefinition('vendorStatus');
        if (vendorStatusField) {
          statusFields.push({
            key: 'vendorStatus',
            label: 'Vendor Status',
            value: record.vendorStatus,
            options: vendorStatusField.options || [],
            fieldDef: vendorStatusField
          });
        }
      }
    }
  } else {
    // For other modules, look for common status/lifecycle fields
    const statusField = getFieldDefinition('status');
    const lifecycleField = getFieldDefinition('lifecycle_stage');
    
    if (lifecycleField) {
      statusFields.push({
        key: 'lifecycle_stage',
        label: 'Lifecycle Stage',
        value: record.lifecycle_stage,
        options: lifecycleField.options || [],
        fieldDef: lifecycleField
      });
    }
    
    if (statusField) {
      statusFields.push({
        key: 'status',
        label: 'Status',
        value: record.status,
        options: statusField.options || [],
        fieldDef: statusField
      });
    }
  }
  
  return statusFields;
});

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
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 1);
};

// Color mapping for alphabets A-Z
const getColorForLetter = (letter) => {
  const colors = {
    'A': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
    'B': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300' },
    'C': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
    'D': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300' },
    'E': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-700 dark:text-lime-300' },
    'F': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300' },
    'G': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
    'H': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300' },
    'I': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-300' },
    'J': { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-300' },
    'K': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
    'L': { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
    'M': { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-300' },
    'N': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
    'O': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    'P': { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
    'Q': { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-300' },
    'R': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
    'S': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
    'T': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
    'U': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
    'V': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-800 dark:text-lime-200' },
    'W': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
    'X': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-800 dark:text-emerald-200' },
    'Y': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
    'Z': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
  };
  return colors[letter.toUpperCase()] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
};

// Get color for a name based on first letter
const getColorForName = (name) => {
  if (!name) return getColorForLetter('?');
  const firstLetter = name.trim()[0];
  return getColorForLetter(firstLetter);
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
                 relatedRecord.type === 'people' ? 'users' :
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
        } else if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
          const authStore = useAuthStore();
          const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
          endpoint = isAdmin 
            ? `/admin/contacts/${relatedRecord.id}`
            : `/people/${relatedRecord.id}`;
        } else {
          endpoint = `/${relatedRecord.type}/${relatedRecord.id}`;
        }
        
        const response = await apiClient.get(endpoint);
        
        // Extract name from response
        if (response.success && response.data) {
          const record = response.data;
          // Different record types have different name fields
          if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
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
    openTab(path, {
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
onMounted(async () => {
  // Fetch module definition for field mapping
  await fetchModuleDefinition();
  
  // Initialize tags from record if available
  if (props.record && props.record.tags && Array.isArray(props.record.tags)) {
    tags.value = [...props.record.tags];
  }
  
  // Listen for sidebar toggle events and window resize
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  window.addEventListener('resize', handleResize);
  
  // Set initial viewport width
  viewportWidth.value = window.innerWidth;
  
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
  // Remove event listeners
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  window.removeEventListener('resize', handleResize);
  destroyGridStack();
});

</script>
