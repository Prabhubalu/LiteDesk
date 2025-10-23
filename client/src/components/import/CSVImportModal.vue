<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click="$emit('close')">
    <div class="card max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slide-up" @click.stop>
      <div class="card-header flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Import {{ entityType }}
        </h2>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="card-body space-y-6">
        <!-- Step Indicator -->
        <div class="flex items-center justify-between mb-8">
          <div v-for="(stepItem, index) in steps" :key="index" class="flex-1 flex items-center">
            <div :class="[
              'flex items-center justify-center w-10 h-10 rounded-full font-semibold',
              step > index ? 'bg-success-500 text-white' :
              step === index ? 'bg-brand-500 text-white' :
              'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            ]">
              <svg v-if="step > index" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div v-if="index < steps.length - 1" :class="[
              'flex-1 h-1 mx-2',
              step > index ? 'bg-success-500' : 'bg-gray-200 dark:bg-gray-700'
            ]"></div>
          </div>
        </div>

        <div class="text-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ steps[step].title }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ steps[step].description }}</p>
        </div>

        <!-- Step 1: Upload File -->
        <div v-if="step === 0">
          <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center hover:border-brand-500 transition-colors">
            <input 
              ref="fileInput"
              type="file" 
              accept=".csv"
              @change="handleFileSelect"
              class="hidden"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Upload CSV File</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Drag and drop your CSV file here, or click to browse</p>
            <button @click="$refs.fileInput.click()" class="btn-primary">
              Choose File
            </button>
            <p v-if="fileName" class="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Selected: <span class="font-medium">{{ fileName }}</span>
            </p>
          </div>
        </div>

        <!-- Step 2: Map Fields -->
        <div v-if="step === 1 && csvHeaders.length > 0">
          <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>{{ totalRows }} rows</strong> detected. Map your CSV columns to {{ entityType }} fields below:
            </p>
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="header in csvHeaders" :key="header" class="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="flex-1">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ header }}</label>
                <p v-if="preview[0] && preview[0][header]" class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  Example: {{ preview[0][header] }}
                </p>
              </div>
              <div class="flex-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400 mx-auto">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
              <div class="flex-1">
                <select v-model="fieldMapping[header]" class="input w-full">
                  <option value="">Skip this field</option>
                  <option v-for="field in availableFields" :key="field.value" :value="field.value">
                    {{ field.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>

        </div>

        <!-- Step 3: Check Duplicates -->
        <div v-if="step === 2">
          <!-- Duplicate Check Options (shown before checking) -->
          <div v-if="!checkingDuplicates && !duplicateData" class="mb-6">
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div class="flex items-start gap-3">
                <svg class="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Duplicate Detection Options</h3>
                  
                  <!-- Radio Buttons for Check/Don't Check -->
                  <div class="space-y-3 mb-6">
                    <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all" :class="shouldCheckDuplicates ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'">
                      <input 
                        type="radio" 
                        :value="true" 
                        v-model="shouldCheckDuplicates"
                        class="w-5 h-5 text-brand-600 border-gray-300 focus:ring-brand-500 mt-0.5 flex-shrink-0"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-semibold text-gray-900 dark:text-white">Check for Duplicates</span>
                          <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">Recommended</span>
                        </div>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Scan your CSV for duplicate records based on selected fields. You can choose to skip, update, or import them.
                        </p>
                      </div>
                    </label>
                    
                    <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all" :class="!shouldCheckDuplicates ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'">
                      <input 
                        type="radio" 
                        :value="false" 
                        v-model="shouldCheckDuplicates"
                        class="w-5 h-5 text-brand-600 border-gray-300 focus:ring-brand-500 mt-0.5 flex-shrink-0"
                      />
                      <div class="flex-1">
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">Do Not Check for Duplicates</span>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Import all records without duplicate checking. Use this if you're confident your data is clean.
                        </p>
                      </div>
                    </label>
                  </div>
                  
                  <!-- Field Selector (only shown if checking duplicates) -->
                  <div v-if="shouldCheckDuplicates" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Select which field(s) to use for duplicate checking. Records matching <strong>ALL</strong> selected fields will be considered duplicates.
                    </p>
                    
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duplicate Check Fields
                    </label>
                  
                  <!-- Multi-Select Dropdown -->
                  <div class="relative">
                    <button
                      type="button"
                      @click="showFieldDropdown = !showFieldDropdown"
                      class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                          <div v-if="duplicateCheckFields.length === 0" class="text-gray-500 dark:text-gray-400">
                            Select fields to check...
                          </div>
                          <div v-else class="flex flex-wrap gap-2">
                            <span
                              v-for="fieldValue in duplicateCheckFields"
                              :key="fieldValue"
                              class="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm rounded-md"
                            >
                              {{ duplicateCheckableFields.find(f => f.value === fieldValue)?.label }}
                              <button
                                @click.stop="removeField(fieldValue)"
                                class="hover:text-brand-900 dark:hover:text-brand-100"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        </div>
                        <svg class="w-5 h-5 text-gray-400 ml-2 flex-shrink-0 transition-transform" :class="{ 'rotate-180': showFieldDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    <!-- Dropdown Menu -->
                    <div
                      v-if="showFieldDropdown"
                      class="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-auto"
                    >
                      <div class="p-2">
                        <label
                          v-for="field in duplicateCheckableFields"
                          :key="field.value"
                          class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            :value="field.value"
                            v-model="duplicateCheckFields"
                            class="w-5 h-5 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 mt-0.5 flex-shrink-0"
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ field.label }}</span>
                              <span
                                v-if="field.recommended"
                                class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full"
                              >
                                Recommended
                              </span>
                            </div>
                            <span class="text-xs text-gray-500 dark:text-gray-400">{{ field.description }}</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                    <div class="mt-3 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                      <span>
                        <strong>AND Logic:</strong> A record is only considered a duplicate if it matches on <strong>ALL</strong> selected fields.
                        For example, selecting "Email + Company" means both the email AND company must match.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="checkingDuplicates" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-brand-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-900 dark:text-white">Checking for duplicates...</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Comparing {{ totalRows }} records</p>
          </div>

          <div v-else-if="duplicateData" class="space-y-6">
            <!-- Summary Cards -->
            <div class="grid grid-cols-3 gap-4">
              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ duplicateData.unique }}</p>
                  <p class="stat-label">New Records</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-warning-500 to-warning-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ duplicateData.duplicates }}</p>
                  <p class="stat-label">Duplicates Found</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ duplicateData.total }}</p>
                  <p class="stat-label">Total Rows</p>
                </div>
              </div>
            </div>

            <!-- Duplicate Handling Options -->
            <div class="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 class="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-4">
                How should we handle duplicates?
              </h4>
              <div class="space-y-3">
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'skip' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="skip" v-model="duplicateAction" class="mt-1 w-4 h-4 text-brand-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">Skip Duplicates</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Only import new records ({{ duplicateData.unique }} records)</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'update' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="update" v-model="duplicateAction" class="mt-1 w-4 h-4 text-brand-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">Update Existing Records</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Update {{ duplicateData.duplicates }} duplicates with new data</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'import-all' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="import-all" v-model="duplicateAction" class="mt-1 w-4 h-4 text-brand-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">Import All (Create Duplicates)</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Import all {{ duplicateData.total }} records, even duplicates</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Duplicate Records List -->
            <div v-if="duplicateData.duplicates > 0" class="max-h-64 overflow-y-auto">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 sticky top-0 bg-white dark:bg-gray-900 py-2">
                Duplicate Records ({{ duplicateData.duplicates }}):
              </h4>
              <div class="space-y-2">
                <div v-for="(dup, index) in duplicateData.duplicateRecords.slice(0, 10)" :key="index" 
                  class="p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        Row {{ dup.rowNumber }}: {{ Object.values(dup.data).slice(0, 3).join(', ') }}...
                      </p>
                      <p class="text-xs text-warning-700 dark:text-warning-300 mt-1">
                        Matches existing record by {{ dup.matchedField }}: <strong>{{ dup.matchedValue }}</strong>
                      </p>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Existing: {{ dup.existingRecord.first_name || dup.existingRecord.name }} ({{ new Date(dup.existingRecord.createdAt).toLocaleDateString() }})
                      </p>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-200 rounded">
                      Duplicate
                    </span>
                  </div>
                </div>
                <p v-if="duplicateData.duplicateRecords.length > 10" class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  ... and {{ duplicateData.duplicateRecords.length - 10 }} more duplicates
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Import Results -->
        <div v-if="step === 3">
          <div v-if="importing" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-brand-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-900 dark:text-white">Importing records...</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">This may take a moment</p>
          </div>

          <div v-else-if="importResults" class="space-y-6">
            <!-- Success Summary -->
            <div class="grid grid-cols-3 gap-4">
              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.created }}</p>
                  <p class="stat-label">Created</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.updated }}</p>
                  <p class="stat-label">Updated</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-danger-500 to-danger-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.failed }}</p>
                  <p class="stat-label">Failed</p>
                </div>
              </div>
            </div>

            <!-- Errors -->
            <div v-if="importResults.errors && importResults.errors.length > 0" class="max-h-64 overflow-y-auto">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Import Errors:</h4>
              <div class="space-y-2">
                <div v-for="(error, index) in importResults.errors" :key="index" class="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                  <p class="text-sm text-danger-800 dark:text-danger-200">
                    <strong>Row {{ error.row }}:</strong> {{ error.error }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Success Message -->
            <div v-else class="p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
              <p class="text-success-800 dark:text-success-200 text-center">
                <strong>✓</strong> All records imported successfully!
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <button v-if="step > 0 && !importing && !importResults && !checkingDuplicates" @click="step--" class="btn-secondary">
            Back
          </button>
          <div v-else></div>

          <div class="flex gap-3">
            <button @click="$emit('close')" class="btn-secondary">
              {{ importResults ? 'Close' : 'Cancel' }}
            </button>
            
            <!-- Check Duplicates button (Step 2, when checking is selected, before checking) -->
            <button 
              v-if="step === 2 && shouldCheckDuplicates && !duplicateData && !importing && !importResults"
              @click="checkDuplicates" 
              :disabled="duplicateCheckFields.length === 0 || checkingDuplicates"
              class="btn-primary"
            >
              <svg v-if="!checkingDuplicates" class="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {{ checkingDuplicates ? 'Checking...' : 'Check Duplicates' }}
            </button>
            
            <!-- Import Now button (Step 2, when NOT checking duplicates) -->
            <button 
              v-if="step === 2 && !shouldCheckDuplicates && !duplicateData && !importing && !importResults"
              @click="performImport" 
              class="btn-primary"
            >
              <svg class="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Now (Skip Duplicate Check)
            </button>
            
            <!-- Next/Import button (all other steps) -->
            <button 
              v-if="(step < 2 || (step === 2 && duplicateData)) && !importing && !importResults"
              @click="nextStep" 
              :disabled="!canProceed"
              class="btn-primary"
            >
              {{ step === 0 ? 'Next' : step === 1 ? 'Next' : 'Import Now' }}
            </button>
            
            <button 
              v-if="importResults"
              @click="$emit('import-complete'); $emit('close')"
              class="btn-primary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  entityType: {
    type: String,
    required: true,
    validator: (value) => ['Contacts', 'Deals', 'Tasks', 'Organizations'].includes(value)
  },
  fileName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'import-complete']);

const step = ref(0);
const fileName = ref(props.fileName || '');
const csvData = ref('');
const csvHeaders = ref([]);
const preview = ref([]);
const totalRows = ref(0);
const fieldMapping = reactive({});
const updateExisting = ref(false);
const importing = ref(false);
const importResults = ref(null);
const checkingDuplicates = ref(false);
const duplicateData = ref(null);
const duplicateAction = ref('skip'); // 'skip', 'update', 'import-all'
const duplicateCheckFields = ref([]); // Fields to check for duplicates
const showFieldDropdown = ref(false); // Control dropdown visibility
const shouldCheckDuplicates = ref(true); // Whether to check duplicates or not

const steps = [
  { title: 'Upload CSV File', description: 'Select your CSV file to import' },
  { title: 'Map Fields', description: 'Match CSV columns to fields' },
  { title: 'Check Duplicates', description: 'Review potential duplicates' },
  { title: 'Import Results', description: 'Review import results' }
];

const availableFields = computed(() => {
  if (props.entityType === 'Contacts') {
    return [
      { label: 'First Name', value: 'first_name' },
      { label: 'Last Name', value: 'last_name' },
      { label: 'Email', value: 'email' },
      { label: 'Phone', value: 'phone' },
      { label: 'Job Title', value: 'job_title' },
      { label: 'Company', value: 'company' },
      { label: 'Lifecycle Stage', value: 'lifecycle_stage' },
      { label: 'Lead Source', value: 'lead_source' },
      { label: 'Status', value: 'status' },
      { label: 'Lead Score', value: 'lead_score' }
    ];
  } else if (props.entityType === 'Deals') {
    return [
      { label: 'Name', value: 'name' },
      { label: 'Amount', value: 'amount' },
      { label: 'Stage', value: 'stage' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Expected Close Date', value: 'expectedCloseDate' }
    ];
  } else if (props.entityType === 'Tasks') {
    return [
      { label: 'Title', value: 'title' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Due Date', value: 'dueDate' },
      { label: 'Tags', value: 'tags' },
      { label: 'Time Estimate (minutes)', value: 'timeEstimate' }
    ];
  } else {
    // Organizations
    return [
      { label: 'Name', value: 'name' },
      { label: 'Industry', value: 'industry' },
      { label: 'Website', value: 'website' },
      { label: 'Phone', value: 'phone' },
      { label: 'Email', value: 'email' },
      { label: 'Address', value: 'address' }
    ];
  }
});

const duplicateCheckableFields = computed(() => {
  // Get only the fields that are actually mapped
  const mappedFields = Object.values(fieldMapping).filter(v => v);
  
  if (props.entityType === 'Contacts') {
    const fields = [
      { label: 'Email', value: 'email', description: 'recommended', recommended: true },
      { label: 'Phone', value: 'phone', description: 'alternative' },
      { label: 'First Name + Last Name', value: 'full_name', description: 'name match' },
      { label: 'Email + Company', value: 'email_company', description: 'strict match' },
      { label: 'Phone + Company', value: 'phone_company', description: 'strict match' }
    ];
    // Only show fields that are actually mapped in the CSV
    return fields.filter(field => {
      if (field.value === 'email') return mappedFields.includes('email');
      if (field.value === 'phone') return mappedFields.includes('phone');
      if (field.value === 'full_name') return mappedFields.includes('first_name') && mappedFields.includes('last_name');
      if (field.value === 'email_company') return mappedFields.includes('email') && mappedFields.includes('company');
      if (field.value === 'phone_company') return mappedFields.includes('phone') && mappedFields.includes('company');
      return false;
    });
  } else if (props.entityType === 'Deals') {
    const fields = [
      { label: 'Deal Name', value: 'name', description: 'recommended', recommended: true },
      { label: 'Name + Amount', value: 'name_amount', description: 'strict match' },
      { label: 'Name + Stage', value: 'name_stage', description: 'strict match' }
    ];
    return fields.filter(field => {
      if (field.value === 'name') return mappedFields.includes('name');
      if (field.value === 'name_amount') return mappedFields.includes('name') && mappedFields.includes('amount');
      if (field.value === 'name_stage') return mappedFields.includes('name') && mappedFields.includes('stage');
      return false;
    });
  } else if (props.entityType === 'Tasks') {
    const fields = [
      { label: 'Title', value: 'title', description: 'recommended', recommended: true }
    ];
    return fields.filter(field => {
      if (field.value === 'title') return mappedFields.includes('title');
      return false;
    });
  } else {
    // Organizations
    const fields = [
      { label: 'Name', value: 'name', description: 'recommended', recommended: true },
      { label: 'Email', value: 'email', description: 'alternative' }
    ];
    return fields.filter(field => {
      if (field.value === 'name') return mappedFields.includes('name');
      if (field.value === 'email') return mappedFields.includes('email');
      return false;
    });
  }
});

const canProceed = computed(() => {
  if (step.value === 0) return csvData.value && csvHeaders.value.length > 0;
  if (step.value === 1) return Object.values(fieldMapping).some(v => v);
  if (step.value === 2) {
    // If checking duplicates, must have fields selected and data checked
    if (shouldCheckDuplicates.value) {
      return duplicateCheckFields.value.length > 0 && duplicateData.value !== null;
    }
    // If not checking duplicates, always can proceed
    return true;
  }
  return false;
});

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.value = file.name;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    csvData.value = e.target.result;
    parseCSV();
    step.value = 1; // Move to next step after parsing
  };
  
  reader.readAsText(file);
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

const parseCSV = () => {
  try {
    const lines = csvData.value.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      alert('CSV file is empty');
      return;
    }

    // Parse headers
    csvHeaders.value = parseCSVLine(lines[0]);
    
    // Parse preview (first 5 rows)
    preview.value = lines.slice(1, 6).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      csvHeaders.value.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    // Total rows (excluding header)
    totalRows.value = lines.length - 1;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    alert('Error parsing CSV file. Please check the format and try again.');
  }
};

const nextStep = async () => {
  if (step.value === 2 && duplicateData.value) {
    // After duplicate check results, perform import
    await performImport();
  } else {
    step.value++;
  }
};

const checkDuplicates = async () => {
  try {
    checkingDuplicates.value = true;
    showFieldDropdown.value = false; // Close dropdown when checking

    const entityTypeMap = {
      'Contacts': 'contacts',
      'Deals': 'deals',
      'Tasks': 'tasks',
      'Organizations': 'organizations'
    };
    const endpoint = `/csv/check-duplicates/${entityTypeMap[props.entityType] || 'contacts'}`;
    
    const response = await apiClient.post(endpoint, {
      csvData: csvData.value,
      fieldMapping: fieldMapping,
      checkFields: duplicateCheckFields.value // Send selected fields to check
    });

    if (response.success) {
      duplicateData.value = response.data;
      
      // Auto-select action based on duplicate count
      if (response.data.duplicates === 0) {
        duplicateAction.value = 'import-all';
      } else {
        duplicateAction.value = 'skip';
      }
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
    alert('Error checking for duplicates. Please try again.');
  } finally {
    checkingDuplicates.value = false;
  }
};

const performImport = async () => {
  try {
    importing.value = true;
    step.value = 3;

    const entityTypeMap = {
      'Contacts': 'contacts',
      'Deals': 'deals',
      'Tasks': 'tasks',
      'Organizations': 'organizations'
    };
    const endpoint = `/csv/import/${entityTypeMap[props.entityType] || 'contacts'}`;
    
    // Determine updateExisting based on duplicate action
    const shouldUpdate = duplicateAction.value === 'update' || duplicateAction.value === 'import-all';
    
    const response = await apiClient.post(endpoint, {
      csvData: csvData.value,
      fieldMapping: fieldMapping,
      updateExisting: shouldUpdate,
      fileName: fileName.value,
      shouldCheckDuplicates: shouldCheckDuplicates.value,
      duplicateCheckFields: shouldCheckDuplicates.value ? duplicateCheckFields.value : []
    });

    if (response.success) {
      importResults.value = response.data;
    }
  } catch (error) {
    console.error('Error importing:', error);
    alert('Error importing data. Please try again.');
    step.value = 1;
  } finally {
    importing.value = false;
  }
};

// Remove a field from the duplicate check selection
const removeField = (fieldValue) => {
  duplicateCheckFields.value = duplicateCheckFields.value.filter(f => f !== fieldValue);
};

// Auto-select recommended duplicate check field when available fields change
watch(duplicateCheckableFields, (newFields) => {
  if (newFields.length > 0 && duplicateCheckFields.value.length === 0) {
    // Auto-select the first recommended field (usually email or name)
    const recommended = newFields.find(f => f.recommended);
    if (recommended) {
      duplicateCheckFields.value = [recommended.value];
    }
  }
}, { immediate: true });
</script>

