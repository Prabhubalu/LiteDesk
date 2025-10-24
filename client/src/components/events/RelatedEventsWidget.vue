<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
        <div class="flex items-start gap-2">
          <div
            :style="{ backgroundColor: event.color }"
            class="w-1 h-full rounded-full flex-shrink-0 mt-1"
          ></div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ event.title }}</h4>
              <span :class="getStatusBadgeClass(event.status)">{{ event.status }}</span>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatDate(event.startDate) }}
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ formatTime(event.startDate) }}
              </span>
              <span v-if="event.type" class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                {{ event.type }}
              </span>
            </div>
            <!-- Show related record if it's a rollup event -->
            <div v-if="event.relatedTo && showRelatedInfo(event)" class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{{ event.relatedTo.type }}: {{ getRelatedName(event.relatedTo.id) }}</span>
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
import { ref, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';

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
  }
});

defineEmits(['create-event', 'view-event']);

const events = ref([]);
const loading = ref(false);

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

