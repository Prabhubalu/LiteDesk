<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 sm:p-8" @click="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit Contact' : 'New Contact' }}
          </h2>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Dynamic Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Phase 2B: Type selector (only if multiple types allowed) -->
          <div v-if="!isEditing && showTypeSelector && isPlatformOwned" class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('people.contactFormModalRecordType') }}<span class="text-gray-500 dark:text-gray-400 text-xs">(based on app configuration)</span>
            </label>
            <select
              v-model="form.type"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option v-for="type in allowedTypes" :key="type.projectionType" :value="type.modelValue">
                {{ type.modelValue }}
              </option>
            </select>
          </div>

          <!-- Phase 2B: Helper text when selector is hidden -->
          <div v-if="!isEditing && hideTypeSelector && isPlatformOwned && defaultType" class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              This app creates {{ defaultType.modelValue }}s by default
            </p>
          </div>

          <DynamicForm
            module-key="people"
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
            >{{ t('performance.cancelWizard') }}</button>
            <button 
              type="submit" 
              :disabled="saving || !moduleDefinition" 
              class="px-6 py-2.5 rounded-lg bg-indigo-600 dark:bg-indigo-700 text-white font-medium hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Saving...' : (isEditing ? 'Update Contact' : 'Create Contact') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import DynamicForm from '@/components/common/DynamicForm.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useProjectionCreate } from '@/composables/useProjectionCreate';
import {
  applyCreateOwnerDefaultsToForm,
  resolveCurrentUserId
} from '@/utils/recordCreateOwnerDefaults';

import { useNotifications } from '@/composables/useNotifications';
const props = defineProps({
  contact: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();
const notifications = useNotifications();


const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const isEditing = computed(() => !!props.contact);
const saving = ref(false);
const moduleDefinition = ref(null);
const form = ref({});
const formErrors = ref({});

// Phase 2B: Projection-aware create form
const {
  loading: projectionLoading,
  allowedTypes,
  defaultType,
  isPlatformOwned,
  isReadOnly,
  showTypeSelector,
  hideTypeSelector,
  load: loadProjection,
  resolveInitialCreatePayload,
  isTypeAllowed
} = useProjectionCreate('people');

// Initialize form with default values from field definitions
const initializeForm = (module) => {
  const initialForm = {};
  const fields = module.fields || [];
  
  console.log('🔵 Initializing form with', fields.length, 'fields');
  
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
  
  console.log('📋 Initial form object:', {
    keys: Object.keys(initialForm),
    sample: Object.fromEntries(Object.entries(initialForm).slice(0, 5))
  });
  
  // If editing, merge with existing contact data
  if (props.contact) {
    const contactData = { ...props.contact };
    // Handle populated relationships
    if (contactData.organization && typeof contactData.organization === 'object') {
      contactData.organization = contactData.organization._id || contactData.organization;
    }
    if (contactData.assignedTo && typeof contactData.assignedTo === 'object') {
      contactData.assignedTo = contactData.assignedTo._id || contactData.assignedTo;
    }
    if (contactData.createdBy && typeof contactData.createdBy === 'object') {
      contactData.createdBy = contactData.createdBy._id || contactData.createdBy;
    }
    
    // Ensure Multi-Picklist fields are arrays
    for (const field of fields) {
      if (field.dataType === 'Multi-Picklist') {
        const value = contactData[field.key];
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          contactData[field.key] = [value].filter(Boolean);
        } else if (!value) {
          contactData[field.key] = [];
        }
      }
    }
    
    // Merge contact data with form defaults
    form.value = { ...initialForm, ...contactData };
    console.log('📝 Form initialized (editing):', {
      keys: Object.keys(form.value),
      contactKeys: Object.keys(contactData)
    });
  } else {
    // For new contacts, set createdBy to current user
    const newFormData = { ...initialForm };
    if (authStore.user?._id) {
      newFormData.createdBy = authStore.user._id;
      console.log('👤 Set createdBy to current user:', authStore.user._id);
    }
    
    // Phase 2B: Apply projection defaults
    const payloadWithDefaults = resolveInitialCreatePayload(newFormData);
    form.value = applyCreateOwnerDefaultsToForm(
      payloadWithDefaults,
      'people',
      resolveCurrentUserId(authStore.user)
    );
    
    console.log('📝 Form initialized (new):', {
      keys: Object.keys(form.value),
      createdBy: form.value.createdBy,
      type: form.value.type,
      hasProjection: !!defaultType.value
    });
  }
};

const onModuleReady = (module) => {
  if (module) {
    moduleDefinition.value = module;
    initializeForm(module);
  }
};

const handleSubmit = async (event) => {
  event?.preventDefault?.();
  saving.value = true;
  formErrors.value = {};
  
  console.log('🔵 ContactFormModal handleSubmit called:', {
    formValue: form.value,
    formKeys: Object.keys(form.value || {}),
    moduleDefinition: !!moduleDefinition.value
  });
  
  try {
    // Use current form value, not passed parameter
    const currentFormData = { ...form.value };
    
    console.log('📝 Current form data:', {
      keys: Object.keys(currentFormData),
      data: currentFormData
    });
    
    // Phase 2B: Validate type against projection metadata
    if (!isEditing.value && isPlatformOwned.value && currentFormData.type) {
      if (!isTypeAllowed(currentFormData.type)) {
        formErrors.value.type = `Type "${currentFormData.type}" is not allowed in this app`;
        console.warn(`❌ Invalid type: ${currentFormData.type}`);
        saving.value = false;
        return;
      }
    }

    // Validate required fields (exclude system fields that are auto-set by backend)
    const systemFieldKeys = ['organizationid', 'createdby', 'createdat', 'updatedat', '_id', '__v', 'activitylogs'];
    const requiredFields = (moduleDefinition.value?.fields || [])
      .filter(f => f.required && !systemFieldKeys.includes(f.key?.toLowerCase()));
    
    console.log('✅ Required fields (excluding system fields):', requiredFields.map(f => ({ key: f.key, label: f.label })));
    
    for (const field of requiredFields) {
      const value = currentFormData[field.key];
      if (value === null || value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        formErrors.value[field.key] = `${field.label || field.key} is required`;
        console.warn(`❌ Missing required field: ${field.key}`);
      }
    }
    
    if (Object.keys(formErrors.value).length > 0) {
      console.error('❌ Validation failed:', formErrors.value);
      saving.value = false;
      return;
    }
    
    // Clean up form data - remove system fields that shouldn't be sent
    // These are automatically set by the backend
    const submitData = { ...currentFormData };
    delete submitData.createdBy; // System field, set by backend
    delete submitData.organizationId; // System field, set by backend
    delete submitData.organizationid; // Also check lowercase
    delete submitData.createdAt;
    delete submitData.updatedAt;
    delete submitData._id;
    delete submitData.__v;
    
    // Phase 2B: Ensure type is set correctly (use default if not set and platform-owned)
    if (!isEditing.value && isPlatformOwned.value && !submitData.type && defaultType.value) {
      submitData.type = defaultType.value.modelValue;
    }
    
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
    
    // If organization is empty string, convert to null (but don't delete it - let backend handle it)
    if (submitData.organization === '') {
      submitData.organization = null;
    }
    
    console.log('📤 Submitting data:', {
      isEditing: isEditing.value,
      submitDataKeys: Object.keys(submitData),
      submitDataSample: Object.fromEntries(Object.entries(submitData).slice(0, 5)),
      organization: submitData.organization,
      organizationType: typeof submitData.organization
    });
    
    let data;
    if (isEditing.value) {
      console.log(`📝 Updating contact ${props.contact._id}...`);
      data = await apiClient.put(`/people/${props.contact._id}`, submitData);
    } else {
      console.log('➕ Creating new contact...');
      data = await apiClient.post('/people', submitData);
    }
    
    console.log('✅ API Response:', {
      success: data.success,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data).slice(0, 10) : []
    });
    
    if (data.success) {
      emit('saved', data.data);
      emit('close'); // Close modal after successful save
    } else {
      throw new Error(data.message || 'Failed to save contact');
    }
  } catch (error) {
    console.error('❌ Error saving contact:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response,
      stack: error.stack
    });
    notifications.error(error.message || t('people.contactFormModalToastFailedToSaveContactPlease'));
  } finally {
    saving.value = false;
  }
};

// Phase 2B: Load projection metadata on mount
onMounted(async () => {
  if (!isEditing.value) {
    await loadProjection();
  }
});

// Form will be initialized when DynamicForm emits ready event
</script>
