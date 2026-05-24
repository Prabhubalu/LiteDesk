<template>
  <div class="related-records-panel">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.relatedRecordsPanelLoadingRelatedRecords') }}</p>
      </div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <div class="flex items-start gap-2">
        <ExclamationCircleIcon class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-300">{{ t('records.relatedRecordsPanelErrorLoadingRelatedRecords') }}</p>
          <p class="text-xs text-red-600 dark:text-red-400 mt-1">{{ error.message || 'Unknown error' }}</p>
        </div>
      </div>
    </div>
    
    <!-- Empty State: no relationships configured -->
    <div v-else-if="!hasRelationships" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
      <p>{{ t('records.relatedRecordsPanelNoRelationshipsConfiguredForThisRecord') }}</p>
    </div>
    
    <!-- Empty State: relationships exist but no records linked yet -->
    <div
      v-else-if="!hasAnyLinkedRecords"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <LinkIcon class="w-6 h-6 text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ t('records.relatedEmpty') }}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('records.relatedRecordsPanelLinkThisRecordToPeopleOrganizations') }}</p>
    </div>
    
    <!-- Relationships List -->
    <div v-else class="space-y-3">
      <!-- Phase 2E: Required Relationship Hints (non-blocking, shown at top) -->
      <div
        v-if="unsatisfiedRequired.length > 0"
        class="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
      >
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-blue-900 dark:text-blue-300">{{ t('records.relatedRecordsPanelRequiredRelationships') }}</p>
            <p class="text-xs text-blue-700 dark:text-blue-400 mt-1">{{ t('records.relatedRecordsPanelThisRecordRequiresTheFollowingRelationships') }}</p>
            <ul class="mt-2 space-y-1">
              <li
                v-for="rel in unsatisfiedRequired"
                :key="rel.relationshipKey"
                class="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                {{ rel.label || rel.ui?.label || rel.relationshipKey }}
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <RelatedRecordSection
        v-for="relationship in sortedRelationships"
        :key="relationship.relationshipKey"
        :relationship="relationship"
        :source-app-key="appKey"
        :is-access-denied="checkAccessDenied"
        :get-disabled-tooltip="getDisabledTooltip"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, onMounted, watch } from 'vue';
import { ExclamationCircleIcon, LinkIcon } from '@heroicons/vue/24/outline';
import { useRecordContext } from '@/composables/useRecordContext';
import RelatedRecordSection from './RelatedRecordSection.vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  appKey: {
    type: String,
    required: true
  },
  moduleKey: {
    type: String,
    required: true
  },
  recordId: {
    type: [String, Object],
    required: true
  },
  // Read-only mode (always true for Phase 0F.1)
  readOnly: {
    type: Boolean,
    default: true
  },
  // Context app key for access resolution (current app)
  contextAppKey: {
    type: String,
    default: null // If null, uses appKey
  }
});

const { t } = useI18n();

const route = useRoute();

// Get current app context from route (for navigation rules)
const getCurrentAppKey = () => {
  const path = route.path.toLowerCase();
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  return 'SALES';
};

// Use record context composable
// Ensure props are converted to functions that return values
const {
  loading,
  error,
  context,
  relatedGroups,
  load
} = useRecordContext(
  () => String(props.appKey || 'SALES'),
  () => String(props.moduleKey || 'unknown'),
  () => props.recordId
);

// Get effective app key for access resolution
// Phase 1B: Use current app context if contextAppKey not provided
const effectiveAppKey = computed(() => {
  if (props.contextAppKey) return props.contextAppKey;
  // Infer from route if not provided
  return getCurrentAppKey();
});

// Check if we have any relationships
const hasRelationships = computed(() => {
  if (!context.value || !context.value.relationships) return false;
  return context.value.relationships.length > 0;
});

// Check if any relationship has linked records (for empty state when none linked)
const hasAnyLinkedRecords = computed(() => {
  if (!context.value || !context.value.relationships) return false;
  return context.value.relationships.some((rel) => {
    const records = rel.records || rel.linkedRecords || [];
    return Array.isArray(records) && records.length > 0;
  });
});

// Normalize platform cardinality (e.g. MANY_TO_ONE) to lowercase type (many_to_one) once.
function normalizeCardinality(cardinality) {
  if (!cardinality) return undefined;
  const key = String(cardinality).toUpperCase().replace(/-/g, '_');
  const map = {
    MANY_TO_ONE: 'many_to_one',
    ONE_TO_MANY: 'one_to_many',
    ONE_TO_ONE: 'one_to_one',
    MANY_TO_MANY: 'many_to_many'
  };
  return map[key];
}

// Normalize relationships once: ensure rel.type is set from type or cardinality so UI only checks rel.type.
// Fallback to 'unknown' when nothing resolves so malformed relationships are easier to debug.
const normalizedRelationships = computed(() => {
  if (!context.value || !context.value.relationships) return [];
  return context.value.relationships.map((rel) => ({
    ...rel,
    type: rel.type ?? normalizeCardinality(rel.cardinality) ?? rel.relationshipType ?? 'unknown'
  }));
});

// Get all relationships (flatten from groups).
// Hide reverse (TARGET) list only for empty lookup-style N:1 groups.
// If there are linked records, keep it visible so users can see existing links.
const allRelationships = computed(() => {
  return normalizedRelationships.value.filter((rel) => {
    const records = Array.isArray(rel.records)
      ? rel.records
      : (Array.isArray(rel.linkedRecords) ? rel.linkedRecords : []);
    const hideReverse =
      rel.direction === 'TARGET' &&
      rel.type === 'many_to_one' &&
      rel.isLookup === true &&
      records.length === 0;
    return !hideReverse;
  });
});

// Phase 2E: Get unsatisfied required relationships for hints
const unsatisfiedRequired = computed(() => {
  if (!context.value || !context.value.relationships) return [];
  return context.value.relationships.filter(
    rel => rel.required && !rel.requiredSatisfied
  );
});

// Sort relationships by sidebarOrder or relationship metadata
const sortedRelationships = computed(() => {
  const relationships = [...allRelationships.value];
  
  return relationships.sort((a, b) => {
    // Sort by required first (required relationships at top)
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    
    // Then by sidebarOrder if available
    const orderA = a.ui?.sidebarOrder ?? a.sidebarOrder ?? 999;
    const orderB = b.ui?.sidebarOrder ?? b.sidebarOrder ?? 999;
    
    if (orderA !== orderB) return orderA - orderB;
    
    // Finally by label alphabetically
    const labelA = (a.label || a.ui?.label || a.relationshipKey || '').toLowerCase();
    const labelB = (b.label || b.ui?.label || b.relationshipKey || '').toLowerCase();
    
    return labelA.localeCompare(labelB);
  });
});

// Check if navigation is disabled for a record
// Phase 1B: Navigation rules enforcement
// - Sales: Full navigation allowed (not disabled)
// - Audit App: Read-only visibility (can view but navigation disabled)
// - Portal App: Indirect visibility only (always disabled for navigation)
const checkAccessDenied = (record) => {
  if (!record) return true;
  
  const recordAppKey = (record.appKey || 'SALES').toUpperCase();
  const currentAppKey = effectiveAppKey.value.toUpperCase();
  
  // Phase 1B: Navigation rules based on app context
  // Audit App → read-only visibility (can view but not navigate)
  if (currentAppKey === 'AUDIT') {
    // Audit App can view Sales records but cannot navigate to them directly
    // Return true to disable navigation (show lock icon)
    if (recordAppKey === 'SALES') {
      return true; // Disabled for navigation (read-only)
    }
    // Audit App cannot access Portal records
    if (recordAppKey === 'PORTAL') {
      return true; // Denied
    }
  }
  
  // Portal App → indirect visibility only (can see linked data but no navigation)
  if (currentAppKey === 'PORTAL') {
    // Portal cannot navigate to Sales or Audit directly
    // Always disabled for navigation (but can view)
    return true; // Disabled for navigation
  }
  
  // Sales → full visibility and navigation
  if (currentAppKey === 'SALES') {
    // Sales can access its own records
    if (recordAppKey === 'SALES') {
      return false; // Full access
    }
    // Sales can view and navigate to Audit/Portal records
    return false; // Allow access
  }
  
  // Default: allow access
  return false;
};

// Get disabled tooltip message
// Phase 1B: Tooltips for navigation restrictions
const getDisabledTooltip = (record) => {
  const recordAppKey = (record.appKey || 'SALES').toUpperCase();
  const currentAppKey = effectiveAppKey.value.toUpperCase();
  
  // Phase 1B: Navigation restriction messages
  if (currentAppKey === 'AUDIT') {
    if (recordAppKey === 'SALES') {
      return 'Read-only: Navigation to Sales records not available from Audit App';
    }
    if (recordAppKey === 'PORTAL') {
      return 'Access denied: Portal records not accessible from Audit App';
    }
  }
  
  if (currentAppKey === 'PORTAL') {
    return 'Read-only: Indirect visibility only. Navigation not available from Portal App';
  }
  
  return 'Access denied';
};

// Load context on mount
onMounted(() => {
  load();
});

// Reload when props change
watch([() => props.appKey, () => props.moduleKey, () => props.recordId], () => {
  load(true);
}, { deep: true });
</script>

<style scoped>
.related-records-panel {
  @apply w-full;
}
</style>

