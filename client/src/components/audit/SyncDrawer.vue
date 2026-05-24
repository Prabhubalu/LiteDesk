<template>
  <!-- Sync Status Drawer (Mobile Bottom Sheet) -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 lg:hidden"
    @click.self="close"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="close"></div>
    
    <!-- Drawer -->
    <div class="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
      <!-- Handle -->
      <div class="flex items-center justify-center pt-3 pb-2">
        <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      </div>
      
      <!-- Header -->
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('audit.syncDrawerSyncStatus') }}</h3>
          <button
            @click="close"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <!-- Pending Actions Count -->
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ t('audit.syncDrawerPendingActions') }}</p>
              <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                {{ pendingCount }}
              </p>
            </div>
            <svg class="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <!-- Sync Now Button -->
        <button
          @click="handleSync"
          :disabled="isSyncing || !isOnline || pendingCount === 0"
          class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <svg
            v-if="isSyncing"
            class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ isSyncing ? 'Syncing...' : 'Sync Now' }}</span>
        </button>
        
        <!-- Error Details -->
        <div v-if="syncError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-red-800 dark:text-red-200">{{ t('audit.syncDrawerSyncStopped') }}</p>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ syncError }}</p>
              <div v-if="syncError.includes('state') || syncError.includes('closed') || syncError.includes('ownership')" class="mt-2 text-xs text-red-600 dark:text-red-400">
                <p class="font-medium mb-1">{{ t('audit.syncDrawerPossibleReasons') }}</p>
                <ul class="list-disc list-inside space-y-0.5">
                  <li v-if="syncError.includes('closed')">{{ t('audit.syncDrawerAuditWasClosedRemotely') }}</li>
                  <li v-if="syncError.includes('ownership')">{{ t('audit.syncDrawerYouNoLongerHaveAccess') }}</li>
                  <li v-if="syncError.includes('state')">{{ t('audit.syncDrawerAuditStateChangedOnServer') }}</li>
                </ul>
                <p class="mt-2">{{ t('audit.syncDrawerPleaseRefreshTheAuditAndTry') }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Success Message -->
        <div v-if="syncSuccess" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-green-800 dark:text-green-200">{{ t('audit.syncDrawerSyncComplete') }}</p>
              <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                {{ syncSuccess.synced }} action(s) synced successfully
              </p>
            </div>
          </div>
        </div>
        
        <!-- Offline Notice -->
        <div v-if="!isOnline" class="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 10m9.9 2.9a3 3 0 11-5.196-5.196" />
            </svg>
            <div class="flex-1">
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ t('audit.syncDrawerYoureCurrentlyOfflineActionsWillSync') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useOffline } from '@/composables/useOffline';
import { getPendingCount } from '@/services/offlineQueue.js';
import { syncPendingActions, isSyncInProgress, onSyncStatusChange } from '@/services/auditSyncEngine.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);

const { isOnline } = useOffline();
const pendingCount = ref(0);
const isSyncing = ref(false);
const syncError = ref(null);
const syncSuccess = ref(null);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const close = () => {
  isOpen.value = false;
  syncError.value = null;
  syncSuccess.value = null;
};

const updatePendingCount = async () => {
  try {
    pendingCount.value = await getPendingCount();
  } catch (err) {
    console.error('[SyncDrawer] Error getting pending count:', err);
  }
};

const handleSync = async () => {
  if (!isOnline.value || isSyncing.value || pendingCount.value === 0) {
    return;
  }
  
  isSyncing.value = true;
  syncError.value = null;
  syncSuccess.value = null;
  
  try {
    const result = await syncPendingActions({
      onProgress: (current, total) => {
        console.log(`[SyncDrawer] Progress: ${current}/${total}`);
      }
    });
    
    if (result.success) {
      syncSuccess.value = {
        synced: result.synced,
        total: result.total
      };
      await updatePendingCount();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        syncSuccess.value = null;
      }, 3000);
    } else {
      syncError.value = result.errors[0]?.error || 'Sync failed';
    }
  } catch (err) {
    console.error('[SyncDrawer] Sync error:', err);
    syncError.value = err.message || 'Failed to sync. Please try again.';
  } finally {
    isSyncing.value = false;
  }
};

// Listen to sync status changes
let syncStatusUnsubscribe = null;
let pendingCountInterval = null;

onMounted(async () => {
  await updatePendingCount();
  
  // Update pending count periodically
  pendingCountInterval = setInterval(updatePendingCount, 5000);
  
  // Listen to sync status
  syncStatusUnsubscribe = onSyncStatusChange((status, data) => {
    if (status === 'started') {
      isSyncing.value = true;
    } else if (status === 'completed') {
      isSyncing.value = false;
      updatePendingCount();
    } else if (status === 'error') {
      isSyncing.value = false;
      syncError.value = data.error || 'Sync failed';
    }
  });
});

onBeforeUnmount(() => {
  if (pendingCountInterval) {
    clearInterval(pendingCountInterval);
  }
  if (syncStatusUnsubscribe) {
    syncStatusUnsubscribe();
  }
});
</script>

