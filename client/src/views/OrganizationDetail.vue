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
    @delete="deleteOrganization"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    ref="summaryViewRef"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import SummaryView from '@/components/common/SummaryView.vue';

const router = useRouter();
const route = useRoute();

const organization = ref(null);
const organizationStats = ref({
  contacts: 0,
  users: 0,
  deals: 0
});
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);

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
  } catch (err) {
    console.error('Error updating organization:', err);
    // Revert on error
    fetchOrganization();
  }
};

const editOrganization = () => {
  console.log('Edit organization:', organization.value);
};

const deleteOrganization = () => {
  if (confirm('Are you sure you want to delete this organization?')) {
    console.log('Delete organization:', organization.value);
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

onMounted(() => {
  fetchOrganization();
});
</script>