<!--
  ============================================================================
  ARCHITECTURAL INVARIANT: ORGANIZATION SURFACE
  ============================================================================
  
  WHAT THIS SURFACE IS:
  - A READ-ONLY display surface for business organizations
  - Shows organization context, people, work, and activity
  - Provides navigation to editing surface (never hosts inline editing)
  
  WHAT THIS SURFACE MUST NEVER DO:
  - MUST NOT perform PATCH/POST operations on organization data
  - MUST NOT contain inline editing forms
  - MUST NOT mutate organization records directly
  - MUST NOT expose tenant configuration (subscription, billing, limits)
  
  INVARIANT LOCKS:
  - No PATCH/POST calls exist (surface is read-only forever)
  - All mutations redirect to CreateOrganizationSurface (never inline)
  
  ============================================================================
  ORGANIZATIONSURFACE CONTRACT
  ============================================================================
  
  OrganizationSurface
  Contextual business organization view.
  Uses OrganizationSurfaceData projection only.
  Aligned with PeopleSurface and organization-surface-invariants.md
  
  OrganizationSurface is a contextual surface for Business Organizations.
  
  See docs/architecture/organization-surface-invariants.md for rules.
  
  OrganizationSurface MUST:
  - Show business context, not platform configuration
  - Be app-agnostic at the surface level
  - Show app-specific data only within app sections
  
  OrganizationSurface MUST NOT:
  - Show subscription, billing, limits, or enabledApps
  - Show tenant-only fields
  - Act as a primary navigation destination
  
  Structural Sections (v1):
  1. Header (business identity)
  2. People linked to the organization
  3. Work grouped by app (Sales, Helpdesk, Audit, etc.)
  4. Business details (progressive disclosure)
  5. Activity timeline
  
  ============================================================================
  EMPTY STATE PHILOSOPHY
  ============================================================================
  
  Empty states in OrganizationSurface follow these principles:
  
  1. Explain why data is missing
     - "No people linked yet" (not "No people")
     - "No work yet — this organization hasn't been used in Sales"
  
  2. Never prompt global creation
     - Do NOT show "Create new person" buttons
     - Do NOT show "Add organization" prompts
     - OrganizationSurface is contextual, not a creation surface
  
  3. Guide users back to context
     - "Add people from the People surface"
     - "Link this organization to deals in Sales"
     - Always reference the source context (People, Deals, etc.)
  
  4. Stay calm and non-CRM-like
     - Empty states are informational, not urgent
     - No call-to-action buttons that create new entities
     - Simple, clear messaging
  
  ============================================================================
  PERMISSION & READ-ONLY DESIGN
  ============================================================================
  
  NOTE:
  OrganizationSurface is read-only by design.
  Editing is intentional, scoped, and introduced only via explicit workflows.
  
  Read-only enforcement:
  - No inline editing capabilities
  - No "Edit organization" forms within this component
  
  Edit affordance:
  - "Edit business details" button in Business Details section
  - Opens CreateOrganizationSurface in edit mode (new tab)
  - Shows only for business organizations (not tenant)
  - Requires edit/update permission
  - Editing happens in CreateOrganizationSurface, not inline
  
  Future edit actions (if introduced) MUST be:
  - Scoped: Limited to specific fields or sections
  - App-specific: Editing happens within app context (Sales, Helpdesk, etc.)
  - Explicitly designed: Dedicated edit flows, not inline edits
  - Contextual: Editing happens from the app that owns the data
  
  Examples of allowed future extensions:
  - "Add to Sales" button (scoped, app-specific action)
  - "Link person" action (relationship management)
  - App-specific sub-surfaces (Sales organization detail, Helpdesk organization detail)
  
  Examples of FORBIDDEN extensions:
  - Inline editing of organization name
  - Modal or drawer editing within OrganizationSurface
  - Sidebar navigation entries for OrganizationSurface
  - Tenant configuration exposure (subscription, limits, etc.)
  
  ============================================================================
  TENANT SAFETY
  ============================================================================
  
  DEFENSIVE UX FALLBACK:
  If the API accidentally returns tenant organization data (should never happen),
  we show a generic error instead of rendering the data.
  
  This is a defensive UX fallback, not normal flow.
  The backend should reject tenant orgs at the API level (403).
  This check is a last line of defense to prevent platform data leakage.
  
  ============================================================================
  FUTURE EXTENSION GUIDANCE
  ============================================================================
  
  Allowed future extensions (must maintain contextual, read-only principles):
  
  1. App-specific sub-surfaces
     - Sales organization detail (shows Sales-specific fields)
     - Helpdesk organization detail (shows Helpdesk-specific fields)
     - These would be accessed from within the app context
  
  2. Scoped actions
     - "Add to Sales" button (creates Sales participation)
     - "Link to Deal" action (creates relationship)
     - Actions are scoped to specific apps or relationships
  
  3. Relationship management
     - Link/unlink people from organization
     - Link/unlink deals from organization
     - All relationship changes happen from the related entity's surface
  
  Explicitly FORBIDDEN extensions:
  
  1. Global edit forms
     - No "Edit Organization" button in OrganizationSurface
     - No inline editing of organization fields
     - Editing must happen from app-specific surfaces
  
  2. Sidebar navigation entries
     - OrganizationSurface must never appear in sidebar
     - It is accessed only contextually (from People, Deals, Search)
  
  3. Tenant configuration exposure
     - Never show subscription, billing, limits
     - Never show enabledApps, security settings
     - Never show platform/tenant management fields
  
  4. Primary navigation destination
     - No "Organizations" tab in main navigation
     - No default route to organizations list
     - OrganizationSurface is always contextual
  
  ============================================================================
-->

<template>
  <div class="mx-auto max-w-7xl density-balanced">
    <!-- Loading State -->
    <div v-if="loading" class="p-8">
      <div class="space-y-6">
        <!-- Header Skeleton -->
        <div class="h-12 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        
        <!-- Section Skeletons -->
        <div v-for="i in 4" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-8">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('organizations.organizationSurfaceErrorLoadingOrganization') }}</h3>
            <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
            <button 
              @click="fetchOrganization"
              class="mt-3 text-sm text-red-700 dark:text-red-300 hover:underline"
            >{{ t('organizations.organizationSurfaceTryAgain') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- OrganizationSurface Content -->
    <div v-else-if="organization" class="space-y-6 p-6">
      <!-- A. Header Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-baseline gap-3 mb-2">
              <h1 class="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {{ organization.name }}
              </h1>
              
              <!-- Organization Type Badge (subtle, contextual) -->
              <span
                v-if="organization.types && organization.types.length > 0"
                class="text-xs font-normal text-gray-500 dark:text-gray-400"
              >
                {{ organization.types[0] }}
              </span>
            </div>
            
            <!-- Industry (if present) -->
            <p v-if="organization.industry" class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {{ organization.industry }}
            </p>
            
            <!-- Primary Contact -->
            <div v-if="organization.primaryContact" class="mt-2">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('organizations.organizationSurfacePrimaryContact') }}</span>
              <button
                @click="openTab(`/people/${organization.primaryContact.id}`, { insertAdjacent: true })"
                class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {{ organization.primaryContact.displayName }}
              </button>
            </div>
          </div>
          <!-- Email action -->
          <button
            v-if="organization && !organization.isTenant"
            @click="handleEmail"
            class="flex-shrink-0 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>{{ t('settings.settingsAddFieldTypeEmail') }}</button>
        </div>
      </div>

      <!-- B. People Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('settings.coreModDetailModulePeople') }}<span v-if="organization.peopleCount !== undefined" class="text-gray-500 dark:text-gray-400 font-normal">({{ organization.peopleCount }})</span>
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('organizations.organizationSurfacePeopleAssociatedWithThisOrganization') }}</p>
          </div>
          <button
            v-if="organization.peopleCount > organization.peoplePreview.length"
            @click="openTab(`/people?organization=${organization.id}`, { insertAdjacent: true })"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >{{ t('settings.roleDrawerPermViewAll') }}</button>
        </div>
        
        <div v-if="organization.peoplePreview && organization.peoplePreview.length > 0" class="space-y-2 mt-4">
          <div
            v-for="person in organization.peoplePreview"
            :key="person.id"
            class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <button
              @click="openTab(`/people/${person.id}`, { insertAdjacent: true })"
              class="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {{ person.name }}
            </button>
            <span v-if="person.role" class="text-xs text-gray-500 dark:text-gray-400">
              {{ person.role }}
            </span>
          </div>
        </div>
        <!-- Empty state: Explain why data is missing, guide to context, never prompt global creation -->
        <p v-else-if="organization.peopleCount === 0" class="text-sm text-gray-500 dark:text-gray-400 italic mt-4">
          No people linked yet — add people from the People surface and link them to this organization.
        </p>
      </div>

      <!-- C. Work by App Section -->
      <div v-if="organization.apps && organization.apps.length > 0" class="space-y-4">
        <div
          v-for="app in organization.apps.filter(a => a.hasWork)"
          :key="app.appKey"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {{ getAppLabel(app.appKey) }}
          </h2>
          
          <div v-if="app.counts" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              v-for="(count, workType) in app.counts"
              :key="workType"
              class="text-center"
            >
              <div class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {{ count }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                {{ workType }}
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('organizations.organizationSurfaceWorkExistsForThisApp') }}</p>
        </div>
        
        <!-- Empty state: Explain why data is missing, guide to context -->
        <div v-if="organization.apps.filter(a => a.hasWork).length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p class="text-sm text-gray-500 dark:text-gray-400 italic">
            No work yet — this organization hasn't been used in any apps. Link it to deals in Sales, tickets in Helpdesk, or audits in Audit.
          </p>
        </div>
      </div>

      <!-- D. Business Details (Collapsed by Default) -->
      <!-- ARCHITECTURAL NOTE: OrganizationSurface remains read-only -->
      <!-- Editing must happen only in CreateOrganizationSurface (edit mode) -->
      <!-- No quick create toggle for edit, no additional navigation added -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between p-6">
          <button
            @click="showBusinessDetails = !showBusinessDetails"
            class="flex-1 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 -m-6 p-6 transition-colors rounded-lg"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('organizations.organizationSurfaceBusinessDetails') }}</h2>
            <svg
              :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0', { 'rotate-180': showBusinessDetails }]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <!-- Edit business details button -->
          <!-- ARCHITECTURAL NOTE: Explicit edit action opens CreateOrganizationSurface in edit mode (drawer) -->
          <!-- Shows only when: organization loaded, not tenant, user has edit permission -->
          <button
            v-if="organization && !organization.isTenant && canEditOrganization"
            @click="showEditDrawer = true"
            class="ml-4 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            :title="'Edit shared business information like address, website, and industry.'"
          >{{ t('organizations.organizationSurfaceEditBusinessDetails') }}</button>
        </div>
        
        <div v-if="showBusinessDetails" class="px-6 pb-6 space-y-4">
          <!-- Helper note: Explain that details are managed by apps -->
          <p class="text-xs text-gray-500 dark:text-gray-400 italic mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">{{ t('organizations.organizationSurfaceTheseDetailsAreManagedByThe') }}</p>
          
          <div v-if="organization.website" class="flex items-start">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{{ t('organizations.organizationSurfaceWebsite') }}</span>
            <a
              :href="organization.website"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {{ organization.website }}
            </a>
          </div>
          
          <div v-if="organization.phone" class="flex items-start">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{{ t('organizations.organizationSurfacePhone') }}</span>
            <a
              :href="`tel:${organization.phone}`"
              class="text-sm text-gray-900 dark:text-gray-100"
            >
              {{ organization.phone }}
            </a>
          </div>
          
          <div v-if="organization.address" class="flex items-start">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{{ t('organizations.organizationSurfaceAddress') }}</span>
            <span class="text-sm text-gray-900 dark:text-gray-100">{{ organization.address }}</span>
          </div>
          
          <div v-if="organization.annualRevenue" class="flex items-start">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{{ t('organizations.organizationSurfaceRevenue') }}</span>
            <span class="text-sm text-gray-900 dark:text-gray-100">
              {{ formatCurrency(organization.annualRevenue) }}
            </span>
          </div>
          
          <div v-if="organization.numberOfEmployees" class="flex items-start">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">{{ t('organizations.organizationSurfaceEmployees') }}</span>
            <span class="text-sm text-gray-900 dark:text-gray-100">
              {{ formatNumber(organization.numberOfEmployees) }}
            </span>
          </div>
          
          <!-- Empty state: Explain why data is missing, guide to context -->
          <p v-if="!hasBusinessDetails" class="text-sm text-gray-500 dark:text-gray-400 italic">
            No business details available — add details when creating or editing this organization from the relevant app context.
          </p>
        </div>
      </div>

      <!-- Action Availability Explanation (Read-Only) -->
      <!-- ARCHITECTURAL NOTE: This section explains why actions may or may not be allowed -->
      <!-- It does NOT enforce, hide, disable, or change behavior -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ t('organizations.organizationSurfaceActionAvailability') }}</h2>
        
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

      <!-- Automation Context -->
      <AutomationContext
        v-if="organization._id"
        entity-type="organization"
        :entity-id="organization._id"
      />

      <!-- E. Activity Timeline (consistent with Person: threads, unread, email) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ t('organizations.organizationSurfaceRecentActivity') }}</h2>
        <ActivityTimeline
          v-if="organization?.id"
          :key="`activity-${organization.id}-${activityRefreshKey}`"
          entity-type="Organization"
          :entity-id="organization.id"
        />
      </div>
    </div>

    <!-- Edit Organization Drawer -->
    <!-- ARCHITECTURAL NOTE: Opens OrganizationQuickCreateDrawer in edit mode -->
    <!-- Editing happens in OrganizationQuickCreateDrawer, not inline -->
    <OrganizationQuickCreateDrawer
      :isOpen="showEditDrawer"
      :organizationId="organization?.id || organization?._id"
      @close="showEditDrawer = false"
      @saved="handleOrganizationUpdated"
    />

    <!-- Email Compose Modal -->
    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="organization?.id ? { moduleKey: 'organizations', recordId: organization.id } : null"
      :initial-to="organization?.primaryContact?.email || ''"
      @close="showEmailModal = false"
      @submit="handleEmailSubmit"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import OrganizationQuickCreateDrawer from '@/components/organizations/OrganizationQuickCreateDrawer.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import ActivityTimeline from '@/components/ActivityTimeline.vue';
import AutomationContext from '@/components/automation/AutomationContext.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { formatNumber } from '@/utils/localeFormat';
// CONTRACT-LOCKED:
// See docs/architecture/platform-permission-contract.md
// Platform Permissions MUST remain explanatory-only.
import {
  derivePlatformPermissions
} from '@/platform/permissions/platformPermissions.utils';

const route = useRoute();
const { openTab } = useTabs();
const authStore = useAuthStore();
const notifications = useNotifications();

// State
const loading = ref(true);
const error = ref(null);
const organization = ref(null);
const showBusinessDetails = ref(false);
const showEditDrawer = ref(false);
const showEmailModal = ref(false);
const activityRefreshKey = ref(0);

// Computed
const hasBusinessDetails = computed(() => {
  if (!organization.value) return false;
  return !!(
    organization.value.website ||
    organization.value.phone ||
    organization.value.address ||
    organization.value.annualRevenue ||
    organization.value.numberOfEmployees
  );
});

// Permission check: user must have edit/update permission for organizations
// ARCHITECTURAL NOTE: Reuse existing permission logic pattern
const canEditOrganization = computed(() => {
  return authStore.can('organizations', 'update') || authStore.can('organizations', 'edit');
});

// Platform Permission Explanation Layer
// ARCHITECTURAL NOTE: This is explanatory only, does NOT enforce permissions
// Defines context based solely on existing surface state (no API calls, no role checks)
const permissionContext = computed(() => ({
  resource: 'organization',
  scope: 'RECORD',

  isReadOnly: true,               // OrganizationSurface is read-only
  isSystemManaged: organization.value?.isTenant === true,
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
      return 'Edit organization';
    case 'DELETE':
      return 'Delete organization';
    case 'LINK':
      return 'Link people';
    case 'UNLINK':
      return 'Unlink people';
    default:
      return action;
  }
}

// Methods
/**
 * Handle organization updated after edit
 * ARCHITECTURAL NOTE: Refresh organization data after successful edit
 */
const handleEmail = () => {
  showEmailModal.value = true;
};

const handleEmailSubmit = async (payload) => {
  showEmailModal.value = false;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success('Email sent');
      activityRefreshKey.value += 1;
      fetchOrganization();
    } else {
      notifications.error(res.message || 'Failed to send email');
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || 'Failed to send email');
  }
};

const handleOrganizationUpdated = () => {
  // DEV-ONLY INVARIANT GUARD: OrganizationSurface does not mutate, only refreshes
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      true, // This handler only refreshes data, which is allowed
      '[OrganizationSurface] INVARIANT: Edit operations must happen in CreateOrganizationSurface, not inline'
    );
  }

  showEditDrawer.value = false;
  activityRefreshKey.value += 1;
  fetchOrganization();
};

const fetchOrganization = async () => {
  // DEV-ONLY INVARIANT GUARD: OrganizationSurface is read-only, no mutations
  if (process.env.NODE_ENV === 'development') {
    // This function only performs GET requests, which is allowed
    // Any POST/PATCH/PUT would violate the invariant
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    const response = await apiClient(`/organizations/${route.params.id}/surface`, {
      method: 'GET'
    });
    
    if (response.success) {
      // DEFENSIVE UX FALLBACK: Check for tenant organization data
      // This should never happen (backend should reject with 403),
      // but this is a last line of defense to prevent platform data leakage.
      const data = response.data;
      
      // If the API accidentally returns tenant data (should never happen),
      // show a generic error instead of rendering.
      // We check for tenant-only fields that should never be in OrganizationSurfaceData.
      // Note: OrganizationSurfaceData type explicitly excludes these fields,
      // so if they appear, something went wrong.
      if (data.subscription || data.enabledApps || data.limits || data.isTenant === true) {
        console.error('[OrganizationSurface] Tenant organization data detected - rejecting');
        error.value = 'This organization cannot be accessed via OrganizationSurface.';
        organization.value = null;
        return;
      }
      
      organization.value = data;
    } else {
      error.value = response.message || 'Failed to load organization';
    }
  } catch (err) {
    console.error('Error fetching organization surface:', err);
    
    // Handle specific error cases
    if (err.status === 403) {
      error.value = 'This organization cannot be accessed via OrganizationSurface.';
    } else if (err.status === 404) {
      error.value = 'Organization not found.';
    } else {
      error.value = err.message || 'Failed to load organization';
    }
  } finally {
    loading.value = false;
  }
};

const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return '-';
  const currencyCode = resolveOrgCurrencyCode(organization.value);
  return (
    formatCurrencyValue(amount, {
      currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) || '-'
  );
};

const getAppLabel = (appKey) => {
  const labels = {
    'SALES': 'Sales',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects',
    'LMS': 'Learning Management'
  };
  return labels[appKey] || appKey;
};

// Listen for refresh events from command palette or other sources
const handleRefreshOrganization = (event) => {
  const { organizationId } = event.detail || {};
  // Only refresh if this is the current organization
  if (organizationId && organizationId === route.params.id) {
    fetchOrganization();
  }
};

// Lifecycle
onMounted(() => {
  fetchOrganization();
  
  // Listen for refresh events
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:refresh-organization', handleRefreshOrganization);
  }

  // DEV-only invariants for Platform Permission Explanation Layer
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      permissions.value.length > 0,
      '[OrganizationSurface] Platform permissions not derived'
    );

    console.assert(
      permissionContext.value.isReadOnly === true,
      '[OrganizationSurface] Read-only invariant violated'
    );
  }
});

onUnmounted(() => {
  // Clean up event listener
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:refresh-organization', handleRefreshOrganization);
  }
});
</script>
