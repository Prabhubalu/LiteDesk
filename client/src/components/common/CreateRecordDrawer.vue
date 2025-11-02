<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="closeDrawer">
      <!-- Background overlay -->
      <TransitionChild
        as="template"
        enter="ease-out duration-400"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-400"
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
              enter="transform transition ease-in-out duration-500 sm:duration-700" 
              enter-from="translate-x-full" 
              enter-to="translate-x-0" 
              leave="transform transition ease-in-out duration-500 sm:duration-700" 
              leave-from="translate-x-0" 
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-2xl">
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div class="bg-indigo-700 dark:bg-indigo-800 px-4 py-6 sm:px-6">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-base font-semibold text-white">{{ computedTitle }}</DialogTitle>
                        <div class="ml-3 flex h-7 items-center">
                          <button 
                            type="button" 
                            class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" 
                            @click="closeDrawer"
                          >
                            <span class="absolute -inset-2.5"></span>
                            <span class="sr-only">Close panel</span>
                            <XMarkIcon class="size-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div class="mt-1">
                        <p class="text-sm text-indigo-300">{{ computedDescription }}</p>
                      </div>
                    </div>
                    <div class="flex flex-1 flex-col justify-between">
                      <div class="divide-y divide-gray-200 dark:divide-gray-700 px-4 sm:px-6">
                        <div class="space-y-6 pt-6 pb-5">
                          <!-- General Error Message -->
                          <div v-if="errors._general" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                            <div class="flex">
                              <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                              </div>
                              <div class="ml-3">
                                <p class="text-sm text-red-800 dark:text-red-200">{{ errors._general }}</p>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Dynamic Form -->
                          <DynamicForm
                            :moduleKey="moduleKey"
                            :formData="formData"
                            :errors="errors"
                            @update:formData="updateFormData"
                            @ready="onFormReady"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex shrink-0 justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <button 
                      type="button" 
                      class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" 
                      @click="closeDrawer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      :disabled="saving" 
                      class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ saving ? 'Saving...' : (isEditing ? 'Update' : 'Save') }}
                    </button>
                  </div>
                </form>
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
import DynamicForm from './DynamicForm.vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  moduleKey: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: null // Will be computed from moduleKey and record
  },
  description: {
    type: String,
    default: null // Will be computed from moduleKey and record
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  record: {
    type: Object,
    default: null // If provided, this is edit mode
  }
});

const emit = defineEmits(['close', 'saved']);

const isEditing = computed(() => !!props.record);

// Module name mapping for titles
const moduleNameMap = {
  'people': 'Contact',
  'organizations': 'Organization',
  'deals': 'Deal',
  'tasks': 'Task',
  'events': 'Event',
  'users': 'User'
};

const computedTitle = computed(() => {
  if (props.title) return props.title;
  const moduleName = moduleNameMap[props.moduleKey] || props.moduleKey;
  return isEditing.value ? `Edit ${moduleName}` : `New ${moduleName}`;
});

const computedDescription = computed(() => {
  if (props.description) return props.description;
  const moduleName = moduleNameMap[props.moduleKey] || props.moduleKey;
  return isEditing.value 
    ? `Update the ${moduleName.toLowerCase()} information below.`
    : `Fill in the information below to create a new ${moduleName.toLowerCase()}.`;
});

const formData = ref({ ...props.initialData });
const errors = ref({});
const saving = ref(false);
const moduleDefinition = ref(null);

const closeDrawer = () => {
  if (!saving.value) {
    emit('close');
    // Reset form after closing
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
    }, 300);
  }
};

const updateFormData = (data) => {
  formData.value = { ...data };
};

const initializeForm = (module) => {
  if (!module) return;
  
  const initialForm = {};
  const fields = module.fields || [];
  
  // Set defaults from field definitions
  for (const field of fields) {
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      initialForm[field.key] = field.defaultValue;
    } else {
      // Set empty defaults based on type
      if (field.dataType === 'Multi-Picklist' || field.key === 'tags') {
        initialForm[field.key] = [];
      } else if (field.dataType === 'Checkbox') {
        initialForm[field.key] = false;
      } else {
        initialForm[field.key] = '';
      }
    }
  }
  
  // If editing, merge with existing record data
  if (props.record) {
    const recordData = { ...props.record };
    
    // Handle populated relationships - convert objects to IDs
    Object.keys(recordData).forEach(key => {
      const value = recordData[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && value._id) {
        recordData[key] = value._id;
      }
    });
    
    // Ensure Multi-Picklist fields are arrays
    for (const field of fields) {
      if (field.dataType === 'Multi-Picklist') {
        const value = recordData[field.key];
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          recordData[field.key] = [value].filter(Boolean);
        } else if (!value) {
          recordData[field.key] = [];
        }
      }
    }
    
    // Merge record data with form defaults
    formData.value = { ...initialForm, ...recordData };
  } else {
    // For new records, merge with initialData if provided
    if (Object.keys(props.initialData).length > 0) {
      formData.value = { ...initialForm, ...props.initialData };
    } else {
      formData.value = initialForm;
    }
  }
};

const onFormReady = (module) => {
  // Store module definition for validation
  if (module) {
    moduleDefinition.value = module;
    initializeForm(module);
  }
};

// Watch for record changes to re-initialize form when editing
watch(() => props.record, () => {
  if (moduleDefinition.value && props.record) {
    initializeForm(moduleDefinition.value);
  }
}, { deep: true });

// Watch for form data changes and clear errors for fields that are now valid
watch(() => formData.value, (newFormData, oldFormData) => {
  if (!moduleDefinition.value || !oldFormData) return;
  
  // Check which fields have changed
  const changedFields = new Set();
  for (const key in newFormData) {
    if (newFormData[key] !== oldFormData[key]) {
      changedFields.add(key);
    }
  }
  
  // For each changed field that has an error, check if it's now valid
  for (const fieldKey of changedFields) {
    if (errors.value[fieldKey]) {
      const value = newFormData[fieldKey];
      const isEmpty = value === null || 
                     value === undefined || 
                     value === '' || 
                     (Array.isArray(value) && value.length === 0);
      
      // If field is no longer empty and has an error, clear it
      // This handles both client-side validation errors and backend validation errors
      if (!isEmpty) {
        delete errors.value[fieldKey];
      }
    }
  }
}, { deep: true });

const handleSubmit = async () => {
  errors.value = {};
  saving.value = true;

  try {
    // Client-side validation (like ContactFormModal)
    if (moduleDefinition.value?.fields) {
      // System fields that are auto-set by backend
      const systemFieldKeys = ['organizationid', 'createdby', 'createdat', 'updatedat', '_id', '__v', 'activitylogs'];
      
      // Get required fields (excluding system fields)
      const requiredFields = moduleDefinition.value.fields
        .filter(f => f.required && !systemFieldKeys.includes(f.key?.toLowerCase()));
      
      // Validate each required field
      for (const field of requiredFields) {
        const value = formData.value[field.key];
        const isEmpty = value === null || 
                       value === undefined || 
                       value === '' || 
                       (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          errors.value[field.key] = `${field.label || field.key} is required`;
        }
      }
      
      // If validation fails, stop here
      if (Object.keys(errors.value).length > 0) {
        saving.value = false;
        return;
      }
    }
    
    // Clean up form data - remove system fields that shouldn't be sent
    const submitData = { ...formData.value };
    delete submitData.createdBy;
    delete submitData.organizationId;
    delete submitData.organizationid;
    delete submitData.createdAt;
    delete submitData.updatedAt;
    delete submitData._id;
    delete submitData.__v;
    
    // Handle organization field - ensure it's an ObjectId string, not an object
    if (submitData.organization && typeof submitData.organization === 'object') {
      submitData.organization = submitData.organization._id || submitData.organization;
    }
    
    // Convert empty strings to null for optional fields (but preserve organization if it's explicitly set)
    for (const key in submitData) {
      if (submitData[key] === '' && key !== 'organization') {
        submitData[key] = null;
      }
    }
    
    // If organization is empty string, convert to null
    if (submitData.organization === '') {
      submitData.organization = null;
    }
    
    // Determine API endpoint based on module key
    // Note: apiClient already prepends /api, so we don't include it here
    let endpoint = '';
    const moduleEndpointMap = {
      'people': '/people',
      'organizations': '/v2/organization',
      'deals': '/deals',
      'tasks': '/tasks',
      'events': '/events',
      'users': '/users'
    };
    
    endpoint = moduleEndpointMap[props.moduleKey] || `/${props.moduleKey}`;
    
    let response;
    if (isEditing.value && props.record?._id) {
      // Update existing record
      response = await apiClient.put(`${endpoint}/${props.record._id}`, submitData);
    } else {
      // Create new record
      response = await apiClient.post(endpoint, submitData);
    }
    
    if (response.success || response.data) {
      saving.value = false; // Reset saving state before closing
      emit('saved', response.data || response);
      closeDrawer();
    } else {
      errors.value = response.errors || { _general: `Failed to ${isEditing.value ? 'update' : 'create'} record` };
      saving.value = false;
    }
  } catch (error) {
    console.error('Error creating record:', error);
    console.error('Error response data:', error.response?.data);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    // Reset errors
    errors.value = {};
    
    // Handle validation errors from API
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // Check for field-specific errors (preferred format)
      if (errorData.errors && typeof errorData.errors === 'object' && !Array.isArray(errorData.errors) && Object.keys(errorData.errors).length > 0) {
        // Set field-specific errors
        errors.value = { ...errorData.errors };
        
        // Don't show general message if we have field-specific errors
        // Field errors will be shown next to each field via DynamicFormField
      } 
      // Check for message in error data (no field-specific errors)
      else if (errorData.message) {
        // Show the message, but prefer it over generic "Error creating record"
        // If it's "Validation failed. Please check the fields below." that's good
        if (errorData.message.includes('Validation failed') || errorData.message.includes('check the fields')) {
          errors.value._general = errorData.message;
        } else if (errorData.message !== 'Error creating record') {
          errors.value._general = errorData.message;
        } else {
          // If it's the generic message, try error field or show helpful message
          errors.value._general = errorData.error || 'Please fill in all required fields and try again.';
        }
      }
      // Check for error field (some APIs use 'error' instead of 'message')
      // Try to parse validation errors from error message if it contains "validation failed"
      else if (errorData.error) {
        // Check if error message contains validation info that we can parse
        if (errorData.error.includes('validation failed')) {
          const validationErrors = {};
          
          // Parse error message like "People validation failed: type: Path `type` is required."
          // Pattern: "field: Path `field` is required."
          const requiredPattern = /(\w+):\s*Path\s+`(\w+)`\s+is\s+required\.?/gi;
          let match;
          while ((match = requiredPattern.exec(errorData.error)) !== null) {
            const fieldName = match[1] || match[2];
            validationErrors[fieldName] = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
          }
          
          // Pattern: "field: error message" (general format)
          if (Object.keys(validationErrors).length === 0) {
            const parts = errorData.error.split(/validation failed:\s*/i);
            if (parts.length > 1) {
              const errorPart = parts[1];
              const fieldMatches = errorPart.match(/(\w+):\s*(.+?)(?:,|$)/g);
              if (fieldMatches) {
                fieldMatches.forEach(fieldMatch => {
                  const fieldParts = fieldMatch.match(/(\w+):\s*(.+)/);
                  if (fieldParts) {
                    const fieldName = fieldParts[1];
                    let errorMsg = fieldParts[2].trim();
                    // Clean up common Mongoose error phrases
                    errorMsg = errorMsg.replace(/^Path\s+`\w+`\s+/, '');
                    errorMsg = errorMsg.replace(/\.$/, '');
                    validationErrors[fieldName] = errorMsg;
                  }
                });
              }
            }
          }
          
          if (Object.keys(validationErrors).length > 0) {
            errors.value = validationErrors;
          } else {
            errors.value._general = errorData.error;
          }
        } else {
          errors.value._general = errorData.error;
        }
      }
      // Fallback - try to parse the error message for validation hints
      else {
        const errorMsg = error.message || '';
        // If error message mentions validation or required fields, show helpful message
        if (errorMsg.toLowerCase().includes('validation') || errorMsg.toLowerCase().includes('required')) {
          errors.value._general = 'Please fill in all required fields and try again.';
        } else {
          errors.value._general = `Failed to ${isEditing.value ? 'update' : 'create'} record. Please check your input.`;
        }
      }
    } else {
      // Generic error message if no response data
      const errorMsg = error.message || '';
      if (errorMsg.toLowerCase().includes('validation') || errorMsg.toLowerCase().includes('required')) {
        errors.value._general = 'Please fill in all required fields and try again.';
      } else {
        errors.value._general = errorMsg || `Failed to ${isEditing.value ? 'update' : 'create'} record. Please try again.`;
      }
    }
    
    // If we still don't have any errors set, set a default
    if (Object.keys(errors.value).length === 0) {
      errors.value._general = 'Please fill in all required fields and try again.';
    }
  } finally {
    saving.value = false;
  }
};

// Reset form when drawer opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    errors.value = {};
    // Form will be initialized by onFormReady when module loads
  } else {
    // Reset when closed
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
    }, 300);
  }
});
</script>
