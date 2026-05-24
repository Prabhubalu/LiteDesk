<template>
  <div class="related-record-section border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
    <!-- Header - Collapsible -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between transition-colors"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <!-- Expand/Collapse Icon -->
        <ChevronRightIcon
          :class="[
            'w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0',
            isExpanded ? 'transform rotate-90' : ''
          ]"
        />
        
        <!-- Relationship Label -->
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {{ relationshipLabel }}
        </h3>
        
        <!-- Count -->
        <span class="text-xs text-gray-500 dark:text-gray-400">
          ({{ recordCount }})
        </span>
        
        <!-- Cardinality Hint -->
        <span
          v-if="cardinalityHint"
          class="text-xs text-gray-400 dark:text-gray-500"
          :title="`Cardinality: ${relationship.cardinality || 'many-to-many'}`"
        >
          {{ cardinalityHint }}
        </span>
        
        <!-- Phase 2E: Required Badge -->
        <span
          v-if="relationship.required && !relationship.requiredSatisfied"
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
        >{{ t('settings.coreModDetailRequired') }}</span>
        
        <!-- Phase 2E: Required Relationship Info Hint (non-blocking) -->
        <span
          v-if="relationship.required && !relationship.requiredSatisfied"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
          :title="`This record requires a linked ${relationshipLabel.toLowerCase()}`"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          This record requires a linked {{ relationshipLabel.toLowerCase() }}
        </span>
      </div>
    </button>
    
    <!-- Content - Collapsible -->
    <div v-if="isExpanded" class="p-4 space-y-2">
      <!-- Empty State -->
      <div v-if="recordCount === 0" class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
        <p>No {{ relationshipLabel.toLowerCase() }} linked</p>
      </div>
      
      <!-- Records List -->
      <div v-else class="space-y-2">
        <RelatedRecordRow
          v-for="record in records"
          :key="record.id || record._id"
          :record="record"
          :target-app-key="targetAppKey"
          :source-app-key="sourceAppKey"
          :show-app-badge="isCrossApp"
          :is-disabled="isAccessDenied(record)"
          :disabled-tooltip="getDisabledTooltip(record)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import RelatedRecordRow from './RelatedRecordRow.vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  relationship: {
    type: Object,
    required: true
  },
  sourceAppKey: {
    type: String,
    default: 'SALES'
  },
  // Access control - determine if record access is denied
  isAccessDenied: {
    type: Function,
    default: () => false
  },
  getDisabledTooltip: {
    type: Function,
    default: () => 'Access denied'
  }
});

const { t } = useI18n();

const route = useRoute();
const isExpanded = ref(true); // Default expanded

// Computed properties
const relationshipLabel = computed(() => {
  return props.relationship.label || 
         props.relationship.ui?.label || 
         props.relationship.relationshipKey || 
         'Related Records';
});

const targetAppKey = computed(() => {
  return props.relationship.target?.appKey?.toUpperCase() || 'SALES';
});

const records = computed(() => {
  return props.relationship.records || props.relationship.linkedRecords || [];
});

const recordCount = computed(() => records.value.length);

const cardinalityHint = computed(() => {
  const cardinality = props.relationship.cardinality || '';
  
  if (cardinality.includes('one-to-one') || cardinality === 'ONE_TO_ONE') {
    return 'One';
  }
  if (cardinality.includes('many-to-many') || cardinality === 'MANY_TO_MANY') {
    return 'Many';
  }
  if (cardinality.includes('one-to-many') || cardinality === 'ONE_TO_MANY') {
    // Determine direction
    const direction = props.relationship.direction || 'SOURCE';
    if (direction === 'SOURCE') {
      return 'Many'; // Source has many targets
    }
    return 'One'; // Target has one source
  }
  
  return null;
});

const isCrossApp = computed(() => {
  const normalizedSource = props.sourceAppKey?.toUpperCase() || 'SALES';
  const normalizedTarget = targetAppKey.value?.toUpperCase() || 'SALES';
  return normalizedSource !== normalizedTarget;
});

// Default collapsed if empty (unless required)
watch([recordCount, () => props.relationship.required], ([count, required]) => {
  if (count === 0 && !required) {
    isExpanded.value = false;
  } else if (count > 0) {
    isExpanded.value = true;
  }
}, { immediate: true });
</script>

<style scoped>
.related-record-section {
  @apply transition-all duration-200;
}
</style>

