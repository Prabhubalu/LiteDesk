<template>
  <div class="page-container">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">{{ error }}</h3>
      <div class="mt-6">
        <button @click="$router.push('/imports')" class="btn-primary">
          Back to Imports
        </button>
      </div>
    </div>

    <!-- Import Detail Content -->
    <div v-else-if="importRecord">
      <!-- Header with Back Button -->
      <div class="mb-6">
        <button @click="$router.push('/imports')" class="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 mb-4">
          <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Imports
        </button>
        
        <h1 class="page-title">Import Details</h1>
        <p class="page-subtitle">View detailed information about this import</p>
      </div>

      <!-- Import Overview Card -->
      <div class="bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-6 mb-6">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0">
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
                <span class="badge badge-secondary">{{ formatModule(importRecord.module) }}</span>
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
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="stat-card cursor-default">
          <div class="stat-value text-gray-900 dark:text-white">{{ importRecord.stats?.total || 0 }}</div>
          <div class="stat-label">Total Records</div>
        </div>
        <div 
          class="stat-card cursor-pointer hover:shadow-lg transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.created || 0) === 0 }"
          @click="viewRecords('created')"
        >
          <div class="stat-value text-success-600 dark:text-success-400">{{ importRecord.stats?.created || 0 }}</div>
          <div class="stat-label">Created</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view</div>
        </div>
        <div 
          class="stat-card cursor-pointer hover:shadow-lg transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.updated || 0) === 0 }"
          @click="viewRecords('updated')"
        >
          <div class="stat-value text-blue-600 dark:text-blue-400">{{ importRecord.stats?.updated || 0 }}</div>
          <div class="stat-label">Updated</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view</div>
        </div>
        <div 
          class="stat-card cursor-pointer hover:shadow-lg transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.skipped || 0) === 0 }"
          @click="viewRecords('skipped')"
        >
          <div class="stat-value text-warning-600 dark:text-warning-400">{{ importRecord.stats?.skipped || 0 }}</div>
          <div class="stat-label">Skipped</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view</div>
        </div>
        <div 
          class="stat-card cursor-pointer hover:shadow-lg transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.failed || 0) === 0 }"
          @click="viewRecords('failed')"
        >
          <div class="stat-value text-danger-600 dark:text-danger-400">{{ importRecord.stats?.failed || 0 }}</div>
          <div class="stat-label">Failed</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view</div>
        </div>
      </div>

      <!-- Records View Modal/Section -->
      <div v-if="showRecordsView" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border-2 border-brand-500">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ recordsViewTitle }}
          </h3>
          <button @click="closeRecordsView" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Created Records -->
        <div v-if="selectedRecordType === 'created'" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ importRecord.stats.created }} record(s) were successfully created during this import.
            </p>
            <button @click="navigateToModule" class="btn-sm btn-secondary flex items-center gap-2">
              <span>Go to {{ formatModule(importRecord.module) }}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
          
          <!-- Loading -->
          <div v-if="loadingRecords" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
          
          <!-- Records Table -->
          <div v-else-if="displayRecords.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th v-for="header in tableHeaders" :key="header" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="record in displayRecords" :key="record._id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td v-for="header in tableHeaders" :key="header" class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {{ getRecordValue(record, header) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Empty State -->
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            Unable to fetch records. They may have been deleted or modified.
          </div>
        </div>

        <!-- Updated Records -->
        <div v-if="selectedRecordType === 'updated'" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ importRecord.stats.updated }} record(s) were updated during this import.
            </p>
            <button @click="navigateToModule" class="btn-sm btn-secondary flex items-center gap-2">
              <span>Go to {{ formatModule(importRecord.module) }}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
          
          <!-- Loading -->
          <div v-if="loadingRecords" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
          
          <!-- Records Table -->
          <div v-else-if="displayRecords.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th v-for="header in tableHeaders" :key="header" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="record in displayRecords" :key="record._id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td v-for="header in tableHeaders" :key="header" class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {{ getRecordValue(record, header) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Empty State -->
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            Unable to fetch records. They may have been deleted or modified.
          </div>
        </div>

        <!-- Skipped Records -->
        <div v-if="selectedRecordType === 'skipped'">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ importRecord.stats.skipped }} record(s) were skipped during this import.
          </p>
          <div class="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div>
                <p class="text-sm font-medium text-warning-800 dark:text-warning-200">Records Skipped</p>
                <p class="text-sm text-warning-700 dark:text-warning-300 mt-1">
                  These records were skipped because they were identified as duplicates based on your duplicate check settings. 
                  <span v-if="importRecord.duplicateCheckEnabled">
                    Duplicate check was performed on: <strong>{{ importRecord.duplicateCheckFields?.join(', ') || 'default fields' }}</strong>.
                  </span>
                </p>
                <p class="text-sm text-warning-700 dark:text-warning-300 mt-2">
                  To import these records, you can either:
                </p>
                <ul class="list-disc list-inside text-sm text-warning-700 dark:text-warning-300 mt-2 space-y-1">
                  <li>Re-import with "Do Not Check Duplicates" option</li>
                  <li>Re-import with "Update Existing Records" action</li>
                  <li>Re-import with "Import All (Create Duplicates)" action</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Failed Records -->
        <div v-if="selectedRecordType === 'failed'">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ importRecord.stats.failed }} record(s) failed during this import. See details below:
          </p>
          <div v-if="importRecord.errors && importRecord.errors.length > 0" class="space-y-3 max-h-96 overflow-y-auto">
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
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            No error details available.
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex space-x-8 px-6">
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
        <div class="p-6">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-4">
            <div class="detail-row">
              <span class="detail-label">Imported By</span>
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-medium">
                  {{ (importRecord.importedBy?.firstName?.[0] || '') + (importRecord.importedBy?.lastName?.[0] || '') }}
                </div>
                <span class="detail-value">
                  {{ importRecord.importedBy?.firstName }} {{ importRecord.importedBy?.lastName }}
                </span>
              </div>
            </div>

            <div class="detail-row">
              <span class="detail-label">Processing Time</span>
              <span class="detail-value">{{ formatProcessingTime(importRecord.processingTime) }}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Total Rows in CSV</span>
              <span class="detail-value">{{ importRecord.metadata?.totalRows || importRecord.stats?.total || 0 }}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Duplicate Check</span>
              <span class="detail-value">
                {{ importRecord.duplicateCheckEnabled ? 'Enabled' : 'Disabled' }}
                <span v-if="importRecord.duplicateCheckEnabled" class="text-sm text-gray-500">
                  ({{ importRecord.duplicateAction }})
                </span>
              </span>
            </div>

            <div v-if="importRecord.duplicateCheckFields?.length" class="detail-row">
              <span class="detail-label">Checked Fields</span>
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

// Calculate success rate
const successRate = computed(() => {
  if (!importRecord.value?.stats) return 0;
  const total = importRecord.value.stats.total || 0;
  if (total === 0) return 0;
  const successful = (importRecord.value.stats.created || 0) + (importRecord.value.stats.updated || 0);
  return Math.round((successful / total) * 100);
});

// Records view title
const recordsViewTitle = computed(() => {
  if (!selectedRecordType.value) return '';
  const type = selectedRecordType.value;
  const count = importRecord.value?.stats?.[type] || 0;
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Records (${count})`;
});

// Table headers based on module type
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

// Fetch import details
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

// Format helpers
const formatModule = (module) => {
  return module.charAt(0).toUpperCase() + module.slice(1);
};

const formatStatus = (status) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatProcessingTime = (ms) => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const getStatusClass = (status) => {
  const classes = {
    completed: 'badge badge-success',
    partial: 'badge badge-warning',
    failed: 'badge badge-danger',
    processing: 'badge badge-info'
  };
  return classes[status] || 'badge';
};

// Fetch records from the import history
const fetchRecords = async (type) => {
  if (!importRecord.value) return;
  
  loadingRecords.value = true;
  displayRecords.value = [];
  
  try {
    // Fetch the specific records that were imported using the new endpoint
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

// Get record value for display
const getRecordValue = (record, header) => {
  const module = importRecord.value.module;
  
  // Map headers to record fields
  const fieldMap = {
    contacts: {
      'Name': record => `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'N/A',
      'Email': record => record.email || 'N/A',
      'Phone': record => record.phone || 'N/A',
      'Company': record => record.company || 'N/A',
      'Created At': record => formatDateTime(record.createdAt)
    },
    deals: {
      'Name': record => record.name || 'N/A',
      'Amount': record => record.amount ? `$${record.amount.toLocaleString()}` : 'N/A',
      'Stage': record => record.stage || 'N/A',
      'Status': record => record.status || 'N/A',
      'Expected Close': record => record.expectedCloseDate ? formatDate(record.expectedCloseDate) : 'N/A',
      'Created At': record => formatDateTime(record.createdAt)
    },
    tasks: {
      'Title': record => record.title || 'N/A',
      'Status': record => record.status || 'N/A',
      'Priority': record => record.priority || 'N/A',
      'Due Date': record => record.dueDate ? formatDate(record.dueDate) : 'N/A',
      'Assigned To': record => record.assignedTo ? `${record.assignedTo.firstName || ''} ${record.assignedTo.lastName || ''}`.trim() : 'N/A',
      'Created At': record => formatDateTime(record.createdAt)
    },
    organizations: {
      'Name': record => record.name || 'N/A',
      'Industry': record => record.industry || 'N/A',
      'Website': record => record.website || 'N/A',
      'Phone': record => record.phone || 'N/A',
      'Created At': record => formatDateTime(record.createdAt)
    }
  };
  
  const moduleFields = fieldMap[module];
  if (!moduleFields || !moduleFields[header]) return 'N/A';
  
  return moduleFields[header](record);
};

// Format date and time
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// View records by type
const viewRecords = (type) => {
  const count = importRecord.value?.stats?.[type] || 0;
  if (count === 0) return; // Don't show if no records
  
  selectedRecordType.value = type;
  showRecordsView.value = true;
  
  // Fetch records only for created and updated
  if (type === 'created' || type === 'updated') {
    fetchRecords(type);
  }
  
  // Scroll to records view
  setTimeout(() => {
    const recordsElement = document.querySelector('.border-brand-500');
    if (recordsElement) {
      recordsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
};

// Close records view
const closeRecordsView = () => {
  showRecordsView.value = false;
  selectedRecordType.value = null;
  displayRecords.value = [];
};

// Navigate to module
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

<style scoped>
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-success {
  background-color: #f0fdf4;
  color: #047857;
}

:global(.dark) .badge-success {
  background-color: rgba(4, 120, 87, 0.3);
  color: #6ee7b7;
}

.badge-warning {
  background-color: #fffbeb;
  color: #b45309;
}

:global(.dark) .badge-warning {
  background-color: rgba(180, 83, 9, 0.3);
  color: #fcd34d;
}

.badge-danger {
  background-color: #fef2f2;
  color: #b91c1c;
}

:global(.dark) .badge-danger {
  background-color: rgba(185, 28, 28, 0.3);
  color: #fca5a5;
}

.badge-info {
  background-color: #dbeafe;
  color: #1d4ed8;
}

:global(.dark) .badge-info {
  background-color: rgba(29, 78, 216, 0.3);
  color: #93c5fd;
}

.badge-secondary {
  background-color: #f3f4f6;
  color: #374151;
}

:global(.dark) .badge-secondary {
  background-color: #374151;
  color: #d1d5db;
}

.stat-card {
  background-color: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  text-align: center;
}

:global(.dark) .stat-card {
  background-color: #1f2937;
  border-color: #374151;
}

.stat-value {
  font-size: 1.875rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.875rem;
  color: #4b5563;
  margin-top: 0.5rem;
}

:global(.dark) .stat-label {
  color: #9ca3af;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row:last-child {
  border-bottom: none;
}

:global(.dark) .detail-row {
  border-bottom-color: #374151;
}

.detail-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
}

:global(.dark) .detail-label {
  color: #9ca3af;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

:global(.dark) .detail-value {
  color: white;
}
</style>

