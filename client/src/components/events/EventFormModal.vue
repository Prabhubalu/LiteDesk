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
            
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.title"
                type="text"
                required
                placeholder="Enter event title"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                v-model="form.description"
                rows="3"
                placeholder="Add event description..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              ></textarea>
            </div>

            <!-- Type, Category, Priority -->
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  v-model="form.type"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="task">Task</option>
                  <option value="deadline">Deadline</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  v-model="form.category"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                  <option value="personal">Personal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  v-model="form.priority"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Date & Time -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Date & Time</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <!-- Start Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.startDate"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <!-- End Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.endDate"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <!-- All Day Event -->
            <div class="flex items-center">
              <input
                v-model="form.allDay"
                type="checkbox"
                id="allDay"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label for="allDay" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                All day event
              </label>
            </div>
          </div>

          <!-- Location -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Location</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physical Location</label>
                <input
                  v-model="form.location"
                  type="text"
                  placeholder="e.g., Conference Room A"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting URL</label>
                <input
                  v-model="form.meetingUrl"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
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
                  v-model="form.relatedType"
                  @change="form.relatedId = ''"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="Contact">Contact</option>
                  <option value="Deal">Deal</option>
                  <option value="Task">Task</option>
                  <option value="Organization">Organization</option>
                </select>
              </div>

              <div v-if="form.relatedType">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select {{ form.relatedType }}</label>
                <select
                  v-model="form.relatedId"
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

          <!-- Color Picker -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Event Color</h3>
            
            <div class="flex gap-3">
              <button
                v-for="color in colorOptions"
                :key="color"
                type="button"
                @click="form.color = color"
                :style="{ backgroundColor: color }"
                :class="[
                  'w-10 h-10 rounded-lg transition-all',
                  form.color === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'
                ]"
              ></button>
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
import { ref, watch, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';

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

const saving = ref(false);
const newAttendeeEmail = ref('');
const relatedRecords = ref([]);

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
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  allDay: false,
  location: '',
  meetingUrl: '',
  type: 'meeting',
  category: 'other',
  priority: 'medium',
  status: 'scheduled',
  attendees: [],
  relatedType: '',
  relatedId: '',
  color: '#3B82F6'
});

const isEditing = computed(() => !!props.event?._id);

// Watch for prop changes
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.event?._id) {
    // Edit mode - populate form with full event data
    form.value = {
      title: props.event.title,
      description: props.event.description || '',
      startDate: formatDateForInput(props.event.startDate),
      endDate: formatDateForInput(props.event.endDate),
      allDay: props.event.allDay || false,
      location: props.event.location || '',
      meetingUrl: props.event.meetingUrl || '',
      type: props.event.type || 'meeting',
      category: props.event.category || 'other',
      priority: props.event.priority || 'medium',
      status: props.event.status || 'scheduled',
      attendees: props.event.attendees || [],
      relatedType: props.event.relatedTo?.type || '',
      relatedId: props.event.relatedTo?.id || '',
      color: props.event.color || '#3B82F6'
    };
  } else if (newVal && props.event) {
    // Create mode with pre-filled data (e.g., from related record)
    resetForm();
    // Override with any pre-filled values
    if (props.event.relatedTo) {
      form.value.relatedType = props.event.relatedTo.type || '';
      form.value.relatedId = props.event.relatedTo.id || '';
      // Fetch related records if type is specified
      if (form.value.relatedType) {
        fetchRelatedRecords(form.value.relatedType);
      }
    }
    if (props.event.startDate) {
      form.value.startDate = formatDateForInput(props.event.startDate);
    }
    if (props.event.endDate) {
      form.value.endDate = formatDateForInput(props.event.endDate);
    }
    if (props.event.allDay !== undefined) {
      form.value.allDay = props.event.allDay;
    }
  } else if (newVal) {
    // Create mode - reset form
    resetForm();
  }
});

// Watch related type changes
watch(() => form.value.relatedType, async (newType) => {
  if (newType) {
    await fetchRelatedRecords(newType);
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
    title: '',
    description: '',
    startDate: formatDateForInput(now),
    endDate: formatDateForInput(oneHourLater),
    allDay: false,
    location: '',
    meetingUrl: '',
    type: 'meeting',
    category: 'other',
    priority: 'medium',
    status: 'scheduled',
    attendees: [],
    relatedType: '',
    relatedId: '',
    color: '#3B82F6'
  };
  newAttendeeEmail.value = '';
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

const fetchRelatedRecords = async (type) => {
  try {
    let endpoint = '';
    switch (type) {
      case 'Contact':
        endpoint = '/contacts';
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
      title: form.value.title,
      description: form.value.description,
      startDate: new Date(form.value.startDate).toISOString(),
      endDate: new Date(form.value.endDate).toISOString(),
      allDay: form.value.allDay,
      location: form.value.location,
      meetingUrl: form.value.meetingUrl,
      type: form.value.type,
      category: form.value.category,
      priority: form.value.priority,
      status: form.value.status,
      attendees: form.value.attendees,
      color: form.value.color
    };
    
    // Add related record if selected
    if (form.value.relatedType && form.value.relatedId) {
      payload.relatedTo = {
        type: form.value.relatedType,
        id: form.value.relatedId
      };
    }
    
    let response;
    if (isEditing.value) {
      response = await apiClient.put(`/events/${props.event._id}`, payload);
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

