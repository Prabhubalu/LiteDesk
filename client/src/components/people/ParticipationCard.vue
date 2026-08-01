<template>
  <div class="relative">
    <SurfaceCard>
      <CardHeader
        :icon="appIcon"
        :title="appName"
        :subtitle="participationRole"
        icon-variant="primary"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <!-- Primary Action Button -->
            <PrimaryActionButton
              v-if="primaryAction"
              :label="primaryAction.label"
              :variant="primaryAction.variant || 'primary'"
              :icon="primaryAction.icon"
              :loading="primaryAction.loading"
              :disabled="primaryAction.disabled"
              @click="handlePrimaryAction"
            />
            
            <!-- Secondary Actions Menu -->
            <SecondaryActionMenu
              v-if="secondaryActions.length > 0"
              :actions="secondaryActions"
              @action="handleSecondaryAction"
            />
          </div>
        </template>
      </CardHeader>

      <!-- Card Content -->
      <div class="px-6 py-4">
        <!-- Current State/Status -->
        <div v-if="currentState" class="mb-4 relative" style="overflow: visible;">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.settingsBhFieldStatus') }}</span>
          </div>
          <div class="mt-2 relative" style="overflow: visible;">
            <StatusDropdown
              v-if="isSalesParticipation"
              :type="currentState.type"
              :label="currentState.label"
              :icon="true"
              :app-key="appKey"
              :participation-type="participationType"
              :current-status="currentStatusValue"
              :person-id="personId"
              :status-badge-id="`status-badge-${appKey}-${personId}`"
              :derived-status="appSection.fields?.derivedStatus || null"
              @status-updated="handleStatusUpdated"
            />
            <StatusFlag
              v-else
              :type="currentState.type"
              :label="currentState.label"
              :icon="true"
            />
          </div>
        </div>

      <!-- Additional Fields (gated behind collapsed state) -->
      <div v-if="hasAdditionalFields" class="mt-4">
        <!-- Toggle Button -->
        <button
          v-if="!showDetails"
          @click="showDetails = true"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
        >
          <span>{{ t('people.participationCardViewDetails') }}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Expanded Details -->
        <div v-else class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click="showDetails = false"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
            <span>{{ t('people.participationCardHideDetails') }}</span>
          </button>
          <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <template v-for="fieldKey in participationDetailFields" :key="fieldKey">
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatFieldLabel(fieldKey) }}
                </dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ displayFields[fieldKey] !== undefined ? formatFieldValue(fieldKey, displayFields[fieldKey]) : '—' }}
                </dd>
              </div>
            </template>
          </dl>
        </div>
      </div>

      <!-- Empty State Message -->
      <div v-if="!hasAdditionalFields && !currentState" class="text-sm text-gray-500 dark:text-gray-400 italic">{{ t('people.participationCardNoAdditionalInformationAvailable') }}</div>
      </div>
    </SurfaceCard>
  </div>
</template>

<script setup>
import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';
import { useI18n } from 'vue-i18n';
import SurfaceCard from '@/components/ui/SurfaceCard.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue';
import SecondaryActionMenu from '@/components/ui/SecondaryActionMenu.vue';
import StatusFlag from '@/components/ui/StatusFlag.vue';
import StatusDropdown from './StatusDropdown.vue';
import { getParticipationActions, normalizeParticipationType } from './participationActions';
import { isDetachAllowed } from './detachPolicy';
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { PEOPLE_PERMISSIONS } from '@/platform/permissions/peoplePermissions';
import { hasPeoplePermission } from '@/platform/permissions/peoplePermissionHelper';
import { getDetailFields, getFieldMetadata, PEOPLE_FIELD_METADATA } from '@/platform/fields/peopleFieldModel';
import {
  getPeopleSalesRoleValueFromFields,
  isPeopleSalesLeadFromFields,
} from '@/utils/peopleParticipationUi';

const props = defineProps({
  appKey: {
    type: String,
    required: true
  },
  appSection: {
    type: Object,
    required: true
  },
  personId: {
    validator: (v) => v === null || typeof v === 'string',
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['convert', 'edit', 'edit-details', 'view', 'create-deal', 'create-task', 'create-case', 'schedule-meeting', 'status-updated', 'detach']);

const authStore = useAuthStore();

// Collapsed state for additional fields (default: collapsed)
const showDetails = ref(false);

// App name mapping
const appNames = {
  'SALES': 'Sales',
  'HELPDESK': 'Helpdesk',
  'AUDIT': 'Audit',
  'PORTAL': 'Portal',
  'PROJECTS': 'Projects'
};

// App icon mapping (using emoji for simplicity)
const appIcons = {
  'SALES': '💼',
  'HELPDESK': '🎧',
  'AUDIT': '📋',
  'PORTAL': '🌐',
  'PROJECTS': '📁'
};

const appName = computed(() => {
  return appNames[props.appKey] || props.appKey;
});

const appIcon = computed(() => {
  return appIcons[props.appKey] || '📄';
});

// Participation role/type
const participationRole = computed(() => {
  const type = props.appSection.fields?.type;
  if (type) {
    return type;
  }
  
  // Fallback: determine from appKey and fields
  if (props.appKey === 'SALES') {
    return 'Participant';
  }
  if (props.appKey === 'HELPDESK') {
    return 'Contact';
  }
  if (props.appKey === 'AUDIT') {
    return 'Member';
  }
  if (props.appKey === 'PORTAL') {
    return 'User';
  }
  if (props.appKey === 'PROJECTS') {
    return 'Member';
  }
  
  return 'Participant';
});

// Participation type (normalized) — profile uses sales_type
const participationType = computed(() => {
  return normalizeParticipationType(getPeopleSalesRoleValueFromFields(props.appSection.fields || {}));
});

// Check if this is a Sales participation (for inline status editing)
const isSalesParticipation = computed(() => {
  return props.appKey === 'SALES' && 
         (participationType.value === 'Lead' || participationType.value === 'Contact');
});

// Current status value for StatusDropdown
const currentStatusValue = computed(() => {
  const fields = props.appSection.fields || {};
  if (participationType.value === 'Lead') {
    return fields.lead_status || null;
  } else if (participationType.value === 'Contact') {
    return fields.contact_status || null;
  }
  return null;
});

// Current state/status
const currentState = computed(() => {
  const fields = props.appSection.fields || {};
  
  // For SALES app
  if (props.appKey === 'SALES') {
    const pt = participationType.value;
    if (pt === 'Lead') {
      if (fields.lead_status) {
        return {
          type: 'info',
          label: `Lead: ${fields.lead_status}`
        };
      } else {
        // Show "No status" when status is missing (for inline editing)
        return {
          type: 'info',
          label: 'Lead: No status'
        };
      }
    }
    if (pt === 'Contact') {
      if (fields.contact_status) {
        return {
          type: fields.contact_status === 'DoNotContact' ? 'danger' : 'success',
          label: `Contact: ${fields.contact_status}`
        };
      } else {
        // Show "No status" when status is missing (for inline editing)
        return {
          type: 'success',
          label: 'Contact: No status'
        };
      }
    }
  }
  
  // For other apps, check for status fields
  if (fields.status) {
    return {
      type: 'info',
      label: fields.status
    };
  }
  
  return null;
});

/**
 * Get visibility rules for detail fields based on participation type
 * Reuses the same logic as AttachToAppModal for consistency
 */
const getVisibilityRules = (appKey) => {
  // For SALES app: Lead vs Contact
  if (appKey === 'SALES') {
    return {
      // When type === 'Lead': show Lead-specific detail fields
      'Lead': {
        // Pattern-based: fields starting with 'lead_' or 'qualification_' or specific Lead-related fields
        showPatterns: [
          (fieldName) => fieldName.startsWith('lead_'),
          (fieldName) => fieldName.startsWith('qualification_'),
          (fieldName) => fieldName === 'estimated_value',
          (fieldName) => fieldName === 'interest_products'
        ],
        // Hide Contact-specific detail fields
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
        // Hide Lead-specific detail fields
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
 * Check if a detail field should be visible based on participation type
 */
const isDetailFieldVisible = (fieldName) => {
  // If no participation type, show all detail fields
  if (!participationType.value) {
    return true;
  }
  
  // Get visibility rules for current app
  const rules = getVisibilityRules(props.appKey);
  const typeValue = participationType.value;
  
  // If no rules for this type value, show the field (default behavior)
  if (!rules[typeValue]) {
    return true;
  }
  
  const rule = rules[typeValue];
  
  // Check if field matches any hide pattern
  if (rule.hidePatterns && rule.hidePatterns.some(pattern => pattern(fieldName))) {
    return false;
  }
  
  // Check if field matches any show pattern
  if (rule.showPatterns && rule.showPatterns.some(pattern => pattern(fieldName))) {
    return true;
  }
  
  // If show patterns exist but field doesn't match any, hide it (strict mode)
  // This ensures only relevant fields are shown
  if (rule.showPatterns && rule.showPatterns.length > 0) {
    return false;
  }
  
  // Default: show the field if no explicit rule
  return true;
};

// Get participation detail fields from field model (canonical source)
// Filter by visibility based on participation type (Lead vs Contact)
const participationDetailFields = computed(() => {
  const allDetailFields = getDetailFields(props.appKey);
  // Filter to only include fields visible for current participation type
  return allDetailFields.filter(fieldName => isDetailFieldVisible(fieldName));
});

// Display fields - map participation detail fields cleanly using field model
// This ensures we show ALL participation detail fields that have values, mapped from field model
const displayFields = computed(() => {
  const fields = props.appSection.fields || {};
  const result = {};
  
  // Get visible participation detail fields for this app from field model (canonical source)
  // These are already filtered by participation type (Lead vs Contact)
  const detailFieldNames = participationDetailFields.value;
  
  // Debug: Log available fields
  if (process.env.NODE_ENV === 'development') {
    console.log('[ParticipationCard] Participation type:', participationType.value);
    console.log('[ParticipationCard] Visible detail fields for', props.appKey, ':', detailFieldNames);
    console.log('[ParticipationCard] Available fields in appSection:', Object.keys(fields));
  }
  
  // Map each visible detail field to its value from appSection.fields
  detailFieldNames.forEach(fieldName => {
    const value = fields[fieldName];
    // Include field if it has a value (null, undefined, empty string are excluded)
    // This ensures we only show fields that actually have data
    if (value !== null && value !== undefined && value !== '') {
      result[fieldName] = value;
    }
  });
  
  // Debug: Log mapped fields
  if (process.env.NODE_ENV === 'development') {
    console.log('[ParticipationCard] Mapped display fields:', Object.keys(result));
  }
  
  return result;
});

const hasAdditionalFields = computed(() => {
  // Show "View details" if there are any visible detail fields for this participation type
  // This ensures the button appears even if fields are empty
  return participationDetailFields.value.length > 0;
});

const shouldDisplayField = (fieldKey, value) => {
  if (value === null || value === undefined || value === '') return false;
  return true;
};

const formatFieldLabel = (fieldKey) => {
  // Use field metadata if available for proper label
  const metadata = getFieldMetadata(fieldKey);
  if (metadata) {
    // Convert snake_case to Title Case for display
    return fieldKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Fallback: format field key
  return fieldKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatFieldValue = (fieldKey, value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  // Handle arrays - format each item, never show raw
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map((item) => formatFieldValue(fieldKey, item)).join(', ');
  }
  
  // Handle objects (shouldn't happen for detail fields, but handle gracefully)
  if (typeof value === 'object') {
    // If it's a populated reference (has _id or name), show the name
    if (value.name) return value.name;
    if (value.firstName || value.lastName) {
      return `${value.firstName || ''} ${value.lastName || ''}`.trim();
    }
    if (value.title) return value.title;
    if (value.label) return value.label;
    if (value.email) return value.email;
    if (value.username) return value.username;
    // Never show raw JSON or ObjectId
    return '—';
  }
  
  // Handle date fields (explicit list + any ISO date string)
  const dateFields = ['birthday', 'qualification_date'];
  const isDateField = dateFields.includes(fieldKey) || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value.trim()));
  if (isDateField) {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      const isDateTime = typeof value === 'string' && value.includes('T');
      return isDateTime
        ? formatUserDateTime(date)
        : formatUserDate(date);
    } catch (e) {
      return String(value);
    }
  }
  
  // Handle enum fields with proper display values
  if (fieldKey === 'role') {
    // Role enum values are already human-readable
    return String(value);
  }
  
  if (fieldKey === 'preferred_contact_method') {
    // Preferred contact method enum values are already human-readable
    return String(value);
  }
  
  // Handle numeric fields
  if (typeof value === 'number') {
    if (fieldKey === 'lead_score' || fieldKey === 'estimated_value') {
      return formatUserDateTime(value);
    }
    return String(value);
  }
  
  // Never show raw ObjectIds
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())) {
    return '—';
  }

  // Default: return as string
  return String(value);
};

// Get participation actions from action map
const participationActions = computed(() => {
  const fields = props.appSection.fields || {};
  const normalizedType = normalizeParticipationType(getPeopleSalesRoleValueFromFields(fields));

  // Get contextual actions from participation action map
  const actions = getParticipationActions(props.appKey, normalizedType);
  
  if (actions) {
    return actions;
  }
  
  // Fallback: Use default actions if no contextual actions defined
  const fallbackActions = {
    primary: null,
    secondary: []
  };
  
  // Convert Lead to Contact (for SALES Lead) - special case
  if (props.appKey === 'SALES' && isPeopleSalesLeadFromFields(fields)) {
    fallbackActions.primary = {
      label: 'Convert to Contact',
      variant: 'secondary',
      icon: 'convert',
      handler: () => emit('convert', props.appKey)
    };
    
    // Add Edit as secondary if canEdit
    if (props.appSection.canEdit) {
      fallbackActions.secondary.push({
        label: 'Edit',
        icon: 'edit',
        handler: () => emit('edit', props.appKey),
        disabled: false
      });
    }
  } else if (props.appSection.canEdit) {
    // Edit participation as primary if canEdit
    fallbackActions.primary = {
      label: 'Edit participation',
      variant: 'primary',
      icon: 'edit',
      handler: () => emit('edit', props.appKey)
    };
  } else {
    // View details as primary if read-only
    fallbackActions.primary = {
      label: 'View details',
      variant: 'secondary',
      icon: null,
      handler: () => emit('view', props.appKey)
    };
  }
  
  return fallbackActions;
});

// Primary Action (from participation actions or fallback)
const primaryAction = computed(() => {
  if (!participationActions.value.primary) return null;
  
  const action = participationActions.value.primary;
  
  // Gate Convert action by lifecycle permission
  if (action.actionType === 'convert') {
    const permissionKey = props.appKey === 'SALES' 
      ? PEOPLE_PERMISSIONS.LIFECYCLE.SALES 
      : PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
    if (!hasPeoplePermission(permissionKey, authStore)) {
      return null; // Hide Convert CTA if no permission
    }
  }
  
  // Map action type to handler
  const handlerMap = {
    'create-deal': () => emit('create-deal', props.appKey, props.personId),
    'create-task': () => emit('create-task', props.appKey, props.personId),
    'create-case': () => emit('create-case', props.appKey, props.personId),
    'schedule-meeting': () => emit('schedule-meeting', props.appKey, props.personId),
    'convert': () => emit('convert', props.appKey),
    'edit': () => emit('edit', props.appKey),
    'view': () => emit('view', props.appKey)
  };
  
  return {
    label: action.label,
    variant: 'primary',
    icon: action.actionType === 'convert' ? 'convert' : action.actionType === 'edit' ? 'edit' : null,
    handler: handlerMap[action.actionType] || (() => {})
  };
});

// Secondary Actions (from participation actions or fallback)
const secondaryActions = computed(() => {
  const actions = [];
  
  // Get primary action type to exclude it from secondary
  const primaryActionType = participationActions.value.primary?.actionType;
  
  // Add secondary actions from participation action map
  // EXCLUDE convert action if it's the primary action (should never be in secondary)
  participationActions.value.secondary.forEach(action => {
    // Guardrail: Never add convert action to secondary if it's already primary
    if (action.actionType === 'convert' && primaryActionType === 'convert') {
      return; // Skip - convert should never be in secondary when it's primary
    }
    
    const handlerMap = {
      'create-deal': () => emit('create-deal', props.appKey, props.personId),
      'create-task': () => emit('create-task', props.appKey, props.personId),
      'create-case': () => emit('create-case', props.appKey, props.personId),
      'schedule-meeting': () => emit('schedule-meeting', props.appKey, props.personId),
      'convert': () => emit('convert', props.appKey),
      'edit': () => emit('edit', props.appKey),
      'view': () => emit('view', props.appKey)
    };
    
    actions.push({
      label: action.label,
      icon: action.actionType === 'edit' ? 'edit' : action.actionType === 'view' ? 'view' : null,
      handler: handlerMap[action.actionType] || (() => {}),
      disabled: false
    });
  });
  
  // Add Edit details action (secondary only, never primary)
  // Gate by EDIT_PARTICIPATION permission
  const editPermissionKey = PEOPLE_PERMISSIONS.EDIT_PARTICIPATION[props.appKey] || PEOPLE_PERMISSIONS.EDIT_PARTICIPATION.BASE;
  if (hasPeoplePermission(editPermissionKey, authStore)) {
    actions.push({
      label: 'Edit details',
      icon: 'edit',
      handler: () => emit('edit-details', props.appKey),
      disabled: false
    });
  }
  
  // Add View details if not already in secondary actions and not primary
  const hasViewDetails = actions.some(a => a.label === 'View details') || 
                         primaryAction.value?.label === 'View details';
  if (!hasViewDetails) {
    actions.push({
      label: 'View details',
      icon: 'view',
      handler: () => {
        // Expand the collapsed details section to show all sales-specific fields
        showDetails.value = true;
      },
      disabled: false
    });
  }
  
  // Add Detach action conditionally (only if allowed by policy AND user has lifecycle permission)
  // ⚠️ IMPORTANT: Detach is NEVER primary, always secondary
  // ⚠️ IMPORTANT: Only show if policy allows detachment AND user has lifecycle permission
  if (isDetachAllowed(props.appKey)) {
    const lifecyclePermissionKey = PEOPLE_PERMISSIONS.LIFECYCLE[props.appKey] || PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
    if (hasPeoplePermission(lifecyclePermissionKey, authStore)) {
      // Check if detach is already in actions (from participationActions)
      const hasDetach = actions.some(a => a.label === 'Detach from ' + appName.value || a.actionType === 'detach');
      if (!hasDetach) {
        actions.push({
          label: `Detach from ${appName.value}`,
          icon: 'detach',
          handler: () => emit('detach', props.appKey),
          disabled: false
        });
      }
    }
  }
  
  return actions;
});

const handlePrimaryAction = () => {
  if (primaryAction.value.handler) {
    primaryAction.value.handler();
  }
};

const handleSecondaryAction = (action) => {
  // Action handler is already called by SecondaryActionMenu
};

// Handle status update
const handleStatusUpdated = (updateData) => {
  // Emit to parent to refresh profile data
  emit('status-updated', updateData);
};
</script>

