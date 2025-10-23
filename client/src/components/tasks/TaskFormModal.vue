<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click="$emit('close')">
    <div class="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up" @click.stop>
      <div class="card-header flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ task ? 'Edit Task' : 'New Task' }}
        </h2>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="card-body space-y-6">
        <!-- Title -->
        <div>
          <label class="label">Title *</label>
          <input 
            v-model="formData.title" 
            type="text" 
            required
            class="input" 
            placeholder="Enter task title"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="label">Description</label>
          <textarea 
            v-model="formData.description" 
            rows="3"
            class="input" 
            placeholder="Enter task description"
          ></textarea>
        </div>

        <!-- Row: Status & Priority -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Status</label>
            <select v-model="formData.status" class="input">
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label class="label">Priority</label>
            <select v-model="formData.priority" class="input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <!-- Row: Due Date & Assigned To -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Due Date</label>
            <input 
              v-model="formData.dueDate" 
              type="date"
              class="input"
            />
          </div>

          <div>
            <label class="label">Assigned To *</label>
            <select v-model="formData.assignedTo" required class="input">
              <option value="">Select assignee...</option>
              <option :value="currentUser._id">{{ currentUser.firstName }} {{ currentUser.lastName }} (Me)</option>
              <!-- Add other team members here when available -->
            </select>
          </div>
        </div>

        <!-- Estimated Hours -->
        <div>
          <label class="label">Estimated Hours</label>
          <input 
            v-model.number="formData.estimatedHours" 
            type="number"
            min="0"
            step="0.5"
            class="input" 
            placeholder="0"
          />
        </div>

        <!-- Tags -->
        <div>
          <label class="label">Tags (comma-separated)</label>
          <input 
            v-model="tagsInput" 
            type="text"
            class="input" 
            placeholder="e.g., urgent, client, bug-fix"
          />
        </div>

        <!-- Subtasks -->
        <div>
          <label class="label">Subtasks</label>
          <div class="space-y-2">
            <div v-for="(subtask, index) in formData.subtasks" :key="index" class="flex items-center gap-2">
              <input 
                v-model="subtask.title" 
                type="text"
                class="input flex-1" 
                placeholder="Subtask title"
              />
              <button 
                type="button"
                @click="removeSubtask(index)"
                class="p-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <button 
              type="button"
              @click="addSubtask"
              class="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Subtask
            </button>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" @click="$emit('close')" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="saving" class="btn-primary">
            <span v-if="saving">Saving...</span>
            <span v-else>{{ task ? 'Update Task' : 'Create Task' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import apiClient from '../../utils/apiClient';

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'save']);

const authStore = useAuthStore();
const currentUser = computed(() => authStore.user || {});

const saving = ref(false);
const tagsInput = ref('');

const formData = reactive({
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  assignedTo: '',
  estimatedHours: 0,
  tags: [],
  subtasks: []
});

// Initialize form data if editing
if (props.task) {
  Object.assign(formData, {
    title: props.task.title || '',
    description: props.task.description || '',
    status: props.task.status || 'todo',
    priority: props.task.priority || 'medium',
    dueDate: props.task.dueDate ? new Date(props.task.dueDate).toISOString().split('T')[0] : '',
    assignedTo: props.task.assignedTo?._id || props.task.assignedTo || '',
    estimatedHours: props.task.estimatedHours || 0,
    tags: props.task.tags || [],
    subtasks: props.task.subtasks || []
  });
  tagsInput.value = formData.tags.join(', ');
} else {
  // Default to current user for new tasks
  formData.assignedTo = currentUser.value._id;
}

// Watch tags input to update array
watch(tagsInput, (newValue) => {
  formData.tags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag);
});

// Subtask management
const addSubtask = () => {
  formData.subtasks.push({ title: '', completed: false });
};

const removeSubtask = (index) => {
  formData.subtasks.splice(index, 1);
};

// Form submission
const handleSubmit = async () => {
  try {
    saving.value = true;

    // Clean up subtasks (remove empty ones)
    const cleanedSubtasks = formData.subtasks.filter(st => st.title.trim());

    const payload = {
      ...formData,
      subtasks: cleanedSubtasks,
      dueDate: formData.dueDate || null
    };

    if (props.task) {
      await apiClient.put(`/tasks/${props.task._id}`, payload);
    } else {
      await apiClient.post('/tasks', payload);
    }

    emit('save');
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Error saving task. Please try again.');
  } finally {
    saving.value = false;
  }
};
</script>

