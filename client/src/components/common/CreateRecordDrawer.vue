<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="isOpen">
      <Dialog :initialFocus="closeButtonRef" class="relative z-[10000]" @close="handleDialogClose">
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
              <div class="pointer-events-auto h-full flex">
                <DialogPanel
                  :class="[
                    'flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] transition-[width] duration-200 ease-out',
                    isQuoteForm || fullMode ? 'w-[60rem]' : 'w-[30rem]'
                  ]"
                  @pointerdown.capture="markUserInteraction"
                  @focusin.capture="markUserInteraction"
                >
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                  <!-- Header: fixed at top -->
                  <div class="flex items-center justify-between bg-indigo-700 dark:bg-indigo-800 px-4 py-4 sm:px-6 flex-shrink-0">
                    <DialogTitle class="text-base font-semibold text-white">{{ computedTitle }}</DialogTitle>
                    <button
                      ref="closeButtonRef"
                      type="button"
                      class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
                      @click="closeDrawer"
                    >
                      <span class="absolute -inset-2.5" />
                      <span class="sr-only">{{ t('common.closePanel') }}</span>
                      <XMarkIcon class="size-6" aria-hidden="true" />
                    </button>
                  </div>

                  <!-- Body: scrollable (user interaction only — not programmatic DynamicForm sync) -->
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div
                      class="px-4 sm:px-6 py-6 space-y-6"
                      @input.capture="markUserInteraction"
                      @change.capture="markUserInteraction"
                      @pointerdown.capture="markUserInteraction"
                    >
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
                          <!-- Loading when fetching Quick Create config from Settings -->
                          <div
                            v-if="moduleOverrideLoading && (effectiveQuickCreateMode || isEditing)"
                            class="flex justify-center py-12"
                          >
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                          </div>
                          <!-- Dynamic Form: moduleOverride from Settings when drawer opens so Quick Create fields match Settings -->
                          <DynamicForm
                            v-else-if="!moduleOverrideLoading"
                            :moduleKey="moduleKey"
                            :moduleOverride="effectiveModuleOverrideForDrawer"
                            :formData="formData"
                            :errors="errors"
                            :excludeFields="effectiveExcludeFields"
                            :lockedFields="lockedFields"
                            :showAllFields="fullMode || !effectiveQuickCreateMode"
                            :quickCreateMode="strictQuickCreateForForm"
                            :useQuickCreateOrder="(useQuickCreateOrder || strictQuickCreateForForm) && !fullMode"
                            :singleColumn="!fullMode"
                            :quickCreateFirstWhenExpanded="effectiveQuickCreateMode"
                            @update:formData="updateFormData"
                            @ready="onFormReady"
                          >
                            <template v-if="isQuoteForm" #after-quick-create>
                              <div class="space-y-3 pt-2">
                                <div class="flex items-center gap-3">
                                  <h3 class="text-sm font-semibold tracking-wide text-gray-900 dark:text-white uppercase">
                                    {{ t('records.quoteLinesSectionTitle') }}
                                  </h3>
                                  <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                </div>
                                <div v-if="quoteFormLoading" class="flex justify-center py-10">
                                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                                </div>
                                <QuoteLinesRecordSection
                                  v-else-if="quoteFormRecord"
                                  :record="quoteFormRecord"
                                  :context="quoteLinesFormContext"
                                  @updated="handleQuoteLinesUpdated"
                                />
                                <p
                                  v-else
                                  class="text-sm text-red-600 dark:text-red-400"
                                >
                                  {{ isQuoteEdit ? t('records.quoteLoadFailed') : t('records.quoteCreateDraftFailed') }}
                                </p>
                              </div>
                            </template>
                          </DynamicForm>
                          <!-- Deal relationship editor (People + Organizations) -->
                          <div
                            v-if="moduleKey === 'deals' && (!effectiveQuickCreateMode || fullMode)"
                            class="pt-6 border-t border-gray-200 dark:border-gray-700"
                          >
                            <DealRelationshipEditor
                              ref="relationshipEditorRef"
                              v-model="dealRelationships"
                              :people="dealPeopleList"
                              :organizations="dealOrgList"
                              :read-only="false"
                            />
                          </div>
                    </div>
                  </div>

                  <!-- Footer: left toggle + right actions (same as edit drawer) -->
                  <div class="flex shrink-0 flex items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <button
                      v-if="showFullModeToggle"
                      type="button"
                      class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer"
                      @click="toggleFullMode"
                    >
                      {{ fullMode ? t('common.drawerBackQuickCreate') : t('common.drawerShowAllFields') }}
                    </button>
                    <span v-else />
                    <div class="flex gap-3">
                      <button
                        type="button"
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        @click="closeDrawer"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        :disabled="saving"
                        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {{ saving ? t('states.saving') : (isEditing ? t('actions.update') : t('actions.save')) }}
                      </button>
                    </div>
                  </div>
                </form>
              </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicForm from './DynamicForm.vue';
import DealRelationshipEditor from '@/components/deals/DealRelationshipEditor.vue';
import QuoteLinesRecordSection from '@/components/record-page/sections/QuoteLinesRecordSection.vue';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import {
  fetchPeopleListCached,
  fetchOrganizationsListCached,
  DEAL_RELATIONSHIP_PEOPLE_PARAMS,
  DEAL_RELATIONSHIP_ORG_PARAMS,
} from '@/utils/recordLookupCache';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { useAuthStore } from '@/stores/authRegistry';
import { isAuditEventType } from '@/utils/eventUtils';
import { getEventTypeByKey, getEventTypeByLabel, EVENT_TYPE_DEFINITIONS } from '@/metadata/eventTypes';
import { useTabs } from '@/composables/useTabs';
import { useRoute } from 'vue-router';
import { getTaskSystemFields } from '@/platform/fields/taskFieldModel';
import {
  getCaseSystemFields,
  stripCaseRecordForEditForm,
  filterCaseEditSubmitPayload,
  buildCaseEditSubmitPayload
} from '@/platform/fields/caseFieldModel';
import {
  getGlobalSystemFieldKeys,
  isSystemField,
  normalizeFieldKeyForSystemMatch,
} from '@/platform/fields/fieldCapabilityEngine';
import {
  getQuickCreateAllowedFieldKeys,
  shouldFilterPayloadByQuickCreate
} from '@/utils/quickCreatePayloadFilter';
import { useCreationContext } from '@/utils/creationContext';
import { getParticipationFields, getCoreIdentityFields, mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldModel';
import {
  normalizeOrganizationEditSubmitPayload,
  stripOrganizationRecordForEditForm,
} from '@/platform/fields/organizationFieldModel';
import { getFormFieldValue, syncPeopleVirtualFieldKeys, applyVirtualFieldDefault } from '@/utils/getFieldValue';
import {
  applyCreateOwnerDefaultsToForm,
  applyCreateOwnerDefaultsToPayload,
  resolveCurrentUserId
} from '@/utils/recordCreateOwnerDefaults';
import {
  getItemQuickCreateFields,
  getItemCatalogScaffoldFieldKeys,
  getItemLegacyCategoryFieldKeys
} from '@/platform/fields/itemFieldModel';
import { normalizeModuleFieldsFromMetadata } from '@/platform/fields/fieldMerge';
import {
  applyQuoteLineDeleteToRecord,
  applyQuoteLinesAddToRecord,
  applyQuoteLinesMutationToRecord,
  applyQuoteLinesRecalculateToRecord,
} from '@/utils/quoteRecordPatch';
import { clearQuoteLinesSession } from '@/composables/useQuoteLinesSession';

const _c = globalThis.console;
function drawerDbg(...args) {
  if (import.meta.env.DEV) _c.log(...args);
}
function drawerWarn(...args) {
  if (import.meta.env.DEV) _c.warn(...args);
}

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
  initialData: {
    type: Object,
    default: () => ({})
  },
  prefillText: {
    type: String,
    default: ''
  },
  prefillFieldKey: {
    type: String,
    default: ''
  },
  record: {
    type: Object,
    default: null // If provided, this is edit mode
  },
  excludeFields: {
    type: Array,
    default: () => [] // Fields to exclude from the form (e.g., app-specific fields)
  },
  // When true, Deal create/edit uses role-based relationship editor; contactId/accountId excluded
  useDealRelationshipEditor: {
    type: Boolean,
    default: true
  },
  lockedFields: {
    type: Array,
    default: () => [] // Fields that should be readonly/locked (e.g., ['accountId'])
  },
  /** When provided (and key matches moduleKey), skips /modules fetch on drawer open. */
  moduleDefinitionPrefetch: {
    type: Object,
    default: null
  },
  quickCreateMode: {
    type: Boolean,
    default: false // If true, only show fields configured in quickCreate settings
  },
  useQuickCreateOrder: {
    type: Boolean,
    default: false // If true, use quickCreate array order even in edit mode
  }
});

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const route = useRoute();
const { openTab, activeTab } = useTabs();
// Omit override = infer from route + activeApp on /people (null would mean explicit global-only)
const { isSalesContext } = useCreationContext();
const isEditing = computed(() => !!props.record);
const isQuoteModule = computed(() => props.moduleKey?.toLowerCase() === 'quotes');
const isQuoteCreate = computed(() => isQuoteModule.value && !isEditing.value);
const isQuoteEdit = computed(() => isQuoteModule.value && isEditing.value);
const isQuoteForm = computed(() => isQuoteModule.value);
const fullMode = ref(false);
const closeButtonRef = ref(null);
const quoteFormRecord = ref(null);
const quoteFormLoading = ref(false);
const quoteFormEnsurePromise = ref(null);
/** Auto-created quote id while create drawer is open; discarded unless Save succeeds */
const quoteCreateDraftId = ref(null);
const quoteCreateSaved = ref(false);
const quoteLinesFormContext = { expandedLeftSection: '' };

function isDuplicateKeyError(error) {
  const msg = String(
    error?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    ''
  );
  return error?.response?.status === 409 ||
    msg.includes('E11000') ||
    msg.includes('duplicate key');
}

async function createQuoteDraftWithRetry(payload, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await apiClient.post('/quotes', payload);
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}

// Two modes: Quick Create Mode (only quick create fields) | Full Form Mode (all fields from config except system)
// Show toggle when quick-create is configured. Quotes always open in full form (no toggle).
const showFullModeToggle = computed(() => effectiveQuickCreateMode.value && !isQuoteForm.value);

function toggleFullMode() {
  markUserInteraction();
  fullMode.value = !fullMode.value;
}

// Quick Create Mode: show only fields from Settings → Quick Create
// Full Form Mode: show all fields from module config (except system) in config order
const effectiveQuickCreateMode = computed(() => {
  if (isQuoteEdit.value) return true;
  if (props.quickCreateMode) return true;
  // If module settings provide a quickCreate config, default to strict quick-create mode.
  // This keeps create drawers aligned with Settings-selected fields.
  const hasConfiguredQuickCreate =
    Array.isArray(moduleOverrideFromSettings.value?.quickCreate) &&
    moduleOverrideFromSettings.value.quickCreate.length > 0;
  if (hasConfiguredQuickCreate) return true;

  // Fallback defaults for modules where create drawers are quick-create first by design.
  const useQuickCreateByDefault = ['organizations', 'tasks', 'items', 'deals', 'cases', 'quotes'];
  return useQuickCreateByDefault.includes(props.moduleKey?.toLowerCase());
});

// DynamicForm treats quickCreateMode as strict: empty quickCreate → no fields. Only enable strict
// mode when Settings (or parent prop) actually defines quickCreate keys; otherwise show required-field fallback.
const strictQuickCreateForForm = computed(() => {
  if (!effectiveQuickCreateMode.value) return false;
  if (props.quickCreateMode) return true;
  if (fullMode.value) return false;
  // Quotes: only Settings → Quick Create selected fields (never required-field fallback).
  if (props.moduleKey?.toLowerCase() === 'quotes') return true;
  const qc = effectiveModuleOverrideForDrawer.value?.quickCreate
    ?? moduleOverrideFromSettings.value?.quickCreate;
  return Array.isArray(qc) && qc.length > 0;
});

// Module name mapping for titles
const moduleNameMap = {
  'people': 'Person',
  'organizations': 'Organization',
  'deals': 'Deal',
  'tasks': 'Task',
  'cases': 'Case',
  'events': 'Event',
  'quotes': 'Quote',
  'users': 'User'
};

const computedTitle = computed(() => {
  if (props.title) return props.title;
  const moduleName = moduleNameMap[props.moduleKey] || props.moduleKey;
  return isEditing.value ? `Edit ${moduleName}` : `New ${moduleName}`;
});

const coreSystemFieldKeys = [
  '_id',
  '__v',
  'organizationId',
  'organizationid',
  'createdBy',
  'createdby',
  'createdAt',
  'createdat',
  'updatedAt',
  'updatedat',
  'activityLogs',
  'activitylogs',
];

const effectiveExcludeFields = computed(() => {
  const base = props.excludeFields || [];
  const excluded = new Set([
    ...(base || []),
    ...getGlobalSystemFieldKeys(),
    ...coreSystemFieldKeys,
  ]);
  // RULE: Global system fields (trash: deletedAt, deletedBy, deletionReason) never show in create/edit
  if (props.moduleKey === 'deals' && props.useDealRelationshipEditor) {
    // Deal create/edit uses DealRelationshipEditor for links and should hide model-level
    // relationship/system tracking arrays from DynamicForm in both quick and full modes.
    [
      'contactId',
      'accountId',
      'dealPeople',
      'dealOrganizations',
      'descriptionVersions',
      'derivedStatus',
      'stageHistory',
      'playbookState',
      'activityLogs',
      'stageOrder',
      'lineItems',
    ].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey === 'tasks') {
    const taskSystemFields = (getTaskSystemFields() || []).map((k) => String(k).toLowerCase());
    // Exclude only system fields; relatedTo and subtasks stay in DynamicForm so they appear in config order (like edit drawer)
    ['relatedToType', 'relatedToId', ...taskSystemFields].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey === 'items') {
    getItemCatalogScaffoldFieldKeys().forEach((k) => excluded.add(k));
    getItemLegacyCategoryFieldKeys().forEach((k) => excluded.add(k));
    ['status', 'product_image', 'stock_quantity', 'reorder_level', 'serial_numbers'].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey === 'cases') {
    const caseSystemFields = (getCaseSystemFields() || []).map((k) => String(k).toLowerCase());
    const caseSystemPrefixes = ['assignmentcontrol', 'currentslacycle', 'slacycles', 'activities', 'source'];
    const caseFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    const caseSystemFieldsFromModule = caseFields
      .map((field) => String(field?.key || ''))
      .filter(Boolean)
      .filter((key) => {
        const normalized = normalizeFieldKeyForSystemMatch(key);
        return caseSystemPrefixes.some((prefix) => normalized.startsWith(prefix));
      });
    [...caseSystemFields, ...caseSystemFieldsFromModule].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey?.toLowerCase() === 'quotes') {
    const quoteFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of quoteFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      const normalized = normalizeFieldKeyForSystemMatch(key);
      if (isSystemField('quotes', { key })) {
        excluded.add(key);
        continue;
      }
      if (normalized.startsWith('customerresponse')) {
        excluded.add(key);
      }
    }
    return Array.from(excluded);
  }
  return Array.from(excluded);
});


// Fetch module (including Quick Create from Settings) when drawer opens
async function fetchModuleForDrawer() {
  if (!props.moduleKey) return;
  const keyLower = (props.moduleKey || '').toLowerCase().trim();
  const prefetched =
    props.moduleDefinitionPrefetch &&
    String(props.moduleDefinitionPrefetch?.key || '').toLowerCase().trim() === keyLower
      ? props.moduleDefinitionPrefetch
      : null;
  if (!prefetched) {
    moduleOverrideLoading.value = true;
  }
  moduleOverrideFromSettings.value = null;
  try {
    const moduleDefinition = prefetched || (await fetchModuleDefinitionCached(props.moduleKey));
    if (!moduleDefinition) return;
    const modulesList = [moduleDefinition];
    const currentPath = String(
      route.path ||
        activeTab.value?.path ||
        (typeof window !== 'undefined' ? window.location.pathname : '') ||
        ''
    ).toLowerCase();
    const inferredAppKey =
      currentPath.startsWith('/helpdesk/') ? 'helpdesk'
      : currentPath.startsWith('/audit/') ? 'audit'
      : currentPath.startsWith('/portal/') ? 'portal'
      : currentPath.startsWith('/projects/') ? 'projects'
      : currentPath.startsWith('/sales/') ? 'sales'
      // Sales CRM routes are not always nested under /sales/*
      : currentPath.startsWith('/deals') ? 'sales'
      : currentPath.startsWith('/quotes') ? 'platform'
      : '';

    // Platform core modules must resolve to platform appKey even off-module routes (e.g. global search).
    const moduleAppKeyHintByKey = {
      quotes: 'platform',
      items: 'platform',
      forms: 'platform',
      tasks: 'platform',
      organizations: 'platform',
      events: 'platform',
    };
    const resolvedAppKey =
      moduleAppKeyHintByKey[keyLower] || inferredAppKey;

    const candidates = modulesList.filter((m) => (m.key || '').toLowerCase().trim() === keyLower);
    const mod = resolvedAppKey
      ? (candidates.find((m) => String(m.appKey || '').toLowerCase().trim() === resolvedAppKey) || candidates[0])
      : candidates[0];
    if (mod) {
      if (!mod.quickCreate) mod.quickCreate = [];
      if (!mod.quickCreateLayout) mod.quickCreateLayout = { version: 1, rows: [] };
      mod.fields = normalizeModuleFieldsFromMetadata(mod.key, mod.fields || []);
      if ((mod.key || '').toLowerCase() === 'people' && Array.isArray(mod.fields)) {
        mod.fields = mergePeopleVirtualFieldDefinitions(mod.fields);
      }
      if ((mod.key || '').toLowerCase() === 'items') {
        const fieldKeys = new Set(
          (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
        );
        const resolveQc = (keys) => keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));
        let quickCreate = resolveQc(Array.isArray(mod.quickCreate) ? mod.quickCreate : []);
        if (!quickCreate.length) {
          quickCreate = resolveQc(getItemQuickCreateFields());
        }
        mod.quickCreate = quickCreate;
        mod.quickCreateLayout = { version: 1, rows: [] };
      }
      moduleOverrideFromSettings.value = mod;
    }
  } catch (e) {
    drawerWarn('[CreateRecordDrawer] Failed to fetch module for quick create:', e);
  } finally {
    moduleOverrideLoading.value = false;
  }
}

const formData = ref({ ...props.initialData });
const errors = ref({});
const saving = ref(false);
const moduleDefinition = ref(null);
/** True when the user has interacted with the form (backdrop/Escape blocked); not set by programmatic sync */
const userHasEdited = ref(false);
function markUserInteraction() {
  userHasEdited.value = true;
}
// Module definition fetched when drawer opens so Quick Create fields come from Settings
const moduleOverrideFromSettings = ref(null);
const moduleOverrideLoading = ref(false);

// For deals: stage options must come from the selected pipeline only (not default pipeline).
// Return a stable reference when pipeline and module are unchanged to avoid recursive updates
// (DynamicForm re-applies on override change -> ready -> initializeForm -> formData -> computed -> loop).
const dealOverrideCache = { mod: null, pipelineKey: undefined, quickMode: undefined, result: null };
const effectiveModuleOverrideForDrawer = computed(() => {
  const mod = moduleOverrideFromSettings.value;
  if (!mod) return mod;
  const moduleKeyLower = String(props.moduleKey || '').toLowerCase();

  // Cases quick create should follow only selected quick-create fields.
  // Clear advanced layout rows in quick mode to prevent non-selected fields from rendering.
  if (moduleKeyLower === 'cases') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    if (!quickMode) return mod;
    return {
      ...mod,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  // Items: layout rows with missing/stale keys render an empty drawer; use list-based quick create.
  if (moduleKeyLower === 'items') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    const fieldKeys = new Set(
      (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
    );
    const resolveQuickCreateKeys = (keys) =>
      keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));

    let quickCreate = Array.isArray(mod.quickCreate) ? [...mod.quickCreate] : [];
    quickCreate = resolveQuickCreateKeys(quickCreate);
    if (!quickCreate.length && quickMode) {
      quickCreate = resolveQuickCreateKeys(getItemQuickCreateFields());
    }
    if (!quickMode) {
      return { ...mod, quickCreate };
    }
    return {
      ...mod,
      quickCreate,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  if (moduleKeyLower === 'quotes') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    const fieldKeys = new Set(
      (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
    );
    const resolveQuickCreateKeys = (keys) =>
      keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));

    let quickCreate = Array.isArray(mod.quickCreate) ? [...mod.quickCreate] : [];
    quickCreate = resolveQuickCreateKeys(quickCreate);
    if (!quickMode) {
      return { ...mod, quickCreate };
    }
    return {
      ...mod,
      quickCreate,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  if (moduleKeyLower !== 'deals') return mod;
  const pipelineSettings = mod.pipelineSettings;
  const pipelineKey = formData.value?.pipeline;
  const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
  if (!Array.isArray(pipelineSettings) || pipelineSettings.length === 0) return mod;
  // Return cached override when module and pipeline key are unchanged
  if (
    dealOverrideCache.mod === mod &&
    dealOverrideCache.pipelineKey === pipelineKey &&
    dealOverrideCache.quickMode === quickMode &&
    dealOverrideCache.result
  )
    return dealOverrideCache.result;
  const pipeline = pipelineKey
    ? pipelineSettings.find((p) => String(p?.key ?? '').trim() === String(pipelineKey).trim())
    : null;
  const stages = pipeline?.stages ?? [];
  const stageOptions = stages.map((s) => {
    const name = (s?.name ?? '').trim();
    return name ? { value: name, label: name, color: (s.color && /^#[0-9A-Fa-f]{6}$/.test(String(s.color).trim())) ? String(s.color).trim() : null } : null;
  }).filter(Boolean);
  const fields = (mod.fields || []).map((f) => {
    if ((f?.key || '').toString().toLowerCase() !== 'stage') return f;
    return { ...f, options: stageOptions };
  });
  const result = { ...mod, fields };
  // Deal quick create should strictly follow the quickCreate list only.
  // If advanced layout rows are present, they can include non-quick-create fields.
  // Clear layout in quick mode so DynamicForm renders from quickCreate keys.
  if (quickMode) {
    result.quickCreateLayout = { version: 1, rows: [] };
  }
  dealOverrideCache.mod = mod;
  dealOverrideCache.pipelineKey = pipelineKey;
  dealOverrideCache.quickMode = quickMode;
  dealOverrideCache.result = result;
  return result;
});

// Deal relationship editor state (when moduleKey=deals)
const relationshipEditorRef = ref(null);
const dealRelationships = ref({ dealPeople: [], dealOrganizations: [] });
const dealPeopleList = ref([]);
const dealOrgList = ref([]);

const normalizeRelationshipId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.recordId || '');
  }
  return String(value);
};

const dedupeDealPeople = (rows = []) => {
  const merged = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const personId = normalizeRelationshipId(row?.personId);
    const role = String(row?.role || '').trim();
    if (!personId || !role) continue;
    const key = `${personId}|${role}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...row, personId });
      continue;
    }
    merged.set(key, {
      ...prev,
      ...row,
      personId,
      isActive: prev.isActive !== false || row.isActive !== false,
      isPrimary: !!prev.isPrimary || !!row.isPrimary,
      addedAt: prev.addedAt || row.addedAt,
      addedBy: prev.addedBy || row.addedBy || null
    });
  }
  return Array.from(merged.values());
};

const dedupeDealOrganizations = (rows = []) => {
  const merged = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const organizationId = normalizeRelationshipId(row?.organizationId);
    const role = String(row?.role || '').trim();
    if (!organizationId || !role) continue;
    const key = `${organizationId}|${role}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...row, organizationId });
      continue;
    }
    merged.set(key, {
      ...prev,
      ...row,
      organizationId,
      isActive: prev.isActive !== false || row.isActive !== false,
      isPrimary: !!prev.isPrimary || !!row.isPrimary,
      addedAt: prev.addedAt || row.addedAt,
      addedBy: prev.addedBy || row.addedBy || null
    });
  }
  return Array.from(merged.values());
};

const enforceSinglePrimaryContact = (rows = [], preferredPersonId = '') => {
  const next = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const preferred = normalizeRelationshipId(preferredPersonId);
  const candidateIndexes = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false) continue;
    if (String(row?.role || '') !== 'primary_contact') continue;
    if (!row?.isPrimary) continue;
    candidateIndexes.push(i);
  }
  if (candidateIndexes.length <= 1) return next;

  let keepIndex = candidateIndexes[0];
  if (preferred) {
    const preferredIndex = candidateIndexes.find((idx) => normalizeRelationshipId(next[idx]?.personId) === preferred);
    if (preferredIndex !== undefined) keepIndex = preferredIndex;
  }

  for (const idx of candidateIndexes) {
    next[idx].isPrimary = idx === keepIndex;
  }
  return next;
};

const enforceSinglePrimaryCustomer = (rows = [], preferredOrganizationId = '') => {
  const next = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const preferred = normalizeRelationshipId(preferredOrganizationId);
  const candidateIndexes = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false) continue;
    if (String(row?.role || '') !== 'customer') continue;
    if (!row?.isPrimary) continue;
    candidateIndexes.push(i);
  }
  if (candidateIndexes.length <= 1) return next;

  let keepIndex = candidateIndexes[0];
  if (preferred) {
    const preferredIndex = candidateIndexes.find((idx) => normalizeRelationshipId(next[idx]?.organizationId) === preferred);
    if (preferredIndex !== undefined) keepIndex = preferredIndex;
  }

  for (const idx of candidateIndexes) {
    next[idx].isPrimary = idx === keepIndex;
  }
  return next;
};

const normalizeDealRelationships = (value = {}, options = {}) => {
  const dealPeople = dedupeDealPeople(value?.dealPeople || []);
  const dealOrganizations = dedupeDealOrganizations(value?.dealOrganizations || []);
  return {
    dealPeople: enforceSinglePrimaryContact(dealPeople, options?.preferredPersonId),
    dealOrganizations: enforceSinglePrimaryCustomer(dealOrganizations, options?.preferredOrganizationId)
  };
};

function discardQuoteCreateDraft(draftId) {
  const id = String(draftId || quoteCreateDraftId.value || '').trim();
  if (!id || quoteCreateSaved.value) return;
  apiClient.delete(`/quotes/${id}`)
    .catch((error) => {
      drawerWarn('[CreateRecordDrawer] Failed to discard quote draft:', error);
    })
    .finally(() => {
      clearQuoteLinesSession(id);
    });
}

const closeDrawer = () => {
  if (!saving.value) {
    const draftIdToDiscard =
      isQuoteCreate.value && quoteCreateDraftId.value && !quoteCreateSaved.value
        ? quoteCreateDraftId.value
        : null;

    fullMode.value = false;
    quoteFormRecord.value = null;
    quoteFormLoading.value = false;
    quoteFormEnsurePromise.value = null;
    quoteCreateDraftId.value = null;
    quoteCreateSaved.value = false;
    emit('close');

    if (draftIdToDiscard) {
      discardQuoteCreateDraft(draftIdToDiscard);
    }
    // Reset form after closing
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
      userHasEdited.value = false;
      if (props.moduleKey === 'deals') {
        dealRelationships.value = { dealPeople: [], dealOrganizations: [] };
      }
    }, 300);
  }
};

async function loadQuoteFormRecord(quoteId) {
  const loaded = await apiClient.get(`/quotes/${quoteId}`);
  quoteFormRecord.value = loaded?.data || loaded;
}

async function ensureQuoteFormRecord() {
  if (!isQuoteForm.value) return;

  const editId = props.record?._id || props.record?.id;
  if (isQuoteEdit.value && editId) {
    if (String(quoteFormRecord.value?._id || '') === String(editId)) return;
    if (quoteFormEnsurePromise.value) {
      await quoteFormEnsurePromise.value;
      return;
    }

    quoteFormLoading.value = true;
    quoteFormEnsurePromise.value = (async () => {
      try {
        await loadQuoteFormRecord(editId);
      } catch (error) {
        drawerWarn('[CreateRecordDrawer] Failed to load quote for edit:', error);
      } finally {
        quoteFormEnsurePromise.value = null;
        quoteFormLoading.value = false;
      }
    })();
    await quoteFormEnsurePromise.value;
    return;
  }

  if (!isQuoteCreate.value || quoteFormRecord.value?._id) return;
  if (quoteFormEnsurePromise.value) {
    await quoteFormEnsurePromise.value;
    return;
  }

  quoteFormLoading.value = true;
  quoteFormEnsurePromise.value = (async () => {
    try {
      const createPayload = applyCreateOwnerDefaultsToPayload(
        { ...props.initialData },
        'quotes',
        resolveCurrentUserId(authStore.user)
      );
      const created = await createQuoteDraftWithRetry(createPayload);
      const createdRecord = created?.data || created;
      const quoteId = createdRecord?._id || createdRecord?.id;
      if (!quoteId) {
        throw new Error('Quote draft was not created');
      }
      quoteCreateDraftId.value = quoteId;
      quoteCreateSaved.value = false;
      await loadQuoteFormRecord(quoteId);
      if (moduleDefinition.value) {
        mergeQuoteFormRecordIntoFormData(quoteFormRecord.value);
      }
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to create quote draft:', error);
    } finally {
      quoteFormEnsurePromise.value = null;
      quoteFormLoading.value = false;
    }
  })();

  await quoteFormEnsurePromise.value;
}

function mergeQuoteFormRecordIntoFormData(record) {
  if (!record || !moduleDefinition.value?.fields) return;
  const next = { ...formData.value };
  for (const field of moduleDefinition.value.fields) {
    const key = field?.key;
    if (!key || !(key in record)) continue;
    let value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && value._id) {
      value = value._id;
    }
    if (value !== null && value !== undefined && value !== '') {
      next[key] = value;
    }
  }
  formData.value = next;
}

function handleQuoteLinesUpdated(payload) {
  const record = quoteFormRecord.value;
  if (!record) return;

  if (payload?.type === 'line-deleted') {
    applyQuoteLineDeleteToRecord(record, {
      deletedLine: payload.deletedLine,
      totals: payload.totals,
      sections: payload.sections,
    });
    return;
  }
  if (payload?.type === 'lines-added') {
    applyQuoteLinesAddToRecord(record, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections,
    });
    return;
  }
  if (payload?.type === 'line-updated') {
    applyQuoteLinesMutationToRecord(record, {
      line: payload.line,
      totals: payload.totals,
      sections: payload.sections,
    });
    return;
  }
  if (payload?.type === 'lines-recalculated') {
    applyQuoteLinesRecalculateToRecord(record, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections,
    });
  }
}

// Handle dialog close (escape/backdrop/portal interactions).
// If the user already interacted with the drawer content, treat close as accidental.
const handleDialogClose = () => {
  if (userHasEdited.value) return;
  closeDrawer();
};

const updateFormData = (data) => {
  formData.value = { ...data };
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
      'input, textarea, select, button,[tabindex]:not([tabindex="-1"])'
    );
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
};

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[\s_-]/g, '');
const normalizeEventTypeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeEventTypeForSubmission = (rawEventType) => {
  if (!rawEventType) return '';
  const candidate = String(rawEventType).trim();
  if (!candidate) return '';

  const byKey = getEventTypeByKey(candidate);
  if (byKey?.key) return byKey.key;

  const byLabel = getEventTypeByLabel(candidate);
  if (byLabel?.key) return byLabel.key;

  const normalizedCandidate = normalizeEventTypeToken(candidate);
  const fallbackMatch = EVENT_TYPE_DEFINITIONS.find((definition) => {
    return (
      normalizeEventTypeToken(definition.key) === normalizedCandidate ||
      normalizeEventTypeToken(definition.label) === normalizedCandidate
    );
  });

  return fallbackMatch?.key || candidate;
};

const getPreferredPrefillField = (module) => {
  const fields = Array.isArray(module?.fields) ? module.fields : [];
  if (!fields.length) return null;

  const preferred = normalizeKey(props.prefillFieldKey);
  if (preferred) {
    const match = fields.find((f) => normalizeKey(f?.key) === preferred);
    if (match) return match;
  }

  const quickCreateKeys =
    strictQuickCreateForForm.value && Array.isArray(module?.quickCreate)
      ? new Set(module.quickCreate.map((k) => normalizeKey(k)).filter(Boolean))
      : null;

  const candidates = fields.filter((f) => {
    if (!f?.key) return false;
    const dataType = String(f.dataType || '').trim();
    if (!['Text', 'Text-Area', 'Email', 'Phone', 'URL'].includes(dataType)) return false;
    if (quickCreateKeys && !quickCreateKeys.has(normalizeKey(f.key))) return false;
    return true;
  });

  if (!candidates.length) return null;
  return candidates[0];
};

const applySearchPrefill = (module) => {
  const seed = String(props.prefillText || '').trim();
  if (!seed || isEditing.value) return;
  const targetField = getPreferredPrefillField(module);
  if (!targetField?.key) return;
  const currentValue = formData.value?.[targetField.key];
  if (currentValue !== null && currentValue !== undefined && String(currentValue).trim() !== '') return;
  formData.value = { ...formData.value, [targetField.key]: seed };
};

function normalizedTaskRelatedTo(val) {
  if (!val || typeof val !== 'object') return { type: 'none', id: null };
  const id = val.id != null && typeof val.id === 'object' && val.id._id != null ? val.id._id : (val.id ?? null);
  return { type: val.type || 'none', id };
}

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
    const recordData =
      props.moduleKey === 'cases'
        ? stripCaseRecordForEditForm(props.record)
        : props.moduleKey === 'organizations'
          ? stripOrganizationRecordForEditForm(props.record)
          : { ...props.record };
    
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
  if (props.moduleKey === 'people') {
    const fd = { ...formData.value };
    syncPeopleVirtualFieldKeys(fd);
    for (const field of fields) {
      if (field.isVirtual && field.defaultValue !== null && field.defaultValue !== undefined && field.defaultValue !== '') {
        applyVirtualFieldDefault(fd, field, field.defaultValue, { moduleKey: props.moduleKey });
      }
    }
    formData.value = fd;
  }
  if (props.moduleKey === 'tasks') {
    formData.value.relatedTo = normalizedTaskRelatedTo(formData.value?.relatedTo);
    if (!Array.isArray(formData.value.subtasks)) {
      formData.value.subtasks = [];
    }
  }

  if (!props.record) {
    formData.value = applyCreateOwnerDefaultsToForm(
      formData.value,
      props.moduleKey,
      resolveCurrentUserId(authStore.user)
    );
  }
};

const onFormReady = (module) => {
  if (!module) return;
  // Only initialize form on first load (when we don't have a module yet). For deals, the override
  // is updated when pipeline changes (to show the right stage options); re-initializing would reset
  // the user's pipeline selection.
  const isFirstLoad = !moduleDefinition.value;
  moduleDefinition.value = module;
  if (isFirstLoad || isEditing.value) {
    initializeForm(module);
    if (!isEditing.value) applySearchPrefill(module);
    if (isQuoteCreate.value && quoteFormRecord.value) {
      mergeQuoteFormRecordIntoFormData(quoteFormRecord.value);
    }
  }
};

watch(moduleOverrideFromSettings, (mod) => {
  if (mod && props.isOpen && isEditing.value) {
    initializeForm(mod);
  }
});

// Watch for record changes to re-initialize form when editing
watch(() => props.record, () => {
  if (moduleDefinition.value && props.record) {
    initializeForm(moduleDefinition.value);
  }
  if (props.moduleKey === 'deals' && props.record) {
    const r = props.record;
    dealRelationships.value = normalizeDealRelationships({
      dealPeople: Array.isArray(r.dealPeople) ? r.dealPeople.map((p) => ({ ...p })) : [],
      dealOrganizations: Array.isArray(r.dealOrganizations) ? r.dealOrganizations.map((o) => ({ ...o })) : []
    }, {
      preferredPersonId: normalizeRelationshipId(r.contactId),
      preferredOrganizationId: normalizeRelationshipId(r.accountId)
    });
  }
}, { deep: true });

// When drawer opens: fetch module so Quick Create fields come from Settings
watch(() => [props.isOpen, props.moduleKey], ([open, key]) => {
  if (open && key) {
    fetchModuleForDrawer();
    if (String(key).toLowerCase() === 'quotes') {
      ensureQuoteFormRecord();
    }
  } else {
    moduleOverrideFromSettings.value = null;
    quoteFormRecord.value = null;
    quoteFormLoading.value = false;
    quoteFormEnsurePromise.value = null;
    dealOverrideCache.mod = null;
    dealOverrideCache.pipelineKey = undefined;
    dealOverrideCache.quickMode = undefined;
    dealOverrideCache.result = null;
  }
}, { immediate: true });

// Fetch people and organizations when opening deal form
watch(() => [props.isOpen, props.moduleKey], async ([open, key]) => {
  if (!open || key !== 'deals') return;
  dealRelationships.value = { dealPeople: [], dealOrganizations: [] };
  if (props.record) {
    const r = props.record;
    dealRelationships.value = normalizeDealRelationships({
      dealPeople: Array.isArray(r.dealPeople) ? r.dealPeople.map((p) => ({ ...p })) : [],
      dealOrganizations: Array.isArray(r.dealOrganizations) ? r.dealOrganizations.map((o) => ({ ...o })) : []
    }, {
      preferredPersonId: normalizeRelationshipId(r.contactId),
      preferredOrganizationId: normalizeRelationshipId(r.accountId)
    });
  }
  try {
    const [peopleRes, orgRes] = await Promise.all([
      fetchPeopleListCached(DEAL_RELATIONSHIP_PEOPLE_PARAMS),
      fetchOrganizationsListCached(DEAL_RELATIONSHIP_ORG_PARAMS),
    ]);
    const normalizeList = (response) => {
      if (Array.isArray(response)) return response;
      const candidates = [
        response?.data,
        response?.data?.data,
        response?.data?.items,
        response?.data?.rows
      ];
      for (const c of candidates) {
        if (Array.isArray(c)) return c;
      }
      return [];
    };
    dealPeopleList.value = normalizeList(peopleRes);
    dealOrgList.value = normalizeList(orgRes);
  } catch (e) {
    drawerWarn('[CreateRecordDrawer] Failed to fetch people/organizations for deal relationships:', e);
    dealPeopleList.value = [];
    dealOrgList.value = [];
  }
}, { immediate: true });

// Deals: when a pipeline is selected, auto-select the first stage in that pipeline
watch(() => formData.value?.pipeline, (newPipelineKey) => {
  if (props.moduleKey?.toLowerCase() !== 'deals' || !newPipelineKey) return;
  const mod = moduleOverrideFromSettings.value;
  if (!mod?.pipelineSettings?.length) return;
  const pipeline = mod.pipelineSettings.find(
    (p) => String(p?.key ?? '').trim() === String(newPipelineKey).trim()
  );
  if (!pipeline?.stages?.length) return;
  const first = pipeline.stages[0];
  const firstStageName = (first?.name ?? '').trim() || 'New';
  const prob = first?.probability ?? 0;
  if (formData.value?.stage !== firstStageName || formData.value?.probability !== prob) {
    formData.value = { ...formData.value, stage: firstStageName, probability: prob };
  }
});

// Deals: when the stage is selected, set probability from the pipeline's stage config
watch(() => formData.value?.stage, (newStage) => {
  if (props.moduleKey?.toLowerCase() !== 'deals' || !newStage || !formData.value?.pipeline) return;
  const mod = moduleOverrideFromSettings.value;
  if (!mod?.pipelineSettings?.length) return;
  const pipeline = mod.pipelineSettings.find(
    (p) => String(p?.key ?? '').trim() === String(formData.value.pipeline).trim()
  );
  if (!pipeline?.stages?.length) return;
  const stageName = String(newStage).trim();
  const stageConfig = pipeline.stages.find((s) => (s?.name ?? '').trim() === stageName);
  if (stageConfig == null) return;
  const prob = typeof stageConfig.probability === 'number' ? stageConfig.probability : (stageConfig.probability ?? 0);
  if (formData.value?.probability !== prob) {
    formData.value = { ...formData.value, probability: prob };
  }
});

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
  drawerDbg('[CreateRecordDrawer] 🚀 handleSubmit called', {
    moduleKey: props.moduleKey,
    isEditing: isEditing.value,
    formDataKeys: Object.keys(formData.value)
  });
  
  errors.value = {};
  if (isQuoteCreate.value && !quoteFormRecord.value?._id) {
    errors.value._general = t('records.quoteCreateDraftFailed');
    return;
  }
  saving.value = true;

  try {
    // Client-side validation (like ContactFormModal)
    if (moduleDefinition.value?.fields) {
      // System fields that are auto-set by backend (status only for Events; Tasks status can be required)
      // RULE: Global system fields (trash: deletedAt, deletedBy, deletionReason) never show in create/edit
      const systemFieldKeys = [
        'organizationid',
        'createdby',
        'createdat',
        'updatedat',
        '_id',
        '__v',
        'activitylogs',
        ...getGlobalSystemFieldKeys(),
        ...(props.moduleKey === 'events' ? ['status'] : [])
      ];
      // Helpdesk Case: module schema may mark server-managed keys as required; never validate on create.
      if (props.moduleKey === 'cases' && !isEditing.value) {
        for (const k of getCaseSystemFields()) {
          const n = normalizeFieldKeyForSystemMatch(k);
          if (n && !systemFieldKeys.includes(n)) systemFieldKeys.push(n);
        }
        const caseIdNorm = normalizeFieldKeyForSystemMatch('caseId');
        if (!systemFieldKeys.includes(caseIdNorm)) systemFieldKeys.push(caseIdNorm);
      }

      const allFields = moduleDefinition.value.fields || [];

      // Get effective required fields (dependency-driven), excluding system fields
      const requiredFields = allFields.filter(f => {
        const keyNorm = normalizeFieldKeyForSystemMatch(f.key);
        if (!f.key || systemFieldKeys.includes(keyNorm)) return false;
        const depState = getFieldDependencyState(f, formData.value, allFields, {
          moduleKey: props.moduleKey,
        });
        // Only validate when visible and required
        return depState.required === true && depState.visible !== false;
      });
      
      // Validate each required field
      for (const field of requiredFields) {
        const value =
          props.moduleKey === 'people'
            ? getFormFieldValue(formData.value, field.key, field, { moduleKey: props.moduleKey })
            : formData.value[field.key];
        const isEmpty = value === null || 
                       value === undefined || 
                       value === '' || 
                       (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          errors.value[field.key] = `${getFieldDisplayLabel(field) || field.key} is required`;
        }
      }
      
      // If validation fails, stop here
      if (Object.keys(errors.value).length > 0) {
        drawerDbg('[CreateRecordDrawer] ❌ Validation failed:', errors.value);
        scrollToFirstErrorField();
        saving.value = false;
        return;
      }
    }

    // Deal relationship validation (one primary contact, one active customer org)
    if (props.moduleKey === 'deals' && props.useDealRelationshipEditor && relationshipEditorRef.value) {
      const relValid = relationshipEditorRef.value.validate();
      if (!relValid) {
        saving.value = false;
        return;
      }
    }
    
    drawerDbg('[CreateRecordDrawer] ✅ Validation passed, proceeding with submission...');
    
    // ARCHITECTURE NOTE: In Quick Create mode, only send fields that are in quickCreate configuration
    let submitData = { ...formData.value };
    
    const qcList = moduleDefinition.value?.quickCreate;
    if (shouldFilterPayloadByQuickCreate(effectiveQuickCreateMode.value, fullMode.value, qcList)) {
      const allowedFieldKeys = getQuickCreateAllowedFieldKeys(
        qcList,
        moduleDefinition.value?.fields
      );

      // Fields that are always required by the API (even if not in quickCreate)
      // These are API-level requirements, not user-facing fields
      const apiRequiredFields = new Set([
        'type',           // Required by Scheduling API (task/event)
        'entitytype',     // Required by Scheduling API
        'entityid',       // Required by Scheduling API
        'ownerpersonid',  // May be set from assignedTo mapping
        'assignedto'      // Required by Task API - auto-assigned to current user
      ]);

      // Filter submitData to quickCreate + module-required + API-required fields
      const filteredData = {};
      for (const [key, value] of Object.entries(submitData)) {
        const keyLower = key.toLowerCase();
        if (allowedFieldKeys.has(keyLower) || apiRequiredFields.has(keyLower)) {
          filteredData[key] = value;
        }
      }

      drawerDbg('[CreateRecordDrawer] 🔍 Quick Create mode - filtering fields:', {
        before: Object.keys(submitData),
        after: Object.keys(filteredData),
        allowedFieldKeys: Array.from(allowedFieldKeys),
        apiRequiredFields: Array.from(apiRequiredFields),
        filteredOut: Object.keys(submitData).filter(k => {
          const keyLower = k.toLowerCase();
          return !allowedFieldKeys.has(keyLower) && !apiRequiredFields.has(keyLower);
        })
      });
      
      submitData = filteredData;
    }
    
    // Debug: Log formData for events before cleaning
    if (props.moduleKey === 'events') {
      drawerDbg('[CreateRecordDrawer] formData.value before cleaning:', {
        linkedFormId: formData.value.linkedFormId,
        relatedToId: formData.value.relatedToId,
        eventType: formData.value.eventType,
        allKeys: Object.keys(formData.value)
      });
    }
    
    // Convert kebab-case field keys to camelCase for events module
    // Backend expects camelCase (linkedFormId, relatedToId) but form might use kebab-case (linked-form-id, related-to-id)
    if (props.moduleKey === 'events') {
      // Map of kebab-case to camelCase for event fields
      const keyMappings = {
        'linked-form-id': 'linkedFormId',
        'related-to-id': 'relatedToId',
        'event-owner-id': 'eventOwnerId',
        'auditor-id': 'auditorId',
        'reviewer-id': 'reviewerId',
        'corrective-owner-id': 'correctiveOwnerId',
        'allow-self-review': 'allowSelfReview',
        'start-date-time': 'startDateTime',
        'end-date-time': 'endDateTime'
      };

      // Also normalize lowercased keys that can come from saved module definitions (defensive)
      const lowercaseMappings = {
        eventownerid: 'eventOwnerId',
        auditorid: 'auditorId',
        reviewerid: 'reviewerId',
        correctiveownerid: 'correctiveOwnerId',
        allowselfreview: 'allowSelfReview',
        linkedformid: 'linkedFormId',
        relatedtoid: 'relatedToId',
        startdatetime: 'startDateTime',
        enddatetime: 'endDateTime'
      };
      
      // Convert kebab-case keys to camelCase
      for (const [kebabKey, camelKey] of Object.entries(keyMappings)) {
        if (submitData[kebabKey] !== undefined) {
          // If camelCase version doesn't exist or is empty, use kebab-case value
          if (!submitData[camelKey] || submitData[camelKey] === '') {
            submitData[camelKey] = submitData[kebabKey];
          }
          // Remove kebab-case version
          delete submitData[kebabKey];
        }
      }

      // Convert lowercase keys to camelCase equivalents
      for (const [lowerKey, camelKey] of Object.entries(lowercaseMappings)) {
        if (submitData[lowerKey] !== undefined) {
          if (submitData[camelKey] === undefined || submitData[camelKey] === '') {
            submitData[camelKey] = submitData[lowerKey];
          }
          delete submitData[lowerKey];
        }
      }
      
      // Normalize eventType to canonical key (e.g., "Meeting" -> "MEETING")
      const normalizedEventType = normalizeEventTypeForSubmission(
        submitData.eventType ?? formData.value?.eventType
      );
      if (normalizedEventType) {
        submitData.eventType = normalizedEventType;
      }

    }
    
    // Strip system-controlled fields
    delete submitData.createdBy;
    delete submitData.organizationId;
    delete submitData.organizationid;
    delete submitData.createdAt;
    delete submitData.updatedAt;
    delete submitData._id;
    delete submitData.__v;
    
    // Strip status field for events (system-controlled)
    if (props.moduleKey === 'events') {
      if (submitData.status !== undefined) {
        drawerDbg('[CreateRecordDrawer] ⚠️ Stripping status field from event payload:', submitData.status);
        delete submitData.status;
      }
    }

    // Helpdesk cases: status transitions must use PATCH /:id/status, not PUT
    let caseEditNextStatus = undefined;
    if (props.moduleKey === 'cases' && isEditing.value) {
      if (Object.prototype.hasOwnProperty.call(submitData, 'status')) {
        caseEditNextStatus = submitData.status;
        delete submitData.status;
      }
    }

    // Helpdesk cases: the form is seeded with the full record; updateCase() only accepts
    // mutable fields + ad-hoc custom keys. Read-only schema keys (caseId, activities, …)
    // in the body cause 400 "Unsupported or system-managed fields" and block every save.
    if (props.moduleKey === 'cases') {
      const caseReadOnlyTopLevel = new Set([
        'caseId',
        'currentSlaCycle',
        'slaCycles',
        'activities',
        'assignmentControl',
        'source',
        'customFields',
        'createdBy',
        'updatedBy',
        'organizationId',
        'deletedAt',
        'deletedBy',
        'deletionReason',
        '_id',
        '__v'
      ]);
      if (isEditing.value) {
        caseReadOnlyTopLevel.add('status');
      }
      // Flattened nested paths (e.g. from record seeding) must not be sent — server rejects them.
      const caseDottedReadOnlyPrefixes = [
        'assignmentControl.',
        'currentSlaCycle.',
        'slaCycles.',
        'activities.'
      ];
      const pruned = {};
      for (const [key, value] of Object.entries(submitData)) {
        if (caseReadOnlyTopLevel.has(key)) continue;
        if (caseDottedReadOnlyPrefixes.some((p) => key.startsWith(p))) continue;
        pruned[key] = value;
      }
      submitData = pruned;
      if (isEditing.value) {
        submitData = buildCaseEditSubmitPayload(formData.value, props.record);
      }
    }
    
    // Handle nested object conflicts (e.g., 'settings' and 'settings.primaryColor')
    // Remove parent keys if nested dot-notation keys exist to avoid Mongoose conflicts
    const keysToRemove = [];
    const nestedKeys = Object.keys(submitData).filter(key => key.includes('.'));
    
    // For each nested key (e.g., 'settings.primaryColor'), check if parent exists
    for (const nestedKey of nestedKeys) {
      const parentKey = nestedKey.split('.')[0];
      if (submitData[parentKey] && typeof submitData[parentKey] === 'object') {
        // Parent object exists and we have nested keys - remove parent to avoid conflict
        if (!keysToRemove.includes(parentKey)) {
          keysToRemove.push(parentKey);
        }
      }
    }
    
    // Remove conflicting parent keys
    for (const key of keysToRemove) {
      delete submitData[key];
    }
    
    // Handle organization field - ensure it's an ObjectId string, not an object
    if (submitData.organization && typeof submitData.organization === 'object') {
      submitData.organization = submitData.organization._id || submitData.organization;
    }
    
    // Convert empty strings to null for optional fields
    // Preserve organization, linkedFormId, and relatedToId if they're explicitly set (even if empty string)
    // These fields should be sent as null rather than being deleted
    const preservedFields = ['organization', 'linkedFormId', 'relatedToId'];
    for (const key in submitData) {
      if (submitData[key] === '' && !preservedFields.includes(key)) {
        submitData[key] = null;
      }
    }
    
    // For preserved fields, convert empty strings to null but keep them in the payload
    for (const field of preservedFields) {
      if (submitData[field] === '') {
        submitData[field] = null;
      }
    }
    
    // Log the submit data for events to debug linkedFormId/relatedToId
    if (props.moduleKey === 'events') {
      drawerDbg('[CreateRecordDrawer] Submitting event data:', {
        linkedFormId: submitData.linkedFormId,
        relatedToId: submitData.relatedToId,
        eventType: submitData.eventType,
        allKeys: Object.keys(submitData)
      });
    }
    
    // CRM organizations: strip tenant/system fields and normalize lookup refs
    if (props.moduleKey === 'organizations') {
      submitData = normalizeOrganizationEditSubmitPayload(
        submitData,
        moduleDefinition.value?.fields
      );
    }

    // Deal role-based relationships: use dealPeople/dealOrganizations, remove legacy contactId/accountId
    if (props.moduleKey === 'deals' && props.useDealRelationshipEditor) {
      delete submitData.contactId;
      delete submitData.accountId;
      const norm = (id) => (id && typeof id === 'object' && id._id) ? id._id : id;
      const normalizedRelationships = normalizeDealRelationships(dealRelationships.value || {}, {
        preferredPersonId: normalizeRelationshipId(formData.value?.contactId || props.record?.contactId),
        preferredOrganizationId: normalizeRelationshipId(formData.value?.accountId || props.record?.accountId)
      });
      const people = (normalizedRelationships.dealPeople || [])
        .filter((p) => p.isActive !== false)
        .map((p) => ({
        personId: norm(p.personId),
        role: p.role,
        isPrimary: !!p.isPrimary,
        isActive: true,
        addedAt: p.addedAt || new Date(),
        addedBy: p.addedBy || null
      }));
      const orgs = (normalizedRelationships.dealOrganizations || [])
        .filter((o) => o.isActive !== false)
        .map((o) => ({
        organizationId: norm(o.organizationId),
        role: o.role,
        isPrimary: !!o.isPrimary,
        isActive: true,
        addedAt: o.addedAt || new Date(),
        addedBy: o.addedBy || null
      }));
      submitData.dealPeople = people;
      submitData.dealOrganizations = orgs;
    }

    // People create: Global = identity only (no type), Sales = create→attach (Lead)
    if (props.moduleKey === 'people' && !isEditing.value) {
      // Strip type and all participation fields - never send to identity-only endpoint
      const participationFields = getParticipationFields('SALES');
      const toStrip = new Set(['type', ...participationFields].map((k) => k.toLowerCase()));
      Object.keys(submitData).forEach((key) => {
        if (toStrip.has(key.toLowerCase())) delete submitData[key];
      });
      // Restrict to core fields only (align with PeopleQuickCreateDrawer)
      const coreFieldSet = new Set((getCoreIdentityFields() || []).map((k) => k.toLowerCase()));
        const quickCreateKeys = (moduleDefinition.value?.quickCreate || []).map((f) =>
          (typeof f === 'string' ? f : (f?.key ?? f) || '').toLowerCase()
        ).filter(Boolean);
      const allowedKeys = new Set([...coreFieldSet, ...quickCreateKeys]);
      if (allowedKeys.size > 0) {
        Object.keys(submitData).forEach((key) => {
          if (!allowedKeys.has(key.toLowerCase())) delete submitData[key];
        });
      }
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
      'cases': '/helpdesk/cases',
      'users': '/users'
    };
    
    endpoint = moduleEndpointMap[props.moduleKey] || `/${props.moduleKey}`;
    let createEndpoint = endpoint;
    
    // Remove legacyOrganizationId if it's null to avoid unique index conflicts
    if (props.moduleKey === 'organizations' && (submitData.legacyOrganizationId === null || submitData.legacyOrganizationId === undefined)) {
      delete submitData.legacyOrganizationId;
    }
    
    // For tasks, ensure default status, normalized relatedTo, and strip system fields
    if (props.moduleKey === 'tasks') {
      const taskSystemKeys = new Set((getTaskSystemFields() || []).map((k) => String(k).toLowerCase()));
      Object.keys(submitData).forEach((key) => {
        if (taskSystemKeys.has(key.toLowerCase())) delete submitData[key];
      });
      if (!submitData.status) submitData.status = 'todo';
      const rt = normalizedTaskRelatedTo(formData.value?.relatedTo);
      submitData.relatedTo = rt.type === 'none' ? { type: 'none', id: null } : { type: rt.type, id: rt.id || null };
      delete submitData.relatedToType;
      delete submitData.relatedToId;
    }

    // For event creation, route audit types through audit-scoped endpoint.
    // Sales endpoint (/events) enforces appKey=SALES and rejects appKey=AUDIT.
    if (props.moduleKey === 'events' && !isEditing.value) {
      const normalizedAppContext =
        typeof submitData.appContext === 'string' ? submitData.appContext.trim().toUpperCase() : '';
      const eventTypeForContext = submitData.eventType || formData.value?.eventType;
      const inferredAppContext = normalizedAppContext || (isAuditEventType(eventTypeForContext) ? 'AUDIT' : '');

      if (inferredAppContext === 'AUDIT') {
        submitData.appContext = inferredAppContext;
        createEndpoint = '/audit/events';
      } else if (inferredAppContext) {
        submitData.appContext = inferredAppContext;
        createEndpoint = `${endpoint}?appKey=${encodeURIComponent(inferredAppContext)}`;
      }
    }
    
    // For events using Scheduling API, inject required fields
    if (props.moduleKey === 'events' && endpoint === '/scheduling') {
      submitData.type = 'event';
      
      // For standalone events (no entityType/entityId provided), use Organization as default entity
      if (!submitData.entityType || !submitData.entityId) {
        const organizationId = authStore.user?.organizationId;
        if (organizationId) {
          submitData.entityType = 'Organization';
          submitData.entityId = organizationId;
        }
      }
      
      // Map startDateTime to startDate (Scheduling uses startDate for events)
      if (submitData.startDateTime && !submitData.startDate) {
        submitData.startDate = submitData.startDateTime;
        delete submitData.startDateTime;
      }
      
      // Map endDateTime to dueDate (Scheduling uses dueDate as end date for events)
      if (submitData.endDateTime && !submitData.dueDate) {
        submitData.dueDate = submitData.endDateTime;
        delete submitData.endDateTime;
      }
      
      // Map assignedTo to ownerPersonId if needed
      if (submitData.assignedTo && !submitData.ownerPersonId) {
        submitData.ownerPersonId = submitData.assignedTo;
      }
      // Remove assignedTo as Scheduling API doesn't use it
      delete submitData.assignedTo;
    }

    if (!isEditing.value) {
      submitData = applyCreateOwnerDefaultsToPayload(
        submitData,
        props.moduleKey,
        resolveCurrentUserId(authStore.user)
      );
    }
    
    // People create in Sales context: use create→attach flow (existing endpoint)
    const usePeopleCreateFlow = props.moduleKey === 'people' && !isEditing.value && isSalesContext.value;

    drawerDbg('[CreateRecordDrawer] 📤 Making API call:', {
      method: isEditing.value ? 'PUT' : 'POST',
      endpoint: usePeopleCreateFlow ? '/people/create' : (isEditing.value ? `${endpoint}/${props.record._id}` : createEndpoint),
      payloadKeys: Object.keys(submitData)
    });

    let response;
    if (isEditing.value && props.record?._id) {
      if (props.moduleKey === 'cases') {
        const id = props.record._id;
        const prevStatus = props.record?.status;
        const statusChanged =
          caseEditNextStatus != null && String(caseEditNextStatus) !== String(prevStatus ?? '');

        let putResult = null;
        if (Object.keys(submitData).length > 0) {
          putResult = await apiClient.put(`${endpoint}/${id}`, submitData);
        } else if (!statusChanged) {
          errors.value._general = 'No changes to save.';
          saving.value = false;
          return;
        }

        let patchResult = null;
        if (statusChanged) {
          const patchBody = { status: caseEditNextStatus };
          const rs = String(
            (formData.value?.resolutionSummary ??
              putResult?.data?.resolutionSummary ??
              props.record?.resolutionSummary) ||
              ''
          ).trim();
          if (
            (caseEditNextStatus === 'Resolved' || caseEditNextStatus === 'Closed') &&
            rs
          ) {
            patchBody.resolutionSummary = rs;
          }
          patchResult = await apiClient.patch(`${endpoint}/${id}/status`, patchBody);
        }

        const merged = patchResult?.data ?? putResult?.data;
        response = { success: true, data: merged };
      } else {
        response = await apiClient.put(`${endpoint}/${props.record._id}`, submitData);
      }
    } else if (usePeopleCreateFlow) {
      // People create in Sales context: create→attach as Lead (standardized: appKey + role)
      response = await apiClient.post('/people/create', {
        appKey: 'SALES',
        role: 'Lead',
        formData: submitData
      });
    } else if (isQuoteCreate.value && quoteFormRecord.value?._id) {
      const quoteId = quoteFormRecord.value._id;
      response = await apiClient.put(`${endpoint}/${quoteId}`, submitData);
      const savedData = response?.data || response;
      if (savedData && quoteFormRecord.value) {
        response = {
          ...response,
          data: {
            ...savedData,
            lines: quoteFormRecord.value.lines,
            sections: quoteFormRecord.value.sections,
          },
        };
      }
    } else {
      // Create new record (including people in Global context)
      response = await apiClient.post(createEndpoint, submitData);
    }
    
    drawerDbg('[CreateRecordDrawer] 📥 API response:', {
      success: response.success,
      hasData: !!response.data,
      errors: response.errors,
      message: response.message
    });
    
    if (response.success || response.data) {
      drawerDbg('[CreateRecordDrawer] ✅ Success! Closing drawer...');
      saving.value = false; // Reset saving state before closing
      if (isQuoteCreate.value) {
        quoteCreateSaved.value = true;
      }

      const savedRecord = response.data || response;
      
      // Always open the saved record in a new tab
      if (savedRecord) {
        const recordId = savedRecord._id || savedRecord.id || savedRecord.eventId;
        
        if (recordId) {
          // Get record title/name based on module type
          let recordTitle = '';
          const moduleTitleMap = {
            'people': () => {
              const firstName = savedRecord.first_name || '';
              const lastName = savedRecord.last_name || '';
              return firstName || lastName ? `${firstName} ${lastName}`.trim() : savedRecord.email || 'Contact';
            },
            'organizations': () => savedRecord.name || 'Organization',
            'deals': () => savedRecord.name || 'Deal',
            'tasks': () => savedRecord.title || 'Task',
            'events': () => savedRecord.eventName || savedRecord.title || 'Event',
            'cases': () => savedRecord.caseId || savedRecord.title || 'Case',
            'quotes': () => savedRecord.quoteNumber || savedRecord.quoteTitle || 'Quote',
            'users': () => savedRecord.firstName && savedRecord.lastName 
              ? `${savedRecord.firstName} ${savedRecord.lastName}`.trim()
              : savedRecord.email || savedRecord.username || 'User'
          };
          
          const getTitle = moduleTitleMap[props.moduleKey];
          if (getTitle) {
            recordTitle = getTitle();
          } else {
            recordTitle = savedRecord.name || savedRecord.title || moduleNameMap[props.moduleKey] || 'Record';
          }
          
          // Get record path based on module
          const modulePathMap = {
            'people': `/people/${recordId}`,
            'organizations': `/organizations/${recordId}`,
            'deals': `/deals/${recordId}`,
            'tasks': `/tasks/${recordId}`,
            'events': `/events/${recordId}`,
            'cases': `/helpdesk/cases/${recordId}`,
            'quotes': `/quotes/${recordId}`,
            'users': `/users/${recordId}`
          };
          
          const recordPath = modulePathMap[props.moduleKey] || `/${props.moduleKey}/${recordId}`;
          
          // Get icon based on module
          const moduleIconMap = {
            'people': 'users',
            'organizations': 'building',
            'deals': 'briefcase',
            'tasks': 'check',
            'events': '📅',
            'cases': 'ticket',
            'quotes': 'document-text',
            'users': 'user'
          };
          
          const icon = moduleIconMap[props.moduleKey] || 'document';
          
          // Check if we're already viewing this record
          const currentPath = activeTab.value?.path || '';
          const isAlreadyViewing = currentPath === recordPath || currentPath.includes(`/${recordId}`);
          
          // Open tab with the saved record (always for new records, or if not already viewing for edits)
          if (!isEditing.value || !isAlreadyViewing) {
            openTab(recordPath, {
              title: recordTitle,
              icon: icon,
              insertAdjacent: true
            });
          }
        }
      }
      
      // Dispatch global event to refresh calendar/list views for events
      if (props.moduleKey === 'events' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:event-created', {
          detail: { event: savedRecord }
        }));
      }
      
      // Dispatch global event to refresh list views for all modules
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:record-created', {
          detail: { moduleKey: props.moduleKey, record: savedRecord }
        }));
      }
      
      emit('saved', savedRecord);
      closeDrawer();
    } else {
      drawerDbg('[CreateRecordDrawer] ❌ Failed:', response);
      errors.value = response.errors || { _general: response.message || `Failed to ${isEditing.value ? 'update' : 'create'} record` };
      scrollToFirstErrorField();
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
      // Check for error field first (it's usually more specific than generic message)
      // Some APIs use 'error' instead of 'message', and it often contains the actual error
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
      // Check for message in error data (if error field wasn't present)
      else if (errorData.message) {
        // Show the message, but prefer it over generic "Error creating record"
        // If it's "Validation failed. Please check the fields below." that's good
        if (errorData.message.includes('Validation failed') || errorData.message.includes('check the fields')) {
          errors.value._general = errorData.message;
        } else if (errorData.message !== 'Error creating record.' && errorData.message !== 'Error updating record.') {
          errors.value._general = errorData.message;
        } else {
          // If it's the generic message, show helpful message
          errors.value._general = 'Please fill in all required fields and try again.';
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
    scrollToFirstErrorField();
  } finally {
    saving.value = false;
  }
};

// Reset form when drawer opens/closes
watch(() => props.isOpen, (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    const draftId = quoteCreateDraftId.value;
    if (isQuoteCreate.value && draftId && !quoteCreateSaved.value) {
      discardQuoteCreateDraft(draftId);
    }
  }
  if (isOpen) {
    userHasEdited.value = false;
    quoteCreateDraftId.value = null;
    quoteCreateSaved.value = false;
    fullMode.value = isQuoteForm.value;
    errors.value = {};
    moduleDefinition.value = null;
    // Form seeds from record in onFormReady / moduleOverride watch after module loads
  } else {
    quoteFormRecord.value = null;
    quoteFormLoading.value = false;
    quoteFormEnsurePromise.value = null;
    quoteCreateDraftId.value = null;
    quoteCreateSaved.value = false;
    // Reset when closed so the next open re-seeds from record via onFormReady
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
      moduleDefinition.value = null;
    }, 300);
  }
});
</script>
