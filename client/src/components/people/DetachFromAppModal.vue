<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
        @click.self="close"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" @click.stop>
          <!-- Header -->
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Detach from {{ formatAppName(appKey) }}</h2>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Remove this person's participation in {{ formatAppName(appKey) }}
              </p>
            </div>
            <button
              @click="close"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-6">
            <!-- Warning Banner -->
            <div class="mb-6 p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <div>
                  <h3 class="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">
                    What happens when you detach?
                  </h3>
                  <ul class="text-sm text-warning-700 dark:text-warning-300 space-y-2 list-disc list-inside">
                    <li>This person will be removed from {{ formatAppName(appKey) }}</li>
                    <li>{{ t('people.detachFromAppModalHistoricalRecordsAndActivityLogsWill') }}</li>
                    <li>You can re-attach this person to {{ formatAppName(appKey) }} later if needed</li>
                    <li v-if="detachReason">{{ detachReason }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div v-if="error" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm text-danger-700 dark:text-danger-300">{{ error }}</p>
                </div>
              </div>
            </div>

            <!-- Confirmation Message -->
            <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ t('people.detachFromAppModalThisWillRemoveThisPersonFrom') }}<strong>{{ formatAppName(appKey) }}</strong>.
                {{ getDetachMessage() }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                @click="close"
                :disabled="loading"
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                type="button"
                @click="handleDetach"
                :disabled="loading"
                class="px-6 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg v-if="loading" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ loading ? 'Detaching...' : 'Detach from ' + formatAppName(appKey) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { getDetachReason } from './detachPolicy';
import { assertLifecyclePermission } from '@/platform/permissions/peopleGuards';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  personId: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    required: true
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'detached']);

const loading = ref(false);
const error = ref(null);

// Format app name
const formatAppName = (appKey) => {
  const appNames = {
    'SALES': 'Sales',
    'HELPDESK': 'Helpdesk',
    'MARKETING': 'Marketing',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects',
    'LMS': 'LMS'
  };
  return appNames[appKey] || appKey;
};

// Get detach reason from policy
const detachReason = computed(() => {
  return getDetachReason(props.appKey);
});

// Get detach message based on app
const getDetachMessage = () => {
  const appKey = props.appKey?.toUpperCase();
  
  if (appKey === 'MARKETING') {
    return 'Campaign history will be preserved.';
  }
  
  // Default message
  return 'Historical records will be preserved.';
};

// Close handler
const close = () => {
  if (!loading.value) {
    error.value = null;
    emit('close');
  }
};

// Handle detach
const handleDetach = async () => {
  // Guard: Check lifecycle permission before submitting
  assertLifecyclePermission(props.appKey);
  
  error.value = null;
  loading.value = true;
  
  try {
    const response = await apiClient.post(`/people/${props.personId}/detach`, {
      appKey: props.appKey
    });
    
    if (response.success) {
      emit('detached', {
        appKey: props.appKey,
        personId: props.personId,
        data: response.data
      });
      close();
    } else {
      error.value = response.message || 'Failed to detach from app';
    }
  } catch (err) {
    console.error('Error detaching from app:', err);
    
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else if (err.response?.data?.code === 'DETACH_NOT_ALLOWED') {
      error.value = 'Detachment is not allowed for this app.';
    } else {
      error.value = err.message || 'Error detaching from app';
    }
  } finally {
    loading.value = false;
  }
};
</script>

