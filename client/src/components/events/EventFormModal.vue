<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="close">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ isEditing ? 'Edit Event' : 'Create New Event' }}
            </h2>
            <button @click="close" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Basic Information -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Basic Information</h3>
            
            <!-- Event Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Name <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.eventName"
                type="text"
                required
                maxlength="255"
                placeholder="Enter event name"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <!-- Agenda Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agenda Notes</label>
              <textarea
                v-model="form.agendaNotes"
                rows="3"
                maxlength="5000"
                placeholder="Add agenda, objectives or notes..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              ></textarea>
            </div>

            <!-- Event Type and Status -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type <span class="text-red-500">*</span></label>
                <select
                  v-model="form.eventType"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Meeting">Meeting</option>
                  <option value="Call">Call</option>
                  <option value="Site Visit">Site Visit</option>
                  <option value="Demo">Demo</option>
                  <option value="Training">Training</option>
                  <option value="Webinar">Webinar</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status <span class="text-red-500">*</span></label>
                <select
                  v-model="form.status"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rescheduled">Rescheduled</option>
                </select>
              </div>
            </div>

            <!-- Event Owner -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Owner <span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.eventOwnerId"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select user...</option>
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.firstName }} {{ user.lastName }} {{ user._id === currentUser._id ? '(Me)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Date & Time -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Date & Time</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <!-- Start Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.startDateTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <!-- End Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.endDateTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <!-- Location -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Location</h3>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location (Address or URL)</label>
              <input
                v-model="form.location"
                type="text"
                maxlength="1024"
                placeholder="Physical address or meeting URL"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <!-- Reminder -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder</label>
              <input
                v-model="form.reminderAt"
                type="datetime-local"
                placeholder="Set reminder time"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Attendees -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Attendees</h3>
            
            <!-- Add Attendee -->
            <div class="flex gap-2">
              <input
                v-model="newAttendeeEmail"
                type="email"
                placeholder="Enter email address"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                @keyup.enter="addAttendee"
              />
              <button
                type="button"
                @click="addAttendee"
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Add
              </button>
            </div>

            <!-- Attendees List -->
            <div v-if="form.attendees.length > 0" class="space-y-2">
              <div
                v-for="(attendee, index) in form.attendees"
                :key="index"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                    {{ attendee.email.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ attendee.email }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ attendee.status }}</div>
                  </div>
                </div>
                <button
                  type="button"
                  @click="removeAttendee(index)"
                  class="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Related Record -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Related To</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Record Type</label>
                <select
                  v-model="form.relatedToType"
                  @change="form.relatedToId = ''"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="Person">Person</option>
                  <option value="Organization">Organization</option>
                  <option value="Deal">Deal</option>
                  <option value="Item">Item</option>
                </select>
              </div>

              <div v-if="form.relatedToType">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select {{ form.relatedToType === 'Person' ? 'Person' : form.relatedToType }}</label>
                <select
                  v-model="form.relatedToId"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option v-for="record in relatedRecords" :key="record._id" :value="record._id">
                    {{ getRecordName(record) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Tags</h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(tag, index) in form.tags"
                :key="index"
                class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-sm"
              >
                {{ tag }}
                <button
                  type="button"
                  @click="form.tags.splice(index, 1)"
                  class="hover:text-indigo-600 dark:hover:text-indigo-200"
                >
                  ×
                </button>
              </span>
              <input
                v-model="newTag"
                type="text"
                placeholder="Add tag..."
                @keyup.enter="addTag"
                class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="close"
              class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  event: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const currentUser = computed(() => authStore.user || {});

const saving = ref(false);
const newAttendeeEmail = ref('');
const newTag = ref('');
const relatedRecords = ref([]);
const users = ref([]);

const colorOptions = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316'  // Orange
];

const form = ref({
  eventName: '',
  agendaNotes: '',
  eventType: 'Meeting',
  status: 'Scheduled',
  eventOwnerId: '',
  startDateTime: '',
  endDateTime: '',
  location: '',
  reminderAt: '',
  attendees: [],
  relatedToType: '',
  relatedToId: '',
  tags: [],
  linkedTaskId: '',
  linkedFormId: ''
});

const isEditing = computed(() => !!props.event?._id);

// Fetch users when component mounts
onMounted(() => {
  fetchUsers();
});

// Watch for prop changes
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Ensure users are loaded
    if (users.value.length === 0) {
      fetchUsers();
    }
  }
  if (newVal && props.event?._id) {
    // Edit mode - populate form with full event data (support both old and new field names)
    form.value = {
      eventName: props.event.eventName || props.event.title || '',
      agendaNotes: props.event.agendaNotes || props.event.description || '',
      eventType: props.event.eventType || props.event.type || 'Meeting',
      status: props.event.status || 'Scheduled',
      eventOwnerId: props.event.eventOwnerId?._id || props.event.eventOwnerId || currentUser.value._id || '',
      startDateTime: formatDateForInput(props.event.startDateTime || props.event.startDate),
      endDateTime: formatDateForInput(props.event.endDateTime || props.event.endDate),
      location: props.event.location || '',
      reminderAt: props.event.reminderAt ? formatDateForInput(props.event.reminderAt) : '',
      attendees: props.event.attendees || [],
      relatedToType: props.event.relatedToType || props.event.relatedTo?.type || '',
      relatedToId: props.event.relatedToId || props.event.relatedTo?.id || '',
      tags: props.event.tags || [],
      linkedTaskId: props.event.linkedTaskId || '',
      linkedFormId: props.event.linkedFormId || ''
    };
    
    // Fetch related records if type is specified
    if (form.value.relatedToType) {
      fetchRelatedRecords(form.value.relatedToType === 'Person' ? 'Contact' : form.value.relatedToType);
    }
  } else if (newVal && props.event) {
    // Create mode with pre-filled data (e.g., from related record)
    resetForm();
    // Override with any pre-filled values
    if (props.event.relatedTo || props.event.relatedToType) {
      form.value.relatedToType = props.event.relatedToType || props.event.relatedTo?.type || '';
      form.value.relatedToId = props.event.relatedToId || props.event.relatedTo?.id || '';
      // Fetch related records if type is specified
      if (form.value.relatedToType) {
        fetchRelatedRecords(form.value.relatedToType === 'Person' ? 'Contact' : form.value.relatedToType);
      }
    }
    if (props.event.startDateTime || props.event.startDate) {
      form.value.startDateTime = formatDateForInput(props.event.startDateTime || props.event.startDate);
    }
    if (props.event.endDateTime || props.event.endDate) {
      form.value.endDateTime = formatDateForInput(props.event.endDateTime || props.event.endDate);
    }
  } else if (newVal) {
    // Create mode - reset form
    resetForm();
  }
});

// Watch related type changes
watch(() => form.value.relatedToType, async (newType) => {
  if (newType) {
    // Map Person to Contact for API calls
    const apiType = newType === 'Person' ? 'Contact' : newType;
    await fetchRelatedRecords(apiType);
  }
});

const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const resetForm = () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  
  form.value = {
    eventName: '',
    agendaNotes: '',
    eventType: 'Meeting',
    status: 'Scheduled',
    eventOwnerId: currentUser.value._id || '',
    startDateTime: formatDateForInput(now),
    endDateTime: formatDateForInput(oneHourLater),
    location: '',
    reminderAt: '',
    attendees: [],
    relatedToType: '',
    relatedToId: '',
    tags: [],
    linkedTaskId: '',
    linkedFormId: ''
  };
  newAttendeeEmail.value = '';
  newTag.value = '';
};

const addTag = () => {
  if (!newTag.value.trim()) return;
  if (form.value.tags.includes(newTag.value.trim())) {
    alert('This tag already exists');
    return;
  }
  form.value.tags.push(newTag.value.trim());
  newTag.value = '';
};

const addAttendee = () => {
  if (!newAttendeeEmail.value.trim()) return;
  
  // Check for duplicates
  if (form.value.attendees.some(a => a.email === newAttendeeEmail.value)) {
    alert('This attendee has already been added');
    return;
  }
  
  form.value.attendees.push({
    email: newAttendeeEmail.value.trim(),
    name: newAttendeeEmail.value.split('@')[0],
    status: 'pending',
    isOrganizer: false
  });
  
  newAttendeeEmail.value = '';
};

const removeAttendee = (index) => {
  form.value.attendees.splice(index, 1);
};

const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    if (response.success) {
      users.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

const fetchRelatedRecords = async (type) => {
  try {
    let endpoint = '';
    switch (type) {
      case 'Contact':
        endpoint = '/people';
        break;
      case 'Deal':
        endpoint = '/deals';
        break;
      case 'Task':
        endpoint = '/tasks';
        break;
      case 'Organization':
        endpoint = '/organization';
        break;
    }
    
    if (endpoint) {
      const response = await apiClient.get(endpoint, { params: { limit: 100 } });
      if (response.success) {
        relatedRecords.value = response.data;
      }
    }
  } catch (error) {
    console.error('Error fetching related records:', error);
  }
};

const getRecordName = (record) => {
  if (record.name) return record.name;
  if (record.title) return record.title;
  if (record.first_name || record.last_name) {
    return `${record.first_name || ''} ${record.last_name || ''}`.trim();
  }
  return 'Unknown';
};

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    const payload = {
      eventName: form.value.eventName,
      agendaNotes: form.value.agendaNotes,
      eventType: form.value.eventType,
      status: form.value.status,
      eventOwnerId: form.value.eventOwnerId || currentUser.value._id,
      startDateTime: new Date(form.value.startDateTime).toISOString(),
      endDateTime: new Date(form.value.endDateTime).toISOString(),
      location: form.value.location || '',
      reminderAt: form.value.reminderAt ? new Date(form.value.reminderAt).toISOString() : null,
      attendees: form.value.attendees,
      tags: form.value.tags || []
    };
    
    // Add related record if selected
    if (form.value.relatedToType && form.value.relatedToId) {
      payload.relatedToType = form.value.relatedToType;
      payload.relatedToId = form.value.relatedToId;
    }
    
    // Add linked records if provided
    if (form.value.linkedTaskId) {
      payload.linkedTaskId = form.value.linkedTaskId;
    }
    if (form.value.linkedFormId) {
      payload.linkedFormId = form.value.linkedFormId;
    }
    
    let response;
    if (isEditing.value) {
      // Support both _id and eventId
      const eventId = props.event.eventId || props.event._id;
      response = await apiClient.put(`/events/${eventId}`, payload);
    } else {
      response = await apiClient.post('/events', payload);
    }
    
    console.log('Event save response:', response);
    
    if (response.success) {
      emit('saved', response.data);
      close();
    } else {
      console.error('Event save failed:', response);
      let errorMessage = response.error || 'Failed to save event';
      if (response.validationErrors) {
        errorMessage += '\nValidation errors:\n' + response.validationErrors.map(e => `- ${e.field}: ${e.message}`).join('\n');
      }
      alert(errorMessage);
    }
  } catch (error) {
    console.error('Error saving event - Full error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response,
      validationErrors: error.validationErrors
    });
    
    let errorMessage = 'Failed to save event: ' + (error.message || 'Unknown error');
    
    // Add validation errors if present
    if (error.validationErrors && error.validationErrors.length > 0) {
      errorMessage += '\n\nValidation Errors:\n';
      errorMessage += error.validationErrors.map(e => `• ${e.field}: ${e.message}`).join('\n');
    }
    
    // Add server error details if present
    if (error.response && error.response.error && error.response.error !== error.message) {
      errorMessage += '\n\nDetails: ' + error.response.error;
    }
    
    alert(errorMessage);
  } finally {
    saving.value = false;
  }
};

const close = () => {
  emit('close');
  setTimeout(resetForm, 300); // Reset after transition
};
</script>


