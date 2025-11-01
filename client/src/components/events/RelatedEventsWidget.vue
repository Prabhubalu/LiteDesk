<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Related Events</h3>
      <button
        @click="$emit('create-event')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Add Event"
      >
        <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
    </div>

    <!-- Events List -->
    <div v-else-if="events.length > 0" class="space-y-2">
      <div
        v-for="event in events"
        :key="event._id"
        @click="$emit('view-event', event._id)"
        class="p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <!-- Event Title -->
        <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate mb-2">{{ event.title }}</h4>
        
        <!-- Key Fields -->
        <div v-if="keyFields.length > 0" class="flex flex-wrap gap-x-4 gap-y-1">
          <div
            v-for="fieldDef in keyFields"
            :key="fieldDef.key"
            class="flex flex-col"
          >
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ fieldDef.label }}
            </div>
            <div class="text-xs text-gray-900 dark:text-white">
              <template v-if="getFieldValue(fieldDef, event)">
                {{ getFieldValue(fieldDef, event) }}
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No events yet</p>
      <button
        @click="$emit('create-event')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Create first event
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';

const props = defineProps({
  relatedType: {
    type: String,
    required: true // 'Contact', 'Deal', 'Task', 'Organization'
  },
  relatedId: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    default: 5
  },
  moduleDefinition: {
    type: Object,
    required: false
  }
});

defineEmits(['create-event', 'view-event']);

const events = ref([]);
const loading = ref(false);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const fetchEvents = async () => {
  if (!props.relatedId) return;
  
  loading.value = true;
  try {
    const params = {
      relatedType: props.relatedType,
      relatedId: props.relatedId,
      limit: props.limit,
      sortBy: 'startDate',
      sortOrder: 'desc'
    };
    
    // For Contacts, include events from related Deals (rollup)
    if (props.relatedType === 'Contact') {
      params.includeRelated = 'true';
    }
    
    const response = await apiClient.get('/events', { params });
    
    if (response.success) {
      events.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching related events:', error);
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  return dateUtils.format(date, 'MMM D, YYYY');
};

const formatTime = (date) => {
  return dateUtils.format(date, 'h:mm A');
};

const getStatusBadgeClass = (status) => {
  const classes = {
    scheduled: 'px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs',
    completed: 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs',
    cancelled: 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs',
    rescheduled: 'px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs'
  };
  return classes[status] || classes.scheduled;
};

const showRelatedInfo = (event) => {
  // Show related info only if viewing from Contact and event is related to a Deal
  return props.relatedType === 'Contact' && event.relatedTo?.type === 'Deal';
};

const getRelatedName = (relatedRecord) => {
  if (!relatedRecord) return 'Unknown';
  // The populated field could have name, title, first_name, or last_name
  if (relatedRecord.name) return relatedRecord.name;
  if (relatedRecord.title) return relatedRecord.title;
  if (relatedRecord.first_name || relatedRecord.last_name) {
    return `${relatedRecord.first_name || ''} ${relatedRecord.last_name || ''}`.trim();
  }
  return 'Unnamed';
};

// Watch for prop changes
watch(() => props.relatedId, () => {
  fetchEvents();
}, { immediate: true });

// Expose refresh method
defineExpose({
  refresh: fetchEvents
});
</script>

