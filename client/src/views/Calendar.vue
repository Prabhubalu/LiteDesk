<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 lg:p-6">
    <!-- Header -->
    <div class="flex flex-row sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Manage your events and meetings</p>
      </div>
      
      <button @click="openEventModal()" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>New Event</span>
      </button>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-5 md:grid-cols-5 gap-3 mb-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total || 0 }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Total Events</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats.today || 0 }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Today</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ stats.thisWeek || 0 }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">This Week</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.upcoming || 0 }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Upcoming</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ Object.keys(stats.byType || {}).length }}</div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Event Types</div>
      </div>
    </div>

    <!-- FullCalendar -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-4">
        <FullCalendar 
          ref="calendarRef"
          :options="calendarOptions"
        />
      </div>
    </div>

    <!-- Event Form Modal -->
    <EventFormModal
      :is-open="showEventModal"
      :event="editingEvent"
      @close="closeEventModal"
      @saved="handleEventSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import apiClient from '@/utils/apiClient';
import EventFormModal from '@/components/events/EventFormModal.vue';

const router = useRouter();
const calendarRef = ref(null);

const events = ref([]);
const stats = ref({});
const loading = ref(false);
const showEventModal = ref(false);
const editingEvent = ref(null);
const isDarkMode = ref(false);

// Check dark mode
const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('dark');
};

// Convert our events to FullCalendar format
const calendarEvents = computed(() => {
  return events.value.map(event => ({
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
  ...(isDarkMode.value ? {
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
  router.push(`/events/${eventId}`);
};

const handleDateSelect = (selectInfo) => {
  editingEvent.value = {
    startDate: selectInfo.startStr,
    endDate: selectInfo.endStr,
    allDay: selectInfo.allDay
  };
  showEventModal.value = true;
  
  // Clear the selection
  const calendarApi = calendarRef.value?.getApi();
  if (calendarApi) {
    calendarApi.unselect();
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

const handleEventSaved = () => {
  fetchEvents();
  fetchStats();
};

// Watch for dark mode changes
watch(() => document.documentElement.classList.contains('dark'), (newVal) => {
  isDarkMode.value = newVal;
}, { immediate: true });

onMounted(() => {
  checkDarkMode();
  fetchEvents();
  fetchStats();
  
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
/* FullCalendar Custom Styling */
.fc {
  /* Typography */
  font-family: inherit;
}

.fc .fc-button {
  background-color: #4f46e5;
  border-color: #4f46e5;
  color: white;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.fc .fc-button:hover {
  background-color: #4338ca;
  border-color: #4338ca;
}

.fc .fc-button:disabled {
  background-color: #9ca3af;
  border-color: #9ca3af;
  opacity: 0.5;
}

.fc .fc-button-primary:not(:disabled):active,
.fc .fc-button-primary:not(:disabled).fc-button-active {
  background-color: #4338ca;
  border-color: #4338ca;
}

.fc .fc-toolbar-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.fc-theme-standard .fc-scrollgrid {
  border-color: #e5e7eb;
}

.fc-theme-standard td,
.fc-theme-standard th {
  border-color: #e5e7eb;
}

.fc .fc-daygrid-day-number {
  color: #374151;
  font-weight: 500;
  padding: 0.5rem;
}

.fc .fc-col-header-cell-cushion {
  color: #6b7280;
  font-weight: 600;
  padding: 0.75rem 0;
}

.fc .fc-daygrid-day.fc-day-today {
  background-color: #eff6ff !important;
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

/* Dark Mode Styles */
.dark .fc .fc-button {
  background-color: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.dark .fc .fc-button:hover {
  background-color: #4338ca;
  border-color: #4338ca;
}

.dark .fc .fc-button:disabled {
  background-color: #4b5563;
  border-color: #4b5563;
  opacity: 0.5;
}

.dark .fc .fc-button-primary:not(:disabled):active,
.dark .fc .fc-button-primary:not(:disabled).fc-button-active {
  background-color: #3730a3;
  border-color: #3730a3;
}

.dark .fc .fc-toolbar {
  background-color: transparent;
}

.dark .fc .fc-toolbar-title {
  color: #f9fafb;
}

.dark .fc .fc-toolbar-chunk {
  color: #f9fafb;
}

.dark .fc .fc-col-header {
  background-color: #111827;
}

.dark .fc .fc-col-header-cell {
  background-color: #111827;
  border-color: #374151;
}

.dark .fc-theme-standard .fc-scrollgrid {
  border-color: #374151;
  background-color: #1f2937;
}

.dark .fc-theme-standard td,
.dark .fc-theme-standard th {
  border-color: #374151;
}

.dark .fc .fc-daygrid-day-number {
  color: #d1d5db;
}

.dark .fc .fc-col-header-cell-cushion {
  color: #9ca3af;
}

.dark .fc .fc-daygrid-day.fc-day-today {
  background-color: #1e3a8a !important;
}

.dark .fc .fc-daygrid-day {
  background-color: #1f2937;
}

.dark .fc .fc-daygrid-day.fc-day-other {
  background-color: #111827;
}

.dark .fc .fc-timegrid-col {
  background-color: #1f2937;
}

.dark .fc .fc-timegrid-axis {
  background-color: #111827;
}

.dark .fc-theme-standard .fc-list {
  border-color: #374151;
  background-color: #1f2937;
}

.dark .fc .fc-list-day-cushion {
  background-color: #1f2937;
  color: #f9fafb;
}

.dark .fc .fc-list-event:hover td {
  background-color: #374151;
}

.dark .fc .fc-list-event-dot {
  border-color: inherit;
}

.dark .fc .fc-list-event-time,
.dark .fc .fc-list-event-title {
  color: #d1d5db;
}

/* Time Grid Styles */
.fc .fc-timegrid-slot {
  height: 3rem;
}

.fc .fc-timegrid-slot-label {
  color: #6b7280;
  font-size: 0.75rem;
}

.dark .fc .fc-timegrid-slot-label {
  color: #9ca3af;
}

.fc .fc-timegrid-event {
  border-radius: 0.375rem;
  border: none;
}

.fc .fc-timegrid-now-indicator-line {
  border-color: #ef4444;
  border-width: 2px;
}

/* List View Styles */
.fc .fc-list-day-cushion {
  background-color: #f3f4f6;
  font-weight: 600;
}

.fc .fc-list-event:hover td {
  background-color: #f9fafb;
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
