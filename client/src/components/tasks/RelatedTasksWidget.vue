<template>
  <CardWidget title="Related Tasks" class="ld-card-group">
    <template #actions>
      <button
        @click="$emit('link-tasks')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Link Tasks"
      >
        <LinkIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        @click="$emit('create-task')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Add Task"
      >
        <PlusIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
      </div>

      <!-- Tasks List -->
      <div v-else-if="tasks.length > 0" class="space-y-2">
      <div
        v-for="task in tasks"
        :key="task._id"
        class="ld-record-card p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Left icon -->
          <div class="shrink-0 mt-0.5">
            <ClipboardDocumentListIcon class="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <!-- Content -->
          <div class="min-w-0 flex-1" @click="$emit('view-task', task._id)">
            <h4 :class="[
              'text-sm font-medium truncate mb-1',
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
          <!-- Actions -->
          <Menu as="div" class="relative shrink-0 ld-record-more">
            <MenuButton class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <EllipsisVerticalIcon class="w-5 h-5" />
            </MenuButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute right-0 mt-2 w-40 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10">
                <MenuItem v-slot="{ active }">
                  <button @click="$emit('unlink-task', task._id)" :class="['w-full text-left px-4 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Unlink</button>
                </MenuItem>
                <MenuItem v-slot="{ active }" v-if="canDelete">
                  <button @click="$emit('delete-task', task._id)" :class="['w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Delete</button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <ClipboardDocumentListIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No tasks yet</p>
        <button
          @click="$emit('create-task')"
          class="mt-2 rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Create first task
        </button>
      </div>
  </CardWidget>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { PlusIcon, ClipboardDocumentListIcon, LinkIcon } from '@heroicons/vue/24/outline';
import CardWidget from '@/components/common/CardWidget.vue';

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
  },
  canDelete: { type: Boolean, default: false }
});

defineEmits(['create-task', 'view-task', 'link-tasks', 'unlink-task', 'delete-task']);

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

