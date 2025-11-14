<template>
  <CardWidget title="Related Events" class="ld-card-group">
    <template #actions>
      <button
        @click="$emit('link-events')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Link Events"
      >
        <LinkIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        @click="$emit('create-event')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Add Event"
      >
        <PlusIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
      </div>

      <!-- Events List -->
      <div v-else-if="events.length > 0" class="space-y-2">
      <div
        v-for="event in events"
        :key="event._id"
        class="ld-record-card p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Left icon -->
          <div class="shrink-0 mt-0.5">
            <CalendarIcon class="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <!-- Content -->
          <div class="min-w-0 flex-1" @click="$emit('view-event', event._id)">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">{{ event.eventName || event.title }}</h4>
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
          <!-- Actions -->
          <Menu as="div" class="relative shrink-0 ld-record-more">
            <MenuButton class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <EllipsisVerticalIcon class="w-5 h-5" />
            </MenuButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute right-0 mt-2 w-40 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10">
                <MenuItem v-slot="{ active }">
                  <button @click="$emit('unlink-event', event._id)" :class="['w-full text-left px-4 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Unlink</button>
                </MenuItem>
                <MenuItem v-slot="{ active }" v-if="canDelete">
                  <button @click="$emit('delete-event', event._id)" :class="['w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Delete</button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <CalendarIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No events yet</p>
        <button
          @click="$emit('create-event')"
          class="mt-2 rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Create first event
        </button>
      </div>
  </CardWidget>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { PlusIcon, CalendarIcon, LinkIcon } from '@heroicons/vue/24/outline';
import CardWidget from '@/components/common/CardWidget.vue';

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
  },
  canDelete: { type: Boolean, default: false }
});

defineEmits(['create-event', 'view-event', 'link-events', 'unlink-event', 'delete-event']);

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
      sortBy: 'startDateTime',
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
  // Normalize status to lowercase for class lookup
  const normalizedStatus = status?.toLowerCase() || 'scheduled';
  const classes = {
    scheduled: 'px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs',
    completed: 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs',
    cancelled: 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs',
    rescheduled: 'px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs'
  };
  return classes[normalizedStatus] || classes.scheduled;
};

const showRelatedInfo = (event) => {
  // Show related info only if viewing from Contact and event is related to a Deal
  const relatedType = event.relatedToType || event.relatedTo?.type;
  return props.relatedType === 'Contact' && relatedType === 'Deal';
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

