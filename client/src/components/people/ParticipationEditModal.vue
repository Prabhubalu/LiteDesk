<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="isOpen">
      <Dialog class="relative z-[10000]" @close="close">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <TransitionChild
                as="template"
                enter="transform transition ease-in-out duration-300 sm:duration-300"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-300"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <DialogPanel
                  class="pointer-events-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-800"
                >
                  <form
                    class="relative flex h-full min-h-0 flex-col divide-y divide-gray-200 dark:divide-gray-700"
                    @submit.prevent="handleSubmit"
                  >
                    <!-- Header (aligned with CreateRecordDrawer) -->
                    <div class="flex shrink-0 items-center justify-between bg-indigo-700 px-4 py-6 sm:px-6 dark:bg-indigo-800">
                      <div class="min-w-0 pr-2">
                        <DialogTitle class="text-base font-semibold text-white">
                          Edit {{ formatAppName(appKey) }} Details
                        </DialogTitle>
                        <p class="mt-1 text-sm text-indigo-200">{{ t('people.participationEditModalUpdateParticipationDetailsForThisPerson') }}</p>
                      </div>
                      <button
                        type="button"
                        class="relative shrink-0 rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        @click="close"
                      >
                        <span class="absolute -inset-2.5" />
                        <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                        <XMarkIcon class="size-6" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="min-h-0 flex-1 overflow-y-auto">
                      <div class="px-4 py-6 sm:px-6 space-y-6">
            <!-- Explanation Banner (non-dismissible) -->
            <div class="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">{{ t('people.participationEditModalEditingParticipationDetails') }}</p>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    You're editing this person's {{ formatAppName(appKey) }} details, not their identity or lifecycle.
                  </p>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-2">
                <svg class="h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
                </div>
              </div>
            </div>

            <!-- Validation Errors Summary -->
            <div v-if="Object.keys(validationErrors).length > 0" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-2">
                <svg class="h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">{{ t('people.participationEditModalValidationErrors') }}</h3>
                  <ul class="list-disc list-inside space-y-2">
                    <li v-for="(message, field) in validationErrors" :key="field" class="text-sm text-red-700 dark:text-red-300">
                      <span class="font-medium">{{ getFieldLabel(field) }}:</span> {{ message }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

                      <div class="space-y-6">
              <!-- Lifecycle Control (Type): Primary Control for SALES -->
              <div v-if="appKey === 'SALES'" class="space-y-1">
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white" :for="'participation-sales-type'">{{ t('settings.modFieldsValidationType') }}<span class="text-red-500">*</span>
                  <span class="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(Primary control)</span>
                </label>
                <HeadlessSelect
                  id="participation-sales-type"
                  :model-value="formData.sales_type ?? ''"
                  :options="salesTypeListboxOptions"
                  :placeholder="t('settings.groupFormSelectType')"
                  allow-empty
                  empty-:label="t('settings.groupFormSelectType')"
                  empty-value=""
                  wrapper-class="mt-2"
                  :invalid="!!validationErrors.sales_type"
                  :options-class="participationListboxOptionsClass"
                  @update:model-value="(v) => { formData.sales_type = v; }"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('people.participationEditModalChangingTypeUpdatesStatusAutomatically') }}</p>
                <p v-if="validationErrors.sales_type" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ validationErrors.sales_type }}
                </p>
              </div>

              <!-- Helpdesk: participation role only (tenant peopleTypes) -->
              <div v-else-if="appKey === 'HELPDESK'" class="space-y-1">
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white" :for="'participation-helpdesk-role'">{{ t('settings.modFieldsPbAssignRole') }}<span class="text-red-500">*</span>
                </label>
                <HeadlessSelect
                  id="participation-helpdesk-role"
                  :model-value="formData.helpdesk_role ?? ''"
                  :options="helpdeskRoleListboxOptions"
                  :placeholder="peopleTypesLoading ? 'Loading...' : 'Select role...'"
                  allow-empty
                  :empty-label="peopleTypesLoading ? 'Loading...' : 'Select role...'"
                  empty-value=""
                  :disabled="peopleTypesLoading"
                  wrapper-class="mt-2"
                  :invalid="!!validationErrors.helpdesk_role"
                  :options-class="participationListboxOptionsClass"
                  @update:model-value="(v) => { formData.helpdesk_role = v; }"
                />
                <p v-if="validationErrors.helpdesk_role" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ validationErrors.helpdesk_role }}
                </p>
              </div>

              <!-- Detail Fields Section -->
              <div v-if="visibleDetailFields.length > 0" class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('people.participationEditModalDetailFields') }}</h3>
                <div class="space-y-6">
                  <div v-for="fieldName in visibleDetailFields" :key="fieldName" class="space-y-1">
                    <label :for="fieldName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                      {{ getFieldLabel(fieldName) }}
                      <span v-if="isFieldRequired(fieldName)" class="text-red-500">*</span>
                    </label>
                    <HeadlessSelect
                      v-if="getFieldComponent(fieldName) === 'select'"
                      :id="fieldName"
                      :model-value="formData[fieldName] ?? ''"
                      :options="toListboxOptions(getFieldOptions(fieldName))"
                      :placeholder="`Select ${getFieldLabel(fieldName)}...`"
                      allow-empty
                      :empty-label="`Select ${getFieldLabel(fieldName)}...`"
                      empty-value=""
                      wrapper-class="mt-2"
                      :invalid="!!validationErrors[fieldName]"
                      :options-class="participationListboxOptionsClass"
                      @update:model-value="(v) => { formData[fieldName] = v; }"
                    />
                    <DatePicker
                      v-else-if="getInputType(fieldName) === 'date'"
                      :id="fieldName"
                      v-model="formData[fieldName]"
                      :invalid="!!validationErrors[fieldName]"
                      :input-class="fieldInputClass(fieldName, true)"
                    />
                    <input
                      v-else-if="getInputType(fieldName) === 'number'"
                      :id="fieldName"
                      :name="fieldName"
                      type="number"
                      v-model.number="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      :min="fieldName === 'lead_score' || fieldName === 'estimated_value' ? 0 : undefined"
                      :class="fieldInputClass(fieldName, false)"
                    />
                    <textarea
                      v-else-if="getFieldComponent(fieldName) === 'textarea'"
                      :id="fieldName"
                      :name="fieldName"
                      v-model="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      rows="3"
                      :class="[fieldInputClass(fieldName, false), 'resize-none']"
                    />
                    <input
                      v-else
                      :id="fieldName"
                      :name="fieldName"
                      type="text"
                      v-model="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      :class="fieldInputClass(fieldName, false)"
                    />
                    <p v-if="validationErrors[fieldName]" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      {{ validationErrors[fieldName] }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Empty State (Helpdesk uses role-only block above) -->
              <div
                v-if="visibleDetailFields.length === 0 && appKey !== 'HELPDESK'"
                class="text-center py-8"
              >
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  No detail fields available for {{ formatAppName(appKey) }}{{ controllingStateValue ? ` (${controllingStateValue})` : '' }}.
                </p>
              </div>

                      </div>
                      </div>
                    </div>

                    <!-- Actions (CreateRecordDrawer pattern) -->
                    <div class="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
                      <button
                        type="button"
                        class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700 cursor-pointer"
                        @click="close"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button
                        type="submit"
                        :disabled="loading || submitDisabled"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus-visible:outline-indigo-600 cursor-pointer"
                      >
                        <svg v-if="loading" class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{{ loading ? 'Saving...' : 'Save Changes' }}</span>
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
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { getAppNameKey } from '@/utils/navigationLabels';
import { ref, computed, watch, toRef } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { 
  PEOPLE_FIELD_METADATA, 
  getDetailFields,
  getFieldMetadata 
} from '@/platform/fields/peopleFieldModel';
import apiClient from '@/utils/apiClient';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { usePeopleModuleFields } from '@/composables/usePeopleModuleFields';
import DatePicker from '@/components/common/DatePicker.vue';
import { assertEditParticipationPermission } from '@/platform/permissions/peopleGuards';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  defaultPicklistFallback,
  getPeoplePicklistValues,
  isPeoplePicklistModuleField,
} from '@/utils/peopleModuleFieldUtils';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  personId: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    required: true
  },
  // Existing participation data (from profileData.apps[appKey])
  participationData: {
    type: Object,
    default: () => ({ fields: {} })
  }
});

const { t, te } = useI18n();

const emit = defineEmits(['close', 'updated']);

const { types: peopleTypes, loading: peopleTypesLoading } = usePeopleTypes(toRef(props, 'appKey'));
const { fields: peopleModuleFields } = usePeopleModuleFields();

const helpdeskRoleOptions = computed(() =>
  peopleTypes.value?.length ? peopleTypes.value : ['Customer', 'Agent']
);

const salesTypeListboxOptions = computed(() =>
  (peopleTypes.value?.length ? peopleTypes.value : ['Lead', 'Contact']).map((t) => ({
    value: t,
    label: t
  }))
);

const helpdeskRoleListboxOptions = computed(() =>
  helpdeskRoleOptions.value.map((t) => ({ value: t, label: t }))
);

/** Above dialog/drawer overlay (z-[10000]) so options are not hidden */
const participationListboxOptionsClass = 'z-[10020]';

/** Match DynamicFormField text/date/number inputs */
function fieldInputClass(fieldName, isDate) {
  const base =
    'block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500';
  const err = validationErrors.value[fieldName]
    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
    : '';
  return [base, err, isDate ? 'cursor-pointer' : ''].filter(Boolean);
}

function toListboxOptions(values) {
  return (Array.isArray(values) ? values : []).map((v) => ({ value: v, label: v }));
}

const loading = ref(false);
const error = ref(null);
const validationErrors = ref({});
const formData = ref({});

// Get detail fields for the app (ONLY detail fields, not state fields)
const allDetailFields = computed(() => {
  return getDetailFields(props.appKey);
});

/**
 * Get the controlling state value from existing participation data
 * This determines which detail fields are visible
 */
const controllingStateValue = computed(() => {
  const fields = props.participationData?.fields || {};
  if (props.appKey === 'SALES') {
    return fields.sales_type ?? null;
  }
  if (props.appKey === 'HELPDESK') {
    return fields.helpdesk_role ?? null;
  }
  return fields.type || fields.status || null;
});

/**
 * Visibility rules mapping per app
 * Reuses the same logic from AttachToAppModal
 */
const getVisibilityRules = (appKey) => {
  // For SALES app: Lead vs Contact
  if (appKey === 'SALES') {
    return {
      // When type === 'Lead': show Lead-specific detail fields
      'Lead': {
        showPatterns: [
          (fieldName) => fieldName.startsWith('lead_'),
          (fieldName) => fieldName.startsWith('qualification_'),
          (fieldName) => fieldName === 'estimated_value',
          (fieldName) => fieldName === 'interest_products'
        ],
        hidePatterns: [
          (fieldName) => fieldName === 'role',
          (fieldName) => fieldName === 'birthday',
          (fieldName) => fieldName === 'preferred_contact_method'
        ]
      },
      // When type === 'Contact': show Contact-specific detail fields
      'Contact': {
        showPatterns: [
          (fieldName) => fieldName === 'role',
          (fieldName) => fieldName === 'birthday',
          (fieldName) => fieldName === 'preferred_contact_method'
        ],
        hidePatterns: [
          (fieldName) => fieldName.startsWith('lead_'),
          (fieldName) => fieldName.startsWith('qualification_'),
          (fieldName) => fieldName === 'estimated_value',
          (fieldName) => fieldName === 'interest_products'
        ]
      }
    };
  }
  // Future apps can add their rules here
  return {};
};

/**
 * Check if a detail field should be visible based on controlling state
 */
const isDetailFieldVisible = (fieldName) => {
  // If no controlling state value, show all detail fields
  if (!controllingStateValue.value) {
    return true;
  }
  
  // Get visibility rules for current app
  const rules = getVisibilityRules(props.appKey);
  const stateValue = controllingStateValue.value;
  
  // If no rules for this state value, show the field (default behavior)
  if (!rules[stateValue]) {
    return true;
  }
  
  const rule = rules[stateValue];
  
  // Check if field matches any hide pattern
  if (rule.hidePatterns && rule.hidePatterns.some(pattern => pattern(fieldName))) {
    return false;
  }
  
  // Check if field matches any show pattern
  if (rule.showPatterns && rule.showPatterns.some(pattern => pattern(fieldName))) {
    return true;
  }
  
  // If show patterns exist but field doesn't match any, hide it (strict mode)
  if (rule.showPatterns && rule.showPatterns.length > 0) {
    return false;
  }
  
  // Default: show the field if no explicit rule
  return true;
};

/**
 * Get visible detail fields based on controlling state
 */
const visibleDetailFields = computed(() => {
  return allDetailFields.value.filter(fieldName => {
    // Only include fields that are:
    // 1. Detail fields (already filtered by getDetailFields)
    // 2. Visible based on controlling state
    // 3. Editable (from metadata)
    const metadata = getFieldMetadata(fieldName);
    return metadata.editable && isDetailFieldVisible(fieldName);
  });
});

/** Helpdesk can save role-only; other apps need at least one visible detail field (existing behavior). */
const submitDisabled = computed(() => {
  if (props.appKey === 'HELPDESK') return false;
  return visibleDetailFields.value.length === 0;
});

const formatAppName = (appKey) => {
  const nameKey = getAppNameKey(appKey);
  if (nameKey && te(nameKey)) return t(nameKey);
  return appKey;
};

const getFieldLabel = (fieldName) => {
  const metadata = getFieldMetadata(fieldName);
  const apiLabel = metadata?.label || metadata?.displayName;
  return resolveFieldLabel('people', { key: fieldName, label: apiLabel }, t, te);
};

// Check if field is required (only for visible fields in form)
const isFieldRequired = (fieldName) => {
  const metadata = getFieldMetadata(fieldName);
  // Only enforce requiredFor if field is visible and has requiredFor
  if (metadata.requiredFor && metadata.requiredFor.includes(props.appKey)) {
    return true;
  }
  return false;
};

// Get field component type
const getFieldComponent = (fieldName) => {
  if (fieldName.includes('notes') || fieldName.includes('description')) {
    return 'textarea';
  }
  if (isPeoplePicklistModuleField(peopleModuleFields.value, fieldName)) {
    return 'select';
  }
  return 'input';
};

// Get input type
const getInputType = (fieldName) => {
  if (fieldName.includes('date') || fieldName === 'birthday' || fieldName === 'qualification_date') {
    return 'date';
  }
  if (fieldName.includes('score') || fieldName.includes('value') || fieldName.includes('amount')) {
    return 'number';
  }
  return 'text';
};

// Get field options (for select fields) from People module definition
const getFieldOptions = (fieldName) => {
  return getPeoplePicklistValues(
    peopleModuleFields.value,
    fieldName,
    defaultPicklistFallback(fieldName)
  );
};

/** Normalize API / ISO dates for <input type="date"> */
const toDateInputValue = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// Initialize form data from existing participation
const initializeFormData = () => {
  formData.value = {};
  const existingFields = props.participationData?.fields || {};

  if (props.appKey === 'SALES') {
    formData.value.sales_type = existingFields.sales_type ?? '';
  } else if (props.appKey === 'HELPDESK') {
    formData.value.helpdesk_role = existingFields.helpdesk_role ?? '';
  }

  visibleDetailFields.value.forEach((fieldName) => {
    if (!Object.prototype.hasOwnProperty.call(existingFields, fieldName)) return;
    const raw = existingFields[fieldName];
    formData.value[fieldName] =
      getInputType(fieldName) === 'date' ? toDateInputValue(raw) : (raw ?? '');
  });
};

// Watch for modal open/participation data changes.
// immediate: true — parent often mounts this with isOpen already true (v-if + ref), so a non-immediate watch never ran and the form stayed blank.
watch([() => props.isOpen, () => props.participationData], () => {
  if (props.isOpen) {
    initializeFormData();
    error.value = null;
    validationErrors.value = {};
  }
}, { immediate: true, deep: true });

// Validate form
const validateForm = () => {
  validationErrors.value = {};
  let isValid = true;

  if (props.appKey === 'HELPDESK') {
    const t = formData.value.helpdesk_role;
    if (!t || (typeof t === 'string' && !t.trim())) {
      validationErrors.value.helpdesk_role = 'Role is required';
      return false;
    }
    return true;
  }

  if (props.appKey === 'SALES') {
    const t = formData.value.sales_type;
    if (!t || (typeof t === 'string' && !t.trim())) {
      validationErrors.value.sales_type = 'Type is required';
      return false;
    }
  }

  // Validate only visible detail fields
  visibleDetailFields.value.forEach(fieldName => {
    const value = formData.value[fieldName];
    const metadata = getFieldMetadata(fieldName);
    
    // Check required fields
    if (isFieldRequired(fieldName)) {
      if (value === null || value === undefined || value === '') {
        validationErrors.value[fieldName] = `${getFieldLabel(fieldName)} is required`;
        isValid = false;
      }
    }
    
    // Add more validation rules as needed
  });
  
  return isValid;
};

/**
 * Sanitize payload - CRITICAL: Only include visible detail fields
 * Development guard: Throw error if invalid fields detected
 */
const sanitizePayload = () => {
  const payload = {};
  
  // Get all state fields to exclude them
  const stateFields = Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && 
      metadata.fieldScope === props.appKey &&
      metadata.intent === 'state'
    )
    .map(([fieldName]) => fieldName);
  
  // Get all core/system fields to exclude them
  const coreFields = Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'core' || metadata.owner === 'system'
    )
    .map(([fieldName]) => fieldName);
  
  // Only include visible detail fields
  visibleDetailFields.value.forEach(fieldName => {
    // Development guard: Check for invalid fields
    if (stateFields.includes(fieldName)) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`CRITICAL: Attempted to include state field "${fieldName}" in edit payload`);
      }
      return; // Skip in production
    }
    
    if (coreFields.includes(fieldName)) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`CRITICAL: Attempted to include core/system field "${fieldName}" in edit payload`);
      }
      return; // Skip in production
    }
    
    // Include field value (even if empty/null - let backend handle it)
    payload[fieldName] = formData.value[fieldName];
  });
  
  return payload;
};

// Handle form submission
const handleSubmit = async () => {
  // Guard: Check permission before submitting
  assertEditParticipationPermission(props.appKey);
  
  if (!validateForm()) {
    return;
  }
  
  loading.value = true;
  error.value = null;
  validationErrors.value = {};
  
  try {
    const sanitizedPayload =
      props.appKey === 'HELPDESK'
        ? { helpdesk_role: formData.value.helpdesk_role }
        : { ...sanitizePayload(), sales_type: formData.value.sales_type };

    const response = await apiClient.put(`/people/${props.personId}/update-app-fields`, {
      appKey: props.appKey,
      formData: sanitizedPayload
    });
    
    if (response.success) {
      emit('updated', response.data);
      close();
    } else {
      error.value = response.message || 'Failed to update participation details';
      
      // Handle validation errors from backend
      if (response.errors) {
        validationErrors.value = response.errors;
      }
    }
  } catch (err) {
    console.error('Error updating participation details:', err);
    error.value = err.message || 'Failed to update participation details';
    
    // Handle validation errors
    if (err.response?.data?.errors) {
      validationErrors.value = err.response.data.errors;
    }
  } finally {
    loading.value = false;
  }
};

// Close modal
const close = () => {
  emit('close');
};
</script>

