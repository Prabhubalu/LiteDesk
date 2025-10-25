<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <div
                v-if="role"
                :style="{ backgroundColor: role.color || '#6366f1' }"
                class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
              >
                {{ getIcon(role.icon) }}
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ role?.name || 'Role' }} Users
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ users.length }} user{{ users.length !== 1 ? 's' : '' }} with this role
                </p>
              </div>
            </div>
            <button
              @click="close"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-6">
            <!-- Loading State -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="users.length === 0" class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No users found</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">No users have been assigned to this role yet</p>
            </div>

            <!-- Users List -->
            <div v-else class="space-y-2">
              <div
                v-for="user in users"
                :key="user._id"
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <!-- User Info -->
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {{ user.firstName?.[0] || 'U' }}{{ user.lastName?.[0] || '' }}
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900 dark:text-white">
                      {{ user.firstName }} {{ user.lastName }}
                      <span v-if="user.isOwner" class="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs font-medium">
                        Owner
                      </span>
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</p>
                  </div>
                </div>

                <!-- Status & Actions -->
                <div class="flex items-center gap-3">
                  <span
                    :class="[
                      user.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
                      'px-3 py-1 rounded-full text-xs font-medium'
                    ]"
                  >
                    {{ user.status || 'active' }}
                  </span>

                  <div class="flex items-center gap-2">
                    <button
                      @click="editUser(user)"
                      class="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Edit user"
                    >
                      <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      @click="changeUserRole(user)"
                      class="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Change role"
                    >
                      <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>

                    <button
                      v-if="!user.isOwner"
                      @click="removeUser(user)"
                      class="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Deactivate user"
                    >
                      <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              @click="close"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: Boolean,
  role: Object
});

const emit = defineEmits(['close', 'edit-user', 'change-role', 'refresh']);

const users = ref([]);
const loading = ref(false);

// Watch for modal opening and fetch users
watch([() => props.isOpen, () => props.role], async ([newIsOpen, newRole]) => {
  if (newIsOpen && newRole?._id) {
    await fetchUsers();
  } else if (!newIsOpen) {
    // Clear users when modal closes
    users.value = [];
  }
});

// Fetch users for this role
const fetchUsers = async () => {
  if (!props.role?._id) {
    console.warn('No role ID provided to fetchUsers');
    return;
  }
  
  loading.value = true;
  try {
    console.log('Fetching users for role:', props.role.name, props.role._id);
    const response = await apiClient.get(`/users?roleId=${props.role._id}&limit=1000`);
    
    if (response.success) {
      users.value = response.data;
      console.log(`Loaded ${response.data.length} users for role ${props.role.name}`);
    }
  } catch (error) {
    console.error('Error fetching users for role:', error);
    users.value = [];
  } finally {
    loading.value = false;
  }
};

// Get icon emoji for role
const getIcon = (iconName) => {
  const icons = {
    crown: '👑',
    shield: '🛡️',
    users: '👥',
    user: '👤',
    eye: '👁️',
    star: '⭐',
    rocket: '🚀'
  };
  return icons[iconName] || '👤';
};

// Close modal
const close = () => {
  emit('close');
};

// Edit user
const editUser = (user) => {
  emit('edit-user', user);
  close();
};

// Change user role
const changeUserRole = (user) => {
  emit('change-role', user);
  close();
};

// Remove/deactivate user
const removeUser = async (user) => {
  if (!confirm(`Deactivate user ${user.firstName} ${user.lastName}? They will lose access to the system.`)) {
    return;
  }
  
  try {
    const response = await apiClient.delete(`/users/${user._id}`);
    
    if (response.success) {
      // Refresh the user list
      await fetchUsers();
      emit('refresh');
    } else {
      alert('Failed to deactivate user');
    }
  } catch (error) {
    console.error('Error deactivating user:', error);
    alert('Failed to deactivate user');
  }
};
</script>

