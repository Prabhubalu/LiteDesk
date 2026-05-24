<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70" @click.self="handleClose">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
      <!-- Header -->
      <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleQuickCreateAddPerson') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleQuickCreateCreateACorePersonIdentity') }}</p>
        </div>
        <button
          @click="handleClose"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleQuickCreateLoadingFields') }}</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('people.peopleQuickCreateError') }}</h3>
              <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSubmit" class="space-y-4">
          <div
            v-for="field in eligibleFields"
            :key="field.key"
            class="space-y-1"
          >
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ field.label }}
              <span v-if="field.required" class="text-red-500">*</span>
            </label>
            <PhoneInput
              v-if="field.dataType === 'Phone'"
              :model-value="formData[field.key]"
              :required="field.required"
              :placeholder="field.placeholder || 'Phone number'"
              input-class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :invalid="Boolean(validationErrors[field.key])"
              @update:model-value="formData[field.key] = $event"
            />
            <input
              v-else-if="field.dataType !== 'Checkbox' && field.dataType !== 'Picklist'"
              v-model="formData[field.key]"
              :type="getInputType(field.dataType)"
              :required="field.required"
              :placeholder="field.placeholder || `Enter ${field.label.toLowerCase()}`"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              v-else-if="field.dataType === 'Picklist'"
              v-model="formData[field.key]"
              :required="field.required"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select {{ field.label.toLowerCase() }}...</option>
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
            <div v-else-if="field.dataType === 'Checkbox'" class="flex items-center">
              <HeadlessCheckbox
                v-model="formData[field.key]"
                checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                {{ field.label }}
              </label>
            </div>
            <p v-if="validationErrors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors[field.key] }}
            </p>
          </div>

          <!-- Form Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >{{ t('performance.cancelWizard') }}</button>
            <button
              type="submit"
              :disabled="submitting"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="submitting">{{ t('settings.settingsModFormCreating') }}</span>
              <span v-else>{{ t('people.peopleQuickCreateCreatePerson') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import PhoneInput from '@/components/common/PhoneInput.vue';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { getDefaultEmailValidations } from '@/utils/defaultFieldValidations';
import { validateField } from '@/utils/fieldValidation';
import { 
  getCoreIdentityFields, 
  getFieldMetadata,
  PEOPLE_FIELD_METADATA 
} from '@/platform/fields/peopleFieldModel';

const props = defineProps({});

const { t } = useI18n();

const emit = defineEmits(['close', 'created']);

const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref(null);
const submitting = ref(false);
const validationErrors = ref({});
const fieldDefinitions = ref([]);
const formData = ref({});

// Helper: Check if a field is eligible for Quick Create
function isFieldEligibleForQuickCreate(fieldKey) {
  try {
    const metadata = getFieldMetadata(fieldKey);
    
    // Core identity fields: owner === 'core', intent === 'identity', editable === true
    const isCoreIdentity = (
      metadata.owner === 'core' &&
      metadata.intent === 'identity' &&
      metadata.editable === true
    );
    
    // System fields with allowOnCreate: owner === 'system', editable === true, allowOnCreate === true
    const isAllowedSystemField = (
      metadata.owner === 'system' &&
      metadata.editable === true &&
      metadata.allowOnCreate === true
    );
    
    return isCoreIdentity || isAllowedSystemField;
  } catch (err) {
    // Field not found in metadata - fail fast
    throw new Error(
      `Field "${fieldKey}" is not eligible for Quick Create. ` +
      `Creation eligibility must be declared in peopleFieldModel.ts. ` +
      `Error: ${err.message}`
    );
  }
}

// Get all eligible field keys (core identity + system fields with allowOnCreate)
function getEligibleFieldKeys() {
  const eligibleKeys = [];
  
  // Get all fields from metadata
  const allFieldKeys = Object.keys(PEOPLE_FIELD_METADATA);
  
  for (const key of allFieldKeys) {
    try {
      if (isFieldEligibleForQuickCreate(key)) {
        eligibleKeys.push(key);
      }
    } catch (err) {
      // Skip fields that fail eligibility check (fail-fast already logged)
      console.error(`Skipping field "${key}" for Quick Create:`, err.message);
    }
  }
  
  return eligibleKeys;
}

// Get eligible field keys
const eligibleFieldKeys = getEligibleFieldKeys();

// Computed: Eligible fields with configuration
const eligibleFields = computed(() => {
  return fieldDefinitions.value.filter(field => 
    eligibleFieldKeys.includes(field.key)
  );
});

// Methods
const getInputType = (dataType) => {
  const typeMap = {
    'Email': 'email',
    'Phone': 'text',
    'Number': 'number',
    'Date': 'date',
    'DateTime': 'datetime-local',
    'URL': 'url'
  };
  return typeMap[dataType] || 'text';
};

const loadFieldDefinitions = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Fetch People module configuration to get field settings (like "Required in Form")
    const response = await apiClient.get('/modules?key=people');
    
    if (response.success && response.data && response.data.length > 0) {
      const peopleModule = response.data[0];
      const moduleFields = peopleModule.fields || [];
      
      // Filter to only eligible fields (core identity + system fields with allowOnCreate)
      const eligibleFieldsList = [];
      const initialData = {};
      
      eligibleFieldKeys.forEach(key => {
        // Validate eligibility (fail-fast)
        if (!isFieldEligibleForQuickCreate(key)) {
          throw new Error(
            `Field "${key}" is not eligible for Quick Create. ` +
            `Creation eligibility must be declared in peopleFieldModel.ts.`
          );
        }
        
        const moduleField = moduleFields.find(f => f.key === key);
        const metadata = getFieldMetadata(key);
        
        const fieldDef = {
          key: key,
          label: moduleField?.label || formatFieldLabel(key),
          dataType: moduleField?.dataType || 'Text',
          required: moduleField?.required || false, // "Required in Form" flag
          placeholder: moduleField?.placeholder || '',
          defaultValue: moduleField?.defaultValue || '',
          options: moduleField?.options || []
        };
        
        eligibleFieldsList.push(fieldDef);
        initialData[key] = fieldDef.defaultValue || '';
      });
      
      // Prefill assignedTo with current user if field is eligible and present
      if (initialData.hasOwnProperty('assignedTo') && authStore.user?._id) {
        initialData.assignedTo = authStore.user._id;
      }
      
      fieldDefinitions.value = eligibleFieldsList;
      formData.value = initialData;
    } else {
      // Fallback: use field model directly if API doesn't return module
      const eligibleFieldsList = [];
      const initialData = {};
      
      eligibleFieldKeys.forEach(key => {
        // Validate eligibility (fail-fast)
        if (!isFieldEligibleForQuickCreate(key)) {
          throw new Error(
            `Field "${key}" is not eligible for Quick Create. ` +
            `Creation eligibility must be declared in peopleFieldModel.ts.`
          );
        }
        
        const fieldDef = {
          key: key,
          label: formatFieldLabel(key),
          dataType: 'Text',
          required: false, // Default to not required
          placeholder: '',
          defaultValue: '',
          options: []
        };
        
        eligibleFieldsList.push(fieldDef);
        initialData[key] = '';
      });
      
      // Prefill assignedTo with current user if field is eligible and present
      if (initialData.hasOwnProperty('assignedTo') && authStore.user?._id) {
        initialData.assignedTo = authStore.user._id;
      }
      
      fieldDefinitions.value = eligibleFieldsList;
      formData.value = initialData;
    }
  } catch (err) {
    console.error('Error loading field definitions:', err);
    error.value = err.message || 'Error loading field definitions';
    
    // Fallback: use field model directly
    const eligibleFieldsList = [];
    const initialData = {};
    
    eligibleFieldKeys.forEach(key => {
      try {
        // Validate eligibility (fail-fast)
        if (!isFieldEligibleForQuickCreate(key)) {
          console.warn(`Skipping field "${key}" for Quick Create: not eligible`);
          return;
        }
        
        const fieldDef = {
          key: key,
          label: formatFieldLabel(key),
          dataType: 'Text',
          required: false,
          placeholder: '',
          defaultValue: '',
          options: []
        };
        
        eligibleFieldsList.push(fieldDef);
        initialData[key] = '';
      } catch (fieldErr) {
        console.error(`Error processing field "${key}":`, fieldErr);
      }
    });
    
    // Prefill assignedTo with current user if field is eligible and present
    if (initialData.hasOwnProperty('assignedTo') && authStore.user?._id) {
      initialData.assignedTo = authStore.user._id;
    }
    
    fieldDefinitions.value = eligibleFieldsList;
    formData.value = initialData;
  } finally {
    loading.value = false;
  }
};

// Helper: Format field key to label
const formatFieldLabel = (key) => {
  const labelMap = {
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'email': 'Email',
    'phone': 'Phone',
    'mobile': 'Mobile',
    'tags': 'Tags',
    'do_not_contact': 'Do Not Contact',
    'source': 'Source',
    'organization': 'Organization'
  };
  return labelMap[key] || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const handleSubmit = async () => {
  // Validate required fields (using "Required in Form" rules only)
  validationErrors.value = {};
  const errors = {};
  
  eligibleFields.value.forEach(field => {
    if (field.required && !formData.value[field.key]) {
      errors[field.key] = `${field.label} is required`;
    }
    if (field.dataType === 'Phone') {
      const p = sanitizeInternationalPhone(formData.value[field.key] || '');
      formData.value[field.key] = p;
      const phoneValidation = validatePhoneValue(p);
      if (!phoneValidation.isValid) {
        errors[field.key] = phoneValidation.error;
      }
    }
    const isEmailField =
      field.dataType === 'Email' || String(field.key || '').toLowerCase() === 'email';
    if (isEmailField) {
      const raw = (formData.value[field.key] || '').trim();
      formData.value[field.key] = raw;
      if (raw) {
        const emailCheck = validateField(raw, getDefaultEmailValidations());
        if (!emailCheck.isValid) {
          errors[field.key] = emailCheck.error || 'Invalid email format';
        }
      }
    }
  });

  if (Object.keys(errors).length > 0) {
    validationErrors.value = errors;
    return;
  }

  try {
    submitting.value = true;
    validationErrors.value = {};
    error.value = null;

    // Create Person with core identity fields only
    // Do NOT include any app-specific fields or appKey
    const response = await apiClient.post('/people', {
      ...formData.value
    });

    if (response.success) {
      // Emit created event and close
      emit('created', response.data);
      handleClose();
      
      // Redirect to PeopleSurface (not detail page)
      router.push('/people');
    } else {
      if (response.errors) {
        validationErrors.value = response.errors;
        error.value = response.message || 'Validation failed. Please check the fields below.';
      } else {
        error.value = response.message || 'Failed to create person';
      }
    }
  } catch (err) {
    console.error('Error creating person:', err);
    
    // Handle validation errors from backend
    if (err.response?.data?.errors) {
      validationErrors.value = err.response.data.errors;
      error.value = err.response.data.message || 'Validation failed. Please check the fields below.';
    } else if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else {
      error.value = err.message || 'Error creating person';
    }
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  // Reset all state when closing
  error.value = null;
  loading.value = false;
  submitting.value = false;
  validationErrors.value = {};
  formData.value = {};
  emit('close');
};

// Lifecycle
onMounted(() => {
  loadFieldDefinitions();
});
</script>
