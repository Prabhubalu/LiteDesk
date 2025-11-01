<template>
  <SummaryView
    :record="formattedPerson"
    :record-type="'people'"
    :loading="loading"
    :error="error"
    @close="goBack"
    @update="handleUpdate"
    @edit="editPerson"
    @delete="deletePerson"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    ref="summaryViewRef"
  />
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import SummaryView from '@/components/common/SummaryView.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const person = ref(null);
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);

// Computed property to format person data for SummaryView
const formattedPerson = computed(() => {
  if (!person.value) return null;
  return {
    ...person.value,
    name: `${person.value.first_name || ''} ${person.value.last_name || ''}`.trim() || person.value.email || 'Person'
  };
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
    await apiClient.put(endpoint, {
      [updateData.field]: updateData.value
    });
  } catch (err) {
    console.error('Error updating person:', err);
    // Revert on error
    fetchPerson();
  }
};

const editPerson = () => {
  console.log('Edit person:', person.value);
};

const deletePerson = () => {
  if (confirm('Are you sure you want to delete this person?')) {
    console.log('Delete person:', person.value);
  }
};

const handleAddRelation = (relationData) => {
  console.log('Add relation:', relationData);
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('Open related record:', relatedRecord);
};

onMounted(() => {
  fetchPerson();
});
</script>

