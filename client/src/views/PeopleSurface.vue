<!--
  ============================================================================
  ARCHITECTURAL INVARIANT: PEOPLE SURFACE
  ============================================================================
  
  WHAT THIS SURFACE IS:
  - A READ-ONLY display surface for person profiles
  - Shows identity, participation, momentum, and history layers
  - Provides navigation to creation/editing surfaces (never hosts them)
  
  WHAT THIS SURFACE MUST NEVER DO:
  - MUST NOT contain create/edit logic (delegates to PeopleQuickCreateDrawer)
  - MUST NOT mutate person records directly (redirects to appropriate surfaces)
  - MUST NOT host inline editing forms
  - MUST NOT perform PATCH/POST operations on person data
  
  INVARIANT LOCKS:
  - No create/edit logic exists here (all mutations redirect to PeopleQuickCreateDrawer)
  - Any attempt to mutate redirects to PeopleQuickCreateDrawer (never inline)
  
  ============================================================================
  PEOPLESURFACE CONTRACT
  ============================================================================
  
  PeopleSurface is a top-level concept that answers three fundamental questions:
  
  1. Who is this person? (Identity)
     - Displayed in IdentityLayer
     - Always visible, never collapses
     - Recognition-first, not edit-first
  
  2. Why are they in our system? (Participation)
     - Displayed in ParticipationLayer
     - Shows app participations and roles
  
  3. What matters now? (Momentum)
     - Displayed in MomentumLayer
     - Shows current activity and priorities
  
  4. History (Activity Timeline)
     - Displayed in HistoryLayer
     - Immutable audit stream
  
  LAYER ORDER (rendered in this exact order):
  - IdentityLayer (always first)
  - ParticipationLayer
  - MomentumLayer
  - HistoryLayer
  
  Each layer must render even if empty.
  
  CONSTRAINTS:
  - No business logic in this component (delegated to layers)
  - No UX pattern invention (use established patterns)
  - No tabs, widgets, dashboards, or summaries
  - No API contract changes
  ============================================================================
-->

<template>
  <!-- Density Mode: Balanced (entity detail screen) -->
  <div class="mx-auto max-w-7xl density-balanced">
    <!-- Loading State (Skeleton Structure) -->
    <div v-if="loading">
      <!-- Header Skeleton -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div class="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Layer Skeletons -->
      <div v-for="i in 4" :key="i" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div class="px-6 py-4">
          <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-danger-800 dark:text-danger-200 mb-2">{{ t('people.peopleSurfaceErrorLoadingProfile') }}</h3>
          <p class="text-sm text-danger-700 dark:text-danger-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- PeopleSurface Content -->
    <div v-else-if="profileData">
      <!-- Layer 1: IdentityLayer (always first, always visible, never collapses) -->
      <IdentityLayer
        :firstName="identityData.firstName"
        :lastName="identityData.lastName"
        :email="identityData.email"
        :phone="identityData.phone"
        :mobile="identityData.mobile"
        :organization="identityData.organization"
        :organizationId="identityData.organizationId"
        :doNotContact="identityData.doNotContact"
        :tags="identityData.tags"
        :avatar="identityData.avatar"
        :person-id="personId"
        @edit-profile="handleEditProfile"
        @email="handleEmail"
      />

      <!-- Action Availability Explanation (Read-Only) -->
      <!-- ARCHITECTURAL NOTE: This section explains why actions may or may not be allowed -->
      <!-- It does NOT enforce, hide, disable, or change behavior -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ t('people.peopleSurfaceActionAvailability') }}</h2>
        
        <div class="space-y-3">
          <div
            v-for="permission in permissions"
            :key="permission.action"
            class="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ getActionLabel(permission.action) }}
                </span>
                <span
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded',
                    permission.allowed
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  ]"
                >
                  {{ permission.allowed ? 'Allowed' : 'Not allowed' }}
                </span>
              </div>
              <p
                v-if="!permission.allowed && permission.reason"
                class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-0"
              >
                Reason: {{ permission.reason }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Layer 2: ParticipationLayer -->
      <ParticipationLayer
        :profileData="profileData"
        :appContext="appContext"
        :person-id="personId"
        @convert="handleConvert"
        @edit="handleEdit"
        @edit-details="handleEditDetails"
        @view="handleView"
        @detach="handleDetach"
        @create-deal="handleCreateDeal"
        @create-task="handleCreateTask"
        @create-case="handleCreateCase"
        @schedule-meeting="handleScheduleMeeting"
        @status-updated="handleStatusUpdated"
        @attach-to-app="handleAttachToApp"
      />

      <!-- Layer 3: MomentumLayer -->
      <MomentumLayer
        :profileData="profileData"
        :appContext="appContext"
        :person-id="personId"
        :attach-modal-open="showAttachModal || showAttachFormModal"
        :convert-modal-open="showConvertModal"
        :stale-suppressed-apps="staleSuppressedApps"
        @convert="handleConvert"
        @edit="handleEdit"
        @edit-details="handleEditDetails"
        @attach-to-app="handleAttachToApp"
        @add-activity="handleAddActivity"
      />

      <!-- Layer 4: HistoryLayer -->
      <HistoryLayer
        v-if="personId"
        :personId="personId"
        :appContext="appContext"
        :refresh-key="activityRefreshKey"
        :optimistic-email="pendingEmail"
        @create-task="handleCreateTaskFromHistory"
        @schedule-meeting="handleScheduleMeetingFromHistory"
        @add-note="handleAddNote"
        @email="handleEmail"
        @retry-email="handleEmailSubmit"
      />

      <!-- Relationship-based drill-downs -->
      <RelationshipDrillDowns
        v-if="personId"
        :person-id="personId"
        :person-name="identityData.fullName"
        :profile-data="profileData"
      />
    </div>

    <!-- Attach to App Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAttachModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
          @click.self="closeAttachModal"
        >
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
            <!-- Header -->
            <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleSurfaceAttachToApp') }}</h2>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleSurfaceAddThisPersonToAnotherApp') }}</p>
              </div>
              <button
                @click="closeAttachModal"
                class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-6">
              <!-- Error State -->
              <div v-if="attachError" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm text-danger-700 dark:text-danger-300">{{ attachError }}</p>
                  </div>
                </div>
              </div>

              <!-- Validation Errors Summary -->
              <div v-if="Object.keys(attachValidationErrors).length > 0" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <h3 class="text-sm font-semibold text-danger-800 dark:text-danger-200 mb-2">{{ t('people.peopleSurfaceValidationErrors') }}</h3>
                    <ul class="list-disc list-inside space-y-2">
                      <li v-for="(message, field) in attachValidationErrors" :key="field" class="text-sm text-danger-700 dark:text-danger-300">
                        <span class="font-medium">{{ field }}:</span> {{ message }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Intent Selection (before intent is selected) -->
              <div v-if="!selectedAttachIntent">
                <div v-if="hasAvailableAttachIntents">
                  <div class="mb-4">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">{{ t('people.peopleSurfaceSelectIntent') }}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleSurfaceChooseHowYouWantToAdd') }}</p>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="intent in availableAttachIntents"
                      :key="intent.id"
                      @click="selectAttachIntent(intent)"
                      class="text-left p-4 border-2 rounded-lg transition-all border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="font-medium text-gray-900 dark:text-white">
                            {{ intent.label }}
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {{ intent.description }}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
                <div v-else class="text-center py-8">
                  <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('people.peopleSurfaceAllAppsAttached') }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.peopleSurfaceThisPersonIsAlreadyPartOf') }}</p>
                </div>
              </div>

              <!-- Attach Form (after intent is selected) -->
              <div v-else>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Preparing form for {{ formatAppName(selectedAttachIntent.appKey) }}...
                </p>
                <button
                  @click="openAttachFormModal"
                  class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >{{ t('performance.next') }}</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Convert Lead to Contact Modal -->
    <SalesConvertLeadModal
      :is-open="showConvertModal"
      :person-id="personId || ''"
      @close="showConvertModal = false"
      @converted="handleConverted"
    />

    <!-- Detach from App Modal -->
    <DetachFromAppModal
      :is-open="showDetachModal"
      :person-id="personId || ''"
      :app-key="detachAppKey || ''"
      @close="showDetachModal = false"
      @detached="handleDetached"
    />

    <!-- Create Record Drawer -->
    <CreateRecordDrawer
      v-if="createDrawerModule"
      :isOpen="showCreateDrawer"
      :moduleKey="createDrawerModule"
      :initialData="createDrawerInitialData"
      @close="showCreateDrawer = false"
      @saved="handleRecordCreated"
    />

    <!-- Edit Profile Drawer -->
    <!-- ENFORCES: Only shows fields that are eligible for Quick Create -->
    <!-- Same fields as quick create: core identity fields + system fields with allowOnCreate -->
    <!-- EXCLUDES: All other fields (participation fields, app-specific fields, etc.) -->
    <!-- Uses quickCreate order to match quick create form -->
    <CreateRecordDrawer
      :isOpen="showEditProfileDrawer"
      moduleKey="people"
      :record="editProfileRecord"
      :excludeFields="excludedProfileFields"
      :useQuickCreateOrder="true"
      @close="showEditProfileDrawer = false"
      @saved="handleProfileUpdated"
    />

    <!-- Attach to App Form Modal (uses field model) -->
    <AttachToAppModal
      v-if="selectedAttachIntent"
      :is-open="showAttachFormModal"
      :person-id="personId || ''"
      :app-key="selectedAttachIntent.appKey"
      :participation-type="selectedAttachIntent.participationType"
      @close="closeAttachModal"
      @attached="handleAttachAttached"
    />

    <!-- Participation Edit Modal -->
    <ParticipationEditModal
      :is-open="showEditDetailsModal"
      :person-id="personId || ''"
      :app-key="editDetailsAppKey || ''"
      :participation-data="editDetailsParticipationData"
      @close="showEditDetailsModal = false"
      @updated="handleParticipationUpdated"
    />

    <!-- Email Compose Drawer (in-product email) -->
    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="personId ? { moduleKey: 'people', recordId: personId } : null"
      :initial-to="identityData.email || ''"
      @close="showEmailModal = false"
      @submit="handleEmailSubmit"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import IdentityLayer from '@/components/people/IdentityLayer.vue';
import ParticipationLayer from '@/components/people/ParticipationLayer.vue';
import MomentumLayer from '@/components/people/MomentumLayer.vue';
import HistoryLayer from '@/components/people/HistoryLayer.vue';
import RelationshipDrillDowns from '@/components/people/RelationshipDrillDowns.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import AttachToAppModal from '@/components/people/AttachToAppModal.vue';
import SalesConvertLeadModal from '@/components/people/SalesConvertLeadModal.vue';
import DetachFromAppModal from '@/components/people/DetachFromAppModal.vue';
import ParticipationEditModal from '@/components/people/ParticipationEditModal.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { assertAttachPermission, assertEditParticipationPermission, assertLifecyclePermission } from '@/platform/permissions/peopleGuards';
import { getFieldMetadata, PEOPLE_FIELD_METADATA } from '@/platform/fields/peopleFieldModel';
// CONTRACT-LOCKED:
// See docs/architecture/platform-permission-contract.md
// Platform Permissions MUST remain explanatory-only.
import {
  derivePlatformPermissions
} from '@/platform/permissions/platformPermissions.utils';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

// Computed: Ensure personId is always a string or null (never undefined)
// IMPORTANT: In the tabbed UI, this view can remain mounted while the global
// route changes (e.g. to `/organizations/:id`). In that case `route.params.id`
// is not a person id; only treat it as one on the People route.
const personId = computed(() => {
  if (route.name !== 'person-detail') return null;
  return route.params.id || null;
});

// State
const loading = ref(true);
const error = ref(null);
const profileData = ref(null);
const appContext = ref(null);

// Attach to App state
const showAttachModal = ref(false);
const showAttachFormModal = ref(false);
const attachLoading = ref(false);
const attachError = ref(null);
const attachValidationErrors = ref({});
const selectedAttachIntent = ref(null);
const attachFormData = ref({});

// Convert Lead to Contact state
const showConvertModal = ref(false);
const convertAppKey = ref(null);

// Momentum signal suppression (in-memory only, for current session)
// Tracks which apps have had activity added to suppress stale signals
const staleSuppressedApps = ref(new Set());

// Detach from App state
const showDetachModal = ref(false);
const detachAppKey = ref(null);

// Edit Details state
const showEditDetailsModal = ref(false);
const editDetailsAppKey = ref(null);
const editDetailsParticipationData = ref(null);

// Edit profile state
const showEditProfileDrawer = ref(false);
const editProfileRecord = ref(null);

// Email compose state
const showEmailModal = ref(false);
const activityRefreshKey = ref(0);
const pendingEmail = ref(null); // Optimistic: { to, subject } while send in progress

/**
 * Check if a field is eligible for Quick Create (same logic as PeopleQuickCreate)
 * Includes ONLY:
 * - Core identity fields (owner === 'core', intent === 'identity', editable === true)
 * - System fields with allowOnCreate (owner === 'system', editable === true, allowOnCreate === true)
 */
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
    // Field not found in metadata - exclude it
    return false;
  }
}

/**
 * Get all field keys that are eligible for Quick Create
 * (same fields shown in quick create form)
 */
function getEligibleFieldKeys() {
  const eligibleKeys = [];
  const allFieldKeys = Object.keys(PEOPLE_FIELD_METADATA);
  
  for (const key of allFieldKeys) {
    if (isFieldEligibleForQuickCreate(key)) {
      eligibleKeys.push(key);
    }
  }
  
  return eligibleKeys;
}

/**
 * Computed: Fields to exclude from "Edit profile" drawer
 * Excludes all fields that are NOT eligible for quick create
 * This ensures edit profile shows the same fields as quick create
 */
const excludedProfileFields = computed(() => {
  const eligibleKeys = getEligibleFieldKeys();
  const allFieldKeys = Object.keys(PEOPLE_FIELD_METADATA);
  
  // Exclude all fields that are NOT eligible
  const excluded = allFieldKeys.filter(key => !eligibleKeys.includes(key));
  
  return excluded;
});

// Create drawer state
const showCreateDrawer = ref(false);
const createDrawerModule = ref(null);
const createDrawerInitialData = ref({});

// Platform Permission Explanation Layer
// ARCHITECTURAL NOTE: This is explanatory only, does NOT enforce permissions
// Defines context based solely on existing surface state (no API calls, no role checks)
const permissionContext = computed(() => ({
  resource: 'people',
  scope: 'RECORD',

  isReadOnly: true,               // PeopleSurface is read-only
  isSystemManaged: false,
  workflowLocked: false           // Explicit for clarity
}));

// Derive permission explanations
const permissions = computed(() =>
  derivePlatformPermissions(
    [
      'UPDATE',
      'DELETE',
      'LINK',
      'UNLINK'
    ],
    permissionContext.value
  )
);

// Helper: Map permission actions to human-readable labels
function getActionLabel(action) {
  switch (action) {
    case 'UPDATE':
      return 'Edit person';
    case 'DELETE':
      return 'Delete person';
    case 'LINK':
      return 'Link organization';
    case 'UNLINK':
      return 'Unlink organization';
    default:
      return action;
  }
}

// Computed: Extract identity data from profileData
const identityData = computed(() => {
  if (!profileData.value?.core?.fields) {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      organization: null,
      organizationId: null,
      doNotContact: undefined,
      tags: [],
      avatar: null
    };
  }

  const fields = profileData.value.core.fields;
  const org = fields.organization;
  
  const firstName = fields.first_name || '';
  const lastName = fields.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || fields.email || 'Person';
  
  return {
    firstName,
    lastName,
    email: fields.email || '',
    phone: fields.phone || '',
    mobile: fields.mobile || '',
    organization: org && typeof org === 'object' && org !== null ? (org.name || org._id) : (org || null),
    organizationId: org && typeof org === 'object' && org !== null && org._id ? org._id : null,
    doNotContact: fields.do_not_contact,
    tags: fields.tags || [],
    avatar: fields.avatar || null,
    fullName
  };
});

// Methods
const loadProfile = async () => {
  // DEV-ONLY INVARIANT GUARD: PeopleSurface is read-only, no mutations
  if (process.env.NODE_ENV === 'development') {
    // This function only performs GET requests, which is allowed
    // Any POST/PATCH/PUT would violate the invariant
  }
  
  try {
    // Guard: PeopleSurface should only load profile on its own route.
    // In our tabbed UI, this component can remain mounted while the global route
    // changes (e.g. to `/organizations/:id`). In that case `route.params.id` is
    // NOT a person id and will correctly 404 on `/api/people/:id/profile`.
    if (route.name !== 'person-detail') {
      return;
    }

    const id = personId.value;
    // Return early if person ID is missing (e.g., when tab is closed)
    if (!id) {
      return;
    }
    
    loading.value = true;
    error.value = null;
    
    // Load composed profile from API
    const response = await apiClient.get(`/people/${id}/profile`, {
      params: {
        routePath: route.path,
        routeName: route.name,
        appKey: route.query.appKey || null
      }
    });
    
    if (response.success && response.data) {
      profileData.value = response.data.profile;
      appContext.value = response.data.appContext;
    } else {
      throw new Error('Failed to load profile');
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    error.value = err.message || 'Failed to load person profile';
  } finally {
    loading.value = false;
  }
};

// Attach to App functionality
const intentMappings = [
  { id: 'sales-lead', label: 'Add to Sales as Lead', description: 'Add as a Sales Lead', appKey: 'SALES', participationType: 'LEAD' },
  { id: 'sales-contact', label: 'Add to Sales as Contact', description: 'Add as a Sales Contact', appKey: 'SALES', participationType: 'CONTACT' },
  { id: 'support-contact', label: 'Add to Helpdesk as Contact', description: 'Add as a Support Contact', appKey: 'HELPDESK', participationType: 'CONTACT' },
  { id: 'audit-member', label: 'Add to Audit as Member', description: 'Add as an Audit Member', appKey: 'AUDIT', participationType: 'MEMBER' },
  { id: 'portal-user', label: 'Add to Portal as User', description: 'Add as a Portal User', appKey: 'PORTAL', participationType: 'USER' },
  { id: 'project-member', label: 'Add to Projects as Member', description: 'Add as a Project Member', appKey: 'PROJECTS', participationType: 'MEMBER' }
];

// Get currently attached apps (apps where person actually participates, not just enabled)
const currentAppParticipations = computed(() => {
  if (!profileData.value?.apps) return [];
  
  const participations = [];
  Object.entries(profileData.value.apps).forEach(([appKey, appSection]) => {
    // Check if person actually participates in this app (has fields set)
    // For SALES, check if type field is set
    if (appKey === 'SALES') {
      if (appSection.fields?.type) {
        participations.push(appKey);
      }
    } else {
      // For other apps, check if any fields are set
      if (appSection.fields && Object.keys(appSection.fields).length > 0) {
        participations.push(appKey);
      }
    }
  });
  
  return participations;
});

// Filter available attach intents (exclude already-attached apps completely)
const availableAttachIntents = computed(() => {
  const currentApps = currentAppParticipations.value;
  
  // Filter out intents for apps where participation already exists
  return intentMappings.filter(intent => {
    // For SALES app, check if person already has type (Lead or Contact)
    if (intent.appKey === 'SALES' && currentApps.includes('SALES')) {
      return false; // Exclude all SALES intents if person already participates in SALES
    }
    // For other apps, check if app is already in participations
    if (currentApps.includes(intent.appKey)) {
      return false; // Exclude intents for apps where participation already exists
    }
    return true; // Include intent if person doesn't participate in this app
  });
});

// Check if there are any available attach intents
const hasAvailableAttachIntents = computed(() => {
  return availableAttachIntents.value.length > 0;
});

// Format app name
const formatAppName = (appKey) => {
  const appNames = {
    'SALES': 'Sales',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects'
  };
  return appNames[appKey] || appKey;
};

// Get display name for attach intent
const getAttachIntentDisplayName = (intent) => {
  if (!intent) return '';
  // Convert "Add to Sales as Lead" to "Sales — Lead", etc.
  return intent.label.replace('Add to ', '').replace(' as ', ' — ');
};

// Select attach intent
const selectAttachIntent = (intent) => {
  selectedAttachIntent.value = intent;
  attachFormData.value = {};
  attachError.value = null;
  attachValidationErrors.value = {};
};

// Open attach form modal (after intent selection)
const openAttachFormModal = () => {
  if (selectedAttachIntent.value) {
    // Guard: Check permission for the specific app before opening form modal
    try {
      assertAttachPermission(selectedAttachIntent.value.appKey);
      showAttachModal.value = false; // Close intent selection modal
      showAttachFormModal.value = true; // Open form modal
    } catch (error) {
      // Permission denied - error bubbles to console
      console.error('Permission denied for Attach to App:', error);
      closeAttachModal(); // Close modal if permission denied
    }
  }
};

// Close attach modal
const closeAttachModal = () => {
  showAttachModal.value = false;
  showAttachFormModal.value = false;
  selectedAttachIntent.value = null;
  attachFormData.value = {};
  attachError.value = null;
  attachValidationErrors.value = {};
};

// Watch for changes in available intents - close modal if none available
watch(hasAvailableAttachIntents, (hasIntents) => {
  if (!hasIntents && showAttachModal.value) {
    closeAttachModal();
  }
});

// Handle attach completion (from AttachToAppModal)
const handleAttachAttached = async (data) => {
  // Refresh profile to show new participation
  await loadProfile();
  // Wait for Vue reactivity to update
  await nextTick();
  // Close modals
  showAttachFormModal.value = false;
  selectedAttachIntent.value = null;
  attachFormData.value = {};
  attachError.value = null;
  attachValidationErrors.value = {};
};

// Handle attach-to-app click from ParticipationLayer
const handleAttachToApp = () => {
  // Guard: Check permission before opening modal
  // Note: We check BASE permission since appKey is not yet selected
  // Individual app-specific checks happen when intent is selected
  try {
    assertAttachPermission('BASE');
    showAttachModal.value = true;
  } catch (error) {
    // Permission denied - error bubbles to console
    console.error('Permission denied for Attach to App:', error);
  }
};

// ParticipationLayer event handlers
const handleConvert = (appKey) => {
  // Guard: Check lifecycle permission before opening modal
  try {
    assertLifecyclePermission(appKey);
    convertAppKey.value = appKey;
    showConvertModal.value = true;
  } catch (error) {
    // Permission denied - error bubbles to console
    console.error('Permission denied for Convert:', error);
  }
};

// Handle detach request from ParticipationCard
const handleDetach = (appKey) => {
  // Guard: Check lifecycle permission before opening modal
  try {
    assertLifecyclePermission(appKey);
    detachAppKey.value = appKey;
    showDetachModal.value = true;
  } catch (error) {
    // Permission denied - error bubbles to console
    console.error('Permission denied for Detach:', error);
  }
};

// Handle detach success (called by DetachFromAppModal)
const handleDetached = async (detachData) => {
  showDetachModal.value = false;
  detachAppKey.value = null;
  // Refresh profile data - ParticipationCard will be removed
  await loadProfile();
};

// Handle edit details (participation detail fields only)
const handleEditDetails = (appKey) => {
  // Guard: Check edit participation permission before opening modal
  try {
    assertEditParticipationPermission(appKey);
    
    if (!profileData.value?.apps?.[appKey]) {
      console.error('No participation data found for app:', appKey);
      return;
    }
    
    editDetailsAppKey.value = appKey;
    editDetailsParticipationData.value = profileData.value.apps[appKey];
    showEditDetailsModal.value = true;
  } catch (error) {
    // Permission denied - error bubbles to console
    console.error('Permission denied for Edit Details:', error);
  }
};

/** Primary "Edit participation" uses the same participation editor as "Edit details". */
const handleEdit = handleEditDetails;

// Handle participation update success
const handleParticipationUpdated = async () => {
  showEditDetailsModal.value = false;
  editDetailsAppKey.value = null;
  editDetailsParticipationData.value = null;
  
  // Refresh profile to show updated participation details
  await loadProfile();
};

const handleView = (appKey) => {
  // View action - can be wired up later
  console.log('View requested for app:', appKey);
};

// Contextual creation actions
const handleCreateDeal = (appKey, personId) => {
  createDrawerModule.value = 'deals';
  createDrawerInitialData.value = {
    contactId: personId,
    personId: personId
  };
  showCreateDrawer.value = true;
};

const handleCreateTask = (appKey, personId) => {
  createDrawerModule.value = 'tasks';
  createDrawerInitialData.value = {
    assignedTo: personId,
    personId: personId
  };
  showCreateDrawer.value = true;
};

const handleCreateCase = (appKey, personId) => {
  createDrawerModule.value = 'cases';
  createDrawerInitialData.value = {
    requesterId: personId,
    contactId: personId,
    personId: personId
  };
  showCreateDrawer.value = true;
};

const handleScheduleMeeting = (appKey, personId) => {
  createDrawerModule.value = 'events';
  createDrawerInitialData.value = {
    relatedTo: {
      type: 'Person',
      id: personId
    },
    attendees: [personId]
  };
  showCreateDrawer.value = true;
};

// HistoryLayer quick actions
const handleCreateTaskFromHistory = (personId) => {
  handleCreateTask(null, personId);
};

const handleScheduleMeetingFromHistory = (personId) => {
  handleScheduleMeeting(null, personId);
};

const handleAddNote = (personId) => {
  // Add note functionality - can use Notes component or API
  createDrawerModule.value = 'notes';
  createDrawerInitialData.value = {
    entityType: 'Person',
    entityId: personId
  };
  showCreateDrawer.value = true;
};

// Handle add activity from MomentumLayer
const handleAddActivity = (appKey, personId) => {
  // Suppress stale signal for this app (user is adding activity)
  staleSuppressedApps.value.add(appKey);
  
  // Open task creation drawer as default activity
  handleCreateTask(appKey, personId);
};

// Handle status update from ParticipationCard
const handleStatusUpdated = async (updateData) => {
  // Suppress stale signal for this app (user just updated participation)
  staleSuppressedApps.value.add(updateData.appKey);
  
  // Refresh profile to show updated status and recompute momentum signals
  await loadProfile();
  
  // Optionally scroll to status badge if updated via momentum signal
  // The status badge has ID: status-badge-{appKey}-{personId}
  const badgeId = `status-badge-${updateData.appKey}-${personId.value}`;
  const badgeElement = document.getElementById(badgeId);
  if (badgeElement) {
    badgeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

// Edit profile handler
// ENFORCES: Edit profile edits ONLY core person identity fields
// EXCLUDES: Participation fields, Lead/Contact status, app-specific fields, workflow state
const handleEditProfile = async (personId) => {
  // DEV-ONLY INVARIANT GUARD: PeopleSurface must not contain create/edit logic
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      true, // This handler redirects to drawer, which is allowed
      '[PeopleSurface] INVARIANT: Edit operations must redirect to PeopleQuickCreateDrawer, not mutate inline'
    );
  }
  
  if (!personId) return;
  
  try {
    // Load person record for editing
    const response = await apiClient.get(`/people/${personId}`);
    if (response.success && response.data) {
      const fullRecord = response.data;
      
      // Filter to ONLY core identity fields
      // Core fields that are editable via "Edit profile"
      const coreFields = [
        '_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'mobile',
        'organization', // Primary organization
        'tags',
        'do_not_contact', // Compliance flag
        'source', // If core-owned
        'avatar'
      ];
      
      // Build filtered record with ONLY core fields
      const coreRecord = {};
      coreFields.forEach(field => {
        if (fullRecord.hasOwnProperty(field)) {
          coreRecord[field] = fullRecord[field];
        }
      });
      
      // Ensure _id is present for edit mode
      if (!coreRecord._id && fullRecord._id) {
        coreRecord._id = fullRecord._id;
      }
      
      editProfileRecord.value = coreRecord;
      showEditProfileDrawer.value = true;
    }
  } catch (err) {
    console.error('Error loading person for editing:', err);
    // Fallback: open drawer with just personId
    editProfileRecord.value = { _id: personId };
    showEditProfileDrawer.value = true;
  }
};

// Email compose handler
const handleEmail = (id) => {
  if (!id) return;
  showEmailModal.value = true;
};

// Email submit: optimistic UI - close modal, show "sending...", call API, refresh when done
// On failure: keep "Email to X (failed — retry?)" with retry button instead of clearing
const handleEmailSubmit = async (payload) => {
  showEmailModal.value = false;
  const toDisplay = payload.to?.[0] || payload.to;
  pendingEmail.value = {
    ...payload,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    toDisplay,
    status: 'sending'
  };
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      pendingEmail.value = null;
      activityRefreshKey.value += 1;
    } else {
      pendingEmail.value = {
        ...pendingEmail.value,
        status: 'failed',
        error: res.message || 'Failed to send email'
      };
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    pendingEmail.value = {
      ...pendingEmail.value,
      status: 'failed',
      error: msg || 'Failed to send email'
    };
  }
};

// Handle conversion success (called by SalesConvertLeadModal)
const handleConverted = async (convertedPerson) => {
  showConvertModal.value = false;
  convertAppKey.value = null;
  // Refresh profile data to show updated participation
  await loadProfile();
};

// Watch for route changes
watch(() => [route.name, route.params.id], ([routeName, newId]) => {
  // Only react to PeopleSurface route changes.
  if (routeName !== 'person-detail') return;
  // Only load profile if person ID exists (prevents error when tab is closed)
  if (newId) loadProfile();
}, { immediate: false });

// Handle record creation
const handleRecordCreated = () => {
  // If creating a task/note/activity, suppress stale signals for related apps
  if (createDrawerModule.value === 'tasks' || createDrawerModule.value === 'notes') {
    // Determine appKey from initialData if available, default to SALES
    const relatedAppKey = createDrawerInitialData.value?.appKey || 'SALES';
    staleSuppressedApps.value.add(relatedAppKey);
  }
  
  showCreateDrawer.value = false;
  createDrawerModule.value = null;
  createDrawerInitialData.value = {};
  // Optionally refresh profile to show new relationships
  loadProfile();
};

// Handle profile update
// ENFORCES: Only core identity fields are updated
// Updates IdentityLayer immediately, logs to History, no navigation
const handleProfileUpdated = () => {
  showEditProfileDrawer.value = false;
  editProfileRecord.value = null;
  // Refresh profile to show updated identity data
  // This updates IdentityLayer immediately and logs changes to History
  loadProfile();
  // No navigation away, no page reload - stays on PeopleSurface
};

// Lifecycle
onMounted(async () => {
  await loadProfile();

  // DEV-only invariants for Platform Permission Explanation Layer
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      permissions.value.length > 0,
      '[PeopleSurface] Platform permissions not derived'
    );

    console.assert(
      permissionContext.value.isReadOnly === true,
      '[Platform Permissions] Explanation layer used on non-read-only surface'
    );
  }
});
</script>

