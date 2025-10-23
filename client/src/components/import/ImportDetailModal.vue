<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Import Details</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 space-y-6">
        <!-- Import Overview -->
        <div class="bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-6">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <div class="w-14 h-14 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-8 h-8 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ importRecord.fileName }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Imported {{ formatDate(importRecord.createdAt) }} at {{ formatTime(importRecord.createdAt) }}
                </p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{{ formatModule(importRecord.module) }}</span>
                  <span :class="getStatusClass(importRecord.status)">{{ formatStatus(importRecord.status) }}</span>
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {{ successRate }}%
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">Success Rate</div>
            </div>
          </div>
        </div>

        <!-- Statistics Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ importRecord.stats?.total || 0 }}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Records</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-success-600 dark:text-success-400">{{ importRecord.stats?.created || 0 }}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">Created</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ importRecord.stats?.updated || 0 }}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">Updated</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-2xl font-bold text-danger-600 dark:text-danger-400">{{ importRecord.stats?.failed || 0 }}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">Failed</div>
          </div>
        </div>

        <!-- Import Details Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex space-x-8">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ tab.name }}
              <span v-if="tab.count !== undefined" class="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700">
                {{ tab.count }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-4">
            <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Imported By</span>
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-medium">
                  {{ (importRecord.importedBy?.firstName?.[0] || '') + (importRecord.importedBy?.lastName?.[0] || '') }}
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ importRecord.importedBy?.firstName }} {{ importRecord.importedBy?.lastName }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Processing Time</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatProcessingTime(importRecord.processingTime) }}</span>
            </div>

            <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Rows in CSV</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ importRecord.metadata?.totalRows || importRecord.stats.total }}</span>
            </div>

            <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Duplicate Check</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ importRecord.duplicateCheckEnabled ? 'Enabled' : 'Disabled' }}
                <span v-if="importRecord.duplicateCheckEnabled" class="text-sm text-gray-500">
                  ({{ importRecord.duplicateAction }})
                </span>
              </span>
            </div>

            <div v-if="importRecord.duplicateCheckFields?.length" class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Checked Fields</span>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="field in importRecord.duplicateCheckFields" 
                  :key="field"
                  class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                >
                  {{ field }}
                </span>
              </div>
            </div>
          </div>

          <!-- Field Mapping Tab -->
          <div v-if="activeTab === 'mapping'" class="space-y-4">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              CSV columns were mapped to the following CRM fields:
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
              <div 
                v-for="(crmField, csvField) in importRecord.metadata?.fieldMapping || {}"
                :key="csvField"
                class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
              >
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ csvField }}</span>
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span class="text-brand-600 dark:text-brand-400 font-medium">{{ crmField }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Errors Tab -->
          <div v-if="activeTab === 'errors'">
            <div v-if="!importRecord.errors || importRecord.errors.length === 0" class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="mt-2 text-gray-600 dark:text-gray-400">No errors during import</p>
            </div>
            <div v-else class="space-y-3">
              <div 
                v-for="(error, index) in importRecord.errors"
                :key="index"
                class="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4"
              >
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-danger-800 dark:text-danger-200">
                      Row {{ error.row }}
                    </div>
                    <div class="text-sm text-danger-700 dark:text-danger-300 mt-1">
                      {{ error.error }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-secondary">
          Close
        </button>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  importRecord: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

const activeTab = ref('overview');

const tabs = computed(() => [
  { id: 'overview', name: 'Overview' },
  { id: 'mapping', name: 'Field Mapping', count: Object.keys(props.importRecord.metadata?.fieldMapping || {}).length },
  { id: 'errors', name: 'Errors', count: props.importRecord.errors?.length || 0 }
]);

// Calculate success rate
const successRate = computed(() => {
  const total = props.importRecord.stats?.total || 0;
  if (total === 0) return 0;
  const successful = (props.importRecord.stats?.created || 0) + (props.importRecord.stats?.updated || 0);
  return Math.round((successful / total) * 100);
});

// Format helpers
const formatModule = (module) => {
  return module.charAt(0).toUpperCase() + module.slice(1);
};

const formatStatus = (status) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatProcessingTime = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const getStatusClass = (status) => {
  const classes = {
    completed: 'px-3 py-1 rounded-full text-xs font-medium bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
    partial: 'px-3 py-1 rounded-full text-xs font-medium bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300',
    failed: 'px-3 py-1 rounded-full text-xs font-medium bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300',
    processing: 'px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  };
  return classes[status] || 'px-3 py-1 rounded-full text-xs font-medium';
};
</script>

<!-- All styling now uses pure Tailwind (no scoped CSS needed) -->

