<!--
  ============================================================================
  ARCHITECTURAL INVARIANT: CREATE ORGANIZATION SURFACE
  ============================================================================
  
  WHAT THIS SURFACE IS:
  - The SINGLE AUTHORITY for creating and editing business organizations
  - Supports two explicit modes: create (new organization) and edit (existing organization)
  - Edit mode requires organizationId and fetches editable data
  
  WHAT THIS SURFACE MUST NEVER DO:
  - MUST NOT edit tenant configuration (subscription, billing, limits)
  - MUST NOT edit app participation (belongs to app-specific surfaces)
  - MUST NOT allow edit mode without organizationId
  - MUST NOT behave like quick create in edit mode
  
  INVARIANT LOCKS:
  - Edit mode requires organizationId (enforced at component level)
  - Edit mode NEVER behaves like quick create (separate logic paths)
  
  ============================================================================
  CREATE / EDIT ORGANIZATION SURFACE

This surface supports two explicit modes:
- create: introduce a new business organization
- edit: update business details of an existing organization

This surface MUST NOT:
- edit tenant configuration
- edit app participation
- expose billing, subscription, or limits
- replace OrganizationSurface

OrganizationSurface remains read-only.

============================================================================
CREATEORGANIZATIONSURFACE CONTRACT
============================================================================

CreateOrganizationSurface
Creation and editing surface for Business Organizations.

ARCHITECTURAL INTENT:
- A creation/editing surface (NOT a general management screen)
- Contextual (invoked from People, Command Palette, OrganizationSurface, or app workflows)
- Supports both create and edit modes via explicit mode prop
- NOT a list
- NOT a general organization editor
  
This surface exists to create and edit Business Organizations
(Customer / Partner / Vendor / etc.)
  
MUST NOT:
- Create tenant organizations
- Expose subscription, billing, limits, enabledApps, or security
- Act as a general organization editor
- Appear in sidebar navigation
- Become a generic "Organization Form"
  
Reference documents:
- docs/architecture/organization-surface-invariants.md
- docs/architecture/module-settings-doctrine.md
- People creation surface as the canonical UX reference
  
============================================================================
INVOCATION CONTEXT
============================================================================
  
This surface can be invoked from:
1. Command Palette (Create Organization) → Open OrganizationSurface after creation
2. PeopleSurface contextual actions (Link / Create) → Link and close
3. OrganizationSurface ("Edit business details") → Return to OrganizationSurface after edit
4. App-specific workflows (Sales, Audit) → Return control to invoking app
  
Post-creation behavior is driven by invocation context via query params:
- ?from=people&personId=xxx → Link to person and close
- ?from=command → Open OrganizationSurface
- ?from=app&appKey=xxx → Return to app workflow
- ?from=organization → Return to OrganizationSurface (edit mode)
  
============================================================================
-->

<template>
  <div :class="['density-balanced', { 'mx-auto max-w-4xl': !emitEvents }]">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ mode === 'edit' ? 'Edit Organization' : 'Create Organization' }}
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ mode === 'edit' ? 'Update business organization details' : 'Create a business organization to link people and work' }}
      </p>
    </div>

    <!-- Validation Errors Summary -->
    <div v-if="Object.keys(validationErrors).length > 0" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">{{ t('organizations.createOrganizationSurfaceValidationErrors') }}</h3>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="(message, field) in validationErrors" :key="field" class="text-sm text-red-700 dark:text-red-300">
              <span class="font-medium">{{ field }}:</span> {{ message }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Loading State (Edit Mode) -->
    <div v-if="loading && mode === 'edit'" class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div class="flex items-center gap-3">
        <svg class="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-sm text-blue-700 dark:text-blue-300">{{ t('organizations.createOrganizationSurfaceLoadingOrganizationData') }}</p>
      </div>
    </div>

    <!-- General Error -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('organizations.createOrganizationSurfaceError') }}</h3>
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Form -->
    <!-- MODE BRANCHING: Same form works for both create and edit modes -->
    <!-- EDIT MODE: Form is disabled while loading initial data -->
    <form @submit.prevent="handleSubmit" class="space-y-6" :class="{ 'opacity-50 pointer-events-none': loading && mode === 'edit' }">
      <!-- 1. Core Business Identity -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('organizations.createOrganizationSurfaceCoreBusinessIdentity') }}</h2>
        
        <div class="space-y-4">
          <!-- Name (required) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.settingsBhFieldName') }}<span class="text-red-500">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :placeholder="t('organizations.createOrganizationSurfaceOrganizationName')"
            />
            <p v-if="validationErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.name }}
            </p>
          </div>

          <!-- Types (multi-select: Customer, Partner, Vendor, Distributor, Dealer) -->
          <!-- EDIT MODE: Read-only if types are already set (used in relationships) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.peopleTypesTitle') }}</label>
            <div class="space-y-2">
              <label
                v-for="type in organizationTypes"
                :key="type"
                class="flex items-center gap-2"
                :class="{ 'cursor-pointer': !(mode === 'edit' && typesReadOnly), 'cursor-not-allowed opacity-60': mode === 'edit' && typesReadOnly }"
              >
                <HeadlessCheckbox
                  :checked="formData.types.includes(type)"
                  @change="toggleOrganizationType(type, $event)"
                  :disabled="mode === 'edit' && typesReadOnly"
                  checkbox-class="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ type }}</span>
              </label>
            </div>
            <p v-if="mode === 'edit' && typesReadOnly" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('organizations.createOrganizationSurfaceTypesCannotBeChangedOnceThe') }}</p>
            <p v-if="validationErrors.types" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.types }}
            </p>
          </div>

          <!-- Status Fields (Intent-Aware) -->
          <!-- Organization Intent is a UI guidance layer, not enforcement -->
          <!-- These fields show/hide and filter options based on selected types -->
          
          <!-- Customer Status (shown when Customer type is selected) -->
          <div v-if="shouldShowStatusField('customerStatus', formData.types)">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.modFieldsCustomerStatus') }}<span v-if="isStatusReadOnly('customerStatus')" class="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">
                (System-owned)
              </span>
            </label>
            <!-- Read-only badge when derivedStatus exists -->
            <div
              v-if="isStatusReadOnly('customerStatus')"
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">
                {{ formData.customerStatus || '—' }}
              </span>
            </div>
            <!-- Editable select (legacy mode when derivedStatus is null) -->
            <select
              v-else
              v-model="formData.customerStatus"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option :value="null">{{ t('organizations.createOrganizationSurfaceSelectStatus3') }}</option>
              <option
                v-for="status in customerStatusOptions"
                :key="status"
                :value="status"
              >
                {{ status }}
              </option>
            </select>
            <p v-if="validationErrors.customerStatus" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.customerStatus }}
            </p>
          </div>

          <!-- Partner Status (shown when Partner type is selected) -->
          <div v-if="shouldShowStatusField('partnerStatus', formData.types)">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.modFieldsPartnerStatus') }}<span v-if="isStatusReadOnly('partnerStatus')" class="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">
                (System-owned)
              </span>
            </label>
            <!-- Read-only badge when derivedStatus exists -->
            <div
              v-if="isStatusReadOnly('partnerStatus')"
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">
                {{ formData.partnerStatus || '—' }}
              </span>
            </div>
            <!-- Editable select (legacy mode when derivedStatus is null) -->
            <select
              v-else
              v-model="formData.partnerStatus"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option :value="null">{{ t('organizations.createOrganizationSurfaceSelectStatus2') }}</option>
              <option
                v-for="status in partnerStatusOptions"
                :key="status"
                :value="status"
              >
                {{ status }}
              </option>
            </select>
            <p v-if="validationErrors.partnerStatus" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.partnerStatus }}
            </p>
          </div>

          <!-- Vendor Status (shown when Vendor type is selected) -->
          <div v-if="shouldShowStatusField('vendorStatus', formData.types)">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.modFieldsVendorStatus') }}<span v-if="isStatusReadOnly('vendorStatus')" class="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">
                (System-owned)
              </span>
            </label>
            <!-- Read-only badge when derivedStatus exists -->
            <div
              v-if="isStatusReadOnly('vendorStatus')"
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">
                {{ formData.vendorStatus || '—' }}
              </span>
            </div>
            <!-- Editable select (legacy mode when derivedStatus is null) -->
            <select
              v-else
              v-model="formData.vendorStatus"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option :value="null">{{ t('organizations.createOrganizationSurfaceSelectStatus') }}</option>
              <option
                v-for="status in vendorStatusOptions"
                :key="status"
                :value="status"
              >
                {{ status }}
              </option>
            </select>
            <p v-if="validationErrors.vendorStatus" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.vendorStatus }}
            </p>
          </div>
        </div>
      </div>

      <!-- 2. Optional Business Context (progressive disclosure) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <button
          type="button"
          @click="showOptionalFields = !showOptionalFields"
          class="w-full flex items-center justify-between text-left"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('organizations.createOrganizationSurfaceOptionalBusinessContext') }}</h2>
          <svg
            :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', { 'rotate-180': showOptionalFields }]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div v-if="showOptionalFields" class="mt-4 space-y-4">
          <!-- Industry -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.assignRulesCondFieldIndustry') }}</label>
            <input
              v-model="formData.industry"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :placeholder="t('organizations.createOrganizationSurfaceEGTechnologyHealthcareManufacturing')"
            />
            <p v-if="validationErrors.industry" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.industry }}
            </p>
          </div>

          <!-- Website -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('organizations.createOrganizationSurfaceWebsite') }}</label>
            <input
              v-model="formData.website"
              type="text"
              inputmode="url"
              autocomplete="url"
              @input="handleWebsiteInput"
              @blur="handleWebsiteBlur"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :placeholder="t('organizations.createOrganizationSurfaceHttpsExampleCom')"
            />
            <p v-if="validationErrors.website" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.website }}
            </p>
          </div>

          <!-- Phone -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.settingsAddFieldTypePhone') }}</label>
            <PhoneInput
              :model-value="formData.phone"
              :placeholder="t('settings.profilePhone')"
              input-class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :invalid="Boolean(validationErrors.phone)"
              @update:model-value="formData.phone = $event"
              @blur="validatePhoneField"
            />
            <p v-if="validationErrors.phone" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.phone }}
            </p>
          </div>

          <!-- Address -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('organizations.createOrganizationSurfaceAddress') }}</label>
            <textarea
              v-model="formData.address"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              :placeholder="t('organizations.createOrganizationSurfaceStreetAddressCityStateZip')"
            ></textarea>
            <p v-if="validationErrors.address" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ validationErrors.address }}
            </p>
          </div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          @click="handleCancel"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >{{ t('performance.cancelWizard') }}</button>
        <button
          type="submit"
          :disabled="submitting || !formData.name"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="submitting">{{ mode === 'edit' ? 'Saving...' : 'Creating...' }}</span>
          <span v-else>{{ mode === 'edit' ? 'Save Changes' : 'Create Organization' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import PhoneInput from '@/components/common/PhoneInput.vue';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { getWebsiteValidationMessage } from '@/utils/urlInputValidation';
import { getAllowedStatusesForTypes, getDefaultStatusForTypes, getOrganizationIntentsForTypes } from '@/platform/organizations/organizationIntents';

// Props
// MODE BRANCHING: Component supports two explicit modes
const props = defineProps({
  /**
   * Mode: 'create' | 'edit'
   * - 'create': Create a new organization (default)
   * - 'edit': Edit an existing organization
   */
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value)
  },
  /**
   * Organization ID (required when mode === 'edit')
   */
  organizationId: {
    type: String,
    default: null
  },
  /**
   * Emit events instead of navigating (for drawer mode)
   */
  emitEvents: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

// Emits
const emit = defineEmits(['close', 'saved']);

const route = useRoute();
const router = useRouter();

// State
const submitting = ref(false);
const validationErrors = ref({});
const error = ref(null);
const showOptionalFields = ref(false);
const loading = ref(false);
const typesReadOnly = ref(false);
const websiteTouched = ref(false);

const validatePhoneField = () => {
  const p = sanitizeInternationalPhone(formData.value.phone || '');
  formData.value.phone = p;
  const phoneValidation = validatePhoneValue(p);
  if (!phoneValidation.isValid) {
    validationErrors.value = { ...validationErrors.value, phone: phoneValidation.error };
    return false;
  }
  if (validationErrors.value.phone) {
    const next = { ...validationErrors.value };
    delete next.phone;
    validationErrors.value = next;
  }
  return true;
};

const validateWebsiteField = (rawValue = formData.value.website, { markTouched = false } = {}) => {
  if (markTouched) {
    websiteTouched.value = true;
  }

  const website = typeof rawValue === 'string' ? rawValue.trim() : '';
  const websiteErrorMessage = getWebsiteValidationMessage(website);
  if (websiteErrorMessage) {
    validationErrors.value.website = websiteErrorMessage;
    return false;
  }

  if (validationErrors.value.website) {
    delete validationErrors.value.website;
  }
  return true;
};

const handleWebsiteInput = () => {
  if (!websiteTouched.value) return;
  validateWebsiteField();
};

const handleWebsiteBlur = () => {
  validateWebsiteField(formData.value.website, { markTouched: true });
};

// Organization types (locked order as per requirements)
const organizationTypes = ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'];

// Form data (only allowed fields)
const formData = ref({
  name: '',
  types: [],
  industry: '',
  website: '',
  phone: '',
  address: '',
  // Status fields (intent-aware)
  customerStatus: null,
  partnerStatus: null,
  vendorStatus: null,
  derivedStatus: null // Track derivedStatus to determine if status is read-only
});

// ============================================================================
// ORGANIZATION INTENT AWARENESS
// ============================================================================
// 
// Organization Intent is a UI guidance layer, not enforcement.
// It provides read-only configuration that maps organization types to
// allowed lifecycle statuses and default values.
// 
// This does NOT:
// - Enforce backend validation rules
// - Block submission of invalid combinations
// - Persist intent data
// 
// This DOES:
// - Filter visible status options based on selected types
// - Auto-select default status in CREATE mode
// - Provide UI guidance for status selection
// ============================================================================

/**
 * Get allowed statuses for a specific status field based on selected types.
 * Maps organization types to their corresponding status fields:
 * - Customer type → customerStatus field
 * - Partner type → partnerStatus field
 * - Vendor type → vendorStatus field
 */
const getAllowedStatusesForField = (fieldKey, selectedTypes) => {
  if (!selectedTypes || selectedTypes.length === 0) {
    return [];
  }
  
  // Map status field keys to organization types
  const fieldToTypeMap = {
    customerStatus: ['Customer'],
    partnerStatus: ['Partner'],
    vendorStatus: ['Vendor']
  };
  
  const relevantTypes = fieldToTypeMap[fieldKey];
  if (!relevantTypes) {
    return [];
  }
  
  // Check if any of the selected types match this field's types
  const matchingTypes = selectedTypes.filter(type => relevantTypes.includes(type));
  if (matchingTypes.length === 0) {
    return [];
  }
  
  // Get allowed statuses for the matching types from intent config
  return getAllowedStatusesForTypes(matchingTypes);
};

/**
 * Get default status for a specific status field based on selected types.
 */
const getDefaultStatusForField = (fieldKey, selectedTypes) => {
  if (!selectedTypes || selectedTypes.length === 0) {
    return null;
  }
  
  // Map status field keys to organization types
  const fieldToTypeMap = {
    customerStatus: ['Customer'],
    partnerStatus: ['Partner'],
    vendorStatus: ['Vendor']
  };
  
  const relevantTypes = fieldToTypeMap[fieldKey];
  if (!relevantTypes) {
    return null;
  }
  
  // Check if any of the selected types match this field's types
  const matchingTypes = selectedTypes.filter(type => relevantTypes.includes(type));
  if (matchingTypes.length === 0) {
    return null;
  }
  
  // Get default status for the matching types from intent config
  return getDefaultStatusForTypes(matchingTypes);
};

/**
 * Check if a status field should be visible based on selected types.
 */
const shouldShowStatusField = (fieldKey, selectedTypes) => {
  const fieldToTypeMap = {
    customerStatus: ['Customer'],
    partnerStatus: ['Partner'],
    vendorStatus: ['Vendor']
  };
  
  const relevantTypes = fieldToTypeMap[fieldKey];
  if (!relevantTypes) {
    return false;
  }
  
  return selectedTypes.some(type => relevantTypes.includes(type));
};

/**
 * Check if a status field should be read-only (when derivedStatus exists)
 */
const isStatusReadOnly = (fieldKey) => {
  // Status is read-only when derivedStatus exists (system-owned)
  return formData.value.derivedStatus != null && formData.value.derivedStatus !== '';
};

// Computed: Allowed statuses for each status field (intent-aware)
const customerStatusOptions = computed(() => {
  const allowed = getAllowedStatusesForField('customerStatus', formData.value.types);
  // If no intent matches, return empty array (will fall back to showing all if needed)
  return allowed;
});

const partnerStatusOptions = computed(() => {
  const allowed = getAllowedStatusesForField('partnerStatus', formData.value.types);
  return allowed;
});

const vendorStatusOptions = computed(() => {
  const allowed = getAllowedStatusesForField('vendorStatus', formData.value.types);
  return allowed;
});

// Computed: Default statuses for each field (intent-aware)
const defaultCustomerStatus = computed(() => {
  return getDefaultStatusForField('customerStatus', formData.value.types);
});

const defaultPartnerStatus = computed(() => {
  return getDefaultStatusForField('partnerStatus', formData.value.types);
});

const defaultVendorStatus = computed(() => {
  return getDefaultStatusForField('vendorStatus', formData.value.types);
});

// Invocation context from query params
const invocationContext = computed(() => {
  return {
    from: route.query.from || (props.mode === 'edit' ? 'organization' : 'command'), // 'people', 'command', 'app', or 'organization'
    personId: route.query.personId || null,
    appKey: route.query.appKey || null
  };
});

// Effective organization ID (from prop or route param)
const effectiveOrganizationId = computed(() => {
  return props.organizationId || route.params.id || null;
});

// UX SAFETY GUARD: Validate props in edit mode
// EDIT MODE RESTRICTION: organizationId is required
if (props.mode === 'edit' && !effectiveOrganizationId.value) {
  // DEV-ONLY INVARIANT GUARD: Edit mode requires organizationId
  if (process.env.NODE_ENV === 'development') {
    console.error('[CreateOrganizationSurface] INVARIANT VIOLATION: Edit mode requires organizationId', {
      mode: props.mode,
      organizationId: props.organizationId,
      routeParam: route.params.id
    });
  }
  throw new Error('organizationId is required when mode === "edit"');
}

// DEV-ONLY INVARIANT GUARD: Edit mode NEVER behaves like quick create
if (process.env.NODE_ENV === 'development' && props.mode === 'edit') {
  // Edit mode has separate logic paths - this is validated throughout the component
  // Quick create would use different endpoints and payload shapes
}

// Methods
const toggleOrganizationType = (type, event) => {
  const isChecked = !!event?.target?.checked;
  if (isChecked) {
    if (!formData.value.types.includes(type)) {
      formData.value.types = [...formData.value.types, type];
    }
    return;
  }
  formData.value.types = formData.value.types.filter(currentType => currentType !== type);
};

const handleSubmit = async () => {
  // Validate required fields
  validationErrors.value = {};
  error.value = null;

  if (!formData.value.name || formData.value.name.trim() === '') {
    validationErrors.value.name = 'Name is required';
    return;
  }

  if (!validateWebsiteField(formData.value.website, { markTouched: true })) {
    return;
  }

  if (!validatePhoneField()) {
    return;
  }

  try {
    submitting.value = true;

    // MODE BRANCHING: Different API endpoints and payload shapes
    if (props.mode === 'edit') {
      // DEV-ONLY INVARIANT GUARD: Edit mode requires organizationId
      if (process.env.NODE_ENV === 'development') {
        console.assert(
          effectiveOrganizationId.value !== null && effectiveOrganizationId.value !== undefined,
          '[CreateOrganizationSurface] INVARIANT VIOLATION: Edit mode submission requires organizationId',
          { mode: props.mode, organizationId: effectiveOrganizationId.value }
        );
        if (!effectiveOrganizationId.value) {
          console.error('[CreateOrganizationSurface] TODO: Edit mode submission attempted without organizationId');
        }
      }
      
      // DEV-ONLY INVARIANT GUARD: Edit mode NEVER behaves like quick create
      if (process.env.NODE_ENV === 'development') {
        // Edit mode uses PATCH with shape-complete payload, not POST with minimal payload
        console.assert(
          true, // This is edit mode, not quick create
          '[CreateOrganizationSurface] INVARIANT: Edit mode uses PATCH with shape-complete payload'
        );
      }
      
      // EDIT MODE: PATCH /organizations/:id
      // EDIT MODE RESTRICTION: Payload must be shape-complete (include all editable fields)
      // Use null for untouched optional fields (not undefined)
      const payload = {
        name: formData.value.name.trim(),
        types: formData.value.types || [],
        industry: formData.value.industry?.trim() || null,
        website: formData.value.website?.trim() || null,
        phone: formData.value.phone?.trim() || null,
        address: formData.value.address?.trim() || null,
        // Status fields (intent-aware, but backend validates)
        customerStatus: formData.value.customerStatus || null,
        partnerStatus: formData.value.partnerStatus || null,
        vendorStatus: formData.value.vendorStatus || null
      };

      const response = await apiClient.patch(`/organizations/${effectiveOrganizationId.value}`, payload);

      if (response.success) {
        const updatedOrg = response.data;

        // Emit event if in drawer mode, otherwise navigate
        if (props.emitEvents) {
          emit('saved', updatedOrg);
        } else {
          // Handle post-update behavior based on invocation context
          await handlePostUpdate(updatedOrg);
        }
      } else {
        if (response.errors) {
          validationErrors.value = response.errors;
          error.value = response.message || 'Validation failed. Please check the fields below.';
        } else {
          error.value = response.message || 'Failed to update organization';
        }
      }
    } else {
      // CREATE MODE: POST /organizations
      // CREATE MODE: Prepare payload - ONLY include allowed fields (undefined fields are removed)
      const payload = {
        name: formData.value.name.trim(),
        types: formData.value.types.length > 0 ? formData.value.types : undefined,
        industry: formData.value.industry?.trim() || undefined,
        website: formData.value.website?.trim() || undefined,
        phone: formData.value.phone?.trim() || undefined,
        address: formData.value.address?.trim() || undefined,
        // Status fields (intent-aware, but backend validates)
        customerStatus: formData.value.customerStatus || undefined,
        partnerStatus: formData.value.partnerStatus || undefined,
        vendorStatus: formData.value.vendorStatus || undefined
      };

      // Remove undefined fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      // Create organization via dedicated API endpoint
      const response = await apiClient.post('/organizations', payload);

      if (response.success) {
        const createdOrg = response.data;

        // Emit event if in drawer mode, otherwise navigate
        if (props.emitEvents) {
          emit('saved', createdOrg);
        } else {
          // Handle post-creation behavior based on invocation context
          await handlePostCreation(createdOrg);
        }
      } else {
        if (response.errors) {
          validationErrors.value = response.errors;
          error.value = response.message || 'Validation failed. Please check the fields below.';
        } else {
          error.value = response.message || 'Failed to create organization';
        }
      }
    }
  } catch (err) {
    console.error(`Error ${props.mode === 'edit' ? 'updating' : 'creating'} organization:`, err);
    
    // Handle validation errors from backend
    if (err.response?.data?.errors) {
      validationErrors.value = err.response.data.errors;
      error.value = err.response.data.message || 'Validation failed. Please check the fields below.';
    } else if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else {
      error.value = err.message || `Error ${props.mode === 'edit' ? 'updating' : 'creating'} organization`;
    }
  } finally {
    submitting.value = false;
  }
};

/**
 * Handle post-creation behavior based on invocation context
 * 
 * Rules:
 * - If created from People context: Link newly created organization to that person → Close surface
 * - If created from Command Palette: Open OrganizationSurface for the new org
 * - If created from app workflow: Return control to invoking app
 */
const handlePostCreation = async (createdOrg) => {
  const context = invocationContext.value;

  if (context.from === 'people' && context.personId) {
    // Link organization to person and close
    try {
      await apiClient.put(`/people/${context.personId}`, {
        organization: createdOrg._id || createdOrg.id
      });
      
      // Close surface (go back)
      router.back();
    } catch (linkError) {
      console.error('Error linking organization to person:', linkError);
      // Still navigate back even if linking fails
      router.back();
    }
  } else if (context.from === 'command') {
    // Open OrganizationSurface for the new org
    router.push(`/organizations/${createdOrg._id || createdOrg.id}`);
  } else if (context.from === 'app' && context.appKey) {
    // Return control to invoking app
    // For now, navigate to OrganizationSurface (can be customized per app)
    router.push(`/organizations/${createdOrg._id || createdOrg.id}`);
  } else {
    // Default: Open OrganizationSurface
    router.push(`/organizations/${createdOrg._id || createdOrg.id}`);
  }
};

/**
 * Handle post-update behavior based on invocation context
 * 
 * Rules:
 * - If edited from OrganizationSurface: Return to OrganizationSurface
 * - If edited from app workflow: Return control to invoking app
 * - Default: Return to OrganizationSurface
 */
const handlePostUpdate = async (updatedOrg) => {
  const context = invocationContext.value;

  if (context.from === 'organization') {
    // Return to OrganizationSurface
    router.push(`/organizations/${updatedOrg._id || updatedOrg.id}`);
  } else if (context.from === 'app' && context.appKey) {
    // Return control to invoking app
    // For now, navigate to OrganizationSurface (can be customized per app)
    router.push(`/organizations/${updatedOrg._id || updatedOrg.id}`);
  } else {
    // Default: Return to OrganizationSurface
    router.push(`/organizations/${updatedOrg._id || updatedOrg.id}`);
  }
};

/**
 * Fetch organization data for edit mode
 * 
 * Fetches ONLY editable business fields from GET /organizations/:id/editable
 * Treats fetched data as INITIAL state only
 */
const fetchOrganizationData = async () => {
  if (props.mode !== 'edit' || !effectiveOrganizationId.value) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.get(`/organizations/${effectiveOrganizationId.value}/editable`);

    if (response.success && response.data) {
      const data = response.data;

      // UX SAFETY GUARD: Defensive check for forbidden fields
      // EDIT MODE RESTRICTION: If API returns forbidden fields, show generic error
      // This is a defensive UX fallback - backend should reject tenant orgs at API level
      const forbiddenFields = ['subscription', 'limits', 'enabledApps', 'billing', 'isTenant'];
      const hasForbiddenFields = forbiddenFields.some(field => data[field] !== undefined);
      
      if (hasForbiddenFields) {
        error.value = 'Invalid data received. Please contact support.';
        console.error('API returned forbidden fields:', Object.keys(data));
        return;
      }

      // EDIT MODE: Populate form with fetched data (treat as INITIAL state only)
      formData.value = {
        name: data.name || '',
        types: Array.isArray(data.types) ? [...data.types] : [],
        industry: data.industry || '',
        website: data.website || '',
        phone: sanitizeInternationalPhone(data.phone || ''),
        address: data.address || '',
        // Status fields (preserve existing values in edit mode)
        customerStatus: data.customerStatus || null,
        partnerStatus: data.partnerStatus || null,
        vendorStatus: data.vendorStatus || null,
        derivedStatus: data.derivedStatus || null
      };

      // EDIT MODE RESTRICTION: Determine if types should be read-only
      // Types are read-only if they're already set (used in relationships)
      // This prevents breaking existing relationships
      typesReadOnly.value = Array.isArray(data.types) && data.types.length > 0;

      // Auto-expand optional fields if any are filled
      if (data.industry || data.website || data.phone || data.address) {
        showOptionalFields.value = true;
      }
    } else {
      error.value = response.message || 'Failed to load organization data';
    }
  } catch (err) {
    console.error('Error fetching organization data:', err);
    
    // Show non-destructive error state
    if (err.response?.status === 404) {
      error.value = 'Organization not found';
    } else if (err.response?.status === 403) {
      error.value = 'You do not have permission to edit this organization';
    } else if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else {
      error.value = err.message || 'Failed to load organization data';
    }
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  if (props.emitEvents) {
    emit('close');
  } else {
    router.back();
  }
};

// Lifecycle
onMounted(() => {
  // Fetch organization data if in edit mode
  if (props.mode === 'edit') {
    fetchOrganizationData();
  }
});

// Watch for mode or organizationId changes
watch([() => props.mode, () => props.organizationId], ([newMode, newId]) => {
  if (newMode === 'edit' && newId) {
    fetchOrganizationData();
  }
});

// ============================================================================
// INTENT-AWARE STATUS FIELD UPDATES
// ============================================================================
// Watch for types changes and update status fields based on intent config
watch(
  () => formData.value.types,
  (newTypes, oldTypes) => {
    // Only process if types actually changed
    if (JSON.stringify(newTypes) === JSON.stringify(oldTypes)) {
      return;
    }
    
    const selectedTypes = Array.isArray(newTypes) ? newTypes : [];
    
    // For CREATE mode: Auto-select default status if no status is selected yet
    if (props.mode === 'create') {
      // Customer status
      if (shouldShowStatusField('customerStatus', selectedTypes)) {
        const allowed = getAllowedStatusesForField('customerStatus', selectedTypes);
        const defaultStatus = getDefaultStatusForField('customerStatus', selectedTypes);
        
        // Only auto-select if no status is currently set
        if (!formData.value.customerStatus && defaultStatus && allowed.length > 0) {
          formData.value.customerStatus = defaultStatus;
        }
        
        // DEV-ONLY ASSERTION: defaultStatus must be in allowedStatuses
        if (import.meta.env.DEV && defaultStatus) {
          console.assert(
            allowed.includes(defaultStatus),
            `[CreateOrganizationSurface] defaultStatus "${defaultStatus}" is not in allowedStatuses for Customer type`,
            { defaultStatus, allowed }
          );
        }
      } else {
        // Hide field if type is deselected
        formData.value.customerStatus = null;
      }
      
      // Partner status
      if (shouldShowStatusField('partnerStatus', selectedTypes)) {
        const allowed = getAllowedStatusesForField('partnerStatus', selectedTypes);
        const defaultStatus = getDefaultStatusForField('partnerStatus', selectedTypes);
        
        if (!formData.value.partnerStatus && defaultStatus && allowed.length > 0) {
          formData.value.partnerStatus = defaultStatus;
        }
        
        if (import.meta.env.DEV && defaultStatus) {
          console.assert(
            allowed.includes(defaultStatus),
            `[CreateOrganizationSurface] defaultStatus "${defaultStatus}" is not in allowedStatuses for Partner type`,
            { defaultStatus, allowed }
          );
        }
      } else {
        formData.value.partnerStatus = null;
      }
      
      // Vendor status
      if (shouldShowStatusField('vendorStatus', selectedTypes)) {
        const allowed = getAllowedStatusesForField('vendorStatus', selectedTypes);
        const defaultStatus = getDefaultStatusForField('vendorStatus', selectedTypes);
        
        if (!formData.value.vendorStatus && defaultStatus && allowed.length > 0) {
          formData.value.vendorStatus = defaultStatus;
        }
        
        if (import.meta.env.DEV && defaultStatus) {
          console.assert(
            allowed.includes(defaultStatus),
            `[CreateOrganizationSurface] defaultStatus "${defaultStatus}" is not in allowedStatuses for Vendor type`,
            { defaultStatus, allowed }
          );
        }
      } else {
        formData.value.vendorStatus = null;
      }
    }
    // For EDIT mode: Only filter visible options, do NOT auto-change existing status
    
    // DEV-ONLY ASSERTION: Check if allowedStatuses is empty for selected types
    if (import.meta.env.DEV) {
      const intents = getOrganizationIntentsForTypes(selectedTypes);
      if (selectedTypes.length > 0 && intents.length === 0) {
        console.warn(
          '[CreateOrganizationSurface] No intent matches found for selected types:',
          selectedTypes
        );
      }
      
      // Check each status field
      ['customerStatus', 'partnerStatus', 'vendorStatus'].forEach(fieldKey => {
        if (shouldShowStatusField(fieldKey, selectedTypes)) {
          const allowed = getAllowedStatusesForField(fieldKey, selectedTypes);
          if (allowed.length === 0) {
            console.warn(
              `[CreateOrganizationSurface] allowedStatuses is empty for ${fieldKey} with types:`,
              selectedTypes
            );
          }
        }
      });
    }
  },
  { deep: true }
);
</script>
