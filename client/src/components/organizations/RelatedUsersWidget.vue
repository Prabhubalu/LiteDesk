<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Users</h3>
      <button
        @click="$emit('create-user')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Add User"
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

    <!-- Users List -->
    <div v-else-if="users.length > 0" class="space-y-2">
      <div
        v-for="user in users"
        :key="user._id"
        @click="$emit('view-user', user._id)"
        class="p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div v-if="user.avatar" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img :src="user.avatar" :alt="user.name" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {{ getInitials(user.name) }}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user.name }}</h4>
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span v-if="user.email" class="truncate">{{ user.email }}</span>
                <span v-if="user.role" class="px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-300 rounded">
                  {{ user.role }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No users found</p>
      <button
        @click="$emit('create-user')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Add user
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  organizationId: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    default: 5
  }
});

defineEmits(['view-user', 'create-user']);

const users = ref([]);
const loading = ref(false);

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const fetchUsers = async () => {
  if (!props.organizationId) return;
  
  loading.value = true;
  try {
    const data = await apiClient.get('/users', {
      params: {
        organizationId: props.organizationId,
        limit: props.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    });
    if (data.success) {
      users.value = data.data || [];
    } else {
      users.value = data || [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    users.value = [];
  } finally {
    loading.value = false;
  }
};

// Watch for prop changes (works better with dynamic mounting)
watch(() => props.organizationId, () => {
  fetchUsers();
}, { immediate: true });

// Also try onMounted as fallback
onMounted(() => {
  if (props.organizationId && users.value.length === 0) {
    fetchUsers();
  }
});

// Expose refresh method
defineExpose({
  refresh: fetchUsers
});
</script>

