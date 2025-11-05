<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 sm:p-8" @click="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            New Module
          </h2>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Module Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Module Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g., Assets, Products, Cases"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              :class="{ 'border-red-500': formErrors.name }"
            />
            <p v-if="formErrors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ formErrors.name }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">The display name for this module</p>
          </div>

          <!-- Module Key -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Module Key <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.key"
              type="text"
              required
              placeholder="e.g., assets, products, cases"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              :class="{ 'border-red-500': formErrors.key }"
            />
            <p v-if="formErrors.key" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ formErrors.key }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Lowercase key used internally (auto-generated from name, duplicates are automatically handled)
              <span v-if="checkingDuplicate" class="text-blue-600 dark:text-blue-400 ml-1">Checking...</span>
            </p>
          </div>

          <!-- Form Actions -->
          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pt-6 -mx-6 -mb-6 px-6 pb-6 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="saving || !form.name || !form.key" 
              class="px-6 py-2.5 rounded-lg bg-brand-600 dark:bg-brand-700 text-white font-medium hover:bg-brand-700 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Creating...' : 'Create Module' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  module: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const saving = ref(false);
const formErrors = ref({});
const autoGenerateEnabled = ref(true);
const existingModules = ref([]);
const checkingDuplicate = ref(false);

const form = ref({
  name: '',
  key: ''
});

// Fetch existing modules to check for duplicates
const fetchExistingModules = async () => {
  try {
    const data = await apiClient.get('/modules');
    if (data.success && Array.isArray(data.data)) {
      existingModules.value = data.data.map(m => m.key.toLowerCase());
    }
  } catch (error) {
    console.error('Error fetching modules:', error);
    existingModules.value = [];
  }
};

// Generate base key from name
const generateBaseKey = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Check if key exists and generate unique key
const generateUniqueKey = async (baseKey) => {
  if (!baseKey) return '';
  
  let candidateKey = baseKey;
  let counter = 1;
  
  // Check if base key exists
  while (existingModules.value.includes(candidateKey)) {
    candidateKey = `${baseKey}-${counter}`;
    counter++;
    // Prevent infinite loop
    if (counter > 1000) break;
  }
  
  return candidateKey;
};

// Auto-generate key from name with duplicate checking
const autoGenerateKey = async () => {
  if (!autoGenerateEnabled.value || !form.value.name) return;
  
  checkingDuplicate.value = true;
  try {
    const baseKey = generateBaseKey(form.value.name);
    if (baseKey) {
      const uniqueKey = await generateUniqueKey(baseKey);
      form.value.key = uniqueKey;
    }
  } finally {
    checkingDuplicate.value = false;
  }
};

// Watch name changes to auto-generate key
watch(() => form.value.name, async () => {
  if (autoGenerateEnabled.value) {
    await autoGenerateKey();
  }
});

// Watch key input to disable auto-generation when user manually edits
watch(() => form.value.key, (newKey, oldKey) => {
  // If user is typing something different from what would be auto-generated, disable auto-gen
  const expectedKey = generateBaseKey(form.value.name);
  
  if (newKey !== expectedKey && !newKey.startsWith(expectedKey) && oldKey !== '') {
    autoGenerateEnabled.value = false;
  }
});

// Reset form when modal opens
watch(() => props.module, async (newModule) => {
  if (newModule) {
    form.value = {
      name: newModule.name || '',
      key: newModule.key || ''
    };
    autoGenerateEnabled.value = false; // Don't auto-generate when editing
  } else {
    // Fetch existing modules when opening for new module
    await fetchExistingModules();
    form.value = {
      name: '',
      key: ''
    };
    autoGenerateEnabled.value = true; // Re-enable auto-generation for new modules
    formErrors.value = {};
  }
}, { immediate: true });

onMounted(async () => {
  // Fetch existing modules on mount
  await fetchExistingModules();
});

const handleSubmit = async () => {
  saving.value = true;
  formErrors.value = {};

  try {
    // Validate
    if (!form.value.name || form.value.name.trim() === '') {
      formErrors.value.name = 'Module name is required';
      saving.value = false;
      return;
    }

    if (!form.value.key || form.value.key.trim() === '') {
      formErrors.value.key = 'Module key is required';
      saving.value = false;
      return;
    }

    // Validate key format (lowercase, alphanumeric, hyphens)
    const keyPattern = /^[a-z0-9-]+$/;
    if (!keyPattern.test(form.value.key)) {
      formErrors.value.key = 'Key must contain only lowercase letters, numbers, and hyphens';
      saving.value = false;
      return;
    }

    // Prepare submit data
    const submitData = {
      name: form.value.name.trim(),
      key: form.value.key.trim().toLowerCase()
    };

    const data = await apiClient.post('/modules', submitData);

    if (data.success) {
      // Refresh existing modules list to include the newly created module
      await fetchExistingModules();
      emit('saved', data.data);
    } else {
      // Handle API errors
      if (data.message) {
        if (data.message.includes('key') || data.message.includes('Key')) {
          formErrors.value.key = data.message;
        } else {
          formErrors.value.name = data.message;
        }
      }
      saving.value = false;
    }
  } catch (error) {
    console.error('Error creating module:', error);
    if (error.response?.data?.errors) {
      formErrors.value = error.response.data.errors;
    } else if (error.response?.data?.message) {
      const message = error.response.data.message;
      if (message.includes('key') || message.includes('Key')) {
        formErrors.value.key = message;
      } else {
        formErrors.value.name = message;
      }
    } else {
      alert(error.message || 'Failed to create module');
    }
    saving.value = false;
  }
};
</script>

