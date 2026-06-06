<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-3xl">
                <div class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <!-- Header -->
                  <div class="flex items-center justify-between px-6 py-4 bg-indigo-700 dark:bg-indigo-800">
                    <DialogTitle class="text-base font-semibold text-white">
                      Link {{ relationship.label }}
                    </DialogTitle>
                    <button
                      type="button"
                      class="rounded-md text-indigo-200 hover:text-white"
                      @click="handleClose"
                    >
                      <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                      <XMarkIcon class="size-6" />
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="flex-1 overflow-hidden flex flex-col">
                    <!-- Search -->
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                      <input
                        v-model="searchQuery"
                        type="text"
                        :placeholder="t('common.searchPlaceholder')"
                        class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10"
                      />
                    </div>

                    <!-- List -->
                    <div class="flex-1 overflow-auto p-4">
                      <div v-if="loading" class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                      <div v-else>
                        <div
                          v-if="visibleItems.length === 0"
                          class="text-center text-sm text-gray-500 dark:text-gray-400 py-8"
                        >{{ t('common.formNoRecordsFound') }}</div>
                        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                          <li
                            v-for="item in visibleItems"
                            :key="item._id"
                            :class="[
                              'flex items-center gap-3 py-3 px-2 rounded-md cursor-pointer',
                              isSelected(item._id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            ]"
                            @click="toggleSelect(item)"
                          >
                            <div class="shrink-0">
                              <HeadlessCheckbox
                                class="w-4 h-4"
                                :checked="isSelected(item._id)"
                                checkbox-class="w-4 h-4"
                                @change="toggleSelect(item)"
                                @click.stop
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {{ getDisplayName(item) }}
                              </p>
                              <p v-if="getSecondaryText(item)" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {{ getSecondaryText(item) }}
                              </p>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ selectedIds.size }} selected
                    </div>
                    <div class="ml-auto flex gap-3">
                      <button
                        type="button"
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        @click="handleClose"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button
                        type="button"
                        :disabled="selectedIds.size === 0"
                        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50"
                        @click="confirmLink"
                      >{{ t('settings.modFieldsPbResourceLink') }}</button>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { getRecordLabel } from '@/utils/recordDisplay';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  relationship: { type: Object, required: true },
  sourceRecord: { type: Object, required: true }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'linked']);

const loading = ref(false);
const items = ref([]);
const searchQuery = ref('');
const selectedIds = ref(new Set());
let searchDebounce = null;

// Get target module and app from relationship
const targetInfo = computed(() => {
  // The backend provides target info in the relationship object
  if (props.relationship.target) {
    return {
      appKey: props.relationship.target.appKey || props.sourceRecord.appKey,
      moduleKey: props.relationship.target.moduleKey || 'unknown'
    };
  }
  
  // Fallback: use source as default (should not happen if backend is correct)
  console.warn('[RelationshipLinkPicker] Missing target info in relationship:', props.relationship);
  return {
    appKey: props.sourceRecord.appKey,
    moduleKey: 'unknown'
  };
});

// Client-side filtered view
const visibleItems = computed(() => {
  const q = (searchQuery.value || '').trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((it) => {
    const primary = (getDisplayName(it) || '').toLowerCase();
    const secondary = (getSecondaryText(it) || '').toLowerCase();
    return primary.includes(q) || secondary.includes(q);
  });
});

// Get endpoint for target module
const getEndpoint = (appKey, moduleKey) => {
  const normalizedApp = appKey?.toLowerCase() || 'crm';
  const normalizedModule = moduleKey?.toLowerCase() || 'unknown';
  
  // Use generic API pattern: /api/{appKey}/{moduleKey}
  // For CRM, use existing endpoints
  if (normalizedApp === 'crm') {
    if (normalizedModule === 'organizations' || normalizedModule === 'organization') {
      return '/v2/organization';
    }
    return `/${normalizedModule}`;
  }
  
  // For other apps, use generic pattern
  return `/${normalizedApp}/${normalizedModule}`;
};

// Fetch records
const fetchItems = async () => {
  loading.value = true;
  try {
    const params = { limit: 50 };
    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }
    
    const endpoint = getEndpoint(targetInfo.value.appKey, targetInfo.value.moduleKey);
    const res = await apiClient.get(endpoint, { params });
    
    if (res.success) {
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      items.value = rows;
    } else {
      items.value = [];
    }
  } catch (e) {
    console.error('[RelationshipLinkPicker] Error fetching items:', e);
    items.value = [];
  } finally {
    loading.value = false;
  }
};

// Watch for search query changes
watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => fetchItems(), 250);
});

// Watch for modal open
watch(() => props.isOpen, (open) => {
  if (open) {
    selectedIds.value = new Set();
    searchQuery.value = '';
    fetchItems();
  }
});

const getDisplayName = (item) => getRecordLabel(item);

const getSecondaryText = (item) => {
  return item.email || item.status || '';
};

const isSelected = (id) => selectedIds.value.has(id);

const toggleSelect = (item) => {
  const id = item._id;
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  selectedIds.value = new Set(selectedIds.value);
};

const handleClose = () => {
  emit('close');
  selectedIds.value = new Set();
  searchQuery.value = '';
};

const confirmLink = async () => {
  if (selectedIds.value.size === 0) return;

  const idsToLink = Array.from(selectedIds.value);
  
  // Link each record
  const linkPromises = idsToLink.map(async (targetId) => {
    try {
      await apiClient.post('/relationships/link', {
        relationshipKey: props.relationship.relationshipKey,
        source: {
          appKey: props.sourceRecord.appKey,
          moduleKey: props.sourceRecord.moduleKey,
          recordId: props.sourceRecord.recordId
        },
        target: {
          appKey: targetInfo.value.appKey,
          moduleKey: targetInfo.value.moduleKey,
          recordId: targetId
        }
      });
    } catch (error) {
      console.error('[RelationshipLinkPicker] Error linking record:', error);
      throw error;
    }
  });

  try {
    await Promise.all(linkPromises);
    emit('linked', { ids: idsToLink });
    handleClose();
  } catch (error) {
    // Error handling is done in the catch block above
    // Could emit an error event here if needed
    console.error('[RelationshipLinkPicker] Failed to link records:', error);
  }
};
</script>

<style scoped>
</style>

