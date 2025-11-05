<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleDialogClose">
      <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild as="template" enter="transform transition ease-in-out duration-300 sm:duration-300" enter-from="translate-x-full" enter-to="translate-x-0" leave="transform transition ease-in-out duration-300 sm:duration-300" leave-from="translate-x-0" leave-to="translate-x-full">
              <DialogPanel class="pointer-events-auto w-screen max-w-3xl">
                <div class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <!-- Header -->
                  <div class="flex items-center justify-between px-6 py-4 bg-indigo-700 dark:bg-indigo-800">
                    <DialogTitle class="text-base font-semibold text-white">{{ computedTitle }}</DialogTitle>
                    <button type="button" class="rounded-md text-indigo-200 hover:text-white" @click="closeDrawer">
                      <span class="sr-only">Close panel</span>
                      <XMarkIcon class="size-6" />
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="flex-1 overflow-hidden flex flex-col">
                    <!-- Search -->
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                      <input v-model="searchQuery" type="text" placeholder="Search..." class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10" />
                    </div>

                    <!-- List -->
                    <div class="flex-1 overflow-auto p-4">
                      <div v-if="loading" class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                      </div>
                      <div v-else>
                        <div v-if="visibleItems.length === 0" class="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No records found</div>
                        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                          <li 
                            v-for="item in visibleItems" 
                            :key="item._id" 
                            :class="[
                              'flex items-center gap-3 py-3 px-2 rounded-md',
                              isPrelinked(item._id) ? 'bg-gray-50 dark:bg-gray-900/40 opacity-80' : ''
                            ]"
                          >
                            <!-- Checkbox on the left for easy selection -->
                            <div class="shrink-0">
                              <input 
                                v-if="multiple" 
                                type="checkbox" 
                                class="w-4 h-4"
                                :checked="isSelected(item._id) || isPrelinked(item._id)"
                                :disabled="isPrelinked(item._id)"
                                @change="toggleSelect(item)"
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ getDisplayName(item) }}</p>
                              <p v-if="getSecondaryText(item)" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ getSecondaryText(item) }}</p>
                            </div>
                            <div class="shrink-0" v-if="!multiple">
                              <button type="button" class="rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" @click="selectSingle(item)">
                                Select
                              </button>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="text-xs text-gray-500 dark:text-gray-400" v-if="multiple">{{ deltaCount }} selected</div>
                    <div class="ml-auto flex gap-3">
                      <button type="button" class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" @click="closeDrawer">Cancel</button>
                      <button type="button" :disabled="multiple && deltaCount === 0" class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50" @click="confirmLink">Link</button>
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
import { ref, watch, computed } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  moduleKey: { type: String, required: true },
  multiple: { type: Boolean, default: true },
  title: { type: String, default: null },
  context: { type: Object, default: () => ({}) }, // e.g., { organizationId, contactId }
  preselectedIds: { type: Array, default: () => [] } // already linked IDs
});

const emit = defineEmits(['close', 'linked']);

const loading = ref(false);
const items = ref([]);
const searchQuery = ref('');
const selectedIds = ref(new Set());
const prelinkedIds = ref(new Set());
let searchDebounce = null;

// Auth role
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isOwner || authStore.userRole === 'admin');

const deltaSelectedIds = computed(() => {
  const out = new Set();
  for (const id of selectedIds.value) {
    if (!prelinkedIds.value.has(id)) out.add(id);
  }
  return out;
});

const deltaCount = computed(() => deltaSelectedIds.value.size);

const computedTitle = computed(() => props.title || `Link ${capitalize(props.moduleKey)}`);

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Client-side filtered view to ensure search works even if backend doesn't support it
const visibleItems = computed(() => {
  const q = (searchQuery.value || '').trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((it) => {
    const primary = (getDisplayName(it) || '').toLowerCase();
    const secondary = (getSecondaryText(it) || '').toLowerCase();
    return primary.includes(q) || secondary.includes(q);
  });
});

const closeDrawer = () => {
  emit('close');
  // reset selection when closing
  selectedIds.value = new Set();
  searchQuery.value = '';
  prelinkedIds.value = new Set();
};

// Allow closing only when no selection changes were made
const handleDialogClose = () => {
  if (props.multiple && deltaCount.value > 0) {
    return; // block close on unsaved changes
  }
  closeDrawer();
};

const endpointForModule = (moduleKey) => {
  if (moduleKey === 'organizations' || moduleKey === 'organization') {
    return isAdmin.value ? '/admin/organizations/all' : '/v2/organization';
  }
  return `/${moduleKey}`;
};

// Build params to fetch already-linked records for the current context
const buildLinkedFilterParams = (moduleKey, context) => {
  const params = { limit: 1000 };
  if (!context) return params;
  // Link targets based on module and context
  if (moduleKey === 'people' && context.organizationId) {
    params.organization = context.organizationId;
  } else if (moduleKey === 'deals') {
    if (context.contactId) params.contactId = context.contactId;
    else if (context.organizationId) params.accountId = context.organizationId;
  } else if (moduleKey === 'tasks') {
    if (context.contactId) params.contactId = context.contactId;
    else if (context.organizationId) params.organizationId = context.organizationId;
  } else if (moduleKey === 'events') {
    if (context.contactId) { params.relatedType = 'Contact'; params.relatedId = context.contactId; }
    else if (context.organizationId) { params.relatedType = 'Organization'; params.relatedId = context.organizationId; }
  } else if (moduleKey === 'organizations' && context.contactId) {
    // For organizations linked to a contact, we need to fetch the contact first to get its organization
    // Return null to indicate we should fetch the contact instead
    return null;
  }
  return params;
};

const fetchPrelinked = async () => {
  try {
    // Special case: when linking organizations to a contact, fetch the contact to get its current organization
    if (props.moduleKey === 'organizations' && props.context?.contactId) {
      try {
        const contactRes = await apiClient.get(`/people/${props.context.contactId}`);
        if (contactRes?.success && contactRes.data?.organization) {
          const orgId = typeof contactRes.data.organization === 'object' 
            ? contactRes.data.organization._id 
            : contactRes.data.organization;
          if (orgId) {
            prelinkedIds.value = new Set([orgId]);
            selectedIds.value = new Set([orgId, ...selectedIds.value]);
          }
        }
      } catch (e) {
        // ignore
      }
      return;
    }
    
    const params = buildLinkedFilterParams(props.moduleKey, props.context);
    // If params is null, we've already handled it above
    if (params === null) return;
    
    const endpoint = endpointForModule(props.moduleKey);
    const res = await apiClient.get(endpoint, { params });
    let rows = [];
    if (res?.success) rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const ids = rows.map(r => r?._id).filter(Boolean);
    prelinkedIds.value = new Set(ids);
    selectedIds.value = new Set([...ids, ...selectedIds.value]);
  } catch (e) {
    // ignore
  }
};

const fetchItems = async () => {
  loading.value = true;
  try {
    const params = { limit: 50 };
    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }
    const endpoint = endpointForModule(props.moduleKey);
    const res = await apiClient.get(endpoint, { params });
    if (res.success) {
      let rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      // Non-admin organizations endpoint returns a single organization object
      if ((props.moduleKey === 'organizations' || props.moduleKey === 'organization') && !isAdmin.value && !Array.isArray(res.data) && res.data && res.data._id) {
        rows = [res.data];
      }
      items.value = rows;
    } else {
      items.value = Array.isArray(res) ? res : [];
    }
    // Initialize prelinked selection/disable state
    if (prelinkedIds.value.size > 0) {
      // Ensure prelinked are also in selected set for consistency
      selectedIds.value = new Set([...prelinkedIds.value, ...selectedIds.value]);
    }
  } catch (e) {
    items.value = [];
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, async (open) => { 
  if (open) {
    // seed prelinked from prop
    prelinkedIds.value = new Set(props.preselectedIds || []);
    selectedIds.value = new Set(props.preselectedIds || []);
    // additionally fetch prelinked from server based on context
    await fetchPrelinked();
    await fetchItems();
  }
});

watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => fetchItems(), 250);
});

const getDisplayName = (item) => item.name || item.title || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email || item._id;
const getSecondaryText = (item) => item.email || item.status || '';

const isSelected = (id) => selectedIds.value.has(id);
const isPrelinked = (id) => prelinkedIds.value.has(id);
const toggleSelect = (item) => {
  const id = item._id;
  if (isPrelinked(id)) return; // do nothing for prelinked/disabled
  if (selectedIds.value.has(id)) selectedIds.value.delete(id); else selectedIds.value.add(id);
  selectedIds.value = new Set(selectedIds.value);
};
const selectSingle = (item) => { if (isPrelinked(item._id)) return; selectedIds.value = new Set([item._id]); confirmLink(); };

const confirmLink = () => {
  const idsToLink = Array.from(deltaSelectedIds.value);
  if (props.multiple && idsToLink.length === 0) return;
  emit('linked', { moduleKey: props.moduleKey, ids: idsToLink, context: props.context });
  closeDrawer();
};
</script>

<style scoped>
</style>


