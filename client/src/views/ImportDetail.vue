<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">Loading import...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Import</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/imports')" class="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium">
          Back to Imports
        </button>
      </div>
    </div>

    <!-- Import Detail Content -->
    <div v-else-if="importRecord" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/imports')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">Back</span>
        </button>

        <div class="flex items-center gap-2">
          <button @click="navigateToModule" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all">
            <span>Go to {{ formatModule(importRecord.module) }}</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Header Card -->
      <div class="bg-gradient-to-r from-brand-50 to-purple-50 dark:from-brand-900/20 dark:to-purple-900/20 border border-brand-200 dark:border-brand-800/50 rounded-xl p-4 mb-4">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ importRecord.fileName }}</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {{ formatDate(importRecord.createdAt) }} at {{ formatTime(importRecord.createdAt) }}
              </p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                  {{ formatModule(importRecord.module) }}
                </span>
                <span :class="getStatusClass(importRecord.status)">
                  {{ formatStatus(importRecord.status) }}
                </span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">{{ successRate }}%</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">Success</div>
          </div>
        </div>
      </div>

      <!-- Statistics Grid -->
      <div class="grid grid-cols-5 gap-3 mb-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center">
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ importRecord.stats?.total || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Total</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.created || 0) === 0 }"
          @click="viewRecords('created')"
        >
          <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ importRecord.stats?.created || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Created</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.updated || 0) === 0 }"
          @click="viewRecords('updated')"
        >
          <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ importRecord.stats?.updated || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Updated</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.skipped || 0) === 0 }"
          @click="viewRecords('skipped')"
        >
          <div class="text-xl font-bold text-yellow-600 dark:text-yellow-400">{{ importRecord.stats?.skipped || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Skipped</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.failed || 0) === 0 }"
          @click="viewRecords('failed')"
        >
          <div class="text-xl font-bold text-red-600 dark:text-red-400">{{ importRecord.stats?.failed || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Failed</div>
        </div>
      </div>

      <!-- Records View Modal -->
      <div v-if="showRecordsView" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4 border-2 border-brand-500">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ recordsViewTitle }}</h3>
          <button @click="closeRecordsView" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Created/Updated Records -->
        <div v-if="selectedRecordType === 'created' || selectedRecordType === 'updated'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ importRecord.stats[selectedRecordType] }} record(s) were {{ selectedRecordType }} during this import.
          </p>
          
          <!-- Loading -->
          <div v-if="loadingRecords" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
          
          <!-- Records Table -->
          <div v-else-if="displayRecords.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th v-for="header in tableHeaders" :key="header" class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="record in displayRecords" :key="record._id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td v-for="header in tableHeaders" :key="header" class="px-3 py-2 text-xs text-gray-900 dark:text-white">
                    {{ getRecordValue(record, header) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Empty State -->
          <div v-else class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            Unable to fetch records. They may have been deleted or modified.
          </div>
        </div>

        <!-- Skipped Records -->
        <div v-if="selectedRecordType === 'skipped'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ importRecord.stats.skipped }} record(s) were skipped during this import.
          </p>
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Records Skipped</p>
                <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  These records were skipped because they were identified as duplicates.
                  <span v-if="importRecord.duplicateCheckEnabled">
                    Checked on: <strong>{{ importRecord.duplicateCheckFields?.join(', ') || 'default fields' }}</strong>.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Failed Records -->
        <div v-if="selectedRecordType === 'failed'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ importRecord.stats.failed }} record(s) failed during this import:
          </p>
          <div v-if="importRecord.errors && importRecord.errors.length > 0" class="space-y-2 max-h-80 overflow-y-auto">
            <div 
              v-for="(error, index) in importRecord.errors"
              :key="index"
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
            >
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <div class="text-xs font-medium text-red-800 dark:text-red-200">Row {{ error.row }}</div>
                  <div class="text-xs text-red-700 dark:text-red-300 mt-0.5">{{ error.error }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">No error details available.</div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex space-x-6 px-4">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
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
        <div class="p-4">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Imported By</span>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-medium">
                  {{ (importRecord.importedBy?.firstName?.[0] || '') + (importRecord.importedBy?.lastName?.[0] || '') }}
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ importRecord.importedBy?.firstName }} {{ importRecord.importedBy?.lastName }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Processing Time</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatProcessingTime(importRecord.processingTime) }}</span>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Rows</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ importRecord.metadata?.totalRows || importRecord.stats?.total || 0 }}</span>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Duplicate Check</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ importRecord.duplicateCheckEnabled ? 'Enabled' : 'Disabled' }}
                <span v-if="importRecord.duplicateCheckEnabled" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({{ importRecord.duplicateAction }})
                </span>
              </span>
            </div>

            <div v-if="importRecord.duplicateCheckFields?.length" class="flex items-start justify-between py-2">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Checked Fields</span>
              <div class="flex flex-wrap gap-1.5 max-w-md justify-end">
                <span 
                  v-for="field in importRecord.duplicateCheckFields" 
                  :key="field"
                  class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                >
                  {{ field }}
                </span>
              </div>
            </div>
          </div>

          <!-- Field Mapping Tab -->
          <div v-if="activeTab === 'mapping'" class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              CSV columns were mapped to the following CRM fields:
            </p>
            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
              <div 
                v-for="(crmField, csvField) in importRecord.metadata?.fieldMapping || {}"
                :key="csvField"
                class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
              >
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ csvField }}</span>
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span class="text-sm text-brand-600 dark:text-brand-400 font-medium">{{ crmField }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Errors Tab -->
          <div v-if="activeTab === 'errors'">
            <div v-if="!importRecord.errors || importRecord.errors.length === 0" class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm text-gray-600 dark:text-gray-400">No errors during import</p>
            </div>
            <div v-else class="space-y-2">
              <div 
                v-for="(error, index) in importRecord.errors"
                :key="index"
                class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <div class="text-xs font-medium text-red-800 dark:text-red-200">Row {{ error.row }}</div>
                    <div class="text-xs text-red-700 dark:text-red-300 mt-0.5">{{ error.error }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';

const route = useRoute();
const router = useRouter();

const importRecord = ref(null);
const loading = ref(true);
const error = ref(null);
const activeTab = ref('overview');
const showRecordsView = ref(false);
const selectedRecordType = ref(null);
const loadingRecords = ref(false);
const displayRecords = ref([]);

const tabs = computed(() => [
  { id: 'overview', name: 'Overview' },
  { id: 'mapping', name: 'Field Mapping', count: Object.keys(importRecord.value?.metadata?.fieldMapping || {}).length },
  { id: 'errors', name: 'Errors', count: importRecord.value?.errors?.length || 0 }
]);

const successRate = computed(() => {
  if (!importRecord.value?.stats) return 0;
  const total = importRecord.value.stats.total || 0;
  if (total === 0) return 0;
  const successful = (importRecord.value.stats.created || 0) + (importRecord.value.stats.updated || 0);
  return Math.round((successful / total) * 100);
});

const recordsViewTitle = computed(() => {
  if (!selectedRecordType.value) return '';
  const type = selectedRecordType.value;
  const count = importRecord.value?.stats?.[type] || 0;
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Records (${count})`;
});

const tableHeaders = computed(() => {
  if (!importRecord.value) return [];
  
  const headers = {
    contacts: ['Name', 'Email', 'Phone', 'Company', 'Created At'],
    deals: ['Name', 'Amount', 'Stage', 'Status', 'Expected Close', 'Created At'],
    tasks: ['Title', 'Status', 'Priority', 'Due Date', 'Assigned To', 'Created At'],
    organizations: ['Name', 'Industry', 'Website', 'Phone', 'Created At']
  };
  
  return headers[importRecord.value.module] || [];
});

const fetchImportDetails = async () => {
  try {
    loading.value = true;
    const response = await apiClient.get(`/imports/${route.params.id}`);
    if (response.success) {
      importRecord.value = response.data;
    } else {
      error.value = 'Import record not found';
    }
  } catch (err) {
    console.error('Error fetching import details:', err);
    error.value = err.message || 'Failed to load import details';
  } finally {
    loading.value = false;
  }
};

const formatModule = (module) => module.charAt(0).toUpperCase() + module.slice(1);
const formatStatus = (status) => status.charAt(0).toUpperCase() + status.slice(1);

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatProcessingTime = (ms) => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const getStatusClass = (status) => {
  const classes = {
    completed: 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    partial: 'px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    failed: 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    processing: 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium'
  };
  return classes[status] || 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium';
};

const fetchRecords = async (type) => {
  if (!importRecord.value) return;
  
  loadingRecords.value = true;
  displayRecords.value = [];
  
  try {
    const response = await apiClient.get(`/imports/${importRecord.value._id}/records/${type}`);
    if (response.success && response.data) {
      displayRecords.value = response.data || [];
    }
  } catch (err) {
    console.error('Error fetching records:', err);
    displayRecords.value = [];
  } finally {
    loadingRecords.value = false;
  }
};

const getRecordValue = (record, header) => {
  const module = importRecord.value.module;
  
  const fieldMap = {
    contacts: {
      'Name': r => `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'N/A',
      'Email': r => r.email || 'N/A',
      'Phone': r => r.phone || 'N/A',
      'Company': r => r.company || 'N/A',
      'Created At': r => new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    deals: {
      'Name': r => r.name || 'N/A',
      'Amount': r => r.amount ? `$${r.amount.toLocaleString()}` : 'N/A',
      'Stage': r => r.stage || 'N/A',
      'Status': r => r.status || 'N/A',
      'Expected Close': r => r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
      'Created At': r => new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    tasks: {
      'Title': r => r.title || 'N/A',
      'Status': r => r.status || 'N/A',
      'Priority': r => r.priority || 'N/A',
      'Due Date': r => r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
      'Assigned To': r => r.assignedTo ? `${r.assignedTo.firstName || ''} ${r.assignedTo.lastName || ''}`.trim() : 'N/A',
      'Created At': r => new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    organizations: {
      'Name': r => r.name || 'N/A',
      'Industry': r => r.industry || 'N/A',
      'Website': r => r.website || 'N/A',
      'Phone': r => r.phone || 'N/A',
      'Created At': r => new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  };
  
  const moduleFields = fieldMap[module];
  if (!moduleFields || !moduleFields[header]) return 'N/A';
  
  return moduleFields[header](record);
};

const viewRecords = (type) => {
  const count = importRecord.value?.stats?.[type] || 0;
  if (count === 0) return;
  
  selectedRecordType.value = type;
  showRecordsView.value = true;
  
  if (type === 'created' || type === 'updated') {
    fetchRecords(type);
  }
  
  setTimeout(() => {
    const recordsElement = document.querySelector('.border-brand-500');
    if (recordsElement) {
      recordsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
};

const closeRecordsView = () => {
  showRecordsView.value = false;
  selectedRecordType.value = null;
  displayRecords.value = [];
};

const navigateToModule = () => {
  const moduleRoutes = {
    contacts: '/contacts',
    deals: '/deals',
    tasks: '/tasks',
    organizations: '/organizations'
  };
  
  const route = moduleRoutes[importRecord.value.module];
  if (route) {
    router.push(route);
  }
};

onMounted(() => {
  fetchImportDetails();
});
</script>
