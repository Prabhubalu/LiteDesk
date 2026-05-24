<template>
    <div
      :class="[
        'related-record-row',
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        (isDisabled || isBroken)
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 cursor-pointer group'
      ]"
      @click="handleOpenRecord"
    >
    <div class="flex-1 min-w-0">
      <!-- Primary Label -->
      <div class="flex items-center gap-2">
        <p
          :class="[
            'text-sm font-medium truncate',
            isDisabled
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-900 dark:text-white'
          ]"
        >
          {{ recordLabel }}
        </p>
        
        <!-- Phase 2E: Projection-Aware Label with App Context -->
        <!-- Example: "Deal (Sales)" ↔ "Project (Projects)" -->
        <span
          v-if="projectionAwareLabel"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300"
        >
          {{ projectionAwareLabel }}
        </span>
        
        <!-- App Badge (if cross-app and no projection label) -->
        <span
          v-else-if="shouldShowAppBadge"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          {{ targetAppKey }}
        </span>
        
        <!-- Phase 2C: Projection Type Badge (if available) -->
        <span
          v-if="projectionTypeLabel"
          :class="projectionTypeBadgeClass"
        >
          {{ projectionTypeLabel }}
        </span>
        
        <!-- Status Badge -->
        <span
          v-if="recordStatus"
          :class="getStatusBadgeClass(recordStatus)"
        >
          {{ recordStatus }}
        </span>
      </div>
      
      <!-- Secondary Text -->
      <p
        v-if="recordSecondaryText"
        class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate"
      >
        {{ recordSecondaryText }}
      </p>
    </div>
    
    <!-- Open Action -->
    <div class="ml-4 flex-shrink-0">
      <button
        v-if="!isDisabled"
        @click.stop="handleOpenRecord"
        class="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded"
        :title="`Open ${recordLabel} in ${targetAppKey}`"
      >
        <ArrowTopRightOnSquareIcon class="w-4 h-4" />
      </button>
      <div
        v-else
        class="p-1.5"
        :title="disabledTooltip"
      >
        <LockClosedIcon class="w-4 h-4 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { ArrowTopRightOnSquareIcon, LockClosedIcon } from '@heroicons/vue/24/outline';
import { useTabs } from '@/composables/useTabs';
import { getRecordLabel, getRecordSecondaryText } from '@/utils/recordDisplay';
import { useRoute } from 'vue-router';
import { getProjectionTypeLabel, getProjectionTypeBadgeClass, getAppLabel } from '@/utils/projectionLabels';

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  targetAppKey: {
    type: String,
    required: true
  },
  sourceAppKey: {
    type: String,
    default: 'SALES'
  },
  // Whether to show app badge (for cross-app relationships)
  showAppBadge: {
    type: Boolean,
    default: false
  },
  // Access denied state
  isDisabled: {
    type: Boolean,
    default: false
  },
  disabledTooltip: {
    type: String,
    default: 'Access denied'
  }
});

const { t } = useI18n();

const route = useRoute();
const { openTab } = useTabs();

// Computed properties
// Phase 2E: Handle broken relationship states gracefully
const recordLabel = computed(() => {
  // If record is marked as broken, show placeholder
  if (props.record._isBroken) {
    return props.record.label || 'Related record unavailable';
  }
  return getRecordLabel(props.record);
});

const recordSecondaryText = computed(() => {
  // If record is broken, show error message
  if (props.record._isBroken) {
    return props.record.secondaryText || 'Record may have been deleted or access denied';
  }
  return getRecordSecondaryText(props.record);
});

const recordStatus = computed(() => props.record.status || props.record.executionStatus || props.record.reviewStatus);

// Phase 2E: Always disable broken records
const isBroken = computed(() => props.record._isBroken === true);

// Phase 2E: Projection-aware label with app context
// Example: "Deal (Sales)" ↔ "Project (Projects)"
const projectionAwareLabel = computed(() => {
  // Check if we have projection metadata
  const projection = props.record.projection;
  if (!projection) return null;
  
  const currentType = projection.currentType;
  const appKey = projection.appKey || props.targetAppKey || 'SALES';
  const basePrimitive = projection.basePrimitive;
  
  // If we have a currentType, show projection-aware label
  if (currentType && basePrimitive) {
    const typeLabel = getProjectionTypeLabel(currentType, appKey);
    const appLabel = getAppLabel(appKey);
    return `${typeLabel} (${appLabel})`;
  }
  
  // Fallback: show module label with app if cross-app
  if (shouldShowAppBadge.value) {
    const moduleLabel = props.record.moduleKey || 'Record';
    const appLabel = getAppLabel(appKey);
    return `${moduleLabel} (${appLabel})`;
  }
  
  return null;
});

// Phase 2C: Projection type label and badge (if record has projection metadata)
const projectionTypeLabel = computed(() => {
  // Check if record has projection metadata (from record context)
  if (!props.record.projection?.currentType) return null;
  const currentType = props.record.projection.currentType;
  const appKey = props.record.projection.appKey || props.targetAppKey || 'SALES';
  return getProjectionTypeLabel(currentType, appKey);
});

const projectionTypeBadgeClass = computed(() => {
  if (!props.record.projection?.currentType) return '';
  const currentType = props.record.projection.currentType;
  const appKey = props.record.projection.appKey || props.targetAppKey || 'SALES';
  return getProjectionTypeBadgeClass(currentType, appKey);
});

// Determine if we should show app badge (cross-app relationship)
const shouldShowAppBadge = computed(() => {
  if (!props.showAppBadge) return false;
  const normalizedSource = props.sourceAppKey?.toUpperCase() || 'SALES';
  const normalizedTarget = props.targetAppKey?.toUpperCase() || 'SALES';
  return normalizedSource !== normalizedTarget;
});

// Get status badge class
const getStatusBadgeClass = (status) => {
  if (!status) return '';
  
  const normalizedStatus = String(status).toLowerCase();
  
  // Status-based styling
  if (normalizedStatus.includes('approved') || normalizedStatus.includes('completed') || normalizedStatus === 'submitted') {
    return 'px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  }
  if (normalizedStatus.includes('pending') || normalizedStatus.includes('in progress') || normalizedStatus.includes('in_progress')) {
    return 'px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
  }
  if (normalizedStatus.includes('rejected') || normalizedStatus.includes('cancelled')) {
    return 'px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  
  // Default badge
  return 'px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
};

// Get current app context from route
const getCurrentAppKey = () => {
  const path = route.path.toLowerCase();
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  return 'SALES';
};

// Handle opening record
// Phase 1B: Navigation rules:
// - Sales: Full navigation allowed
// - Audit App: Read-only visibility, disable navigation (no route push)
// - Portal App: Indirect visibility only, never allow direct navigation
// Phase 2E: Never allow navigation for broken records
const handleOpenRecord = () => {
  if (props.isDisabled || isBroken.value) return;
  
  const currentAppKey = getCurrentAppKey();
  const recordAppKey = (props.targetAppKey || 'SALES').toUpperCase();
  
  // Phase 1B: Navigation rules enforcement
  // Audit App: Can view but cannot navigate to Sales records directly
  if (currentAppKey === 'AUDIT') {
    if (recordAppKey === 'SALES') {
      // Read-only: Navigation to Sales records not available from Audit App
      console.log('[RelatedRecordRow] Navigation disabled: Audit App cannot navigate to Sales records');
      return;
    }
    // Audit App cannot access Portal records
    if (recordAppKey === 'PORTAL') {
      return;
    }
  }
  
  // Portal App: Indirect visibility only, never allow direct navigation
  if (currentAppKey === 'PORTAL') {
    // Portal cannot navigate to Sales or Audit directly
    console.log('[RelatedRecordRow] Navigation disabled: Portal App has indirect visibility only');
    return;
  }
  
  // Sales: Full navigation allowed
  const appKey = (props.targetAppKey || 'SALES').toLowerCase();
  const moduleKey = props.record.moduleKey || 'unknown';
  const recordId = props.record.id || props.record._id;
  
  if (!recordId) {
    console.warn('[RelatedRecordRow] Cannot open record: missing ID');
    return;
  }
  
  // Build path - respect app boundaries
  let path = '';
  
  // Phase 0I.2: Special handling for responses
  if (moduleKey === 'responses' || moduleKey === 'formresponse' || moduleKey === 'formresponses') {
    path = `/responses/${recordId}`;
  } else if (appKey !== 'sales') {
    // For cross-app navigation, use full path
    path = `/${appKey}/${moduleKey}/${recordId}`;
  } else {
    // For Sales, use module route directly
    path = `/${moduleKey}/${recordId}`;
  }
  
  openTab(path, {
    title: recordLabel.value,
    icon: 'document',
    insertAdjacent: true
  });
};
</script>

<style scoped>
.related-record-row {
  @apply transition-all duration-150;
}
</style>

