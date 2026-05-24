<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <DialogTitle as="h3" class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('records.genericLinkDrawerLink') }}</DialogTitle>
                <button
                  type="button"
                  @click="handleClose"
                  class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon class="w-5 h-5" />
                </button>
              </div>

              <!-- Body -->
              <div class="px-6 py-4 space-y-4">
                <!-- Module Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('records.linkRecordModalRecordType') }}</label>
                  <Listbox v-model="selectedModule">
                    <div class="relative">
                      <ListboxButton
                        class="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-2.5 pl-4 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <span v-if="selectedModule" class="flex items-center gap-2">
                          <component
                            :is="getModuleIcon(selectedModule.key)"
                            class="w-5 h-5 text-gray-500 dark:text-gray-400"
                          />
                          <span class="block truncate text-gray-900 dark:text-white">{{ selectedModule.label }}</span>
                        </span>
                        <span v-else class="block truncate text-gray-400 dark:text-gray-500">{{ t('records.linkRecordModalSelectARecordType') }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </span>
                      </ListboxButton>
                      <Transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions
                          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                        >
                          <ListboxOption
                            v-for="module in availableModules"
                            :key="module.key"
                            :value="module"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-pointer select-none py-2.5 pl-4 pr-10 flex items-center gap-2',
                                active ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                              ]"
                            >
                              <component
                                :is="getModuleIcon(module.key)"
                                :class="[
                                  'w-5 h-5',
                                  active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                                ]"
                              />
                              <span
                                :class="[
                                  'block truncate',
                                  selected ? 'font-medium text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'
                                ]"
                              >
                                {{ module.label }}
                              </span>
                              <span
                                v-if="selected"
                                class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                              >
                                <CheckIcon class="h-5 w-5" aria-hidden="true" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </Transition>
                    </div>
                  </Listbox>
                </div>

                <!-- Record Search (only show after module selected) -->
                <div v-if="selectedModule">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Search {{ selectedModule.label }}
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      ref="searchInputRef"
                      v-model="searchQuery"
                      type="text"
                      :placeholder="`Search ${selectedModule.label.toLowerCase()}...`"
                      class="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      @input="handleSearchInput"
                    />
                    <div v-if="searching" class="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    </div>
                  </div>

                  <!-- Search Results -->
                  <div
                    v-if="searchQuery && searchResults.length > 0"
                    class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                  >
                    <button
                      v-for="record in searchResults"
                      :key="record._id"
                      type="button"
                      @click="selectRecord(record)"
                      :class="[
                        'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0',
                        selectedRecord?._id === record._id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      ]"
                    >
                      <div class="flex items-center gap-3">
                        <component
                          :is="getModuleIcon(selectedModule.key)"
                          class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {{ getRecordDisplayName(record) }}
                          </div>
                          <div v-if="getRecordSubtitle(record)" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {{ getRecordSubtitle(record) }}
                          </div>
                        </div>
                        <CheckIcon
                          v-if="selectedRecord?._id === record._id"
                          class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                        />
                      </div>
                    </button>
                  </div>

                  <!-- No Results -->
                  <div
                    v-else-if="searchQuery && !searching && searchResults.length === 0 && hasSearched"
                    class="mt-2 px-4 py-6 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      No {{ selectedModule.label.toLowerCase() }} found matching "{{ searchQuery }}"
                    </p>
                  </div>

                  <!-- Selected Record Preview -->
                  <div
                    v-if="selectedRecord && !searchQuery"
                    class="mt-2 px-4 py-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20"
                  >
                    <div class="flex items-center gap-3">
                      <component
                        :is="getModuleIcon(selectedModule.key)"
                        class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {{ getRecordDisplayName(selectedRecord) }}
                        </div>
                        <div v-if="getRecordSubtitle(selectedRecord)" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {{ getRecordSubtitle(selectedRecord) }}
                        </div>
                      </div>
                      <button
                        type="button"
                        @click="clearSelection"
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors"
                      >
                        <XMarkIcon class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  type="button"
                  @click="handleClose"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >{{ t('performance.cancelWizard') }}</button>
                <button
                  type="button"
                  @click="handleConfirm"
                  :disabled="!canConfirm || linking"
                  :class="[
                    'px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors',
                    canConfirm && !linking
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-indigo-400 cursor-not-allowed'
                  ]"
                >
                  <span v-if="linking" class="flex items-center gap-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>{{ t('records.linkRecordModalLinking') }}</span>
                  <span v-else>{{ t('records.genericLinkDrawerLink') }}</span>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, nextTick } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption
} from '@headlessui/vue';
import {
  XMarkIcon,
  ChevronUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  availableModules: {
    type: Array,
    default: () => [
      { key: 'project', label: 'Project', endpoint: '/projects' },
      { key: 'deal', label: 'Deal', endpoint: '/deals' },
      { key: 'event', label: 'Event', endpoint: '/events' },
      { key: 'form', label: 'Form', endpoint: '/forms' },
      { key: 'person', label: 'Person', endpoint: '/people' },
      { key: 'organization', label: 'Organization', endpoint: '/organizations' }
    ]
  },
  excludeRecordIds: {
    type: Array,
    default: () => []
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'confirm']);

// State
const selectedModule = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);
const selectedRecord = ref(null);
const searching = ref(false);
const linking = ref(false);
const hasSearched = ref(false);
const searchInputRef = ref(null);

// Debounce timer
let searchDebounceTimer = null;

// Computed
const canConfirm = computed(() => {
  return selectedModule.value && selectedRecord.value;
});

// Module icon mapping
const getModuleIcon = (moduleKey) => {
  const iconMap = {
    project: FolderIcon,
    deal: CurrencyDollarIcon,
    event: CalendarIcon,
    form: DocumentTextIcon,
    person: UserGroupIcon,
    organization: BuildingOfficeIcon,
    case: ClipboardDocumentListIcon
  };
  return iconMap[moduleKey] || DocumentTextIcon;
};

// Get display name for a record
const getRecordDisplayName = (record) => {
  return record.name || record.title || record.firstName 
    ? `${record.firstName || ''} ${record.lastName || ''}`.trim() 
    : record._id?.slice(-8);
};

// Get subtitle for a record (secondary info)
const getRecordSubtitle = (record) => {
  if (record.email) return record.email;
  if (record.company) return record.company;
  if (record.startDate) {
    return new Date(record.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return null;
};

// Handle search input with debounce
const handleSearchInput = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    hasSearched.value = false;
    return;
  }
  
  searchDebounceTimer = setTimeout(() => {
    performSearch();
  }, 300);
};

// Perform the actual search
const performSearch = async () => {
  if (!selectedModule.value || !searchQuery.value) return;
  
  searching.value = true;
  hasSearched.value = false;
  
  try {
    const endpoint = selectedModule.value.endpoint;
    const response = await apiClient.get(`${endpoint}?search=${encodeURIComponent(searchQuery.value)}&limit=10`);
    
    let results = [];
    if (response.success && Array.isArray(response.data)) {
      results = response.data;
    } else if (Array.isArray(response)) {
      results = response;
    } else if (response.data && Array.isArray(response.data.items)) {
      results = response.data.items;
    } else if (response.data && Array.isArray(response.data.records)) {
      results = response.data.records;
    }
    
    // Filter out already linked records
    if (props.excludeRecordIds.length > 0) {
      results = results.filter(r => !props.excludeRecordIds.includes(r._id));
    }
    
    searchResults.value = results;
    hasSearched.value = true;
  } catch (err) {
    console.error('Error searching records:', err);
    searchResults.value = [];
    hasSearched.value = true;
  } finally {
    searching.value = false;
  }
};

// Select a record from search results
const selectRecord = (record) => {
  selectedRecord.value = record;
  searchQuery.value = '';
  searchResults.value = [];
};

// Clear selection
const clearSelection = () => {
  selectedRecord.value = null;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
};

// Handle close
const handleClose = () => {
  if (!linking.value) {
    emit('close');
  }
};

// Handle confirm
const handleConfirm = () => {
  if (!canConfirm.value || linking.value) return;
  
  linking.value = true;
  emit('confirm', {
    module: selectedModule.value.key,
    moduleLabel: selectedModule.value.label,
    recordId: selectedRecord.value._id,
    record: selectedRecord.value
  });
};

// Reset linking state (called by parent after API success/failure)
const resetLinkingState = () => {
  linking.value = false;
};

// Reset form when modal opens/closes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Reset state when modal opens
    selectedModule.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    selectedRecord.value = null;
    searching.value = false;
    linking.value = false;
    hasSearched.value = false;
  }
});

// Focus search input when module is selected
watch(selectedModule, (module) => {
  if (module) {
    selectedRecord.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    hasSearched.value = false;
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
});

// Expose methods for parent
defineExpose({
  resetLinkingState
});
</script>
