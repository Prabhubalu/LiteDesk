<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 sm:p-8" @click="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit Organization' : 'New Organization' }}
          </h2>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Dynamic Form -->
        <form @submit.prevent="handleSubmit(form)" class="p-6 space-y-6">
          <DynamicForm
            module-key="organizations"
            :form-data="form"
            :errors="formErrors"
            @update:form-data="form = $event"
            @ready="onModuleReady"
          />

          <!-- Form Actions -->
          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pt-6 -mx-6 -mb-6 px-6 pb-6 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="saving || !moduleDefinition" 
              class="px-6 py-2.5 rounded-lg bg-brand-600 dark:bg-brand-700 text-white font-medium hover:bg-brand-700 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Saving...' : (isEditing ? 'Update Organization' : 'Create Organization') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import DynamicForm from '@/components/common/DynamicForm.vue';

const props = defineProps({
  organization: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const isEditing = computed(() => !!props.organization);
const saving = ref(false);
const moduleDefinition = ref(null);
const form = ref({});
const formErrors = ref({});

// Initialize form with default values from field definitions
const initializeForm = (module) => {
  const initialForm = {};
  const fields = module.fields || [];
  
  // Set defaults from field definitions
  for (const field of fields) {
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      initialForm[field.key] = field.defaultValue;
    } else {
      // Set empty defaults based on type
      if (field.dataType === 'Multi-Picklist') {
        initialForm[field.key] = [];
      } else if (field.dataType === 'Checkbox') {
        initialForm[field.key] = false;
      } else {
        initialForm[field.key] = '';
      }
    }
  }
  
  // If editing, merge with existing organization data
  if (props.organization) {
    const orgData = { ...props.organization };
    // Handle populated relationships
    if (orgData.assignedTo && typeof orgData.assignedTo === 'object') {
      orgData.assignedTo = orgData.assignedTo._id || orgData.assignedTo;
    }
    if (orgData.accountManager && typeof orgData.accountManager === 'object') {
      orgData.accountManager = orgData.accountManager._id || orgData.accountManager;
    }
    if (orgData.primaryContact && typeof orgData.primaryContact === 'object') {
      orgData.primaryContact = orgData.primaryContact._id || orgData.primaryContact;
    }
    if (orgData.logisticsPartner && typeof orgData.logisticsPartner === 'object') {
      orgData.logisticsPartner = orgData.logisticsPartner._id || orgData.logisticsPartner;
    }
    if (orgData.createdBy && typeof orgData.createdBy === 'object') {
      orgData.createdBy = orgData.createdBy._id || orgData.createdBy;
    }
    
    // Ensure Multi-Picklist fields are arrays
    const fields = module.fields || [];
    for (const field of fields) {
      if (field.dataType === 'Multi-Picklist') {
        const value = orgData[field.key];
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          // Convert to array if it's not already
          orgData[field.key] = [value].filter(Boolean);
        } else if (!value) {
          // Set empty array if missing
          orgData[field.key] = [];
        }
      }
    }
    
    // Merge organization data with form defaults
    form.value = { ...initialForm, ...orgData };
  } else {
    form.value = initialForm;
  }
};

const onModuleReady = (module) => {
  if (module) {
    moduleDefinition.value = module;
    initializeForm(module);
  }
};

const handleSubmit = async (formData) => {
  saving.value = true;
  formErrors.value = {};
  
  try {
    // Validate required fields
    const requiredFields = (moduleDefinition.value?.fields || []).filter(f => f.required);
    for (const field of requiredFields) {
      const value = formData[field.key];
      if (value === null || value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        formErrors.value[field.key] = `${field.label || field.key} is required`;
      }
    }
    
    if (Object.keys(formErrors.value).length > 0) {
      saving.value = false;
      return;
    }
    
    // Clean up form data - remove system fields that shouldn't be sent
    const submitData = { ...formData };
    delete submitData.createdBy; // System field, set by backend
    delete submitData.createdAt;
    delete submitData.updatedAt;
    delete submitData._id;
    delete submitData.__v;
    delete submitData.organizationId; // System field
    
    // Convert empty strings to null for optional fields
    for (const key in submitData) {
      if (submitData[key] === '') {
        submitData[key] = null;
      }
    }
    
    let data;
    if (isEditing.value) {
      // Update organization - use v2 API route
      data = await apiClient.put(`/v2/organization/${props.organization._id}`, submitData);
    } else {
      // Create organization - use v2 API route
      data = await apiClient.post('/v2/organization', submitData);
    }
    
    if (data.success) {
      emit('saved', data.data);
    }
  } catch (error) {
    console.error('Error saving organization:', error);
    alert(error.message || 'Failed to save organization');
  } finally {
    saving.value = false;
  }
};

// Form will be initialized when DynamicForm emits ready event
</script>

