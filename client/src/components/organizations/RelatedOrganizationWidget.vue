<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Related Organizations</h3>
      <button
        v-if="!organization"
        @click="$emit('link-organization')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Link Organization"
      >
        <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Organization Details -->
    <div v-if="organization" class="space-y-3">
      <div
        @click="$emit('view-organization', organization._id)"
        class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
      >
        <!-- Organization Name -->
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white truncate mb-2">{{ organization.name }}</h4>
        
        <!-- Key Fields -->
        <div v-if="keyFields.length > 0" class="flex flex-wrap gap-x-4 gap-y-1 mb-2">
          <div
            v-for="fieldDef in keyFields"
            :key="fieldDef.key"
            class="flex flex-col"
          >
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ fieldDef.label }}
            </div>
            <div class="text-xs text-gray-900 dark:text-white">
              <template v-if="getFieldValue(fieldDef, organization)">
                {{ getFieldValue(fieldDef, organization) }}
              </template>
              <span v-else class="text-gray-400 dark:text-gray-500 italic">Empty</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No organization linked</p>
      <button
        @click="$emit('link-organization')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Link organization
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';

const props = defineProps({
  organization: {
    type: Object,
    default: null
  },
  moduleDefinition: {
    type: Object,
    required: false
  }
});

defineEmits(['view-organization', 'link-organization', 'unlink-organization']);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const formatWebsite = (website) => {
  if (!website) return '';
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }
  return `https://${website}`;
};
</script>

