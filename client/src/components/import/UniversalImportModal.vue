<template>
  <!-- Module Selection Modal -->
  <Teleport to="body" v-if="!selectedModule">
    <div class="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Import Data</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto flex-1">
        <!-- Module Selection -->
        <div class="space-y-6">
          <div class="text-center">
            <svg class="mx-auto h-16 w-16 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Select Module to Import</h3>
            <p class="mt-2 text-gray-600 dark:text-gray-400">Choose which module you want to import data into</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Contacts -->
            <button
              @click="selectModule('Contacts')"
              class="w-full p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left group"
            >
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-8 h-8 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div class="flex-1 text-left">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Contacts
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Import customer contacts, leads, and prospects
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Fields: Name, Email, Phone, Company, etc.
                  </p>
                </div>
                <svg class="w-6 h-6 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <!-- Deals -->
            <button
              @click="selectModule('Deals')"
              class="w-full p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left group"
            >
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-green-500 to-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-8 h-8 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="flex-1 text-left">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Deals
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Import sales opportunities and deals
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Fields: Name, Amount, Stage, Status, etc.
                  </p>
                </div>
                <svg class="w-6 h-6 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <!-- Tasks -->
            <button
              @click="selectModule('Tasks')"
              class="w-full p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left group"
            >
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-8 h-8 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div class="flex-1 text-left">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Tasks
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Import tasks and to-do items
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Fields: Title, Description, Status, Priority, etc.
                  </p>
                </div>
                <svg class="w-6 h-6 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <!-- Organizations -->
            <button
              @click="selectModule('Organizations')"
              class="w-full p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left group"
            >
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-500 to-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-8 h-8 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div class="flex-1 text-left">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Organizations
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Import companies and organizations
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Fields: Name, Industry, Website, Phone, etc.
                  </p>
                </div>
                <svg class="w-6 h-6 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  </Teleport>

  <!-- CSV Import Modal (once module selected) -->
  <CSVImportModal 
    v-if="selectedModule"
    :entity-type="selectedModule"
    :file-name="fileName"
    @close="handleClose"
    @import-complete="handleImportComplete"
  />
</template>

<script setup>
import { ref } from 'vue';
import CSVImportModal from './CSVImportModal.vue';

const emit = defineEmits(['close', 'import-complete']);

const selectedModule = ref(null);
const fileName = ref('');

const selectModule = (module) => {
  selectedModule.value = module;
};

const handleClose = () => {
  // Reset and close
  selectedModule.value = null;
  fileName.value = '';
  emit('close');
};

const handleImportComplete = (data) => {
  emit('import-complete', data);
  handleClose();
};
</script>

<!-- All styling now uses pure Tailwind (no scoped CSS needed) -->

