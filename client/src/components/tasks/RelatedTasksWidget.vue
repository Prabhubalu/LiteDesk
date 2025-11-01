<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Related Tasks</h3>
      <button
        @click="$emit('create-task')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Add Task"
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

    <!-- Tasks List -->
    <div v-else-if="tasks.length > 0" class="space-y-2">
      <div
        v-for="task in tasks"
        :key="task._id"
        @click="$emit('view-task', task._id)"
        class="p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <!-- Task Title -->
        <h4 :class="[
          'text-sm font-medium truncate mb-2',
          task.status === 'Completed' 
            ? 'text-gray-500 dark:text-gray-400 line-through' 
            : 'text-gray-900 dark:text-white'
        ]">
          {{ task.title }}
        </h4>
        
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
              <template v-if="getFieldValue(fieldDef, task)">
                {{ getFieldValue(fieldDef, task) }}
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No tasks yet</p>
      <button
        @click="$emit('create-task')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Create first task
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';

const props = defineProps({
  contactId: {
    type: String,
    required: false
  },
  organizationId: {
    type: String,
    required: false
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

defineEmits(['create-task', 'view-task']);

const tasks = ref([]);
const loading = ref(false);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const fetchTasks = async () => {
  if (!props.contactId && !props.organizationId) return;
  
  loading.value = true;
  try {
    const params = {
      limit: props.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    if (props.contactId) {
      params.contactId = props.contactId;
    } else if (props.organizationId) {
      params.organizationId = props.organizationId;
    }
    
    const response = await apiClient.get('/tasks', { params });
    
    if (response.success) {
      tasks.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching related tasks:', error);
  } finally {
    loading.value = false;
  }
};

const toggleTaskStatus = async (task) => {
  const newStatus = task.status === 'Completed' ? 'In Progress' : 'Completed';
  
  try {
    const response = await apiClient.put(`/tasks/${task._id}`, {
      status: newStatus
    });
    
    if (response.success) {
      task.status = newStatus;
    }
  } catch (error) {
    console.error('Error updating task status:', error);
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getPriorityClass = (priority) => {
  const classes = {
    'High': 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs',
    'Medium': 'px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs',
    'Low': 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs'
  };
  return classes[priority] || 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs';
};

const getStatusClass = (status) => {
  const classes = {
    'To Do': 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs',
    'In Progress': 'px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs',
    'Completed': 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs',
    'Cancelled': 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs'
  };
  return classes[status] || 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs';
};

const getAssigneeName = (assignee) => {
  if (!assignee) return 'Unassigned';
  if (typeof assignee === 'string') return assignee;
  if (assignee.firstName || assignee.lastName) {
    return `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
  }
  return 'Unknown';
};

// Watch for prop changes
watch([() => props.contactId, () => props.organizationId], () => {
  fetchTasks();
}, { immediate: true });

// Expose refresh method
defineExpose({
  refresh: fetchTasks
});
</script>

