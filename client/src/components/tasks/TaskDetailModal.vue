<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click="$emit('close')">
    <div class="card max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slide-up" @click.stop>
      <div class="card-header flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Task Details</h2>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="card-body space-y-6">
        <!-- Title & Actions -->
        <div class="flex items-start justify-between gap-4">
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white flex-1">
            {{ task.title }}
          </h3>
          <div class="flex gap-2">
            <button @click="$emit('edit', task)" class="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button @click="confirmDelete" class="p-2 text-gray-600 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-all" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Status & Priority Badges -->
        <div class="flex items-center gap-3">
          <select 
            v-model="currentStatus" 
            @change="updateStatus"
            :class="[
              'badge cursor-pointer hover:opacity-80 transition-opacity',
              task.status === 'completed' ? 'badge-success' :
              task.status === 'in_progress' ? 'badge-info' :
              task.status === 'waiting' ? 'badge-warning' :
              task.status === 'cancelled' ? 'badge-danger' :
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            ]"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <span :class="[
            'badge',
            task.priority === 'urgent' ? 'badge-danger' :
            task.priority === 'high' ? 'badge-warning' :
            task.priority === 'medium' ? 'badge-info' :
            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          ]">
            {{ formatPriority(task.priority) }}
          </span>
        </div>

        <!-- Description -->
        <div v-if="task.description">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
          <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{{ task.description }}</p>
        </div>

        <!-- Meta Information Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Assigned To -->
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Assigned To</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ task.assignedTo?.firstName }} {{ task.assignedTo?.lastName }}
              </p>
            </div>
          </div>

          <!-- Due Date -->
          <div v-if="task.dueDate" class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
              <p :class="['text-sm font-medium', isOverdue ? 'text-danger-600' : 'text-gray-900 dark:text-white']">
                {{ formatDate(task.dueDate) }}
                <span v-if="isOverdue && task.status !== 'completed'" class="text-danger-600 text-xs ml-1">(Overdue)</span>
              </p>
            </div>
          </div>

          <!-- Created By -->
          <div v-if="task.createdBy" class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Created By</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ task.createdBy.firstName }} {{ task.createdBy.lastName }}
              </p>
            </div>
          </div>

          <!-- Created At -->
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDate(task.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Estimated Hours -->
        <div v-if="task.estimatedHours" class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Estimated Hours</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ task.estimatedHours }} hours</p>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="task.tags && task.tags.length > 0">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h4>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in task.tags" :key="tag" class="badge bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Subtasks -->
        <div v-if="task.subtasks && task.subtasks.length > 0">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Subtasks ({{ completedSubtasksCount }}/{{ task.subtasks.length }})
          </h4>
          <div class="space-y-2">
            <label 
              v-for="subtask in task.subtasks" 
              :key="subtask._id"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <input 
                type="checkbox" 
                :checked="subtask.completed"
                @change="toggleSubtask(subtask)"
                class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <span :class="['flex-1', subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white']">
                {{ subtask.title }}
              </span>
            </label>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button @click="$emit('close')" class="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import apiClient from '../../utils/apiClient';

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'edit', 'delete', 'statusChange']);

const currentStatus = ref(props.task.status);

const completedSubtasksCount = computed(() => {
  return props.task.subtasks?.filter(st => st.completed).length || 0;
});

const isOverdue = computed(() => {
  if (!props.task.dueDate) return false;
  return new Date(props.task.dueDate) < new Date();
});

// Update task status
const updateStatus = async () => {
  try {
    await apiClient.patch(`/tasks/${props.task._id}/status`, { 
      status: currentStatus.value 
    });
    emit('statusChange');
  } catch (error) {
    console.error('Error updating task status:', error);
    currentStatus.value = props.task.status; // Revert on error
  }
};

// Toggle subtask
const toggleSubtask = async (subtask) => {
  try {
    await apiClient.patch(`/tasks/${props.task._id}/subtasks/${subtask._id}`, {
      completed: !subtask.completed
    });
    subtask.completed = !subtask.completed; // Optimistic update
  } catch (error) {
    console.error('Error toggling subtask:', error);
    subtask.completed = !subtask.completed; // Revert on error
  }
};

// Delete confirmation
const confirmDelete = () => {
  if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
    emit('delete', props.task._id);
  }
};

// Utility functions
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const formatPriority = (priority) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
};
</script>

