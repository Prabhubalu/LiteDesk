<template>
  <SummaryView
    :record="formattedPerson"
    :record-type="'people'"
    :loading="loading"
    :error="error"
    @close="goBack"
    @update="handleUpdate"
    @edit="editPerson"
    @delete="showDeleteModal = true"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    @record-updated="handleRecordUpdated"
    ref="summaryViewRef"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteModal"
    :record-name="personName"
    record-type="people"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="deletePerson"
  />
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import { UsersIcon } from '@heroicons/vue/24/outline';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const person = ref(null);
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

// Computed property to format person data for SummaryView
const formattedPerson = computed(() => {
  if (!person.value) return null;
  // Explicitly reference fields to ensure reactivity tracking
  // This ensures Vue tracks changes to nested properties like type, lead_status, etc.
  return {
    ...person.value,
    name: `${person.value.first_name || ''} ${person.value.last_name || ''}`.trim() || person.value.email || 'Person',
    // Explicitly include fields that might be changed from header dropdowns to ensure reactivity
    type: person.value.type,
    lead_status: person.value.lead_status,
    contact_status: person.value.contact_status
  };
});

// Computed property for person name in delete modal
const personName = computed(() => {
  if (!person.value) return '';
  return `${person.value.first_name || ''} ${person.value.last_name || ''}`.trim() || person.value.email || '';
});

const fetchPerson = async () => {
  loading.value = true;
  error.value = null;
  try {
    const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
    const endpoint = isAdmin 
      ? `/admin/contacts/${route.params.id}`
      : `/people/${route.params.id}`;
    
    const data = await apiClient(endpoint, {
      method: 'GET'
    });
    
    if (data.success) {
      person.value = data.data;
    }
  } catch (err) {
    console.error('Error fetching person:', err);
    error.value = err.message || 'Failed to load person';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/people');
};

const handleUpdate = async (updateData) => {
  try {
    const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
    const endpoint = isAdmin 
      ? `/admin/contacts/${route.params.id}`
      : `/people/${route.params.id}`;
    
    // Update local state immediately for UI responsiveness
    if (person.value) {
      person.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    const response = await apiClient.put(endpoint, {
      [updateData.field]: updateData.value
    });
    
    // Debug: Check what the backend returned
    if (response.success && response.data) {
      console.log('🔍 Backend response data:', {
        field: updateData.field,
        fieldValue: response.data[updateData.field],
        fieldValueType: typeof response.data[updateData.field],
        isFieldValueObject: response.data[updateData.field] && typeof response.data[updateData.field] === 'object' && !Array.isArray(response.data[updateData.field]),
        assignedToValue: response.data.assignedTo,
        assignedToType: typeof response.data.assignedTo,
        assignedToIsObject: response.data.assignedTo && typeof response.data.assignedTo === 'object' && !Array.isArray(response.data.assignedTo),
        allKeys: Object.keys(response.data).slice(0, 10)
      });
    }
    
    // Update local state with the response (which has populated fields)
    if (response.success && response.data && person.value) {
      // Update the person record with the populated data from the server
      Object.assign(person.value, response.data);
    }
    
    // Call onSuccess callback if provided (for activity logging)
    // Pass the updated record so it can use populated fields for formatting
    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }
  } catch (err) {
    console.error('Error updating person:', err);
    // Revert on error
    fetchPerson();
  }
};

const editPerson = () => {
  console.log('Edit person:', person.value);
};

const deletePerson = async () => {
  deleting.value = true;
  
  try {
    const isAdmin = authStore.isOwner || authStore.userRole === 'admin';
    const endpoint = isAdmin 
      ? `/admin/contacts/${route.params.id}`
      : `/people/${route.params.id}`;
    
    await apiClient.delete(endpoint);
    
    // Close the modal
    showDeleteModal.value = false;
    
    // Get current tab (the record detail tab)
    const currentTabId = activeTabId.value;
    const currentTab = currentTabId ? findTabById(currentTabId) : null;
    
    // Check if People module tab already exists
    const modulePath = '/people';
    const moduleTab = findTabByPath(modulePath);
    
    if (moduleTab) {
      // Module tab exists: switch to it and close the record detail tab
      switchToTab(moduleTab.id);
      // Update tab title to module name in case it was changed
      if (moduleTab.title !== 'People' && moduleTab.title !== 'Contacts') {
        updateTabTitle(moduleTab.id, 'People');
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
        currentTab.title = 'People';
        currentTab.icon = UsersIcon; // Update icon to module icon
        currentTab.params = {}; // Clear record params
        // Navigate to module page
        router.push(modulePath);
      } else {
        // No current tab (shouldn't happen, but fallback)
        openTab(modulePath, {
          title: 'People',
          icon: 'users'
        });
      }
    }
  } catch (err) {
    console.error('Error deleting person:', err);
    alert(err.message || 'Failed to delete person. Please try again.');
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = (relationData) => {
  console.log('Add relation:', relationData);
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('Open related record:', relatedRecord);
};

const handleRecordUpdated = (updatedRecord) => {
  // Update local state with the updated record
  if (updatedRecord && person.value) {
    // Merge the updated record data into the existing person object
    person.value = { ...person.value, ...updatedRecord };
  } else if (updatedRecord) {
    // If person is null, set it to the updated record
    person.value = updatedRecord;
  }
};

onMounted(() => {
  fetchPerson();
});
</script>

