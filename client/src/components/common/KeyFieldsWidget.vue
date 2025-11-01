<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Key Fields</h3>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
    </div>

    <!-- Key Fields List -->
    <div v-else-if="keyFields.length > 0" class="flex flex-wrap gap-x-4 gap-y-3">
      <div
        v-for="fieldDef in keyFields"
        :key="fieldDef.key"
        class="flex flex-col"
      >
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {{ fieldDef.label }}
        </div>
        <div class="text-sm text-gray-900 dark:text-white">
          <template v-if="getFieldValueForDisplay(fieldDef)">
            {{ getFieldValueForDisplay(fieldDef) }}
          </template>
          <span v-else class="text-gray-400 dark:text-gray-500 italic">Empty</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No key fields configured</p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Mark fields as "Key Field" in module settings</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  recordType: {
    type: String,
    required: true
  },
  moduleDefinition: {
    type: Object,
    required: true
  }
});

const loading = ref(false);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

// Get field value from record
const getFieldValueForDisplay = (fieldDef) => {
  return getFieldValue(fieldDef, props.record);
};
</script>

