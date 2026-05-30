<!--
  ============================================================================
  ARCHITECTURAL INVARIANT: PEOPLE QUICK CREATE DRAWER
  ============================================================================
  
  CONFIG-DRIVEN + CONTEXT-AWARE:
  - Quick create fields: getPeopleQuickCreateFields(module) — Settings → People → Quick Create
  - context: 'ALL' | 'SALES' | 'HELPDESK' — determines UI and submission
  
  ALL CONTEXTS: Quick create fields always visible (identity creation)
  
  ALL APPS TAB (optionalAppParticipation + contextAppKey null):
  - "App participation" picker: None | SALES | HELPDESK → AppSection when an app is selected
  
  APP CONTEXT (when context !== 'ALL'):
  - Divider: "{AppName} Information"
  - Type (required): usePeopleTypes(context), auto-select first
  - Dependent fields: getAppFields(context, role) — role-specific participation fields
  - UX hint: "This person will be added to {AppName} as {SelectedType}"
  - Submission: POST /people/create { quickCreate fields, appKey, role }
  
  CONSTRAINTS: No hardcoded SALES, no hardcoded core fields, no submit without role in app context.
  
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
              as="template" 
              enter="transform transition ease-in-out duration-300 sm:duration-300" 
              enter-from="translate-x-full" 
              enter-to="translate-x-0" 
              leave="transform transition ease-in-out duration-300 sm:duration-300" 
              leave-from="translate-x-0" 
              leave-to="translate-x-full"
            >
              <DialogPanel :class="drawerPanelClass">
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl">
                  <!-- Fixed Header -->
                  <div class="flex-shrink-0 bg-indigo-700 dark:bg-indigo-800 px-4 py-6 sm:px-6 border-b border-indigo-600 dark:border-indigo-700">
                    <div class="flex items-center justify-between">
                      <DialogTitle class="text-base font-semibold text-white">{{ t('people.peopleQuickCreateDrawerCreatePerson') }}</DialogTitle>
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
                        <!-- App context hint: "This person will be added to Sales as [Lead]" -->
                        <p v-if="appContextHint" class="text-xs text-indigo-200 dark:text-indigo-300 mt-2">
                          {{ appContextHint }}
                        </p>
                        <p v-else-if="optionalAppParticipation && !effectiveAppKey" class="text-xs text-indigo-200 dark:text-indigo-300 mt-2">{{ t('people.peopleQuickCreateDrawerOptionalChooseAnAppBelowTo') }}</p>
                        <p v-else-if="!effectiveAppKey" class="text-xs text-gray-400 dark:text-gray-500 mt-2">{{ t('people.peopleQuickCreateDrawerCreatesIdentityOnlyNoAppParticipation') }}</p>
                      </div>
                  </div>

                  <!-- Scrollable Content Area (user interaction only — not programmatic DynamicForm sync) -->
                  <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <div
                      class="px-4 sm:px-6 py-6 pb-48"
                      @input.capture="markUserInteraction"
                      @change.capture="markUserInteraction"
                      @pointerdown.capture="markUserInteraction"
                    >
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
                        
                        <!-- STEP 1: Core fields (always visible) -->
                        <div v-if="peopleModuleLoading" class="flex justify-center py-12">
                          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        </div>
                        <template v-else-if="peopleModuleOverride">
                          <!-- Quick create fields (configurable via Settings → People → Quick Create) -->
                          <DynamicForm
                            moduleKey="people"
                            :formData="formData"
                            :errors="errors"
                            :quickCreateMode="true"
                            :showAllFields="false"
                            :fieldsOverride="quickCreateFieldsOverride"
                            :excludeFields="quickCreateExcludeFields"
                            :moduleOverride="peopleModuleOverride"
                            context="platform"
                            @update:formData="updateFormData"
                            @ready="onFormReady"
                          />

                          <!-- All Apps tab: optional app picker → AppSection -->
                          <div
                            v-if="optionalAppParticipation && contextAppKeyPropIsNull"
                            class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6"
                          >
                            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('records.genericAppParticipation') }}</h3>
                            <Listbox
                              :model-value="selectedOptionalAppKey"
                              as="div"
                              class="block"
                              @update:model-value="onOptionalAppChange"
                            >
                              <ListboxLabel class="block text-sm/6 font-medium text-gray-900 dark:text-white mb-1">{{ t('people.peopleQuickCreateDrawerAddToApp') }}</ListboxLabel>
                              <div class="relative mt-2">
                                <ListboxButton
                                  type="button"
                                  :class="[
                                    'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-left text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-default relative pr-10'
                                  ]"
                                >
                                  <span class="block truncate">
                                    {{ optionalAppListboxLabel }}
                                  </span>
                                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                    <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                                  </span>
                                </ListboxButton>
                                <Transition
                                  enter-active-class="transition duration-100 ease-out"
                                  enter-from-class="opacity-0"
                                  enter-to-class="opacity-100"
                                  leave-active-class="transition duration-100 ease-in"
                                  leave-from-class="opacity-100"
                                  leave-to-class="opacity-0"
                                >
                                  <ListboxOptions
                                    as="ul"
                                    class="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                                  >
                                    <ListboxOption
                                      v-for="opt in optionalAppParticipationOptions"
                                      :key="String(opt.value ?? 'none')"
                                      :value="opt.value"
                                      v-slot="{ active, selected }"
                                    >
                                      <div
                                        :class="[
                                          'relative cursor-default select-none py-2 pl-4 pr-10',
                                          active
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100'
                                            : 'text-gray-900 dark:text-gray-100'
                                        ]"
                                      >
                                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ opt.label }}</span>
                                        <span
                                          v-if="selected"
                                          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                                        >
                                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                        </span>
                                      </div>
                                    </ListboxOption>
                                  </ListboxOptions>
                                </Transition>
                              </div>
                            </Listbox>
                          </div>

                          <!-- App section (generic, no hardcoded apps) -->
                          <AppSection
                            v-if="effectiveAppKey"
                            :app-key="effectiveAppKey"
                            v-model="appForm"
                            :module-override="peopleModuleOverride"
                            :errors="errors"
                          />
                        </template>
                        <p v-else-if="isOpen" class="text-sm text-amber-600 dark:text-amber-400">{{ t('people.peopleQuickCreateDrawerCouldNotLoadPeopleModulePlease') }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Fixed Footer -->
                  <div class="flex-shrink-0 flex justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex gap-3">
                      <button 
                        type="button" 
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
                        @click="closeDrawer"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button 
                        type="submit" 
                        :disabled="saving || submitDisabled" 
                        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {{ saving ? 'Saving...' : 'Save' }}
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

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
// Type declaration for process.env (used in DEV-ONLY guards)
declare const process: {
  env: {
    NODE_ENV: string;
  };
};

import { ref, computed, watch, toRef, nextTick, type PropType } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
  Listbox,
  ListboxLabel,
  ListboxButton,
  ListboxOptions,
  ListboxOption
} from '@headlessui/vue';
import { XMarkIcon, ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import AppSection from '@/components/people/AppSection.vue';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { useCreationContext } from '@/utils/creationContext';
import { getPeopleQuickCreateFields, getAppFields } from '@/platform/fields/peopleFieldModel';
import { getGlobalSystemFieldKeys } from '@/platform/fields/fieldCapabilityEngine';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { getFormFieldValue, syncParticipationClassifierFields } from '@/utils/getFieldValue';
import { normalizeModuleFieldsFromMetadata } from '@/platform/fields/fieldMerge';
import { mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldRegistry';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  /**
   * Creation context app key (OPTIONAL)
   * When 'SALES': create→attach flow with type selection.
   * When 'HELPDESK': create→attach for Helpdesk.
   * When null/undefined: identity-only POST /people.
   */
  /**
   * null = explicit global (no AppSection on People "All People", ignoring shell active app).
   * undefined (omit prop) = infer from route + activeApp on /people.
   */
  contextAppKey: {
    type: String as PropType<string | null | undefined>,
    required: false,
    default: undefined
  },
  /**
   * When true with contextAppKey null (All Apps tab), show optional app picker + AppSection.
   */
  optionalAppParticipation: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

const { openTab } = useTabs();

// Creation context: appKey is null for global, 'SALES'|'HELPDESK' for app-specific
const { appKey } = useCreationContext(toRef(props, 'contextAppKey'));

/** When optional participation mode (All Apps), user-selected app; null = identity only */
const selectedOptionalAppKey = ref<'SALES' | 'HELPDESK' | null>(null);

const contextAppKeyPropIsNull = computed(() => props.contextAppKey === null);

const effectiveAppKey = computed((): 'SALES' | 'HELPDESK' | null => {
  if (props.optionalAppParticipation && props.contextAppKey === null) {
    return selectedOptionalAppKey.value;
  }
  return appKey.value;
});

const OPTIONAL_APP_KEYS = ['SALES', 'HELPDESK'] as const;

const optionalAppParticipationOptions = computed(() => [
  { value: null as null, label: 'None (identity only)' },
  ...OPTIONAL_APP_KEYS.map((k) => ({ value: k, label: getAppLabel(k) }))
]);

const optionalAppListboxLabel = computed(() => {
  const k = selectedOptionalAppKey.value;
  if (!k) return 'None (identity only)';
  return getAppLabel(k);
});

function onOptionalAppChange(value: 'SALES' | 'HELPDESK' | null) {
  markUserInteraction();
  selectedOptionalAppKey.value = value;
  appForm.value = { participationType: null };
}

const { typeDefs: peopleTypeDefs } = usePeopleTypes(effectiveAppKey);

/** Hide platform-managed keys (e.g. source) — People quick create does not use CreateRecordDrawer’s exclude list */
const quickCreateExcludeFields = computed(() => getGlobalSystemFieldKeys());

// App form state (participation type + dependent fields) — used by AppSection
const appForm = ref<Record<string, any>>({ participationType: null });

// People module fetched when drawer opens (Settings → People → Quick Create + app participation fields).
const peopleModuleOverride = ref<any>(null);
const peopleModuleLoading = ref(false);

// Fetch people module from quick-create endpoint (single source: Settings → People → Quick Create).
watch(() => props.isOpen, async (open) => {
  if (!open) {
    peopleModuleOverride.value = null;
    peopleModuleLoading.value = false;
    appForm.value = { participationType: null };
    selectedOptionalAppKey.value = null;
    return;
  }
  peopleModuleLoading.value = true;
  peopleModuleOverride.value = null;
  try {
    const res = await apiClient.get('/modules/people/quick-create', { params: { context: 'all' } });
    if (res?.success && res?.data) {
      const mod = res.data;
      if (!mod.quickCreate) mod.quickCreate = [];
      if (!mod.quickCreateLayout) mod.quickCreateLayout = { version: 1, rows: [] };
      mod.fields = normalizeModuleFieldsFromMetadata('people', mod.fields || []);
      mod.fields = mergePeopleVirtualFieldDefinitions(mod.fields);
      peopleModuleOverride.value = mod;
    }
  } catch (e) {
    console.error('[PeopleQuickCreateDrawer] Failed to fetch people module:', e);
  } finally {
    peopleModuleLoading.value = false;
  }
}, { immediate: true });

// Form state
const formData = ref<Record<string, any>>({});
const errors = ref<Record<string, string>>({});
const saving = ref(false);
const moduleDefinition = ref<any>(null);

/** True after real user interaction (backdrop/Escape blocked); not set by programmatic DynamicForm sync */
const userHasEdited = ref(false);
function markUserInteraction() {
  userHasEdited.value = true;
}

async function scrollToFirstErrorField() {
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
    ) as HTMLElement | null;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
}

// Quick create fields from config (Settings → People → Quick Create)
const quickCreateFieldsOverride = computed(() =>
  getPeopleQuickCreateFields(peopleModuleOverride.value)
);

// App-dependent fields for validation/payload (when in app context)
const appDependentFields = computed(() => {
  if (!effectiveAppKey.value || !appForm.value?.participationType) return [];
  return getAppFields(effectiveAppKey.value, appForm.value.participationType, peopleTypeDefs.value);
});

// UX hint: "This person will be added to {AppName} as {Role}"
const appContextHint = computed(() => {
  if (effectiveAppKey.value && appForm.value?.participationType) {
    return `This person will be added to ${getAppLabel(effectiveAppKey.value)} as ${appForm.value.participationType}`;
  }
  return null;
});

// Prevent submit when app context but no role selected
const submitDisabled = computed(() =>
  !!effectiveAppKey.value && !appForm.value?.participationType
);

// Helper text
const helperText = computed(() => {
  if (!effectiveAppKey.value) {
    return props.optionalAppParticipation && props.contextAppKey === null
      ? 'Create a new person with identity information. App participation is optional.'
      : 'Create a new person with identity information.';
  }
  return 'Create a new person with identity and app participation.';
});

// Drawer panel class
const drawerPanelClass = 'pointer-events-auto w-screen max-w-2xl h-full';

/**
 * Validate quick create + app fields (required in form from module)
 */
function appFormDataForDependencies() {
  const base = { ...(appForm.value || {}) } as Record<string, unknown>;
  syncParticipationClassifierFields(base, effectiveAppKey.value);
  return base;
}

function validateForm() {
  errors.value = {};
  if (!moduleDefinition.value?.fields) return;

  const moduleFields = moduleDefinition.value.fields as any[];
  const qcFields = quickCreateFieldsOverride.value;
  const appFields = appDependentFields.value;
  const appDepForm = appFormDataForDependencies();

  for (const field of moduleFields) {
    if (!field.key) continue;
    const isQcField = qcFields.includes(field.key);
    const isAppField = appFields.includes(field.key);
    if (!isQcField && !isAppField) continue;

    // Apply dependency-driven effective state (required/visibility), not static `field.required` only.
    const depState = getFieldDependencyState(
      field,
      isAppField ? appDepForm : formData.value,
      moduleFields,
      { moduleKey: 'people' }
    );
    if (depState.visible === false) continue;
    if (depState.required !== true) continue;

    const source = isQcField ? formData.value : appForm.value;
    const value = field.key in source
      ? source[field.key]
      : getFormFieldValue(formData.value, field.key, field, { moduleKey: 'people' });
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      (errors.value as Record<string, string>)[field.key] = `${field.label || field.key} is required`;
    }
  }
  if (effectiveAppKey.value && !appForm.value?.participationType) {
    (errors.value as Record<string, string>).participationType = 'Type is required';
  }
}

const closeDrawer = () => {
  if (!saving.value) {
    emit('close');
    // Reset form after closing
    setTimeout(() => {
      formData.value = {};
      appForm.value = { participationType: null };
      selectedOptionalAppKey.value = null;
      errors.value = {};
      userHasEdited.value = false;
    }, 300);
  }
};

const handleDialogClose = () => {
  if (userHasEdited.value) return;
  closeDrawer();
};

const updateFormData = (data: Record<string, any>) => {
  formData.value = { ...data };
};

const onFormReady = (module: any) => {
  moduleDefinition.value = module;
  const allFieldKeys = [...quickCreateFieldsOverride.value];
  const initialForm: Record<string, any> = {};
  if (module?.fields) {
    for (const field of module.fields) {
      if (allFieldKeys.includes(field.key)) {
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          initialForm[field.key] = field.defaultValue;
        } else if (field.dataType === 'Multi-Picklist' || field.key === 'tags') {
          initialForm[field.key] = [];
        } else if (field.dataType === 'Checkbox') {
          initialForm[field.key] = false;
        } else {
          initialForm[field.key] = '';
        }
      }
    }
  }
  formData.value = { ...initialForm };
};

watch(formData, (newVal, oldVal) => {
  if (!oldVal) return;
  for (const key in newVal) {
    if (newVal[key] !== oldVal[key] && errors.value[key]) {
      const v = newVal[key];
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        delete errors.value[key];
      }
    }
  }
}, { deep: true });

watch(appForm, (newVal, oldVal) => {
  if (!oldVal) return;
  for (const key in newVal) {
    if (newVal[key] !== oldVal[key] && errors.value[key]) {
      const v = newVal[key];
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        delete errors.value[key];
      }
    }
  }
}, { deep: true });

/**
 * Build payload: context ALL → quick create only; context app → quick create + app fields
 */
function buildCreatePersonPayload(): Record<string, any> {
  const payload: Record<string, any> = {};
  const qcFields = quickCreateFieldsOverride.value;
  const appFields = appDependentFields.value;

  for (const field of qcFields) {
    if (field in formData.value) {
      const value = formData.value[field];
      if (Array.isArray(value)) {
        if (value.length > 0) payload[field] = value;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '') payload[field] = trimmed;
      } else if (value !== null && value !== undefined) {
        payload[field] = value;
      }
    }
  }

  for (const field of appFields) {
    if (field in appForm.value) {
      const value = appForm.value[field];
      if (Array.isArray(value)) {
        if (value.length > 0) payload[field] = value;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '') payload[field] = trimmed;
      } else if (value !== null && value !== undefined) {
        payload[field] = value;
      }
    }
  }

  return payload;
}

/**
 * Handle form submission (context-driven)
 * ALL: POST /people (core fields only)
 * SALES/HELPDESK: POST /people/create (quick create fields + app fields, appKey + role)
 */
const handleSubmit = async () => {
  errors.value = {};
  saving.value = true;

  try {
    validateForm();
    if (Object.keys(errors.value).length > 0) {
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    const payload = buildCreatePersonPayload();

    let response;
    if (!effectiveAppKey.value) {
      response = await apiClient.post('/people', payload);
    } else {
      const requestBody = {
        appKey: effectiveAppKey.value,
        role: appForm.value.participationType,
        formData: payload
      };
      response = await apiClient.post('/people/create', requestBody);
    }
      
      if (response.success) {
        console.log('[PeopleQuickCreate] ✅ Person created successfully');
        const createdPerson = response.data;
        
        // Open the newly created record in a new tab
        const personId = createdPerson._id || createdPerson.id;
        if (personId) {
          const firstName = createdPerson.first_name || '';
          const lastName = createdPerson.last_name || '';
          const title = firstName || lastName 
            ? `${firstName} ${lastName}`.trim() 
            : 'Person Detail';
          
          openTab(`/people/${personId}`, {
            title,
            icon: 'users',
            params: { name: title },
            insertAdjacent: true
          });
        }
        
        emit('saved', createdPerson);
        
        // Dispatch global event to refresh list views
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:record-created', {
            detail: { moduleKey: 'people', record: createdPerson }
          }));
        }
        
        saving.value = false; // Reset saving state before closing
        closeDrawer();
      } else {
        if (response.errors) {
          errors.value = { ...errors.value, ...response.errors };
          scrollToFirstErrorField();
        } else {
          errors.value._general = response.message || 'Failed to create contact';
        }
        saving.value = false;
      }
    
  } catch (error: unknown) {
    const err = error as any;
    console.error('[PeopleQuickCreate] ❌ Error creating person:', error);
    console.error('[PeopleQuickCreate] Error details:', {
      message: err?.message,
      error: error,
      response: err?.response?.data,
      responseData: err?.response?.data,
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      fullError: JSON.stringify(error, null, 2)
    });
    
    // If we have a response with error details, show them
    if (err?.response?.data?.error) {
      console.error('[PeopleQuickCreate] Server error message:', err.response.data.error);
    }
    
    // Handle validation errors from API
    if (err?.response?.data?.errors) {
      errors.value = { ...errors.value, ...err.response.data.errors };
      scrollToFirstErrorField();
    } else if (err?.response?.data?.message) {
      (errors.value as Record<string, string>)._general = err.response.data.message;
    } else if (err?.response?.data?.error) {
      // Backend might return error in 'error' field
      (errors.value as Record<string, string>)._general = err.response.data.error;
    } else {
      (errors.value as Record<string, string>)._general = err?.message || 'Failed to create contact';
    }
  } finally {
    saving.value = false;
  }
};

// Reset form when drawer opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    userHasEdited.value = false;
    formData.value = {};
    errors.value = {};
    appForm.value = { participationType: null };
    selectedOptionalAppKey.value = null;
  }
});
</script>

