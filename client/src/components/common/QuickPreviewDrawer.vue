<template>
  <Teleport to="body">
    <!-- Drawer -->
    <Transition
      enter-active-class="transition-transform ease-out duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform ease-in duration-300"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="show"
        @click.stop
        class="fixed right-0 w-full max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-[9999]"
        :style="{
          top: 'var(--quickpreview-offset, 4rem)',
          height: 'calc(100vh - var(--quickpreview-offset, 4rem))'
        }"
      >
        <!-- Drawer Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ moduleTitle }}</span>
            <ChevronDownIcon class="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span v-if="row?._id" class="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {{ row._id.slice(-8) }}
            </span>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <!-- Drawer Content - Split Layout -->
        <div class="flex-1 overflow-hidden flex">
          <!-- Main Content Area -->
          <div 
            ref="scrollContainer"
            class="flex-1 overflow-y-auto px-6 py-6"
            @wheel="handleWheel"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
          >
            <div v-if="row">
              <!-- Summary Tab Content -->
              <div v-if="activeTab === 'summary'" class="space-y-6">
                <!-- Record Name/Title -->
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {{ getRecordDisplayName(row) || 'Untitled' }}
                  </h2>
                </div>

                <!-- GridStack Container -->
                <div v-if="moduleDefinition && activeTab === 'summary'" ref="gridStackContainer" class="grid-stack sm:p-3"></div>

                <!-- Fallback: Show basic fields if module definition not loaded -->
                <div v-else class="space-y-4">
                  <div
                    v-for="column in visibleColumns.filter(col => col.visible !== false && !isCustomField(col))"
                    :key="columnKey(column)"
                    class="flex items-start gap-3"
                  >
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <component
                          :is="getFieldIcon(column.dataType || 'Text')"
                          class="w-4 h-4 text-gray-400 dark:text-gray-500"
                        />
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {{ columnLabel(column) }}
                        </span>
                      </div>
                      <div class="text-sm text-gray-900 dark:text-white">
                        {{ formatFieldValue(row, column) || 'Empty' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Details Tab Content -->
              <div v-else-if="activeTab === 'details'" class="space-y-6">
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {{ getRecordDisplayName(row) || 'Untitled' }}
                  </h2>
                </div>
                
                <!-- Search Field -->
                <div class="relative mb-4">
                  <input
                    v-model="detailsSearch"
                    type="text"
                    placeholder="Search fields..."
                    class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                  />
                  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <!-- Fields Grid using DynamicFormField -->
                <div class="space-y-4">
                  <div
                    v-for="fieldData in getFieldsWithDefinitions"
                    :key="fieldData.key"
                    class="flex items-start gap-3"
                  >
                    <!-- Special handling for createdBy field -->
                    <div v-if="fieldData.key?.toLowerCase() === 'createdby'" class="flex-1">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ fieldData.field.label || fieldData.field.key }}
                      </label>
                      <div class="flex items-center gap-2">
                        <template v-if="fieldData.value && typeof fieldData.value === 'object' && fieldData.value !== null && !Array.isArray(fieldData.value) && fieldData.value._id">
                          <div v-if="fieldData.value.avatar" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                            <img :src="fieldData.value.avatar" :alt="fieldData.value.name || 'User'" class="w-full h-full object-cover" />
                          </div>
                          <div v-else class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {{ getInitials(fieldData.value.name || fieldData.value.firstName + ' ' + fieldData.value.lastName || '?') }}
                          </div>
                          <span class="text-sm text-gray-900 dark:text-white">
                            {{ fieldData.value.name || `${fieldData.value.firstName || ''} ${fieldData.value.lastName || ''}`.trim() || fieldData.value.email || 'User' }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="text-sm text-gray-400 dark:text-gray-500">-</span>
                        </template>
                      </div>
                    </div>
                    <!-- Regular field rendering -->
                    <div v-else class="flex-1">
                      <DynamicFormField 
                        :field="fieldData.field"
                        :value="fieldData.value"
                        @update:value="updateField(fieldData.key, $event)"
                        @blur="saveFieldOnBlur(fieldData.key)"
                        :errors="{}"
                        :dependency-state="fieldData.dependencyState"
                        :module-definition="moduleDefinition"
                        :all-module-definitions="allModuleDefinitions"
                      />
                    </div>
                  </div>
                  
                  <!-- Empty state -->
                  <div v-if="getFieldsWithDefinitions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p v-if="detailsSearch">No fields match your search.</p>
                    <p v-else-if="!showEmptyFields">No fields with values to display.</p>
                    <p v-else>No fields available.</p>
                  </div>
                </div>
              </div>

              <!-- Updates Tab Content -->
              <div v-else-if="activeTab === 'updates'" class="space-y-4">
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {{ getRecordDisplayName(row) || 'Untitled' }}
                  </h2>
                </div>
                
                <!-- Search Field -->
                <div class="relative mb-4">
                  <input
                    v-model="activitySearchQuery"
                    type="text"
                    placeholder="Search activities..."
                    class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 pl-10 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  />
                  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MagnifyingGlassIcon class="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div v-if="activityItems.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                  No activity yet
                </div>
                <div v-else class="flow-root">
                  <ul role="list" class="-mb-8">
                    <li v-for="(activityItem, activityItemIdx) in activityItems" :key="activityItem.id">
                      <div class="relative pb-8">
                        <span v-if="activityItemIdx !== activityItems.length - 1" class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                        <div class="relative flex items-start space-x-3">
                          <template v-if="activityItem.type === 'comment'">
                            <div class="relative">
                              <div :class="['flex size-10 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-800 outline -outline-offset-1 outline-black/5 dark:outline-white/5', getColorForName(activityItem.person.name).bg]">
                                <span :class="['text-sm font-medium', getColorForName(activityItem.person.name).text]">
                                  {{ getInitials(activityItem.person.name) }}
                                </span>
                              </div>
                              <span class="absolute -right-1 -bottom-0.5 rounded-tl bg-white dark:bg-gray-800 px-0.5 py-px">
                                <ChatBubbleLeftEllipsisIcon class="size-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                              </span>
                            </div>
                            <div class="min-w-0 flex-1">
                              <div>
                                <div class="text-sm">
                                  <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                                </div>
                                <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ activityItem.date }}</p>
                              </div>
                              <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>{{ activityItem.comment }}</p>
                              </div>
                            </div>
                          </template>
                          <template v-else-if="activityItem.type === 'assignment'">
                            <div>
                              <div class="relative px-1">
                                <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                                  <UserCircleIcon class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                                </div>
                              </div>
                            </div>
                            <div class="min-w-0 flex-1 py-1.5">
                              <div>
                                <div class="text-sm">
                                  <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                                  {{ ' ' }}
                                  <span class="text-gray-500 dark:text-gray-400">{{ activityItem.action }}</span>
                                  {{ ' ' }}
                                  <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.fieldName || '' }}</span>
                                  {{ ' ' }}
                                  <span class="whitespace-nowrap text-gray-500 dark:text-gray-400">{{ activityItem.date }}</span>
                                </div>
                                <div v-if="activityItem.comment && activityItem.comment !== activityItem.action" class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                  <p>{{ activityItem.comment }}</p>
                                </div>
                              </div>
                            </div>
                          </template>
                          <template v-else-if="activityItem.type === 'tags'">
                            <div>
                              <div class="relative px-1">
                                <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                                  <TagIconSolid class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                                </div>
                              </div>
                            </div>
                            <div class="min-w-0 flex-1 py-0">
                              <div class="text-sm/8 text-gray-500 dark:text-gray-400">
                                <span class="mr-0.5">
                                  <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                                  {{ ' ' }}
                                  {{ activityItem.action }}
                                </span>
                                {{ ' ' }}
                                <span class="mr-0.5">
                                  <template v-for="(tag, tagIdx) in activityItem.tags" :key="tag.name">
                                    <span class="inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600">
                                      <svg :class="[tag.color, 'size-1.5']" viewBox="0 0 6 6" aria-hidden="true">
                                        <circle cx="3" cy="3" r="3" />
                                      </svg>
                                      {{ tag.name }}
                                    </span>
                                    {{ ' ' }}
                                  </template>
                                </span>
                                <span class="whitespace-nowrap">{{ activityItem.date }}</span>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Tenant Details Tab Content (only for tenant organizations) -->
              <div v-else-if="activeTab === 'tenant-details' && row?.isTenant === true" class="space-y-6">
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {{ getRecordDisplayName(row) || 'Untitled' }}
                  </h2>
                </div>
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>Tenant-specific fields will be displayed here</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Sidebar - Tabs -->
          <div class="w-20 border-l border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-2">
            <button
              v-for="tab in fixedTabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="w-full p-2.5 transition-colors cursor-pointer flex flex-col items-center gap-1"
              :title="tab.name"
            >
              <div
                :class="[
                  'p-2 rounded-lg flex items-center justify-center',
                  activeTab === tab.id
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : ''
                ]"
              >
                <component
                  :is="getTabIcon(tab.id)"
                  :class="[
                    'w-5 h-5 flex-shrink-0',
                    activeTab === tab.id
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400'
                  ]"
                />
              </div>
              <span 
                :class="[
                  'text-xs font-medium leading-tight text-center',
                  activeTab === tab.id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400'
                ]"
              >
                {{ tab.name }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Transition } from 'vue';
import { 
  XMarkIcon, 
  ChevronDownIcon, 
  RectangleStackIcon, 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ClockIcon,
  LinkIcon,
  UserCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline';
import {
  UserIcon,
  CalendarIcon,
  TagIcon,
  FlagIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline';
import { TagIcon as TagIconSolid, ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/24/solid';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import KeyFieldsWidget from '@/components/common/metrics/KeyFieldsWidget.vue';
import LifecycleStageWidget from '@/components/common/metrics/LifecycleStageWidget.vue';
import MetricsWidget from '@/components/common/metrics/MetricsWidget.vue';
import RelatedContactsWidget from '@/components/organizations/RelatedContactsWidget.vue';
import RelatedDealsWidget from '@/components/deals/RelatedDealsWidget.vue';
import RelatedTasksWidget from '@/components/tasks/RelatedTasksWidget.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';
import RelatedOrganizationWidget from '@/components/organizations/RelatedOrganizationWidget.vue';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import { createApp, h } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  row: {
    type: Object,
    default: null
  },
  columns: {
    type: Array,
    required: true
  },
  moduleTitle: {
    type: String,
    required: true
  },
  moduleKey: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'update']);

// Ref for scroll container
const scrollContainer = ref(null);
// Track initial touch position for mobile scroll detection
const touchStartY = ref(0);

// Active tab state
const activeTab = ref('summary');

// Fixed tabs - similar to SummaryView
const fixedTabs = computed(() => {
  const baseTabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'details', name: 'Details' },
    { id: 'updates', name: 'Updates' }
  ];
  
  // Add Tenant Details tab if viewing a tenant organization
  if (props.row?.isTenant === true) {
    baseTabs.splice(2, 0, { id: 'tenant-details', name: 'Tenant' });
  }
  
  return baseTabs;
});

// Get icon for tab
const getTabIcon = (tabId) => {
  const iconMap = {
    'summary': RectangleStackIcon,
    'details': DocumentTextIcon,
    'updates': ClockIcon,
    'tenant-details': RectangleStackIcon
  };
  return iconMap[tabId] || RectangleStackIcon;
};

// Auth store
const authStore = useAuthStore();

// Module definition
const moduleDefinition = ref(null);
const allModuleDefinitions = ref({});

// GridStack
const gridStackContainer = ref(null);
let gridStack = null;
let isInitializing = false;
const widgetApps = new Map();

// Details tab state
const detailsSearch = ref('');
const showEmptyFields = ref(true);
const pendingFieldChanges = ref({});

// Activity logs state
const timelineUpdates = ref([]);
const activityFilterUser = ref('');
const activityFilterType = ref('');
const activitySearchQuery = ref('');

// Fetch module definition
const fetchModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    const modules = response.data || [];
    
    // Create a map of all module definitions
    const moduleMap = {};
    modules.forEach(mod => {
      moduleMap[mod.key] = mod;
    });
    allModuleDefinitions.value = moduleMap;
    
    const module = modules.find(m => m.key === props.moduleKey);
    if (module) {
      moduleDefinition.value = module;
    }
  } catch (error) {
    console.error('Error fetching module definition:', error);
  }
};

// Get activity logs API endpoint
const getActivityLogsEndpoint = (recordId) => {
  const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
  
  if (props.moduleKey === 'people') {
    return isAdmin 
      ? `/admin/contacts/${recordId}/activity-logs`
      : `/people/${recordId}/activity-logs`;
  } else if (props.moduleKey === 'organizations') {
    return `/admin/organizations/${recordId}/activity-logs`;
  }
  return null;
};

// Load activity logs
const loadActivityLogs = async () => {
  if (!props.row?._id) return;
  
  const recordId = props.row._id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return;
  
  try {
    const response = await apiClient.get(endpoint);
    if (response.success && response.data) {
      timelineUpdates.value = response.data.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  } catch (error) {
    console.warn('Error loading activity logs:', error);
    timelineUpdates.value = [];
  }
};

// Get target module from field key
const getTargetModuleFromFieldKey = (fieldKey) => {
  if (!fieldKey) return null;
  
  const keyLower = fieldKey.toLowerCase();
  
  // Common field key to module mappings
  const mappings = {
    'organization': 'organizations',
    'organizations': 'organizations',
    'organizationid': 'organizations',
    'accountid': 'organizations',
    'account': 'organizations',
    'contact': 'people',
    'contactid': 'people',
    'contacts': 'people',
    'legacycontactid': 'people',
    'assignedto': 'users',
    'assigned_to': 'users',
    'leadowner': 'users',
    'lead_owner': 'users',
    'createdby': 'users',
    'created_by': 'users',
    'deal': 'deals',
    'dealid': 'deals',
    'deals': 'deals',
    'task': 'tasks',
    'taskid': 'tasks',
    'tasks': 'tasks',
    'event': 'events',
    'eventid': 'events',
    'events': 'events'
  };
  
  // Check exact match first
  if (mappings[keyLower]) {
    return mappings[keyLower];
  }
  
  // Check if key contains any of the mapping keys
  for (const [key, module] of Object.entries(mappings)) {
    if (keyLower.includes(key) || key.includes(keyLower)) {
      return module;
    }
  }
  
  return null;
};

// Get field dependency state
const getFieldState = (field) => {
  if (!field || !field.dependencies || !Array.isArray(field.dependencies) || field.dependencies.length === 0) {
    return {
      visible: true,
      readonly: false,
      required: field.required || false,
      allowedOptions: null
    };
  }
  const currentFormData = props.row || {};
  return getFieldDependencyState(field, currentFormData, moduleDefinition.value?.fields || []);
};

// Get fields with definitions for details tab
const getFieldsWithDefinitions = computed(() => {
  if (!props.row || !moduleDefinition.value?.fields) return [];
  
  const fieldMap = new Map();
  moduleDefinition.value.fields.forEach(field => {
    if (field.key) {
      const keyLower = field.key.toLowerCase();
      fieldMap.set(keyLower, field);
      fieldMap.set(field.key, field);
    }
  });
  
  const systemFieldKeys = ['_id', 'id', '__v', 'createdat', 'updatedat', 'organizationid', 'activitylogs'];
  
  const processed = [];
  const processedKeys = new Set();
  
  for (const fieldDef of moduleDefinition.value.fields) {
    if (!fieldDef.key) continue;
    
    const keyLower = fieldDef.key.toLowerCase();
    if (processedKeys.has(keyLower)) continue;
    processedKeys.add(keyLower);
    
    if (systemFieldKeys.includes(keyLower)) continue;
    
    // Resolve value from row - try multiple key variations
    let displayValue = undefined;
    
    // Try exact key match first
    if (fieldDef.key && props.row[fieldDef.key] !== undefined) {
      displayValue = props.row[fieldDef.key];
    }
    // Try lowercase key
    else if (keyLower && props.row[keyLower] !== undefined) {
      displayValue = props.row[keyLower];
    }
    // Try nested key (e.g., "user.name")
    else if (fieldDef.key && fieldDef.key.includes('.')) {
      displayValue = fieldDef.key.split('.').reduce((obj, k) => obj?.[k], props.row);
    }
    // Try camelCase variations
    else if (fieldDef.key) {
      // Try camelCase
      const camelKey = fieldDef.key.charAt(0).toLowerCase() + fieldDef.key.slice(1);
      if (props.row[camelKey] !== undefined) {
        displayValue = props.row[camelKey];
      }
      // Try with underscore variations
      const underscoreKey = fieldDef.key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (props.row[underscoreKey] !== undefined) {
        displayValue = props.row[underscoreKey];
      }
    }
    
    // If still undefined, explicitly set to null (not undefined)
    if (displayValue === undefined) {
      displayValue = null;
    }
    
    const depState = getFieldState(fieldDef);
    if (!depState.visible && depState.visible !== undefined) {
      continue;
    }
    
    if (!showEmptyFields.value) {
      const isEmpty = displayValue === null || 
                     displayValue === undefined || 
                     displayValue === '' || 
                     (Array.isArray(displayValue) && displayValue.length === 0);
      if (isEmpty) continue;
    }
    
    if (detailsSearch.value) {
      const searchLower = detailsSearch.value.toLowerCase();
      const fieldName = (fieldDef.label || fieldDef.key).toLowerCase();
      const fieldValue = String(displayValue || '').toLowerCase();
      
      if (!fieldName.includes(searchLower) && !fieldValue.includes(searchLower)) {
        continue;
      }
    }
    
    // Enrich lookup fields with targetModule if missing
    let enrichedField = { ...fieldDef };
    if (enrichedField.dataType === 'Lookup (Relationship)' && !enrichedField.lookupSettings?.targetModule) {
      // Derive targetModule from field key
      const targetModule = getTargetModuleFromFieldKey(enrichedField.key);
      if (targetModule) {
        enrichedField = {
          ...enrichedField,
          lookupSettings: {
            ...(enrichedField.lookupSettings || {}),
            targetModule
          }
        };
      }
    }
    
    processed.push({
      field: enrichedField,
      key: fieldDef.key,
      value: displayValue,
      dependencyState: depState
    });
  }
  
  processed.sort((a, b) => {
    const orderA = a.field.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.field.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
  
  return processed;
});

// Format field name
const formatFieldName = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
};

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 1);
};

// Get color for name
const getColorForName = (name) => {
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
  const firstLetter = name ? name.trim()[0] : '?';
  return colors[firstLetter.toUpperCase()] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
};

// Transform activity logs into activity items
const sortedTimelineUpdates = computed(() => {
  return [...timelineUpdates.value].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

const activityItems = computed(() => {
  const items = sortedTimelineUpdates.value.map((update, index) => {
    const action = update.action || '';
    const lowerAction = action.toLowerCase();
    
    let type = 'comment';
    let comment = action;
    let fieldName = '';
    let tags = [];
    let actionText = '';
    
    if (lowerAction.includes('tag')) {
      type = 'tags';
      const tagMatch = action.match(/(?:added|removed)\s+tag\s+"?([^"]+)"?/i);
      if (tagMatch) {
        const tagName = tagMatch[1].replace(/^"|"$/g, '');
        const isRemoved = lowerAction.includes('removed');
        tags = [{ name: tagName, color: 'fill-indigo-500' }];
        actionText = isRemoved ? 'removed tag' : 'added tag';
      }
    } else if (lowerAction.includes('changed') || lowerAction.includes('set') || lowerAction.includes('updated')) {
      type = 'assignment';
      const setMatch = action.match(/set\s+([^"]+?)\s+to\s+"([^"]*)"/i);
      const changeMatch = action.match(/changed\s+([^"]+?)\s+from\s+"([^"]*)"\s+to\s+"([^"]*)"/i);
      
      if (setMatch) {
        fieldName = formatFieldName(setMatch[1].trim());
        actionText = 'set';
        comment = `Set ${fieldName} to "${setMatch[2]}"`;
      } else if (changeMatch) {
        fieldName = formatFieldName(changeMatch[1].trim());
        actionText = 'changed';
        comment = `Changed ${fieldName} from "${changeMatch[2] || 'empty'}" to "${changeMatch[3]}"`;
      }
    }
    
    let userName = update.user || 'System';
    if (typeof userName === 'string' && /^[0-9a-fA-F]{24}$/.test(userName)) {
      userName = 'Unknown User';
    }
    
    return {
      id: `activity-${update.timestamp?.getTime() || index}`,
      type,
      person: { name: userName, href: '#' },
      comment,
      action: actionText,
      fieldName,
      tags,
      date: formatDate(update.timestamp)
    };
  });
  
  return items.filter(item => {
    if (activityFilterUser.value && item.person.name.toLowerCase() !== activityFilterUser.value.toLowerCase()) {
      return false;
    }
    if (activityFilterType.value && item.type !== activityFilterType.value) {
      return false;
    }
    if (activitySearchQuery.value) {
      const query = activitySearchQuery.value.toLowerCase();
      const searchableText = `${item.person.name} ${item.comment} ${item.fieldName}`.toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }
    return true;
  });
});

// Normalize value for comparison
const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};


// Format value for activity log
const formatValueForActivityLog = (value, field) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value._id) {
      // It's a populated object - try to get a display name
      return value.name || value.firstName || value.email || value.title || `[${field}]`;
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'object' && v.name ? v.name : String(v)).join(', ');
  }
  return String(value);
};

// Update field value (track changes, don't save yet)
const updateField = (field, value) => {
  const oldValue = props.row ? props.row[field] : null;
  
  // Normalize values for comparison
  const normalizedOldValue = normalizeValue(oldValue);
  const normalizedNewValue = normalizeValue(value);
  
  // Only proceed if value actually changed
  if (normalizedOldValue === normalizedNewValue) {
    // Clear pending change if value reverted to original
    if (pendingFieldChanges.value[field]) {
      delete pendingFieldChanges.value[field];
    }
    return;
  }
  
  // Update local state immediately for UI responsiveness
  if (props.row) {
    props.row[field] = value;
  }
  
  // Track pending change
  if (!pendingFieldChanges.value[field]) {
    pendingFieldChanges.value[field] = {
      originalValue: oldValue,
      currentValue: value
    };
  } else {
    pendingFieldChanges.value[field].currentValue = value;
  }
};

// Save field and log activity (called on blur)
const saveFieldOnBlur = async (field) => {
  const pendingChange = pendingFieldChanges.value[field];
  
  // If no pending change, nothing to save
  if (!pendingChange) {
    return;
  }
  
  const { originalValue, currentValue } = pendingChange;
  
  // Normalize values for final comparison
  const normalizedOldValue = normalizeValue(originalValue);
  const normalizedNewValue = normalizeValue(currentValue);
  
  // If values are the same, don't save
  if (normalizedOldValue === normalizedNewValue) {
    delete pendingFieldChanges.value[field];
    return;
  }
  
  // Clear pending change before saving
  delete pendingFieldChanges.value[field];
  
  // Emit update event to parent
  emit('update', {
    field,
    value: currentValue,
    onSuccess: async (updatedRecord = null) => {
      await nextTick();
      
      // Log activity
      const fieldName = formatFieldName(field);
      const oldValueFormatted = formatValueForActivityLog(originalValue, field);
      const newValueFormatted = formatValueForActivityLog(currentValue, field);
      
      // Add activity log
      await addActivityLog(`changed ${fieldName} from "${oldValueFormatted}" to "${newValueFormatted}"`);
      
      // Reload activity logs to show the new entry
      if (props.row?._id) {
        loadActivityLogs();
      }
    }
  });
};

// Get current user name for activity logs
const getCurrentUserName = () => {
  if (authStore.user) {
    const firstName = authStore.user.firstName || '';
    const lastName = authStore.user.lastName || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return authStore.user.username || authStore.user.email || 'User';
  }
  return 'System';
};

// Add activity log
const addActivityLog = async (action) => {
  if (!props.row?._id) return;
  
  const recordId = props.row._id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return;
  
  try {
    await apiClient.post(endpoint, {
      user: getCurrentUserName(),
      action,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding activity log:', error);
  }
};

// Watch for drawer open and load data
watch(() => props.show, async (newVal) => {
  if (newVal) {
    activeTab.value = 'summary';
    await fetchModuleDefinition();
    if (props.row?._id) {
      loadActivityLogs();
    }
    // Initialize GridStack when drawer opens and summary tab is active
    if (activeTab.value === 'summary' && moduleDefinition.value) {
      await nextTick();
      initializeGridStack();
    }
  } else {
    // Destroy GridStack when drawer closes
    destroyGridStack();
    // Clear pending changes when drawer closes
    pendingFieldChanges.value = {};
  }
});

// Watch for row changes
watch(() => props.row?._id, (newId) => {
  if (newId && props.show) {
    loadActivityLogs();
  }
});

// Watch for tab changes to load activity logs and initialize GridStack
watch(() => activeTab.value, async (newTab) => {
  if (newTab === 'updates' && props.row?._id && timelineUpdates.value.length === 0) {
    loadActivityLogs();
  }
  if (newTab === 'summary' && props.show && moduleDefinition.value) {
    await nextTick();
    initializeGridStack();
  } else if (newTab !== 'summary') {
    destroyGridStack();
  }
});

// Calculate quick preview drawer offset dynamically
const quickPreviewOffset = ref(64); // Default fallback

// Prevent body scroll when drawer is open
const preventBodyScroll = () => {
  if (props.show) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
};

// Handle wheel events to prevent scroll propagation
const handleWheel = (e) => {
  if (!scrollContainer.value) return;
  
  const container = scrollContainer.value;
  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtTop = scrollTop === 0;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // Allow 1px tolerance
  
  // If scrolling up at the top, prevent propagation
  if (isAtTop && e.deltaY < 0) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // If scrolling down at the bottom, prevent propagation
  if (isAtBottom && e.deltaY > 0) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Allow normal scrolling within bounds
  e.stopPropagation();
};

// Handle touch start for mobile
const handleTouchStart = (e) => {
  if (e.touches.length > 0) {
    touchStartY.value = e.touches[0].clientY;
  }
};

// Handle touch events for mobile
const handleTouchMove = (e) => {
  if (!scrollContainer.value || e.touches.length === 0) return;
  
  const container = scrollContainer.value;
  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtTop = scrollTop === 0;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
  
  const currentY = e.touches[0].clientY;
  const deltaY = currentY - touchStartY.value;
  
  // If at top and trying to scroll up (swiping down), prevent
  if (isAtTop && deltaY > 0) {
    e.preventDefault();
    return false;
  }
  
  // If at bottom and trying to scroll down (swiping up), prevent
  if (isAtBottom && deltaY < 0) {
    e.preventDefault();
    return false;
  }
};

const updateQuickPreviewOffset = () => {
  // Find the tabbar element directly by its characteristics
  // TabBar has: fixed positioning, z-30, border-b, and contains tabs
  const allFixedElements = Array.from(document.querySelectorAll('[class*="fixed"]'));
  const tabbar = allFixedElements.find(el => {
    const styles = getComputedStyle(el);
    const classes = el.className || '';
    return (
      styles.position === 'fixed' &&
      styles.zIndex === '30' &&
      (classes.includes('border-b') || classes.includes('border-gray')) &&
      el.querySelector('[class*="flex"]') // Has flex container inside
    );
  });
  
  if (tabbar) {
    const rect = tabbar.getBoundingClientRect();
    const calculatedOffset = Math.round(rect.bottom);
    if (calculatedOffset > 0) {
      quickPreviewOffset.value = calculatedOffset;
      // Set CSS variable for this component
      document.documentElement.style.setProperty('--quickpreview-offset', `${calculatedOffset}px`);
      return;
    }
  }
  
  // Fallback: try to get the tabbar offset CSS variable
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--tabbar-offset');
  if (cssVar && cssVar.trim()) {
    const value = parseInt(cssVar.trim());
    if (!isNaN(value) && value > 0) {
      quickPreviewOffset.value = value;
      document.documentElement.style.setProperty('--quickpreview-offset', `${value}px`);
      return;
    }
  }
  
  // Final fallback: calculate based on viewport
  // On mobile: header (64px) + tabbar (48px) = 112px
  // On desktop: tabbar (48px) = 48px
  const isMobile = window.innerWidth < 1024;
  const fallbackOffset = isMobile ? 112 : 48;
  quickPreviewOffset.value = fallbackOffset;
  document.documentElement.style.setProperty('--quickpreview-offset', `${fallbackOffset}px`);
};

// Watch for changes when drawer opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    // Prevent body scroll
    preventBodyScroll();
    
    // Multiple attempts to ensure we get the correct offset
    nextTick(() => {
      updateQuickPreviewOffset();
      // Try again after a short delay to catch any late updates
      setTimeout(() => {
        updateQuickPreviewOffset();
      }, 100);
    });
  } else {
    // Restore body scroll
    preventBodyScroll();
    // Clean up CSS variable when drawer closes
    document.documentElement.style.removeProperty('--quickpreview-offset');
  }
});

// Watch for window resize and sidebar toggle
const handleResize = () => {
  if (props.show) {
    updateQuickPreviewOffset();
  }
};

const handleSidebarToggle = () => {
  if (props.show) {
    setTimeout(() => {
      updateQuickPreviewOffset();
    }, 350); // Wait for sidebar animation to complete
  }
};

// Get layout storage key for quick preview drawer
const getLayoutStorageKey = () => {
  return `quickpreview-layout-${props.moduleKey}`;
};

// Initialize GridStack
const initializeGridStack = async () => {
  if (isInitializing) return;
  
  await nextTick();
  await nextTick(); // Extra tick to ensure v-if has rendered
  
  if (!gridStackContainer.value) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }
  
  if (gridStack) {
    destroyGridStack();
  }
  
  if (!document.contains(gridStackContainer.value)) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }

  isInitializing = true;
  
  try {
    gridStack = GridStack.init({
      column: 12,
      cellHeight: 70,
      marginRight: '0.8rem',
      marginLeft: '0rem',
      marginTop: '0rem',
      marginBottom: '0.8rem',
      animate: true,
      disableResize: true, // Disable resize in preview mode
      disableDrag: true, // Disable drag in preview mode
      resizable: { handles: 'all' },
      columnOpts: {
        breakpoints: [
          { w: 600, c: 1 },
          { w: 1024, c: 2 }
        ]
      }
    }, gridStackContainer.value);
    
    setTimeout(async () => {
      isInitializing = false;
      
      if (!gridStack) {
        setTimeout(() => initializeGridStack(), 100);
        return;
      }
      
      try {
        const existingWidgets = gridStack.getGridItems();
        
        if (existingWidgets.length === 0) {
          const savedLayout = await loadSavedLayout();
          if (savedLayout && savedLayout.length > 0) {
            loadSavedWidgets(savedLayout);
          } else {
            loadDefaultWidgets();
          }
        }
      } catch (err) {
        console.error('Error checking GridStack items:', err);
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
  widgetApps.forEach((widgetData) => {
    try {
      if (widgetData.app) {
        widgetData.app.unmount();
      }
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

// Load saved layout
const loadSavedLayout = async () => {
  if (!props.moduleKey) return null;
  
  try {
    const saved = localStorage.getItem(getLayoutStorageKey());
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading saved layout:', error);
  }
  return null;
};

// Load saved widgets
const loadSavedWidgets = (savedLayout) => {
  if (!gridStack) return;
  
  const validWidgetTypes = [
    'related-contacts', 'related-deals', 'related-tasks', 'related-events', 
    'related-organization', 'lifecycle-stage', 'key-fields', 'metrics'
  ];
  
  savedLayout.forEach(widgetData => {
    if (widgetData.type && validWidgetTypes.includes(widgetData.type)) {
      addWidgetToGrid(widgetData.type, widgetData.x, widgetData.y, widgetData.w, widgetData.h);
    }
  });
  
  if (gridStack) {
    setTimeout(() => {
      gridStack.compact();
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
    }, 100);
  }
};

// Load default widgets
const loadDefaultWidgets = () => {
  if (!gridStack) return;
  
  let defaultWidgets = [];
  let yPosition = 0;
  
  defaultWidgets.push(
    { type: 'key-fields', x: 0, y: yPosition, w: 3, h: 4 },
    { type: 'lifecycle-stage', x: 3, y: yPosition, w: 6, h: 4 },
    { type: 'metrics', x: 9, y: yPosition, w: 3, h: 4 }
  );
  yPosition += 4;
  
  if (props.moduleKey === 'organizations') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.moduleKey === 'people') {
    defaultWidgets.push(
      { type: 'related-organization', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.moduleKey === 'deals') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.moduleKey === 'tasks') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.moduleKey === 'events') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-tasks', x: 6, y: yPosition, w: 6, h: 4 }
    );
  }

  defaultWidgets.forEach(widget => {
    addWidgetToGrid(widget.type, widget.x, widget.y, widget.w, widget.h);
  });
  
  if (gridStack) {
    setTimeout(() => {
      gridStack.compact();
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
    }, 100);
  }
};

// Add widget to GridStack
const addWidgetToGrid = (widgetType, x = 0, y = 0, w = 4, h = 3) => {
  if (!gridStack || !gridStackContainer.value) return;
  
  if ((widgetType === 'related-contacts' || widgetType === 'related-deals' || widgetType === 'related-tasks' || widgetType === 'related-events') && !props.row?._id) {
    return;
  }

  const widgetElement = createWidgetElement(widgetType);
  
  const itemEl = document.createElement('div');
  itemEl.className = 'grid-stack-item';
  itemEl.style.margin = '';
  itemEl.style.padding = '0';
  itemEl.setAttribute('data-widget-type', widgetType);
  itemEl.setAttribute('gs-x', x);
  itemEl.setAttribute('gs-y', y);
  itemEl.setAttribute('gs-w', w);
  itemEl.setAttribute('gs-h', h);

  const contentEl = document.createElement('div');
  contentEl.className = 'grid-stack-item-content';
  contentEl.style.padding = '0';
  contentEl.style.height = '100%';
  contentEl.style.width = '100%';
  contentEl.style.overflow = 'hidden';
  contentEl.appendChild(widgetElement);

  itemEl.appendChild(contentEl);
  gridStackContainer.value.appendChild(itemEl);
  
  const widget = gridStack.makeWidget(itemEl);
  gridStack.compact();

  return widget;
};

// Create widget DOM element
const createWidgetElement = (widgetType) => {
  const container = document.createElement('div');
  container.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700/70 p-3 sm:p-4';
  container.style.boxSizing = 'border-box';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-start';
  container.style.justifyContent = 'flex-start';
  container.style.overflow = 'auto';
  
  let Component = null;
  const componentProps = {};
  
  if (props.moduleKey === 'organizations' && props.row?._id) {
    switch (widgetType) {
      case 'related-contacts':
        Component = RelatedContactsWidget;
        componentProps.organizationId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['people'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        componentProps.accountId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.organizationId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Organization';
        componentProps.relatedId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
      case 'metrics':
        Component = MetricsWidget;
        componentProps.stats = {};
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
    }
  } else if (props.row?._id) {
    switch (widgetType) {
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'metrics':
        Component = MetricsWidget;
        componentProps.stats = {};
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.row;
        componentProps.recordType = props.moduleKey;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'related-organization':
        Component = RelatedOrganizationWidget;
        const orgField = props.row.organization;
        if (orgField && typeof orgField === 'object' && orgField._id) {
          componentProps.organization = orgField;
        } else {
          componentProps.organization = null;
        }
        componentProps.moduleDefinition = allModuleDefinitions.value['organizations'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        componentProps.contactId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.contactId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Contact';
        componentProps.relatedId = props.row._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
    }
  }
  
  if (Component) {
    const wrapperComponent = {
      setup() {
        return () => h(Component, componentProps);
      }
    };
    
    const app = createApp(wrapperComponent);
    app.mount(container);
    widgetApps.set(container, { app });
  }
  
  return container;
};

// Watch for CSS variable changes
let observer = null;

onMounted(() => {
  updateQuickPreviewOffset();
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  
  // Watch for CSS variable changes on document root (especially --tabbar-offset)
  observer = new MutationObserver(() => {
    if (props.show) {
      updateQuickPreviewOffset();
    }
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style']
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  if (observer) {
    observer.disconnect();
  }
  // Restore body scroll
  document.body.style.overflow = '';
  // Clean up CSS variable
  document.documentElement.style.removeProperty('--quickpreview-offset');
  destroyGridStack();
});

// Filter visible columns
const visibleColumns = computed(() => {
  return props.columns.filter(col => col.visible !== false);
});

// Helper functions
const columnKey = (column) => {
  if (typeof column === 'string') return column;
  return column.key ?? String(column.label ?? '');
};

const columnLabel = (column) => {
  if (typeof column === 'string') return column;
  return column.label ?? column.key ?? '';
};

const resolveValue = (row, column) => {
  const key = typeof column === 'string' ? column : column.key;
  if (!key) return '';
  
  // Handle nested keys (e.g., 'user.name')
  if (key.includes('.')) {
    return key.split('.').reduce((obj, k) => obj?.[k], row) ?? '';
  }
  
  const value = row?.[key];
  
  // Handle populated relationship fields (lookup fields)
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    if (value.name) return value.name;
    if (value.title) return value.title;
    if (value.firstName && value.lastName) return `${value.firstName} ${value.lastName}`;
    if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`;
    if (value._id) return value;
  }
  
  return value ?? '';
};

// Get record display name
const getRecordDisplayName = (row) => {
  if (!row) return '';
  if (row.name) return row.name;
  if (row.title) return row.title;
  if (row.firstName || row.lastName) {
    return `${row.firstName || ''} ${row.lastName || ''}`.trim();
  }
  if (row.first_name || row.last_name) {
    return `${row.first_name || ''} ${row.last_name || ''}`.trim();
  }
  return '';
};

// Format field value for display
const formatFieldValue = (row, column) => {
  const value = resolveValue(row, column);
  if (value === null || value === undefined || value === '') return null;
  
  // Handle dates
  if (value instanceof Date) {
    return new Date(value).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  // Handle date strings
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  return value;
};

// Check if field is a custom field
const isCustomField = (column) => {
  if (typeof column === 'string') return false;
  // Custom fields typically have specific indicators or are not standard fields
  const standardFields = ['_id', 'id', 'name', 'title', 'first_name', 'last_name', 'firstName', 'lastName', 'email', 'phone', 'createdAt', 'updatedAt', 'created_by', 'updated_by'];
  const key = column.key || '';
  return !standardFields.includes(key.toLowerCase());
};

// Check if there are custom fields
const hasCustomFields = computed(() => {
  if (!props.row) return false;
  return visibleColumns.value.some(col => col.visible !== false && isCustomField(col));
});

// Field icon mapping
const getFieldIcon = (dataType) => {
  const iconMap = {
    'Text': DocumentTextIcon,
    'Number': DocumentTextIcon,
    'Date': CalendarIcon,
    'DateTime': CalendarIcon,
    'Picklist': TagIcon,
    'Multi-Picklist': TagIcon,
    'User': UserIcon,
    'Lookup': LinkIcon,
    'Checkbox': CheckCircleIcon,
    'URL': GlobeAltIcon,
    'Email': DocumentTextIcon,
    'Phone': DocumentTextIcon,
    'Currency': DocumentTextIcon,
    'Percent': DocumentTextIcon,
    'Status': FlagIcon,
    'Priority': FlagIcon,
    'Related': LinkIcon,
    'Parent': ArrowPathIcon
  };
  return iconMap[dataType] || DocumentTextIcon;
};
</script>

