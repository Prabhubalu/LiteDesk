<template>
  <Teleport to="body">
    <div
      v-if="isOpen && user"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all">
          <!-- Header -->
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
              <button
                @click="close"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
            <!-- User Info (Read-only) -->
            <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {{ user.firstName?.[0] || 'U' }}{{ user.lastName?.[0] || '' }}
              </div>
              <div>
                <p class="font-semibold text-gray-900 dark:text-white text-lg">
                  {{ user.firstName }} {{ user.lastName }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</p>
              </div>
            </div>

            <!-- Role -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role *
              </label>
              <select
                v-model="form.roleId"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
              >
                <option value="">Select a role</option>
                <option v-for="role in availableRoles" :key="role._id" :value="role._id">
                  {{ role.name }} - {{ role.description }}
                </option>
              </select>
            </div>

            <!-- Status -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status *
              </label>
              <select
                v-model="form.status"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
              >
                <option value="active">Active - User can log in and access the system</option>
                <option value="inactive">Inactive - User cannot log in</option>
                <option value="suspended">Suspended - Temporarily blocked</option>
              </select>
            </div>

            <!-- Status Change Warning -->
            <div v-if="form.status !== 'active'" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div class="flex gap-3">
                <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {{ form.status === 'inactive' ? 'Deactivating User' : 'Suspending User' }}
                  </p>
                  <p class="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    This user will no longer be able to access the system. Consider transferring their data ownership before proceeding.
                  </p>
                </div>
              </div>
            </div>

            <!-- Reset Password Option -->
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="text-sm font-medium text-blue-900 dark:text-blue-300">Reset Password</p>
                  <p class="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Generate a new temporary password and send it to the user's email
                  </p>
                </div>
                <button
                  type="button"
                  @click="resetPassword"
                  class="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                @click="deleteUser"
                class="px-5 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
              >
                Delete User
              </button>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="close"
                  class="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="saving"
                  class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ saving ? 'Saving...' : 'Save Changes' }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: Boolean,
  user: Object
});

const emit = defineEmits(['close', 'user-updated']);

const authStore = useAuthStore();

const form = ref({
  roleId: '',
  status: 'active'
});

const saving = ref(false);
const error = ref('');
const availableRoles = ref([]);

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data;
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    console.log('EditUserModal opened with user:', props.user);
    fetchRoles();
    // Initialize form when modal opens
    if (props.user) {
      const roleIdValue = props.user.roleId?._id || props.user.roleId || props.user.role || '';
      console.log('Setting form.roleId to:', roleIdValue, 'from user:', props.user);
      form.value = {
        roleId: roleIdValue,
        status: props.user.status || 'active'
      };
    }
  }
});

watch(() => props.user, (newUser) => {
  if (newUser && props.isOpen) {
    // Extract roleId._id if roleId is populated, otherwise use roleId directly
    const roleIdValue = newUser.roleId?._id || newUser.roleId || newUser.role || '';
    console.log('User changed, updating form.roleId to:', roleIdValue);
    
    form.value = {
      roleId: roleIdValue,
      status: newUser.status || 'active'
    };
  }
});

const close = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';

  try {
    const originalRoleId = props.user.roleId?._id || props.user.roleId;
    const response = await apiClient.put(`/users/${props.user._id}`, form.value);

    if (response.success) {
      // Check if role was changed
      const roleChanged = originalRoleId !== form.value.roleId;
      
      if (roleChanged) {
        console.log('User role updated. Changes will be reflected on their next page refresh or within 2 minutes.');
      }
      
      emit('user-updated');
    } else {
      error.value = response.message || 'Failed to update user';
    }
  } catch (err) {
    console.error('Error updating user:', err);
    error.value = err.message || 'Failed to update user';
  } finally {
    saving.value = false;
  }
};

const resetPassword = async () => {
  if (!confirm('Generate a new password and send it to this user via email?')) return;

  try {
    const response = await apiClient.post(`/users/${props.user._id}/reset-password`);

    if (response.success) {
      alert('Password reset email sent successfully');
    } else {
      alert('Failed to reset password');
    }
  } catch (err) {
    console.error('Error resetting password:', err);
    alert('Failed to reset password');
  }
};

const deleteUser = async () => {
  if (!confirm(`Delete user ${props.user.firstName} ${props.user.lastName}? This action cannot be undone.`)) return;

  try {
    const response = await apiClient.delete(`/users/${props.user._id}`);

    if (response.success) {
      emit('user-updated');
    } else {
      alert('Failed to delete user');
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    alert('Failed to delete user');
  }
};
</script>

