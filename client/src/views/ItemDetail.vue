<template>
  <SummaryView
    :record="item"
    :record-type="'items'"
    :loading="loading"
    :error="error"
    :stats="itemStats"
    @close="goBack"
    @update="handleUpdate"
    @edit="editItem"
    @delete="showDeleteModal = true"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    @record-updated="handleRecordUpdated"
    ref="summaryViewRef"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteModal"
    :record-name="item?.item_name || ''"
    record-type="items"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="deleteItem"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

const router = useRouter();
const route = useRoute();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const item = ref(null);
const itemStats = ref({
  linked_deals: 0,
  linked_forms: 0,
  linked_contacts: 0
});
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const fetchItem = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiClient(`/items/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      item.value = data.data;
      itemStats.value = {
        linked_deals: data.data.linked_deals?.length || 0,
        linked_forms: data.data.linked_forms?.length || 0,
        linked_contacts: data.data.linked_contacts?.length || 0
      };
      
      // Update tab title
      updateTabTitle(activeTabId.value, data.data.item_name || 'Item');
    }
  } catch (err) {
    console.error('Error fetching item:', err);
    error.value = err.message || 'Failed to load item';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/items');
};

const handleUpdate = async (updateData) => {
  try {
    // Update local state immediately for UI responsiveness
    if (item.value) {
      item.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    const response = await apiClient.put(`/items/${route.params.id}`, {
      [updateData.field]: updateData.value
    });
    
    // Update local state with the response (which has populated fields)
    if (response.success && response.data && item.value) {
      Object.assign(item.value, response.data);
    }
    
    // Call onSuccess callback if provided (for activity logging)
    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }
    
    // Update tab title if item_name changed
    if (updateData.field === 'item_name' && item.value?.item_name) {
      updateTabTitle(activeTabId.value, item.value.item_name);
    }
  } catch (err) {
    console.error('Error updating item:', err);
    error.value = err.message || 'Failed to update item';
    throw err;
  }
};

const editItem = () => {
  // SummaryView will handle opening the edit drawer
  if (summaryViewRef.value) {
    summaryViewRef.value.edit();
  }
};

const deleteItem = async () => {
  deleting.value = true;
  try {
    await apiClient.delete(`/items/${route.params.id}`);
    showDeleteModal.value = false;
    
    // Close the tab
    const tab = findTabById(activeTabId.value);
    if (tab) {
      closeTab(tab.id);
    }
    
    // Navigate back to items list
    router.push('/items');
  } catch (err) {
    console.error('Error deleting item:', err);
    error.value = err.message || 'Failed to delete item';
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = async (relationType, relatedId) => {
  try {
    if (relationType === 'deals') {
      await apiClient.post(`/items/${route.params.id}/link-deal`, {
        dealId: relatedId
      });
    }
    
    // Refresh item data to get updated relationships
    await fetchItem();
  } catch (err) {
    console.error('Error adding relation:', err);
    error.value = err.message || 'Failed to add relation';
  }
};

const handleOpenRelatedRecord = (relationType, recordId) => {
  if (relationType === 'deals') {
    openTab(`/deals/${recordId}`, {
      title: 'Deal Detail',
      icon: 'briefcase',
      insertAdjacent: true
    });
  } else if (relationType === 'forms') {
    openTab(`/forms/${recordId}/detail`, {
      title: 'Form Detail',
      icon: 'document-text',
      insertAdjacent: true
    });
  } else if (relationType === 'contacts' || relationType === 'people') {
    openTab(`/people/${recordId}`, {
      title: 'Contact Detail',
      icon: 'user',
      insertAdjacent: true
    });
  }
};

const handleRecordUpdated = async () => {
  await fetchItem();
};

onMounted(() => {
  fetchItem();
});
</script>

