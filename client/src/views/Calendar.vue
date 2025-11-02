<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">Manage your events and meetings</p>
      </div>
      
      <div class="flex gap-4">
        <button @click="navigateToOctober2025" class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Go to October 2025</span>
        </button>
        
        <button @click="openEventModal()" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Event</span>
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ stats.total || 0 }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{{ stats.today || 0 }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Today</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{{ stats.thisWeek || 0 }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">This Week</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{{ stats.upcoming || 0 }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Upcoming</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">{{ Object.keys(stats.byType || {}).length }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Event Types</div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col lg:flex-row gap-4 mb-6">
      <div class="w-full lg:w-80">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search events..."
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <select v-model="filters.type" @change="applyFilters" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Types</option>
          <option value="meeting">Meeting</option>
          <option value="appointment">Appointment</option>
          <option value="deadline">Deadline</option>
          <option value="event">Event</option>
          <option value="reminder">Reminder</option>
        </select>

        <select v-model="filters.status" @change="applyFilters" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="postponed">Postponed</option>
        </select>

        <select v-model="filters.timeRange" @change="applyFilters" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="thisWeek">This Week</option>
          <option value="nextWeek">Next Week</option>
          <option value="thisMonth">This Month</option>
          <option value="nextMonth">Next Month</option>
        </select>

        <button 
          @click="clearFilters" 
          :disabled="!hasActiveFilters"
          class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      </div>
    </div>

    <!-- FullCalendar -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-6">
        <FullCalendar 
          v-if="!loading"
          ref="calendarRef"
          :options="calendarOptions"
        />
        <div v-else class="flex items-center justify-center h-64">
          <div class="text-gray-500 dark:text-gray-400">Loading calendar...</div>
        </div>
      </div>
    </div>

    <!-- Event Form Drawer -->
    <CreateRecordDrawer
      :isOpen="showEventModal"
      moduleKey="events"
      :record="editingEvent"
      @close="closeEventModal"
      @saved="handleEventSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import apiClient from '@/utils/apiClient';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import { useTabs } from '@/composables/useTabs';

const router = useRouter();
const route = useRoute();
const calendarRef = ref(null);

// Initialize tabs composable
const { openTab } = useTabs();

const events = ref([]);
const stats = ref({});
const loading = ref(false);
const showEventModal = ref(false);
const editingEvent = ref(null);
const isDarkMode = ref(false);

// Search and filters
const searchQuery = ref('');
const filters = ref({
  type: '',
  status: '',
  timeRange: ''
});

let searchTimeout;

// Check dark mode
const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('dark');
};

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         filters.value.type !== '' || 
         filters.value.status !== '' || 
         filters.value.timeRange !== '';
});

// Convert our events to FullCalendar format with filtering
const calendarEvents = computed(() => {
  let filteredEvents = events.value;

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filteredEvents = filteredEvents.filter(event => 
      event.title?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query) ||
      event.location?.toLowerCase().includes(query)
    );
  }

  // Apply type filter
  if (filters.value.type) {
    filteredEvents = filteredEvents.filter(event => event.type === filters.value.type);
  }

  // Apply status filter
  if (filters.value.status) {
    filteredEvents = filteredEvents.filter(event => event.status === filters.value.status);
  }

  // Apply time range filter
  if (filters.value.timeRange) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filteredEvents = filteredEvents.filter(event => {
      const eventDate = new Date(event.startDate);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      
      switch (filters.value.timeRange) {
        case 'today':
          return eventDateOnly.getTime() === today.getTime();
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return eventDateOnly.getTime() === tomorrow.getTime();
        case 'thisWeek':
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return eventDateOnly >= startOfWeek && eventDateOnly <= endOfWeek;
        case 'nextWeek':
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
          return eventDateOnly >= nextWeekStart && eventDateOnly <= nextWeekEnd;
        case 'thisMonth':
          return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
        case 'nextMonth':
          const nextMonth = new Date(now);
          nextMonth.setMonth(now.getMonth() + 1);
          return eventDate.getMonth() === nextMonth.getMonth() && eventDate.getFullYear() === nextMonth.getFullYear();
        default:
          return true;
      }
    });
  }

  const convertedEvents = filteredEvents.map(event => ({
    id: event._id,
    title: event.title,
    start: event.startDate,
    end: event.endDate,
    backgroundColor: event.color || '#3b82f6',
    borderColor: event.color || '#3b82f6',
    textColor: '#ffffff',
    extendedProps: {
      description: event.description,
      location: event.location,
      type: event.type,
      status: event.status,
      attendees: event.attendees,
      originalEvent: event
    }
  }));
  
  return convertedEvents;
});

// FullCalendar Options
const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
  },
  buttonText: {
    today: 'Today',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    list: 'List'
  },
  height: 'auto',
  aspectRatio: 1.8,
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  nowIndicator: true,
  eventMaxStack: 3,
  
  // Events
  events: calendarEvents.value,
  
  // Event handlers
  eventClick: handleEventClick,
  select: handleDateSelect,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  
  // Styling
  themeSystem: 'standard',
  
  // Custom styling based on dark mode
  ...(isDarkMode ? {
    // Dark mode custom styles applied via CSS
  } : {})
}));

// Methods
const fetchEvents = async () => {
  try {
    loading.value = true;
    
    // Fetch all events (FullCalendar will handle filtering by view)
    const response = await apiClient.get('/events', {
      params: { limit: 500 }
    });
    
    if (response.success) {
      events.value = response.data;
      console.log('✅ Events loaded:', events.value.length, 'events');
    } else {
      console.error('❌ Events API failed:', response);
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const response = await apiClient.get('/events/stats');
    if (response.success) {
      stats.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};

const handleEventClick = (info) => {
  const eventId = info.event.id;
  const eventTitle = info.event.title;
  
  // Open event detail in a new tab
  openTab(`/events/${eventId}`, {
    title: eventTitle,
    icon: 'calendar',
    params: { name: eventTitle }
  });
};

const handleDateSelect = (selectInfo) => {
  editingEvent.value = {
    startDate: selectInfo.startStr,
    endDate: selectInfo.endStr,
    allDay: selectInfo.allDay
  };
  showEventModal.value = true;
  
  // Clear the selection
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    if (calendarApi) {
      calendarApi.unselect();
    }
  }
};

const handleEventDrop = async (info) => {
  try {
    const event = info.event;
    const eventId = event.id;
    
    await apiClient.put(`/events/${eventId}`, {
      startDate: event.start.toISOString(),
      endDate: event.end ? event.end.toISOString() : event.start.toISOString()
    });
    
    await fetchEvents();
    await fetchStats();
  } catch (error) {
    console.error('Error updating event:', error);
    info.revert();
  }
};

const handleEventSaved = async () => {
  // Refresh events and stats when a new event is saved
  await fetchEvents();
  await fetchStats();
  closeEventModal();
};

// Function to refresh calendar data (can be called from other components)
const refreshCalendar = async () => {
  await fetchEvents();
  await fetchStats();
};

const handleEventResize = async (info) => {
  try {
    const event = info.event;
    const eventId = event.id;
    
    await apiClient.put(`/events/${eventId}`, {
      startDate: event.start.toISOString(),
      endDate: event.end ? event.end.toISOString() : event.start.toISOString()
    });
    
    await fetchEvents();
    await fetchStats();
  } catch (error) {
    console.error('Error updating event:', error);
    info.revert();
  }
};

const openEventModal = (event = null) => {
  editingEvent.value = event;
  showEventModal.value = true;
};

const closeEventModal = () => {
  showEventModal.value = false;
  editingEvent.value = null;
};

const navigateToOctober2025 = () => {
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    if (calendarApi) {
      calendarApi.changeView('dayGridMonth', '2025-10-01');
      console.log('🗓️ Navigated to October 2025');
    }
  }
};

// Search and filter methods
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // The computed property will automatically update the calendar
  }, 300);
};

const applyFilters = () => {
  // The computed property will automatically update the calendar
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.value = {
    type: '',
    status: '',
    timeRange: ''
  };
};

// Watch for dark mode changes
watch(() => document.documentElement.classList.contains('dark'), (newVal) => {
  isDarkMode.value = newVal;
}, { immediate: true });

// Watch for events changes and refresh calendar
watch(calendarEvents, () => {
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    if (calendarApi) {
      calendarApi.refetchEvents();
    }
  }
}, { deep: true });

// Watch for raw events changes and refresh calendar
watch(events, () => {
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    if (calendarApi) {
      calendarApi.refetchEvents();
    }
  }
}, { deep: true });

// Watch for route changes to refresh calendar when returning from event detail
watch(() => route.path, (newPath, oldPath) => {
  if (oldPath && oldPath.startsWith('/events/') && newPath === '/calendar') {
    // User navigated back from event detail page, refresh calendar
    refreshCalendar();
  }
});

onMounted(async () => {
  checkDarkMode();
  await fetchEvents();
  await fetchStats();
  
  // Watch for dark mode changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        checkDarkMode();
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
});
</script>

<style>
/* FullCalendar Custom Styling - Using Tailwind color values */
.fc {
  font-family: inherit;
}

.fc .fc-button {
  background-color: #4f46e5; /* indigo-600 */
  border-color: #4f46e5;
  color: white;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.fc .fc-button:hover {
  background-color: #4338ca; /* indigo-700 */
  border-color: #4338ca;
}

.fc .fc-button:disabled {
  background-color: #9ca3af; /* gray-400 */
  border-color: #9ca3af;
  opacity: 0.5;
}

.fc .fc-button-primary:not(:disabled):active,
.fc .fc-button-primary:not(:disabled).fc-button-active {
  background-color: #4338ca; /* indigo-700 */
  border-color: #4338ca;
}

.fc .fc-toolbar-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827; /* gray-900 */
}

.fc-theme-standard .fc-scrollgrid {
  border-color: #e5e7eb; /* gray-200 */
}

.fc-theme-standard td,
.fc-theme-standard th {
  border-color: #e5e7eb; /* gray-200 */
}

.fc .fc-daygrid-day-number {
  color: #374151; /* gray-700 */
  font-weight: 500;
  padding: 0.5rem;
}

.fc .fc-col-header-cell-cushion {
  color: #6b7280; /* gray-500 */
  font-weight: 600;
  padding: 0.75rem 0;
}

.fc .fc-daygrid-day.fc-day-today {
  background-color: #eff6ff !important; /* blue-50 */
}

.fc .fc-event {
  border-radius: 0.375rem;
  padding: 2px 4px;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.fc .fc-event:hover {
  opacity: 0.85;
}

.fc .fc-daygrid-event-dot {
  display: none;
}

/* Dark Mode Styles - Using Tailwind dark mode colors */
.dark .fc .fc-button {
  background-color: #4f46e5; /* indigo-600 */
  border-color: #4f46e5;
  color: white;
}

.dark .fc .fc-button:hover {
  background-color: #4338ca; /* indigo-700 */
  border-color: #4338ca;
}

.dark .fc .fc-button:disabled {
  background-color: #4b5563; /* gray-600 */
  border-color: #4b5563;
  opacity: 0.5;
}

.dark .fc .fc-button-primary:not(:disabled):active,
.dark .fc .fc-button-primary:not(:disabled).fc-button-active {
  background-color: #3730a3; /* indigo-800 */
  border-color: #3730a3;
}

.dark .fc .fc-toolbar {
  background-color: transparent;
}

.dark .fc .fc-toolbar-title {
  color: #f9fafb; /* gray-50 */
}

.dark .fc .fc-toolbar-chunk {
  color: #f9fafb; /* gray-50 */
}

.dark .fc .fc-col-header {
  background-color: #111827; /* gray-900 */
}

.dark .fc .fc-col-header-cell {
  background-color: #111827; /* gray-900 */
  border-color: #374151; /* gray-700 */
}

.dark .fc-theme-standard .fc-scrollgrid {
  border-color: #374151; /* gray-700 */
  background-color: #1f2937; /* gray-800 */
}

.dark .fc-theme-standard td,
.dark .fc-theme-standard th {
  border-color: #374151; /* gray-700 */
}

.dark .fc .fc-daygrid-day-number {
  color: #d1d5db; /* gray-300 */
}

.dark .fc .fc-col-header-cell-cushion {
  color: #9ca3af; /* gray-400 */
}

.dark .fc .fc-daygrid-day.fc-day-today {
  background-color: #1e3a8a !important; /* blue-800 */
}

.dark .fc .fc-daygrid-day {
  background-color: #1f2937; /* gray-800 */
}

.dark .fc .fc-daygrid-day.fc-day-other {
  background-color: #111827; /* gray-900 */
}

.dark .fc .fc-timegrid-col {
  background-color: #1f2937; /* gray-800 */
}

.dark .fc .fc-timegrid-axis {
  background-color: #111827; /* gray-900 */
}

.dark .fc-theme-standard .fc-list {
  border-color: #374151; /* gray-700 */
  background-color: #1f2937; /* gray-800 */
}

.dark .fc .fc-list-day-cushion {
  background-color: #1f2937; /* gray-800 */
  color: #f9fafb; /* gray-50 */
}

.dark .fc .fc-list-event:hover td {
  background-color: #374151; /* gray-700 */
}

.dark .fc .fc-list-event-dot {
  border-color: inherit;
}

.dark .fc .fc-list-event-time,
.dark .fc .fc-list-event-title {
  color: #d1d5db; /* gray-300 */
}

/* Time Grid Styles */
.fc .fc-timegrid-slot {
  height: 3rem;
}

.fc .fc-timegrid-slot-label {
  color: #6b7280; /* gray-500 */
  font-size: 0.75rem;
}

.dark .fc .fc-timegrid-slot-label {
  color: #9ca3af; /* gray-400 */
}

.fc .fc-timegrid-event {
  border-radius: 0.375rem;
  border: none;
}

.fc .fc-timegrid-now-indicator-line {
  border-color: #ef4444; /* red-500 */
  border-width: 2px;
}

/* List View Styles */
.fc .fc-list-day-cushion {
  background-color: #f3f4f6; /* gray-100 */
  font-weight: 600;
}

.fc .fc-list-event:hover td {
  background-color: #f9fafb; /* gray-50 */
}

/* Responsive */
@media (max-width: 768px) {
  .fc .fc-toolbar {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .fc .fc-toolbar-title {
    font-size: 1.25rem;
  }
  
  .fc .fc-button {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }
}
</style>
