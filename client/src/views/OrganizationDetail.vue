<template>
  <SummaryView
    :record="organization"
    :record-type="'organizations'"
    :loading="loading"
    :error="error"
    :stats="organizationStats"
    @close="goBack"
    @update="handleUpdate"
    @edit="editOrganization"
    @delete="showDeleteModal = true"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    @record-updated="handleRecordUpdated"
    ref="summaryViewRef"
  />

  <!-- Delete Confirmation Modal -->
  <TransitionRoot as="template" :show="showDeleteModal">
    <Dialog class="relative z-50" @close="showDeleteModal = false">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100"
        leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild as="template" enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div
                  class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10 sm:mx-0 sm:size-10">
                  <ExclamationTriangleIcon class="size-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">
                    Delete Organization
                  </DialogTitle>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this organization? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button type="button"
                  class="inline-flex w-full justify-center rounded-md bg-red-600 dark:bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 dark:hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:focus-visible:outline-red-500 sm:ml-3 sm:w-auto"
                  :disabled="deleting"
                  @click="deleteOrganization">
                  <span v-if="deleting">Deleting...</span>
                  <span v-else>Delete</span>
                </button>
                <button type="button"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 sm:mt-0 sm:w-auto"
                  :disabled="deleting"
                  @click="showDeleteModal = false">
                  Cancel
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
import { ref, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { BuildingOfficeIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import SummaryView from '@/components/common/SummaryView.vue';

const router = useRouter();
const route = useRoute();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const organization = ref(null);
const organizationStats = ref({
  contacts: 0,
  users: 0,
  deals: 0
});
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const fetchOrganization = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiClient(`/admin/organizations/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      organization.value = data.data;
      organizationStats.value = data.stats || organizationStats.value;
    }
  } catch (err) {
    console.error('Error fetching organization:', err);
    error.value = err.message || 'Failed to load organization';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/organizations');
};

const handleUpdate = async (updateData) => {
  try {
    // Update local state immediately for UI responsiveness
    if (organization.value) {
      organization.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    await apiClient.put(`/admin/organizations/${route.params.id}`, {
      [updateData.field]: updateData.value
    });
    
    // Call onSuccess callback if provided (for activity logging)
    if (updateData.onSuccess) {
      await updateData.onSuccess();
    }
  } catch (err) {
    console.error('Error updating organization:', err);
    // Revert on error
    fetchOrganization();
  }
};

const editOrganization = () => {
  console.log('Edit organization:', organization.value);
};

const deleteOrganization = async () => {
  deleting.value = true;
  
  try {
    await apiClient.delete(`/admin/organizations/${route.params.id}`);
    
    // Close the modal
    showDeleteModal.value = false;
    
    // Get current tab (the record detail tab)
    const currentTabId = activeTabId.value;
    const currentTab = currentTabId ? findTabById(currentTabId) : null;
    
    // Check if Organizations module tab already exists
    const modulePath = '/organizations';
    const moduleTab = findTabByPath(modulePath);
    
    if (moduleTab) {
      // Module tab exists: switch to it and close the record detail tab
      switchToTab(moduleTab.id);
      // Update tab title to module name in case it was changed
      if (moduleTab.title !== 'Organizations') {
        updateTabTitle(moduleTab.id, 'Organizations');
      }
      // Close the record detail tab
      if (currentTab && currentTab.path !== modulePath) {
        closeTab(currentTab.id);
      }
      // Force refresh the module tab by navigating with a refresh query parameter
      // This ensures the list is updated to reflect the deletion
      await nextTick();
      const refreshPath = `${modulePath}?refresh=${Date.now()}`;
      router.push(refreshPath).then(() => {
        // Remove the refresh parameter after navigation
        nextTick(() => {
          router.replace(modulePath);
        });
      });
    } else {
      // Module tab doesn't exist: update current tab to module page
      if (currentTab) {
        currentTab.path = modulePath;
        currentTab.title = 'Organizations';
        currentTab.icon = BuildingOfficeIcon; // Update icon to module icon
        currentTab.params = {}; // Clear record params
        // Navigate to module page
        router.push(modulePath);
      } else {
        // No current tab (shouldn't happen, but fallback)
        openTab(modulePath, {
          title: 'Organizations',
          icon: 'building'
        });
      }
    }
  } catch (err) {
    console.error('Error deleting organization:', err);
    alert(err.message || 'Failed to delete organization. Please try again.');
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = (relationData) => {
  console.log('Add relation:', relationData);
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('Open related record:', relatedRecord);
  
  // SummaryView will handle tab creation internally
  // We don't need to call addDynamicTab here since handleOpenRelatedRecord
  // in SummaryView already does it
  // Just log for debugging
};

const handleRecordUpdated = (updatedRecord) => {
  // Update local state with the updated record
  if (updatedRecord && organization.value) {
    // Merge the updated record data into the existing organization object
    organization.value = { ...organization.value, ...updatedRecord };
  } else if (updatedRecord) {
    // If organization is null, set it to the updated record
    organization.value = updatedRecord;
  }
};

onMounted(() => {
  fetchOrganization();
});
</script>