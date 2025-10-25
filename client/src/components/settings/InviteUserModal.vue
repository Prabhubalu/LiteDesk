<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
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
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Invite New User</h2>
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
            <!-- Name Fields -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name *
                </label>
                <input
                  v-model="form.firstName"
                  type="text"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  placeholder="John"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name *
                </label>
                <input
                  v-model="form.lastName"
                  type="text"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>

            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address *
              </label>
              <input
                v-model="form.email"
                type="email"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                placeholder="john.doe@company.com"
              />
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

            <!-- Password Option -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div class="flex items-center gap-3 mb-2">
                <label class="flex items-center gap-2">
                  <input
                    type="radio"
                    v-model="passwordOption"
                    value="auto"
                    class="w-4 h-4 text-brand-600 focus:ring-brand-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Auto-generate</span>
                </label>
                <label class="flex items-center gap-2">
                  <input
                    type="radio"
                    v-model="passwordOption"
                    value="manual"
                    class="w-4 h-4 text-brand-600 focus:ring-brand-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Set manually</span>
                </label>
              </div>

              <input
                v-if="passwordOption === 'manual'"
                v-model="form.password"
                type="password"
                required
                minlength="8"
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                placeholder="Minimum 8 characters"
              />
              <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                A secure password will be auto-generated. {{ form.sendEmail ? 'It will be sent via email.' : 'You will need to share it with the user manually.' }}
              </p>
            </div>

            <!-- Send Invite Email -->
            <div class="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <input
                type="checkbox"
                v-model="form.sendEmail"
                id="sendEmail"
                class="w-4 h-4 text-brand-600 focus:ring-brand-500 rounded"
              />
              <div class="flex-1">
                <label for="sendEmail" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  Send invitation email with login credentials
                </label>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ form.sendEmail ? 'Email will be sent with password' : 'User will be created without email notification' }}
                </p>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                <span>{{ saving ? 'Inviting...' : 'Invite User' }}</span>
              </button>
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
  isOpen: Boolean
});

const emit = defineEmits(['close', 'user-invited']);

const authStore = useAuthStore();

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
  password: '',
  sendEmail: false
});

const passwordOption = ref('auto');
const saving = ref(false);
const error = ref('');
const availableRoles = ref([]);

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    resetForm();
    fetchRoles();
  }
});

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

const resetForm = () => {
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
    password: '',
    sendEmail: false
  };
  passwordOption.value = 'auto';
  error.value = '';
};

const close = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';

  try {
    const payload = {
      ...form.value
    };

    // If auto-generate, remove password field
    if (passwordOption.value === 'auto') {
      delete payload.password;
    }

    const response = await apiClient.post('/users', payload);

    if (response.success) {
      // If email not sent and password was auto-generated, show the password
      if (!form.value.sendEmail && response.data.tempPassword) {
        alert(`User created successfully!\n\nTemporary Password: ${response.data.tempPassword}\n\nPlease share this password with the user securely.`);
      }
      emit('user-invited');
      resetForm();
    } else {
      error.value = response.message || 'Failed to invite user';
    }
  } catch (err) {
    console.error('Error inviting user:', err);
    error.value = err.message || 'Failed to invite user';
  } finally {
    saving.value = false;
  }
};
</script>

