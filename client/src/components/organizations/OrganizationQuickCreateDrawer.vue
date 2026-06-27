<!--
  ============================================================================
  CREATEORGANIZATIONDRAWER CONTRACT
  ============================================================================
  
  CreateOrganizationDrawer
  Creation-only drawer with Quick → Full form behavior.
  
  ARCHITECTURAL INTENT:
  - ONE creation entry point for Organizations
  - Creation happens in a drawer with two modes: Quick Create (default) and Full Form (explicit expansion)
  - Both modes are creation-only (NOT editing, NOT OrganizationSurface)
  - Quick Create unblocks flow. Full Form is intentional completion. Both are creation-only.
  
  MODE BEHAVIOR:
  - mode: 'quick' | 'full' (default: 'quick')
  - Quick mode: Settings-driven fields only (Settings → Organizations → Quick Create)
  - Full mode: Locked fields (name, types, industry, website, phone, address)
  - Form state MUST be preserved across mode switches
  - No API call on mode switch
  
  CREATION INTENT INVARIANT
  ------------------------
  Quick Create and Full Form represent different user intents.
  
  - Draft values may persist across mode switches
  - ONLY fields visible in the active mode at submit time
    are allowed to be persisted
  
  Mode at submission time is the source of truth.
  
  Reference documents:
  - docs/architecture/organization-surface-invariants.md
  - docs/architecture/module-settings-doctrine.md
  
  ============================================================================
-->

<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleDialogClose">
      <!-- Background overlay -->
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/50 dark:bg-black/60" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild 
              enter="transform transition ease-in-out duration-300 sm:duration-300" 
              enter-from="translate-x-full" 
              enter-to="translate-x-0" 
              leave="transform transition ease-in-out duration-300 sm:duration-300" 
              leave-from="translate-x-0" 
              leave-to="translate-x-full"
            >
              <!-- Drawer width behavior aligned with shared create drawers -->
              <DialogPanel
                :class="[
                  'pointer-events-auto h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] transition-[width] duration-200 ease-out',
                  drawerWidthClass
                ]"
              >
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                  <!-- Fixed Header -->
                  <div class="flex-shrink-0 bg-indigo-700 dark:bg-indigo-800 px-4 py-6 sm:px-6">
                    <div class="flex items-center justify-between">
                      <DialogTitle class="text-base font-semibold text-white">
                        {{ isEditMode ? 'Edit Organization' : 'New Organization' }}
                      </DialogTitle>
                      <div class="ml-3 flex h-7 items-center">
                        <button 
                          type="button" 
                          class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" 
                          @click="closeDrawer"
                        >
                          <span class="absolute -inset-2.5"></span>
                          <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div class="mt-1">
                      <p class="text-sm text-indigo-300">
                        {{ helperText }}
                      </p>
                    </div>
                  </div>

                  <!-- Scrollable Content Area -->
                  <div class="flex-1 overflow-y-auto">
                    <div class="px-4 sm:px-6 py-6">
                      <div class="space-y-6">
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
                          
                          <!-- QUICK CREATE MODE: Settings-driven fields -->
                          <template v-if="mode === 'quick'">
                            <!-- 
                              ARCHITECTURAL INTENT: Quick Create Mode
                              - Render ONLY fields defined in Settings → Organizations → Quick Create
                              - name MUST be required and first
                              - Fields are fully settings-driven
                              - No hard-coded optional fields here
                            -->
                            <DynamicForm
                              module-key="organizations"
                              context="platform"
                              :form-data="formData"
                              :errors="errors"
                              :exclude-fields="excludeFields"
                              :show-all-fields="false"
                              :quick-create-mode="true"
                              :single-column="true"
                              :fields-override="quickCreateFieldsOverrideProp"
                              @update:form-data="updateFormData"
                              @ready="onFormReady"
                            />
                          </template>

                          <!-- FULL FORM MODE: Config-driven with explicit section ordering -->
                          <template v-else>
                            <div v-if="moduleDefinition && !moduleLoading" class="space-y-6">
                              <div v-if="fullQuickCreateFields.length">
                                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('organizations.organizationQuickCreateDrawerQuickCreateFields') }}</h3>
                                <DynamicForm
                                  module-key="organizations"
                                  context="platform"
                                  :form-data="formData"
                                  :errors="errors"
                                  :show-all-fields="true"
                                  :quick-create-mode="false"
                                  :single-column="false"
                                  :fields-override="fullQuickCreateFields"
                                  :exclude-fields="fullModeExcludeFields"
                                  :module-override="moduleDefinition"
                                  @update:form-data="updateFormData"
                                />
                              </div>

                              <div v-if="fullOtherFields.length" class="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('organizations.organizationQuickCreateDrawerOtherFields') }}</h3>
                                <DynamicForm
                                  module-key="organizations"
                                  context="platform"
                                  :form-data="formData"
                                  :errors="errors"
                                  :show-all-fields="true"
                                  :quick-create-mode="false"
                                  :single-column="false"
                                  :fields-override="fullOtherFields"
                                  :exclude-fields="fullModeExcludeFields"
                                  :module-override="moduleDefinition"
                                  @update:form-data="updateFormData"
                                />
                              </div>

                              <div v-if="fullParticipationFields.length" class="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('records.genericAppParticipation') }}</h3>
                                <DynamicForm
                                  module-key="organizations"
                                  context="platform"
                                  :form-data="formData"
                                  :errors="errors"
                                  :show-all-fields="true"
                                  :quick-create-mode="false"
                                  :single-column="false"
                                  :fields-override="fullParticipationFields"
                                  :exclude-fields="fullModeExcludeFields"
                                  :module-override="moduleDefinition"
                                  @update:form-data="updateFormData"
                                />
                              </div>
                            </div>

                            <div v-else class="flex justify-center py-12">
                              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                          </template>
                      </div>
                    </div>
                  </div>

                  <!-- Fixed Footer -->
                  <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <!-- Left: Mode switch button -->
                    <div class="flex-1">
                      <button 
                        v-if="mode === 'quick'"
                        type="button" 
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
                        @click="switchToFull"
                      >{{ t('organizations.organizationQuickCreateDrawerFullForm') }}</button>
                      <button 
                        v-else
                        type="button" 
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
                        @click="switchToQuick"
                      >{{ t('organizations.organizationQuickCreateDrawerBackToQuick') }}</button>
                    </div>

                    <!-- Right: Cancel and Save/Create buttons (always on the right) -->
                    <div class="flex gap-3">
                      <button 
                        type="button" 
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
                        @click="closeDrawer"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button 
                        type="submit" 
                        :disabled="saving || !formData.name" 
                        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {{ saving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create organization') }}
                      </button>
                    </div>
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
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, nextTick } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import {
  getOrganizationParticipationFields,
  isTenantPlatformOrganizationFieldKey,
  ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
} from '@/platform/fields/organizationFieldModel';
import { getGlobalSystemFieldKeys, isSystemField } from '@/platform/fields/fieldCapabilityEngine';
import { getWebsiteValidationMessage, isValidWebsiteInput } from '@/utils/urlInputValidation';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  autoLinkContext: {
    type: Object,
    default: null
  },
  /**
   * Edit mode: organizationId (required when editing)
   */
  organizationId: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

const { openTab } = useTabs();

// ============================================================================
// CREATION MODE STATE
// ============================================================================
// 
// createMode: Tracks the current submission intent
// This must update when the user toggles Quick Create ↔ Full Form
// Mode at submission time is the source of truth for field filtering
// Type: 'quick' | 'full'
//
const createMode = ref('quick');

// Edit mode: true if organizationId is provided
const isEditMode = computed(() => !!props.organizationId);

// Mode state: 'quick' | 'full' (default: 'quick')
// ARCHITECTURAL INTENT: Quick Create unblocks flow. Full Form is intentional completion.
// NOTE: This is the UI mode. createMode tracks submission intent and must be kept in sync.
const mode = ref('quick');

// Form data (preserved across mode switches)
const formData = ref({ ...props.initialData });
const errors = ref({});
const saving = ref(false);
const moduleDefinition = ref(null);

// ============================================================================
// AUTHORITATIVE FIELD LISTS (DO NOT INFER FROM FILLED VALUES)
// ============================================================================
//
// QUICK_CREATE_FIELDS: Must exactly match Settings → Organizations → Quick Create
// Loaded from module definition (moduleDefinition.value.quickCreate)
//
// FULL_CREATE_FIELDS: authoritative field list for full-form submission.
// Built from rendered sections: quick-create fields, then other fields, then participation fields.
const QUICK_CREATE_FIELDS = computed(() => {
  if (!moduleDefinition.value || !moduleDefinition.value.quickCreate) {
    // Fallback to default if module definition not loaded yet
    return ['name'];
  }
  
  // Quick Create: Only fields from Settings → Organizations → Quick Create
  const quickCreate = moduleDefinition.value.quickCreate || [];
  return quickCreate.map((f) => {
    return typeof f === 'string' ? f : (f.key || f);
  });
});

const FULL_MODE_STATIC_EXCLUDE_FIELDS = [
  'organizationId',
  ...ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  'createdBy',
  'createdAt',
  'updatedAt',
  '_id',
  '__v'
];

const PARTICIPATION_FIELD_KEYS = new Set(
  getOrganizationParticipationFields('SALES').map((fieldKey) => String(fieldKey).toLowerCase())
);

const moduleSystemFieldKeys = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  return moduleFields
    .map((field) => field?.key)
    .filter((key) => !!key && isSystemField('organizations', { key: String(key) }));
});

const moduleSystemFieldKeySet = computed(() =>
  new Set(moduleSystemFieldKeys.value.map((fieldKey) => String(fieldKey).toLowerCase()))
);

const fullModeExcludeFields = computed(() => {
  const deduped = new Set([
    ...FULL_MODE_STATIC_EXCLUDE_FIELDS.map((fieldKey) => String(fieldKey)),
    ...getGlobalSystemFieldKeys(),
    ...moduleSystemFieldKeys.value
  ]);
  return Array.from(deduped);
});

const fullQuickCreateFields = computed(() =>
  QUICK_CREATE_FIELDS.value.filter((fieldKey) => {
    const keyLower = String(fieldKey).toLowerCase();
    return !PARTICIPATION_FIELD_KEYS.has(keyLower)
      && !isTenantPlatformOrganizationFieldKey(fieldKey)
      && !fullModeExcludeFields.value.some((excluded) => excluded.toLowerCase() === keyLower)
      && !moduleSystemFieldKeySet.value.has(keyLower);
  })
);

const fullOtherFields = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  const quickSet = new Set(fullQuickCreateFields.value.map((fieldKey) => String(fieldKey).toLowerCase()));
  const excludedSet = new Set(fullModeExcludeFields.value.map((fieldKey) => String(fieldKey).toLowerCase()));

  return moduleFields
    .map((field) => field?.key)
    .filter((key) => {
      if (!key) return false;
      const keyLower = String(key).toLowerCase();
      if (excludedSet.has(keyLower)) return false;
      if (quickSet.has(keyLower)) return false;
      if (PARTICIPATION_FIELD_KEYS.has(keyLower)) return false;
      if (isTenantPlatformOrganizationFieldKey(key)) return false;
      if (moduleSystemFieldKeySet.value.has(keyLower)) return false;
      return true;
    });
});

const fullParticipationFields = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  return moduleFields
    .map((field) => field?.key)
    .filter((key) => {
      if (!key) return false;
      const keyLower = String(key).toLowerCase();
      return PARTICIPATION_FIELD_KEYS.has(keyLower)
        && !isTenantPlatformOrganizationFieldKey(key)
        && !moduleSystemFieldKeySet.value.has(keyLower);
    });
});

const FULL_CREATE_FIELDS = computed(() => [
  ...fullQuickCreateFields.value,
  ...fullOtherFields.value,
  ...fullParticipationFields.value
]);

/** Quick create keys with tenant/nested tenant paths removed (module API can expose subscription.* etc.) */
const sanitizedQuickCreateFieldKeys = computed(() =>
  QUICK_CREATE_FIELDS.value.filter((fieldKey) => !isTenantPlatformOrganizationFieldKey(fieldKey))
);

/**
 * When the organizations module includes flattened tenant paths in quickCreate, override with the filtered list.
 * If nothing was stripped, omit override so DynamicForm uses its default quick-create path.
 */
const quickCreateFieldsOverrideProp = computed(() => {
  const full = QUICK_CREATE_FIELDS.value;
  const sanitized = sanitizedQuickCreateFieldKeys.value;
  if (!full.length || full.length === sanitized.length) return null;
  return sanitized.length ? sanitized : null;
});

const moduleLoading = ref(false);

const fetchOrganizationModuleDefinition = async () => {
  if (moduleLoading.value) return;
  moduleLoading.value = true;

  try {
    try {
      const response = await apiClient.get('/modules/organizations/quick-create');
      if (response?.success && response?.data) {
        moduleDefinition.value = response.data;
        return;
      }
    } catch (error) {
      console.warn('[OrganizationQuickCreate] Failed quick-create module fetch, falling back to modules endpoint:', error);
    }

    try {
      const fallbackResponse = await apiClient.get('/modules?context=platform');
      const moduleList = Array.isArray(fallbackResponse?.data) ? fallbackResponse.data : [];
      const organizationsModule = moduleList.find((moduleItem) => String(moduleItem?.key || '').toLowerCase() === 'organizations');
      if (organizationsModule) {
        moduleDefinition.value = organizationsModule;
      }
    } catch (error) {
      console.error('[OrganizationQuickCreate] Failed to fetch organizations module definition:', error);
    }
  } finally {
    moduleLoading.value = false;
  }
};

// Computed: Helper text based on mode
const helperText = computed(() => {
  return isEditMode.value
    ? 'Update the organization information below.'
    : 'Fill in the information below to create a new organization.';
});

// Computed: Drawer width class based on mode (quick vs full)
const drawerWidthClass = computed(() => {
  return mode.value === 'full' ? 'w-[60rem]' : 'w-[30rem]';
});

// Fields to exclude from Quick Create
// ARCHITECTURAL INTENT: Only core business fields are eligible for Quick Create
// Exclude: app participation fields, system fields, tenant fields, ownership/assignment fields
const QUICK_MODE_STATIC_EXCLUDE_FIELDS = [
  'createdBy',
  'assignedTo',
  'accountManager',
  ...ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  'customerStatus',
  'partnerStatus',
  'vendorStatus',
  'organizationId',
  'createdAt',
  'updatedAt',
  '_id',
  '__v'
];

const excludeFields = computed(() => {
  const deduped = new Set([
    ...QUICK_MODE_STATIC_EXCLUDE_FIELDS.map((fieldKey) => String(fieldKey)),
    ...getGlobalSystemFieldKeys(),
    ...moduleSystemFieldKeys.value
  ]);
  return Array.from(deduped);
});

/**
 * Handle form ready event from DynamicForm (Quick Create mode only)
 */
const onFormReady = (module) => {
  if (module) {
    moduleDefinition.value = module;
    console.log('[OrganizationQuickCreate] Module ready, quickCreate fields:', module.quickCreate);
    console.log('[OrganizationQuickCreate] QUICK_CREATE_FIELDS computed:', QUICK_CREATE_FIELDS.value);
  }
};

/**
 * Update form data (preserved across mode switches)
 */
const updateFormData = (newData) => {
  formData.value = { ...newData };
};

const scrollToFirstErrorField = async () => {
  const errorKeys = Object.keys(errors.value || {}).filter((key) => key && key !== '_general');
  if (!errorKeys.length) return;

  await nextTick();

  for (const key of errorKeys) {
    const escapedKey =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(key)
        : key.replace(/"/g, '\\"');
    const fieldContainer = document.querySelector(`[data-field-key="${escapedKey}"]`);
    if (!fieldContainer) continue;

    fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusTarget = fieldContainer.querySelector(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
};

/**
 * Switch to Full Form mode
 * ARCHITECTURAL INTENT: Mode switch preserves form state. No API call happens.
 * Updates both UI mode and submission intent mode.
 */
const switchToFull = () => {
  mode.value = 'full';
  createMode.value = 'full';
  
  // Ensure formData has structure for full form fields
  // DO NOT clear existing values - preserve drafts
  if (!formData.value.types) {
    formData.value.types = [];
  }
  if (!formData.value.industry) {
    formData.value.industry = '';
  }
  if (!formData.value.website) {
    formData.value.website = '';
  }
  if (!formData.value.phone) {
    formData.value.phone = '';
  }
  if (!formData.value.address) {
    formData.value.address = '';
  }
};

/**
 * Switch to Quick Create mode
 * ARCHITECTURAL INTENT: Mode switch preserves form state. No API call happens.
 * Updates both UI mode and submission intent mode.
 * DO NOT clear form state - preserve drafts for UX.
 */
const switchToQuick = () => {
  mode.value = 'quick';
  createMode.value = 'quick';
};

/**
 * Close drawer
 */
const closeDrawer = () => {
  emit('close');
};

/**
 * Handle dialog close (from overlay click)
 */
const handleDialogClose = () => {
  closeDrawer();
};

/**
 * Build create organization payload based on current mode
 * 
 * CRITICAL LOCK: This function filters payload based on createMode at submit time.
 * Draft values may persist in memory, but ONLY fields allowed in the active mode
 * are included in the payload.
 * 
 * @param {Record<string, any>} formState - Current form state (may contain draft values)
 * @returns {Record<string, any>} Filtered payload with only allowed fields
 */
function buildCreateOrganizationPayload(formState) {
  const allowedFields = createMode.value === 'quick'
    ? QUICK_CREATE_FIELDS.value
    : FULL_CREATE_FIELDS.value;

  const payload = {};
  
  // Only include fields that are in the allowed list for current mode
  for (const field of allowedFields) {
    if (field in formState) {
      const value = formState[field];
      
      // Handle different value types
      if (Array.isArray(value)) {
        // Include only non-empty arrays
        if (value.length > 0) {
          payload[field] = value;
        }
      } else if (typeof value === 'string') {
        // Include only non-empty strings (trimmed)
        const trimmed = value.trim();
        if (trimmed !== '') {
          payload[field] = trimmed;
        }
      } else if (value !== null && value !== undefined) {
        // Include other non-null values (numbers, booleans, etc.)
        payload[field] = value;
      }
    }
  }
  
  return payload;
}

/**
 * Handle form submission (both modes)
 * ARCHITECTURAL INTENT: Submission logic filters payload based on createMode.
 * Always send only allowed fields for the current mode. Backend enforces isTenant = false.
 */
const handleSubmit = async () => {
  saving.value = true;
  errors.value = {};
  
  try {
    // Validate required fields
    if (!formData.value.name || formData.value.name.trim() === '') {
      errors.value.name = 'Name is required';
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    const website = formData.value.website?.trim();
    if (website && !isValidWebsiteInput(formData.value.website)) {
      errors.value.website = getWebsiteValidationMessage(formData.value.website) || 'Enter a valid website URL (e.g., example.com or https://example.org)';
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    let response;
    
    if (isEditMode.value) {
      // EDIT MODE: PATCH /organizations/:id — only fields visible in the active mode
      const payload = buildCreateOrganizationPayload(formData.value);
      response = await apiClient.patch(`/organizations/${props.organizationId}`, payload);
    } else {
      // CREATE MODE: POST /organizations
      // CRITICAL: Build payload using filtered function based on current createMode
      // This ensures only fields allowed in the active mode are persisted
      const payload = buildCreateOrganizationPayload(formData.value);
      
      response = await apiClient.post('/organizations', payload);
    }
    
    if (response.success) {
      const org = response.data;
      
      // In edit mode, just emit saved event
      if (isEditMode.value) {
        emit('saved', org);
        closeDrawer();
        return;
      }
      
      // CREATE MODE: Handle auto-link context if provided (e.g., from People surface)
      const createdOrg = org;
      if (props.autoLinkContext) {
        if (props.autoLinkContext.personId || props.autoLinkContext.contactId) {
          const personId = props.autoLinkContext.personId || props.autoLinkContext.contactId;
          try {
            // Link the created organization to the person
            await apiClient.put(`/api/people/${personId}`, {
              organization: createdOrg._id || createdOrg.id
            });
            console.log('[OrganizationQuickCreate] Auto-linked organization to person:', personId);
            
            // Emit refresh events
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('arivu:refresh-person', {
                detail: { personId }
              }));
              window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
                detail: { organizationId: createdOrg._id || createdOrg.id }
              }));
            }
          } catch (linkError) {
            console.error('[OrganizationQuickCreate] Failed to auto-link organization:', linkError);
            // Don't fail the creation if linking fails
          }
        }
      } else {
        // If invoked from Command Palette: Open OrganizationSurface in new tab
        const orgId = createdOrg._id || createdOrg.id;
        if (orgId) {
          openTab(`/organizations/${orgId}`, { insertAdjacent: true });
        }
      }
      
      emit('saved', createdOrg);
      
      // Dispatch global event to refresh list views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:record-created', {
          detail: { moduleKey: 'organizations', record: createdOrg }
        }));
      }
      
      closeDrawer();
    } else {
      errors.value._general = response.message || 'Failed to create organization';
    }
  } catch (error) {
    console.error('[OrganizationQuickCreate] Error creating organization:', error);
    if (error.response?.data?.errors) {
      errors.value = { ...error.response.data.errors };
      scrollToFirstErrorField();
    } else {
      errors.value._general = error.message || 'Failed to create organization';
    }
  } finally {
    saving.value = false;
  }
};

// Fetch organization data for edit mode
const loading = ref(false);

const fetchOrganizationData = async () => {
  if (!isEditMode.value || !props.organizationId) return;
  
  loading.value = true;
  errors.value = {};
  
  try {
    const response = await apiClient.get(`/organizations/${props.organizationId}/editable`);
    
    if (response.success && response.data) {
      const data = response.data;
      
      // Defensive check: If API returns forbidden fields, show generic error
      const forbiddenFields = ['subscription', 'limits', 'enabledApps', 'billing', 'isTenant'];
      const hasForbiddenFields = forbiddenFields.some(field => data[field] !== undefined);
      
      if (hasForbiddenFields) {
        errors.value._general = 'Invalid data received. Please contact support.';
        console.error('API returned forbidden fields:', Object.keys(data));
        return;
      }
      
      // Populate form with fetched data
      formData.value = {
        name: data.name || '',
        types: Array.isArray(data.types) ? [...data.types] : [],
        industry: data.industry || '',
        website: data.website || '',
        phone: data.phone || '',
        address: data.address || ''
      };
      
      mode.value = 'quick';
      createMode.value = 'quick';
    } else {
      errors.value._general = response.message || 'Failed to load organization data';
    }
  } catch (err) {
    console.error('Error fetching organization data:', err);
    
    if (err.response?.status === 404) {
      errors.value._general = 'Organization not found';
    } else if (err.response?.status === 403) {
      errors.value._general = 'You do not have permission to edit this organization';
    } else if (err.response?.data?.message) {
      errors.value._general = err.response.data.message;
    } else {
      errors.value._general = err.message || 'Failed to load organization data';
    }
  } finally {
    loading.value = false;
  }
};

// Reset form and mode when drawer opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    fetchOrganizationModuleDefinition();
    if (isEditMode.value) {
      mode.value = 'quick';
      createMode.value = 'quick';
      fetchOrganizationData();
    } else {
      // Create mode: use initial data
      formData.value = { ...props.initialData };
      errors.value = {};
      mode.value = 'quick'; // Reset to quick mode on open
      createMode.value = 'quick'; // Reset submission intent mode
    }
  }
});
</script>
