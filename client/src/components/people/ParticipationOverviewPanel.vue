<template>
  <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.participationOverviewPanelPlatformMediated') }}</span>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.participationOverviewPanelParticipationOverview') }}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.participationOverviewPanelSummaryOfThisPersonsParticipationAcross') }}</p>
    </div>
    
    <div class="px-6 py-4">
      <!-- Participation Cards -->
      <div v-if="participatingApps.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="participation in participatingApps"
          :key="participation.appKey"
          class="relative bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <!-- App Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{{ participation.appIcon }}</span>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ participation.appName }}
                </h3>
                <p v-if="participation.participationType" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ participation.participationType }}
                </p>
              </div>
            </div>
            
            <!-- Actions Menu -->
            <div v-if="participation.actions.length > 0" class="relative">
              <button
                @click="toggleActions(participation.appKey)"
                class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              <!-- Actions Dropdown -->
              <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <div
                  v-if="openActionsMenu === participation.appKey"
                  v-click-outside="closeActionsMenu"
                  class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
                >
                  <div class="py-1">
                    <button
                      v-for="action in participation.actions"
                      :key="action.label"
                      @click="handleAction(action, participation.appKey)"
                      :disabled="action.disabled"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors',
                        action.disabled
                          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      ]"
                    >
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
          
          <!-- State Badges -->
          <div v-if="participation.primaryState || participation.secondaryState" class="flex flex-wrap gap-2 mb-3">
            <span
              v-if="participation.primaryState"
              :class="[
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                participation.primaryState.color ? '' : getStateBadgeClass(participation.primaryState.type)
              ]"
              :style="participation.primaryState.color ? picklistBadgeStyle(participation.primaryState.color) : undefined"
            >
              {{ participation.primaryState.label }}
            </span>
            <span
              v-if="participation.secondaryState"
              :class="[
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                participation.secondaryState.color ? '' : getStateBadgeClass(participation.secondaryState.type)
              ]"
              :style="participation.secondaryState.color ? picklistBadgeStyle(participation.secondaryState.color) : undefined"
            >
              {{ participation.secondaryState.label }}
            </span>
          </div>
          
          <!-- Last Activity (Optional) -->
          <p v-if="participation.lastActivity" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Last activity: {{ participation.lastActivity }}
          </p>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.participationOverviewPanelNoAppParticipationsYet') }}</p>
      </div>
      
      <!-- Non-Participating Apps (Attach CTAs) -->
      <div v-if="nonParticipatingApps.length > 0" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('people.participationOverviewPanelAvailableApps') }}</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="app in nonParticipatingApps"
            :key="app.appKey"
            @click="handleAttach(app.appKey)"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span>{{ app.appIcon }}</span>
            <span>Attach to {{ app.appName }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';
import { getParticipationFields, getStateFields, getFieldMetadata } from '@/platform/fields/peopleFieldModel';
import { getParticipationActions, normalizeParticipationType } from './participationActions';
import { getParticipation } from '@/utils/getParticipation';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { isDetachAllowed } from './detachPolicy';
import { useAuthStore } from '@/stores/authRegistry';
import clickOutside from '@/directives/clickOutside';
import { PEOPLE_PERMISSIONS } from '@/platform/permissions/peoplePermissions';
import { hasPeoplePermission } from '@/platform/permissions/peoplePermissionHelper';
import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';
import { usePeopleModuleFields } from '@/composables/usePeopleModuleFields';
import { getPeoplePicklistColor } from '@/utils/peopleModuleFieldUtils';
import { picklistBadgeStyle } from '@/utils/peopleParticipationPicklistColors';

const props = defineProps({
  person: {
    type: Object,
    required: true
  }
});

const { t } = useI18n();

const emit = defineEmits(['edit', 'convert', 'detach', 'attach']);

const authStore = useAuthStore();
const { fields: peopleModuleFields } = usePeopleModuleFields();

// Actions menu state
const openActionsMenu = ref(null);

// App label helper - use getAppLabel for dynamic labels (no hardcoded "Sales")
const getAppDisplayName = (appKey) => getAppLabel(appKey) || appKey;

// App icon mapping
const appIcons = {
  'SALES': '💼',
  'HELPDESK': '🎧',
  'MARKETING': '📧',
  'AUDIT': '📋',
  'PORTAL': '🌐',
  'PROJECTS': '📁'
};

// Known app keys (all apps that can have participation)
const knownAppKeys = ['SALES', 'HELPDESK', 'MARKETING', 'AUDIT', 'PORTAL', 'PROJECTS'];

/**
 * Check if person participates in an app using metadata-driven detection
 * Uses profileData.apps structure if available, otherwise checks person fields directly
 */
function participatesInApp(person, appKey) {
  if (!person || !appKey) return false;
  
  // If person has apps structure (profileData format), check if app exists
  if (person.apps && typeof person.apps === 'object' && person.apps[appKey]) {
    return true;
  }
  
  // If person has nested profileData.apps, check that
  if (person.profileData?.apps && person.profileData.apps[appKey]) {
    return true;
  }
  
  // Otherwise, derive from person object directly
  // Get all participation fields for this app
  const participationFields = getParticipationFields(appKey);
  if (!participationFields || participationFields.length === 0) {
    return false;
  }
  
  // Check if any state field has a non-null value
  const stateFields = getStateFields(appKey);
  for (const fieldKey of stateFields) {
    const value = person[fieldKey];
    if (value !== null && value !== undefined && value !== '') {
      return true;
    }
  }
  
  // SALES: use getParticipation abstraction instead of person.type
  if (appKey === 'SALES') {
    return getParticipation(person, 'SALES') != null;
  }
  
  return false;
}

/**
 * Get participation data from profileData.apps structure
 * Accepts either:
 * - profileData object with apps property
 * - person object directly
 */
function getParticipationData(person) {
  // If person has profileData structure (composed format), use profileData.apps
  if (person.apps && typeof person.apps === 'object') {
    return person.apps;
  }
  
  // If person has nested profileData property, use that
  if (person.profileData?.apps) {
    return person.profileData.apps;
  }
  
  // Otherwise, derive from person object directly (fallback for raw person records)
  const participations = {};
  for (const appKey of knownAppKeys) {
    if (participatesInApp(person, appKey)) {
      // Build app section structure - use getParticipation for SALES, never person.type
      const fields = {};
      const participationFields = getParticipationFields(appKey);
      const part = appKey === 'SALES' ? getParticipation(person, 'SALES') : null;

      participationFields.forEach(fieldKey => {
        let value;
        if (appKey === 'SALES' && isPeopleSalesRoleFieldKey(fieldKey)) {
          value = part?.role ?? null;
        } else {
          value = person[fieldKey];
        }
        if (value !== null && value !== undefined && value !== '') {
          fields[fieldKey] = value;
        }
      });
      
      participations[appKey] = {
        appKey,
        fields
      };
    }
  }
  
  return participations;
}

// Get all participating apps
const participatingApps = computed(() => {
  const apps = [];
  
  // Get participation data (either from profileData.apps or derived from person)
  const participationData = getParticipationData(props.person);
  
  // Process each participating app
  for (const [appKey, appSection] of Object.entries(participationData)) {
    const fields = appSection.fields || {};
    const stateFields = getStateFields(appKey);
    
    // Get primary state (first state field with value)
    let primaryState = null;
    let secondaryState = null;
    
    for (const fieldKey of stateFields) {
      const value = fields[fieldKey];
      if (value !== null && value !== undefined && value !== '') {
        const metadata = getFieldMetadata(fieldKey);
        const label = formatStateLabel(fieldKey, value);
        const state = {
          type: getStateType(appKey, fieldKey, value),
          label,
          color:
            fieldKey === 'lead_status' || fieldKey === 'contact_status'
              ? getPeoplePicklistColor(peopleModuleFields.value, fieldKey, value)
              : null,
        };
        
        if (!primaryState) {
          primaryState = state;
        } else if (!secondaryState) {
          secondaryState = state;
          break; // Only need two states
        }
      }
    }
    
    // Get participation type (e.g., 'Lead', 'Contact')
    const participationType = normalizeParticipationType(fields.sales_type);
    
    // Get participation actions
    const participationActions = getParticipationActions(appKey, participationType);
    const actions = [];
    
    // Add Edit action
    if (appSection.canEdit !== false) {
      actions.push({
        label: 'Edit details',
        actionType: 'edit',
        disabled: false
      });
    }
    
    // Add Convert action if applicable
    if (appKey === 'SALES' && participationType === 'Lead') {
      const lifecyclePermissionKey = PEOPLE_PERMISSIONS.LIFECYCLE.SALES || PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
      if (hasPeoplePermission(lifecyclePermissionKey, authStore)) {
        actions.push({
          label: 'Convert to Contact',
          actionType: 'convert',
          disabled: false
        });
      }
    }
    
    // Add Detach action if allowed
    if (isDetachAllowed(appKey)) {
      const lifecyclePermissionKey = PEOPLE_PERMISSIONS.LIFECYCLE[appKey] || PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
      if (hasPeoplePermission(lifecyclePermissionKey, authStore)) {
        actions.push({
          label: `Detach from ${getAppDisplayName(appKey)}`,
          actionType: 'detach',
          disabled: false
        });
      }
    }
    
      apps.push({
      appKey,
      appName: getAppDisplayName(appKey),
      appIcon: appIcons[appKey] || '📄',
      participationType: participationType || null,
      primaryState,
      secondaryState,
      lastActivity: null, // TODO: Get from activity log if needed
      actions
    });
  }
  
  return apps;
});

// Get non-participating apps (for Attach CTAs)
const nonParticipatingApps = computed(() => {
  const apps = [];
  const participationData = getParticipationData(props.person);
  
  for (const appKey of knownAppKeys) {
    // Check if app exists in participation data
    if (!participationData[appKey]) {
      apps.push({
        appKey,
        appName: getAppDisplayName(appKey),
        appIcon: appIcons[appKey] || '📄'
      });
    }
  }
  
  return apps;
});

// Format state label for display
function formatStateLabel(fieldKey, value) {
  // For SALES app, format role + status
  if (isPeopleSalesRoleFieldKey(fieldKey)) {
    return value; // 'Lead' or 'Contact'
  }
  if (fieldKey === 'lead_status') {
    return `Lead: ${value}`;
  }
  if (fieldKey === 'contact_status') {
    return `Contact: ${value}`;
  }
  
  // Default: use field key + value
  return `${fieldKey}: ${value}`;
}

// Get state badge type (for styling)
function getStateType(appKey, fieldKey, value) {
  // SALES app specific
  if (appKey === 'SALES') {
    if (isPeopleSalesRoleFieldKey(fieldKey)) {
      return value === 'Contact' ? 'success' : 'info';
    }
    if (fieldKey === 'contact_status') {
      return value === 'DoNotContact' ? 'danger' : 'success';
    }
    if (fieldKey === 'lead_status') {
      return 'info';
    }
  }
  
  // Default
  return 'info';
}

// Get state badge CSS classes
function getStateBadgeClass(type) {
  const classMap = {
    'info': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    'success': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    'danger': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    'warning': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
  };
  return classMap[type] || classMap.info;
}

// Handle action click
function handleAction(action, appKey) {
  switch (action.actionType) {
    case 'edit':
      emit('edit', appKey);
      break;
    case 'convert':
      emit('convert', appKey);
      break;
    case 'detach':
      emit('detach', appKey);
      break;
  }
}

// Handle attach click
function handleAttach(appKey) {
  emit('attach', appKey);
}

// Toggle actions menu
function toggleActions(appKey) {
  openActionsMenu.value = openActionsMenu.value === appKey ? null : appKey;
}

// Close actions menu
function closeActionsMenu() {
  openActionsMenu.value = null;
}

const vClickOutside = clickOutside;
</script>
