<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="close">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ isEditing ? 'Edit Event' : 'Create New Event' }}
            </h2>
            <button @click="close" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" @keydown.enter.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Basic Information -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('process.ruleFormBasicInfo') }}</h3>
            
            <!-- Event Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalEventName') }}<span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.eventName"
                type="text"
                required
                maxlength="255"
                :placeholder="t('events.eventFormModalEnterEventName')"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('forms.fieldNotes') }}</label>
              <textarea
                v-model="form.notes"
                rows="3"
                maxlength="5000"
                :placeholder="t('events.eventFormModalAddNotesOrDescription')"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              ></textarea>
            </div>

            <!-- Event Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.integrationsEventType') }}<span class="text-red-500">*</span>
                <span v-if="showTypeSelector && isPlatformOwned" class="text-gray-500 dark:text-gray-400 text-xs ml-2">(based on app configuration)</span>
              </label>
              <!-- Phase 2B: Show filtered options based on projection metadata -->
              <!-- ARCHITECTURE NOTE: Audit event types are filtered out from generic event creation.
                   Audit events require complex configuration (roles, forms, geo) and must be created
                   through Audit application flows, not generic event creation interfaces.
                   See: docs/architecture/event-settings.md Section 7 (Quick Create Rules) -->
              <select
                v-if="showTypeSelector && isPlatformOwned && !isEditing"
                v-model="form.eventType"
                @change="onEventTypeChange"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option v-for="type in filteredAllowedTypes" :key="type.projectionType" :value="type.modelValue">
                  {{ type.modelValue }}
                </option>
              </select>
              <!-- Fallback to non-audit options if no projection or editing -->
              <select
                v-else
                v-model="form.eventType"
                @change="onEventTypeChange"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option v-for="eventType in nonAuditEventTypes" :key="eventType" :value="eventType">
                  {{ eventType }}
                </option>
              </select>
              <!-- Phase 2B: Helper text when selector is hidden -->
              <p v-if="hideTypeSelector && isPlatformOwned && defaultType && !isEditing" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This app creates {{ defaultType.modelValue }}s by default
              </p>
              <!-- Helper text explaining audit event exclusion -->
              <p v-if="!isEditing" class="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{{ t('events.eventFormModalAuditEventsAreScheduledFromThe') }}</p>
            </div>

            <!-- Event Owner -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalEventOwner') }}<span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.eventOwnerId"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">{{ t('events.eventFormModalSelectUser') }}</option>
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.firstName }} {{ user.lastName }} {{ user._id === currentUser._id ? '(Me)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Date & Time -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Date & Time</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <!-- Start Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.startDateTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  @click="openDatePicker"
                />
              </div>

              <!-- End Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.endDateTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  @click="openDatePicker"
                />
              </div>
            </div>
          </div>

          <!-- Location -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('events.eventFormModalLocation') }}</h3>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalLocationAddressOrUrl') }}</label>
              <input
                v-model="form.location"
                type="text"
                maxlength="1024"
                :placeholder="t('events.eventFormModalPhysicalAddressOrMeetingUrl')"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Recurrence -->
          <div v-if="showRecurrence" class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('events.eventFormModalRecurrence') }}</h3>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalRecurrencePattern') }}</label>
              <select
                v-model="form.recurrence"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option :value="null">{{ t('settings.settingsBhNone') }}</option>
                <option value="Daily">{{ t('settings.assignRulesFreqDaily') }}</option>
                <option value="Weekly">{{ t('settings.assignRulesFreqWeekly') }}</option>
                <option value="Monthly">{{ t('events.eventFormModalMonthly') }}</option>
                <option value="Custom">{{ t('settings.modFieldsBadgeCustomField') }}</option>
              </select>
            </div>
          </div>

          <!-- Visibility -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('settings.modFieldsDepVisibility') }}</h3>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.modFieldsDepVisibility') }}</label>
              <select
                v-model="form.visibility"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Internal">{{ t('settings.inviteInternal') }}</option>
                <option value="Partner">{{ t('forms.visibilityPartner') }}</option>
                <option value="Public">{{ t('records.tagsPublic') }}</option>
              </select>
            </div>
          </div>

          <!-- Event Type Specific Fields -->
          <div v-if="showEventTypeFields" :key="`event-type-${form.eventType}`" class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('events.eventFormModalEventConfiguration') }}</h3>
            
            <!-- GEO Required Toggle -->
            <div v-if="showGeoToggle" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalGeoRequired2') }}</label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ geoRequiredDescription }}
                </p>
              </div>
              <HeadlessSwitch
                v-model="form.geoRequired"
                :disabled="!canToggleGeo"
                switch-class="w-11 h-6"
              />
            </div>
            
            <div v-else-if="geoRequiredForced" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p class="text-sm text-blue-800 dark:text-blue-300">
                <strong>{{ t('events.eventFormModalGeoRequired') }}</strong> Always enabled for {{ form.eventType }}
              </p>
          </div>
            
            <!-- Organization (for audit events) -->
            <div v-if="requiresLinkedOrg" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.profileMetaOrg') }}<span class="text-red-500">*</span>
                </label>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventFormModalTheOrganizationThisEventIsAssociated') }}</p>
                <select
                  v-model="form.relatedToId"
                  @change="fetchOrganizations"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">{{ t('events.eventFormModalSelectOrganization') }}</option>
                  <option v-for="org in organizations" :key="org._id" :value="org._id">
                    {{ org.name }}
                  </option>
                </select>
              </div>
              </div>

            <!-- Form Selection -->
            <div v-if="requiresAuditForm" :key="`audit-form-${form.eventType}-${auditForms.length}`" class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.modFieldsPbResourceForm') }}<span class="text-red-500">*</span>
                </label>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventFormModalTheFormThatWillBeExecuted') }}</p>
                <select
                  v-model="form.linkedFormId"
                  :required="linkedFormIdDependencyState.required"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">{{ t('events.eventFormModalSelectForm') }}</option>
                  <option v-if="auditForms.length === 0 && !loadingForms" value="" disabled>{{ t('events.eventFormModalNoFormsAvailableCreateAForm') }}</option>
                  <option v-for="formItem in auditForms" :key="formItem._id" :value="formItem._id">
                    {{ formItem.name }} {{ formItem.status === 'Ready' ? '(Ready - will activate)' : formItem.status === 'Active' ? '(Active)' : '' }}
                  </option>
                </select>
                <p v-if="requiresAuditForm && auditForms.length === 0 && !loadingForms" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventFormModalCreateAFormFirstInThe') }}</p>
              </div>
            </div>

            <!-- Controlled Self Review (audit events only; dependency-driven visibility) -->
            <div v-if="showAllowSelfReview" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div class="pr-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalAllowSelfReview') }}</label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('events.eventFormModalEnableOnlyIfTheAuditorIs') }}</p>
              </div>
              <HeadlessSwitch
                v-model="form.allowSelfReview"
                switch-class="w-11 h-6"
              />
            </div>

            <!-- Multi-Org Route (External Audit Beat, Field Sales Beat) -->
            <div v-if="isMultiOrgRoute" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalOrganizationList') }}<span class="text-red-500">*</span>
                </label>
                <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                  <div v-for="(org, index) in form.orgList" :key="index" class="flex items-center gap-2">
                    <input
                      type="number"
                      v-model.number="org.sequence"
                      min="1"
                      :placeholder="t('events.eventFormModalSequence')"
                      class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <select
                      v-model="org.organizationId"
                      class="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">{{ t('events.eventFormModalSelectOrg') }}</option>
                      <option v-for="orgOption in organizations" :key="orgOption._id" :value="orgOption._id">
                        {{ orgOption.name }}
                      </option>
                    </select>
                    <button
                      type="button"
                      @click="removeOrgFromList(index)"
                      class="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                <button
                  type="button"
                    @click="addOrgToList"
                    class="w-full px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700"
                >
                    + Add Organization
                </button>
                </div>
              </div>
              
              <!-- Background Tracking (External Audit Beat) -->
              <div v-if="form.eventType === 'External Audit Beat'" class="flex items-center gap-2">
                <HeadlessCheckbox
                  v-model="form.backgroundTracking"
                  checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalEnableBackgroundTracking') }}</label>
              </div>
            </div>
            
            <!-- Min Visit Duration -->
            <div v-if="showMinVisitDuration" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.eventFormModalMinimumVisitDurationMinutes') }}</label>
                <input
                  type="number"
                  v-model.number="form.minVisitDuration"
                  min="1"
                  :placeholder="t('events.eventFormModalEG30')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <!-- Field Sales Specific -->
            <div v-if="form.eventType === 'Field Sales Beat'" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('events.eventFormModalAllowedActions') }}</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-2">
                    <HeadlessCheckbox
                      v-model="form.allowedActions.orders"
                      checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalOrders') }}</span>
                  </label>
                  <label class="flex items-center gap-2">
                    <HeadlessCheckbox
                      v-model="form.allowedActions.payments"
                      checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalPayments') }}</span>
                  </label>
                  <label class="flex items-center gap-2">
                    <HeadlessCheckbox
                      v-model="form.allowedActions.feedback"
                      checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.typeFeedback') }}</span>
                  </label>
                </div>
              </div>
            </div>
            
            <!-- Partner Visibility (External Audit) -->
            <div v-if="form.eventType === 'External Audit — Single Org'" class="flex items-center gap-2">
              <HeadlessCheckbox
                v-model="form.partnerVisibility"
                checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventFormModalPartnerVisibilityForGuestAuditor') }}</label>
            </div>
          </div>


          <!-- Attachments -->
          <div v-if="showAttachments" class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ t('events.eventFormModalAttachments') }}</h3>
            <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventFormModalFileUploadFunctionalityToBeImplemented') }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="close"
              class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >{{ t('performance.cancelWizard') }}</button>
            <button
              type="button"
              @click="handleSubmit"
              @mousedown="() => console.log('[EventFormModal] Button clicked!')"
              :disabled="saving"
              class="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import dateUtils, { openDatePicker } from '@/utils/dateUtils';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { useProjectionCreate } from '@/composables/useProjectionCreate';
import { isAuditEventType, filterNonAuditEventTypes, NON_AUDIT_EVENT_TYPES } from '@/utils/eventUtils';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  event: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const { openTab, activeTab } = useTabs();
const currentUser = computed(() => authStore.user || {});

const saving = ref(false);
const users = ref([]);
const organizations = ref([]);
const auditForms = ref([]);
const loadingForms = ref(false);
const eventsModuleDefinition = ref(null);

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
} = useProjectionCreate('events');

// ARCHITECTURE NOTE: Filter out audit event types from generic event creation.
// Audit events require complex configuration and must be created through Audit flows.
// See: docs/architecture/event-settings.md Section 7 (Quick Create Rules)
const filteredAllowedTypes = computed(() => {
  if (!allowedTypes.value) return [];
  return allowedTypes.value.filter(type => !isAuditEventType(type.modelValue));
});

const nonAuditEventTypes = computed(() => {
  return NON_AUDIT_EVENT_TYPES;
});

const colorOptions = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316'  // Orange
];

const form = ref({
  eventName: '',
  notes: '',
  eventType: 'Meeting',
  // status is system-controlled, not user-editable
  eventOwnerId: '',
  auditorId: '',
  reviewerId: '',
  correctiveOwnerId: '',
  startDateTime: '',
  endDateTime: '',
  location: '',
  recurrence: null,
  relatedToId: '',
  linkedFormId: '',
  geoRequired: false,
  geoLocation: {
    latitude: null,
    longitude: null,
    radius: 100
  },
  orgList: [],
  minVisitDuration: null,
  backgroundTracking: false,
  minTimePerStop: null,
  partnerVisibility: false,
  // Controlled self-review support (audit events only; visibility is dependency-driven)
  allowSelfReview: false,
  allowedActions: {
    orders: true,
    payments: false,
    feedback: true
  },
  visibility: 'Internal',
  // Legacy: plural corrective owners removed (single-owner enforced via correctiveOwnerId)
});

const isEditing = computed(() => !!props.event?._id);
const isMeetingType = computed(() => ['Meeting', 'Meeting / Appointment'].includes(form.value.eventType));

// Computed properties for dynamic field visibility
const showEventTypeFields = computed(() => {
  // Show fields for all event types except basic Meeting/Appointment
  // This ensures audit form field appears for audit types
  return !isMeetingType.value;
});

const showGeoToggle = computed(() => {
  return isMeetingType.value || 
         form.value.eventType === 'External Audit — Single Org' || 
         form.value.eventType === 'Field Sales Beat';
});

const geoRequiredForced = computed(() => {
  return form.value.eventType === 'Internal Audit' || 
         form.value.eventType === 'External Audit Beat';
});

const canToggleGeo = computed(() => {
  // Admin permission check would go here
  // For now, allow toggling for applicable types
  return showGeoToggle.value;
});

const geoRequiredDescription = computed(() => {
  if (isMeetingType.value) {
    return 'Optional: Enable location tracking for this meeting';
  } else if (form.value.eventType === 'External Audit — Single Org') {
    return 'Default: ON. Admin can disable if needed';
  } else if (form.value.eventType === 'Field Sales Beat') {
    return 'Default: ON. Some companies allow non-geo orders';
  }
  return '';
});

const requiresLinkedOrg = computed(() => {
  return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(form.value.eventType);
});

// Get linkedFormId field definition from module
const linkedFormIdField = computed(() => {
  if (!eventsModuleDefinition.value?.fields) return null;
  return eventsModuleDefinition.value.fields.find(f => (f.key || '').toLowerCase() === 'linkedformid');
});

// Evaluate dependency state for linkedFormId field
const linkedFormIdDependencyState = computed(() => {
  const field = linkedFormIdField.value;
  if (!field) {
    // Fallback: if module definition not loaded, use hardcoded logic
    const eventType = form.value.eventType;
    const isAuditType = 
      eventType === 'Internal Audit' ||
      eventType === 'External Audit — Single Org' ||
      eventType === 'External Audit Beat';
    return { visible: isAuditType };
  }
  
  // Use dependency evaluation system
  return getFieldDependencyState(
    field,
    form.value,
    eventsModuleDefinition.value?.fields || [],
    { moduleKey: 'events' }
  );
});

// Computed property for visibility (using dependency system)
const requiresAuditForm = computed(() => {
  return linkedFormIdDependencyState.value.visible !== false;
});

// Legacy: plural corrective owners removed (single-owner enforced via correctiveOwnerId)

// Get allowSelfReview field definition from module (dependency-driven visibility)
const allowSelfReviewField = computed(() => {
  if (!eventsModuleDefinition.value?.fields) return null;
  return eventsModuleDefinition.value.fields.find(f => (f.key || '').toLowerCase() === 'allowselfreview');
});

// Evaluate dependency state for allowSelfReview field
const allowSelfReviewDependencyState = computed(() => {
  const field = allowSelfReviewField.value;
  if (!field) {
    // Safety-first fallback: if module definition isn't loaded, do NOT show this field.
    // (Prevents accidentally enabling self-review visibility outside audit configuration.)
    return { visible: false, required: false, readonly: false };
  }
  return getFieldDependencyState(
    field,
    form.value,
    eventsModuleDefinition.value?.fields || [],
    { moduleKey: 'events' }
  );
});

const showAllowSelfReview = computed(() => {
  return allowSelfReviewDependencyState.value.visible !== false;
});

const isMultiOrgRoute = computed(() => {
  return ['External Audit Beat', 'Field Sales Beat'].includes(form.value.eventType);
});

const showMinVisitDuration = computed(() => {
  return form.value.geoRequired && (
    form.value.eventType === 'Internal Audit' || 
    form.value.eventType === 'External Audit Beat'
  );
});

const showRecurrence = computed(() => {
  return true; // Universal field, always show
});

const showAttachments = computed(() => {
  return true; // Universal field, always show
});

// Watch eventType to fetch forms when it changes
watch(() => form.value.eventType, (newEventType, oldEventType) => {
  if (requiresAuditForm.value) {
    fetchForms();
  } else {
    // Clear linked form if event type no longer requires audit form
    if (oldEventType && !requiresAuditForm.value) {
      form.value.linkedFormId = '';
    }
  }
  
  // Clear allowSelfReview if event type no longer shows it (dependency-driven)
  if (oldEventType && !showAllowSelfReview.value) {
    form.value.allowSelfReview = false;
  }
}, { immediate: false });

// Fetch Events module definition to get field dependencies
const fetchEventsModuleDefinition = async () => {
  try {
    const response = await apiClient.get('/modules');
    if (response.success) {
      const eventsModule = response.data.find(m => m.key === 'events');
      if (eventsModule) {
        eventsModuleDefinition.value = eventsModule;
        console.log('✅ Events module definition loaded:', {
          fieldsCount: eventsModule.fields?.length || 0,
          linkedFormIdField: linkedFormIdField.value
        });
      }
    }
  } catch (error) {
    console.error('Error fetching Events module definition:', error);
  }
};

// Fetch users when component mounts
onMounted(async () => {
  fetchUsers();
  fetchOrganizations();
  fetchEventsModuleDefinition();
  // Forms will be fetched by the watch or when modal opens
  
  // Phase 2B: Load projection metadata
  if (!isEditing.value) {
    await loadProjection();
    // Apply projection defaults after loading
    if (defaultType.value && !form.value.eventType) {
      form.value.eventType = defaultType.value.modelValue;
    }
  }
});

// Methods for dynamic fields
const onEventTypeChange = () => {
  // Reset GEO based on event type rules
  if (form.value.eventType === 'Internal Audit' || form.value.eventType === 'External Audit Beat') {
    form.value.geoRequired = true; // Always ON
  } else if (form.value.eventType === 'External Audit — Single Org' || form.value.eventType === 'Field Sales Beat') {
    form.value.geoRequired = true; // Default ON
  } else if (isMeetingType.value) {
    form.value.geoRequired = false; // Default OFF
  }
  
  // Reset orgList for multi-org routes
  if (isMultiOrgRoute.value) {
    if (form.value.orgList.length === 0) {
      form.value.orgList = [{ sequence: 1, organizationId: '', status: 'PENDING' }];
    }
  } else {
    form.value.orgList = [];
  }
  
  // Fetch forms if needed
  if (requiresAuditForm.value) {
    fetchForms();
  }
  
  // Clear linked form if not needed
  if (!requiresAuditForm.value) {
    form.value.linkedFormId = '';
  }
};

const addOrgToList = () => {
  const nextSequence = form.value.orgList.length > 0 
    ? Math.max(...form.value.orgList.map(o => o.sequence || 0)) + 1
    : 1;
  form.value.orgList.push({
    sequence: nextSequence,
    organizationId: '',
    status: 'PENDING'
  });
};

const removeOrgFromList = (index) => {
  form.value.orgList.splice(index, 1);
  // Re-sequence remaining orgs
  form.value.orgList.forEach((org, idx) => {
    org.sequence = idx + 1;
  });
};

const fetchOrganizations = async () => {
  try {
    const response = await apiClient.get('/organization');
    if (response.success) {
      organizations.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
  }
};

const fetchForms = async () => {
  loadingForms.value = true;
  try {
    // Fetch both Ready and Active forms
    // When a Ready form is linked to an event, it automatically becomes Active
    const response = await apiClient.get('/forms', { params: { limit: 100 } });
    if (response.success) {
      const allForms = response.data || [];
      
      // Filter to show only Ready and Active forms
      const readyAndActiveForms = allForms.filter(form => 
        form.status === 'Ready' || form.status === 'Active'
      );
      
      // Further filter to show audit-related forms if formType exists
      auditForms.value = readyAndActiveForms.filter(form => {
        // If formType exists, prefer Audit types; otherwise include all Ready/Active forms
        return !form.formType || 
               form.formType === 'Audit' || 
               form.formType.toLowerCase().includes('audit');
      });
      
      // If no audit-type forms found, show all Ready/Active forms as fallback
      if (auditForms.value.length === 0 && readyAndActiveForms.length > 0) {
        auditForms.value = readyAndActiveForms;
      }
      
      // Sort: Active forms first, then Ready forms
      auditForms.value.sort((a, b) => {
        if (a.status === 'Active' && b.status === 'Ready') return -1;
        if (a.status === 'Ready' && b.status === 'Active') return 1;
        return 0;
      });
    }
  } catch (error) {
    console.error('Error fetching forms:', error);
    auditForms.value = [];
  } finally {
    loadingForms.value = false;
  }
};

// Watch for prop changes
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Ensure users are loaded
    if (users.value.length === 0) {
      fetchUsers();
    }
  }
  if (newVal && props.event?._id) {
    // Edit mode - populate form with event data
    form.value = {
      eventName: props.event.eventName || '',
      notes: props.event.notes || '',
      eventType: props.event.eventType || 'Meeting',
      // status is system-controlled, not user-editable
      eventOwnerId: props.event.eventOwnerId?._id || props.event.eventOwnerId || currentUser.value._id || '',
      auditorId: props.event.auditorId?._id || props.event.auditorId || '',
      reviewerId: props.event.reviewerId?._id || props.event.reviewerId || '',
      correctiveOwnerId: props.event.correctiveOwnerId?._id || props.event.correctiveOwnerId || '',
      startDateTime: formatDateForInput(props.event.startDateTime),
      endDateTime: formatDateForInput(props.event.endDateTime),
      location: props.event.location || '',
      recurrence: props.event.recurrence || null,
      relatedToId: props.event.relatedToId || '',
      linkedFormId: props.event.linkedFormId || '',
      geoRequired: props.event.geoRequired || false,
      geoLocation: props.event.geoLocation || { latitude: null, longitude: null, radius: 100 },
      orgList: props.event.orgList || [],
      minVisitDuration: props.event.minVisitDuration || null,
      backgroundTracking: props.event.backgroundTracking || false,
      minTimePerStop: props.event.minTimePerStop || null,
      partnerVisibility: props.event.partnerVisibility || false,
      allowSelfReview: props.event.allowSelfReview === true,
      allowedActions: props.event.allowedActions || { orders: true, payments: false, feedback: true },
      visibility: props.event.visibility || 'Internal',
      attachments: props.event.attachments || []
    };
    
    // Fetch organizations if needed
    if (requiresLinkedOrg.value || isMultiOrgRoute.value) {
      fetchOrganizations();
    }
    
    // Fetch forms if needed - use nextTick to ensure form is fully populated
    nextTick(() => {
      if (requiresAuditForm.value) {
        fetchForms();
      }
    });
  } else if (newVal) {
    // Create mode - reset form
    resetForm();
    // Phase 2B: Load projection metadata for create mode
    nextTick(async () => {
      await loadProjection();
      // Apply projection defaults after loading
      if (defaultType.value && !form.value.eventType) {
        form.value.eventType = defaultType.value.modelValue;
      }
    });
  }
});


const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const resetForm = () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  
  // Phase 2B: Apply projection defaults
  const baseForm = {
    eventName: '',
    notes: '',
    eventType: 'Meeting',
    // status is system-controlled, defaults to 'Planned' on creation
    eventOwnerId: currentUser.value._id || '',
    auditorId: '',
    reviewerId: '',
    correctiveOwnerId: '',
    startDateTime: formatDateForInput(now),
    endDateTime: formatDateForInput(oneHourLater),
    location: '',
    recurrence: null,
    relatedToId: '',
    linkedFormId: '',
    geoRequired: false,
    geoLocation: {
      latitude: null,
      longitude: null,
      radius: 100
    },
    orgList: [],
    minVisitDuration: null,
    backgroundTracking: false,
    minTimePerStop: null,
    partnerVisibility: false,
    allowSelfReview: false,
    allowedActions: {
      orders: true,
      payments: false,
      feedback: true
    },
    visibility: 'Internal',
    attachments: [],
  };
  
  // Phase 2B: Apply projection defaults
  form.value = resolveInitialCreatePayload(baseForm);
};


const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    if (response.success) {
      users.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};


const handleSubmit = async (e) => {
  console.log('[EventFormModal] 🚀 handleSubmit STARTED', {
    isEditing: isEditing.value,
    saving: saving.value,
    hasEvent: !!e,
    formKeys: Object.keys(form.value)
  });
  
  // Prevent default form submission
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Early return if already saving
  if (saving.value) {
    console.log('[EventFormModal] ⏸️ Already saving, ignoring submit');
    return;
  }
  
  console.log('[EventFormModal] ✅ Proceeding with validation...');
  
  // Phase 2B: Validate type against projection metadata
  if (!isEditing.value && isPlatformOwned.value && form.value.eventType) {
    if (!isTypeAllowed(form.value.eventType)) {
      alert(`Event type "${form.value.eventType}" is not allowed in this app`);
      saving.value = false;
      return;
    }
  }
  
  // Validate required fields
  if (!form.value.eventName || !form.value.eventName.trim()) {
    alert(t('events.eventFormModalToastEventNameIsRequired'));
    return;
  }
  
  if (!form.value.startDateTime) {
    alert(t('events.eventFormModalToastStartDateTimeIsRequired'));
    return;
  }
  
  if (!form.value.endDateTime) {
    alert(t('events.eventFormModalToastEndDateTimeIsRequired'));
    return;
  }
  
  if (!form.value.eventOwnerId && !currentUser.value._id) {
    alert(t('events.eventFormModalToastEventOwnerIsRequired'));
    return;
  }
  
  saving.value = true;
  
  try {
    // Validate and convert dates
    let startDate, endDate;
    try {
      startDate = new Date(form.value.startDateTime);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid start date/time');
      }
    } catch (error) {
      alert(t('events.eventFormModalToastInvalidStartDateTimePlease'));
      saving.value = false;
      return;
    }
    
    try {
      endDate = new Date(form.value.endDateTime);
      if (isNaN(endDate.getTime())) {
        throw new Error('Invalid end date/time');
      }
    } catch (error) {
      alert(t('events.eventFormModalToastInvalidEndDateTimePlease'));
      saving.value = false;
      return;
    }
    
    if (endDate <= startDate) {
      alert(t('events.eventFormModalToastEndDateTimeMustBe'));
      saving.value = false;
      return;
    }
    
    const payload = {
      eventName: form.value.eventName.trim(),
      notes: form.value.notes || '',
      eventType: form.value.eventType,
      // status is system-controlled - backend will set to 'Planned' on creation
      eventOwnerId: form.value.eventOwnerId || currentUser.value._id,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      location: form.value.location || '',
      recurrence: form.value.recurrence || null,
      visibility: form.value.visibility || 'Internal'
    };
    
    // Add linked organization if selected
    if (form.value.relatedToId) {
      payload.relatedToId = form.value.relatedToId;
    }
    
    // Add linked form if provided (convert empty string to null)
    if (form.value.linkedFormId && form.value.linkedFormId.trim() !== '') {
      payload.linkedFormId = form.value.linkedFormId;
    } else {
      // Explicitly set to null if empty to ensure it's cleared
      payload.linkedFormId = null;
    }
    
    console.log('[EventFormModal] Submitting event payload:', JSON.stringify(payload, null, 2));
    
    // Add GEO and event-type specific fields
    payload.geoRequired = form.value.geoRequired || false;
    if (form.value.geoLocation && form.value.geoLocation.latitude) {
      payload.geoLocation = form.value.geoLocation;
    }
    
    // Add multi-org fields
    if (isMultiOrgRoute.value && form.value.orgList.length > 0) {
      payload.orgList = form.value.orgList.map(org => ({
        organizationId: org.organizationId,
        sequence: org.sequence,
        status: 'PENDING'
      }));
      payload.isMultiOrg = true;
    }
    
    // Add audit-specific fields
    if (requiresAuditForm.value) {
      if (form.value.minVisitDuration) {
        payload.minVisitDuration = form.value.minVisitDuration;
      }
      if (form.value.eventType === 'External Audit Beat') {
        payload.backgroundTracking = form.value.backgroundTracking;
      }
      if (form.value.eventType === 'External Audit — Single Org') {
        payload.partnerVisibility = form.value.partnerVisibility;
      }
    }

    // Controlled self-review (dependency-driven visibility)
    payload.allowSelfReview = showAllowSelfReview.value ? (form.value.allowSelfReview === true) : false;
 
    // Legacy: plural corrective owners removed (single-owner enforced via correctiveOwnerId)
    // Ensure audit role fields are included when set
    if (form.value.auditorId) payload.auditorId = form.value.auditorId;
    if (form.value.reviewerId) payload.reviewerId = form.value.reviewerId;
    if (form.value.correctiveOwnerId) payload.correctiveOwnerId = form.value.correctiveOwnerId;
    
    // Add field sales specific fields
    if (form.value.eventType === 'Field Sales Beat') {
      payload.allowedActions = form.value.allowedActions;
      if (form.value.minTimePerStop) {
        payload.minTimePerStop = form.value.minTimePerStop;
      }
    }
    
    // Add visibility
    payload.visibility = form.value.visibility || 'Internal';
    
    console.log('[EventFormModal] Making API call...', {
      method: isEditing.value ? 'PUT' : 'POST',
      url: isEditing.value ? `/events/${props.event.eventId || props.event._id}` : '/events'
    });
    
    let response;
    if (isEditing.value) {
      // Support both _id and eventId
      const eventId = props.event.eventId || props.event._id;
      response = await apiClient.put(`/events/${eventId}`, payload);
    } else {
      response = await apiClient.post('/events', payload);
    }
    
    console.log('[EventFormModal] Event save response:', response);
    
    if (response.success) {
      emit('saved', response.data);
      
      // Open the saved event in a new tab
      if (response.data) {
        const eventId = response.data.eventId || response.data._id;
        if (eventId) {
          const eventTitle = response.data.eventName || response.data.title || 'Event';
          const recordPath = `/events/${eventId}`;
          
          // Check if we're already viewing this event
          const currentPath = activeTab.value?.path || '';
          const isAlreadyViewing = currentPath === recordPath || currentPath.includes(`/${eventId}`);
          
          // Open tab for new events, or if not already viewing for edits
          if (!isEditing.value || !isAlreadyViewing) {
            openTab(recordPath, {
              title: eventTitle,
              icon: '📅',
              insertAdjacent: true
            });
          }
        }
      }
      
      // Dispatch global event to refresh calendar/list views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:event-created', {
          detail: { event: response.data }
        }));
      }
      
      close();
    } else {
      console.error('Event save failed:', response);
      let errorMessage = response.error || 'Failed to save event';
      if (response.validationErrors) {
        errorMessage += '\nValidation errors:\n' + response.validationErrors.map(e => `- ${e.field}: ${e.message}`).join('\n');
      }
      alert(errorMessage);
    }
  } catch (error) {
    console.error('Error saving event - Full error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response,
      responseData: error.response?.data,
      validationErrors: error.validationErrors
    });
    
    // Extract actual error message from backend response
    let errorMessage = 'Failed to save event';
    
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // Prioritize actual error message over generic ones
      if (errorData.error && errorData.error !== 'Error creating event.' && errorData.error !== 'Error updating event.') {
        errorMessage = errorData.error;
      } else if (errorData.message && errorData.message !== 'Error creating event.' && errorData.message !== 'Error updating event.') {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      // Add validation errors if present
      if (errorData.validationErrors && Array.isArray(errorData.validationErrors) && errorData.validationErrors.length > 0) {
        errorMessage += '\n\nValidation Errors:\n';
        errorMessage += errorData.validationErrors
          .map((e) => `• ${e.field || 'Field'}: ${e.message || e}`)
          .join('\n');
      }
      
      // Add error field if it contains more details
      if (errorData.error && errorData.error !== errorMessage && !errorMessage.includes(errorData.error)) {
        errorMessage += '\n\nDetails: ' + errorData.error;
      }
    } else if (error.message && error.message !== 'Failed to save event') {
      errorMessage = error.message;
    }
    
    // Fallback to error.message if we still have generic message
    if (errorMessage === 'Failed to save event' && error.message) {
      errorMessage = error.message;
    }
    
    alert(errorMessage);
  } finally {
    saving.value = false;
  }
};

const close = () => {
  emit('close');
  setTimeout(resetForm, 300); // Reset after transition
};
</script>


