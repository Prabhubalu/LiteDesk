<template>
  <div class="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click="$emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-slide-up border border-gray-200 dark:border-gray-700" @click.stop>
      <!-- Header with Gradient -->
      <div class="relative bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 px-8 py-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 class="text-2xl font-bold text-white">
                Import {{ entityType }}
              </h2>
              <p class="text-indigo-100 text-sm mt-0.5">{{ t('import.cSVImportModalUploadAndMapYourCsvData') }}</p>
            </div>
          </div>
          <button @click="$emit('close')" class="p-2.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modern Step Indicator -->
        <div class="mt-6 relative">
          <div class="flex items-center justify-between">
            <div v-for="(stepItem, index) in steps" :key="index" class="flex-1 flex items-center">
              <div class="relative flex flex-col items-center flex-1">
                <div :class="[
                  'relative z-10 flex items-center justify-center w-11 h-11 rounded-full font-semibold transition-all duration-300 shadow-lg',
                  step > index ? 'bg-white text-indigo-600 scale-100' :
                  step === index ? 'bg-white text-indigo-600 scale-110 ring-4 ring-white/30' :
                  'bg-white/20 text-white/60 scale-90'
                ]">
                  <svg v-if="step > index" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span v-else class="text-base font-bold">{{ index + 1 }}</span>
                </div>
                <div class="mt-2 text-xs font-medium text-white/90">{{ stepItem.shortTitle || stepItem.title }}</div>
              </div>
              <div v-if="index < steps.length - 1" :class="[
                'flex-1 h-1 -mx-3 rounded-full transition-all duration-300',
                step > index ? 'bg-white' : 'bg-white/20'
              ]"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto px-8 py-6 bg-gray-50 dark:bg-gray-800/50">
        <div class="max-w-3xl mx-auto">
          <!-- Step Title & Description -->
          <div class="text-center mb-8">
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ steps[step].title }}</h3>
            <p class="text-gray-600 dark:text-gray-400">{{ steps[step].description }}</p>
          </div>

          <!-- Step 1: Upload File -->
          <div v-if="step === 0">
            <div class="relative group">
              <div class="border-3 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-16 text-center bg-white dark:bg-gray-900 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-300 cursor-pointer shadow-sm" 
                   @click="$refs.fileInput.click()"
                   @dragover.prevent
                   @drop.prevent="handleFileDrop">
                <input 
                  ref="fileInput"
                  type="file" 
                  accept=".csv"
                  @change="handleFileSelect"
                  class="hidden"
                />
                
                <div v-if="!fileName" class="space-y-4">
                  <div class="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-indigo-600 dark:text-indigo-400">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ t('import.cSVImportModalUploadYourCsvFile') }}</h4>
                    <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{{ t('import.cSVImportModalDragAndDropYourFileHere') }}</p>
                    <button type="button" class="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>{{ t('import.cSVImportModalChooseFile') }}</button>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-500 pt-4">{{ t('import.cSVImportModalSupportedFormatCsvFilesOnly') }}</p>
                </div>

                <div v-else class="space-y-4">
                  <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-10 h-10 text-green-600 dark:text-green-400">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-lg font-bold text-gray-900 dark:text-white mb-1">{{ t('import.cSVImportModalFileSelected') }}</h4>
                    <p class="text-indigo-600 dark:text-indigo-400 font-medium text-lg">{{ fileName }}</p>
                    <button type="button" @click.stop="clearFile" class="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline transition-colors">{{ t('import.cSVImportModalChooseADifferentFile') }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Map Fields -->
          <div v-if="step === 1 && csvHeaders.length > 0">
            <!-- Info Banner -->
            <div class="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-6 shadow-lg">
              <div class="relative z-10 flex items-start gap-4">
                <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <p class="text-white text-sm font-medium">
                    <span class="font-bold text-lg">{{ totalRows }} rows</span>{{ t('import.cSVImportModalDetectedInYourCsvFile') }}</p>
                  <p class="text-blue-100 text-sm mt-1">
                    Map your CSV columns to {{ entityType }} fields below. You can skip fields you don't need.
                  </p>
                </div>
              </div>
              <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
            </div>

            <!-- Field Mapping Cards -->
            <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="header in csvHeaders" :key="header" class="group bg-white dark:bg-gray-900 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 shadow-sm hover:shadow-md">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <!-- CSV Column -->
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <label class="text-sm font-bold text-gray-900 dark:text-white">{{ header }}</label>
                    </div>
                    <p v-if="preview[0] && preview[0][header]" class="text-xs text-gray-500 dark:text-gray-400 pl-4 truncate">
                      📄 <span class="italic">{{ preview[0][header] }}</span>
                    </p>
                  </div>

                  <!-- Arrow -->
                  <div class="flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-indigo-500 dark:text-indigo-400 transition-transform group-hover:translate-x-1">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>

                  <!-- Target Field -->
                  <div>
                    <select 
                      v-model="fieldMapping[header]" 
                      class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    >
                      <option value="" class="text-gray-500">⊘ Skip this field</option>
                      <option v-for="field in availableFields" :key="field.value" :value="field.value" class="text-gray-900 dark:text-white">
                        {{ field.label }}
                      </option>
                    </select>
                  </div>
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
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('import.cSVImportModalDuplicateDetectionOptions') }}</h3>
                  
                  <!-- Radio Buttons for Check/Don't Check -->
                  <div class="space-y-3 mb-6">
                    <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all" :class="shouldCheckDuplicates ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'">
                      <input 
                        type="radio" 
                        :value="true" 
                        v-model="shouldCheckDuplicates"
                        class="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 mt-0.5 flex-shrink-0"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('import.cSVImportModalCheckForDuplicates') }}</span>
                          <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">{{ t('settings.integrationsRecommended') }}</span>
                        </div>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('import.cSVImportModalScanYourCsvForDuplicateRecords') }}</p>
                      </div>
                    </label>
                    
                    <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all" :class="!shouldCheckDuplicates ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'">
                      <input 
                        type="radio" 
                        :value="false" 
                        v-model="shouldCheckDuplicates"
                        class="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 mt-0.5 flex-shrink-0"
                      />
                      <div class="flex-1">
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('import.cSVImportModalDoNotCheckForDuplicates') }}</span>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('import.cSVImportModalImportAllRecordsWithoutDuplicateChecking') }}</p>
                      </div>
                    </label>
                  </div>
                  
                  <!-- Field Selector (only shown if checking duplicates) -->
                  <div v-if="shouldCheckDuplicates" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('import.cSVImportModalSelectWhichFieldSToUse') }}<strong>{{ t('import.cSVImportModalAll2') }}</strong>{{ t('import.cSVImportModalSelectedFieldsWillBeConsideredDuplicates') }}</p>
                    
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('import.cSVImportModalDuplicateCheckFields') }}</label>
                  
                  <!-- Multi-Select Dropdown -->
                  <div class="relative">
                    <button
                      type="button"
                      @click="showFieldDropdown = !showFieldDropdown"
                      class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                          <div v-if="duplicateCheckFields.length === 0" class="text-gray-500 dark:text-gray-400">{{ t('import.cSVImportModalSelectFieldsToCheck') }}</div>
                          <div v-else class="flex flex-wrap gap-2">
                            <span
                              v-for="fieldValue in duplicateCheckFields"
                              :key="fieldValue"
                              class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm rounded-md"
                            >
                              {{ duplicateCheckableFields.find(f => f.value === fieldValue)?.label }}
                              <button
                                @click.stop="removeField(fieldValue)"
                                class="hover:text-indigo-900 dark:hover:text-indigo-100"
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
                          <HeadlessCheckbox
                            :checked="duplicateCheckFields.includes(field.value)"
                            @change="toggleDuplicateCheckField(field.value, $event)"
                            checkbox-class="w-5 h-5 mt-0.5 flex-shrink-0"
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ field.label }}</span>
                              <span
                                v-if="field.recommended"
                                class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full"
                              >{{ t('settings.integrationsRecommended') }}</span>
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
                        <strong>{{ t('import.cSVImportModalAndLogic') }}</strong>{{ t('import.cSVImportModalARecordIsOnlyConsideredA') }}<strong>{{ t('import.cSVImportModalAll') }}</strong> selected fields.
                        For example, selecting "Email + Company" means both the email AND company must match.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="checkingDuplicates" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalCheckingForDuplicates') }}</p>
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
                  <p class="stat-label">{{ t('import.cSVImportModalNewRecords') }}</p>
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
                  <p class="stat-label">{{ t('import.cSVImportModalDuplicatesFound') }}</p>
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
                  <p class="stat-label">{{ t('import.cSVImportModalTotalRows') }}</p>
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
                  :class="duplicateAction === 'skip' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="skip" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalSkipDuplicates') }}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Only import new records ({{ duplicateData.unique }} records)</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'update' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="update" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalUpdateExistingRecords') }}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Update {{ duplicateData.duplicates }} duplicates with new data</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'import-all' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="import-all" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportAllCreateDuplicates') }}</p>
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
                    <span class="px-2 py-1 text-xs font-semibold bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-200 rounded">{{ t('forms.builderDuplicate') }}</span>
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
            <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportingRecords') }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">{{ t('import.cSVImportModalThisMayTakeAMoment') }}</p>
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
                  <p class="stat-label">{{ t('forms.hubColCreated') }}</p>
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
                  <p class="stat-label">{{ t('import.cSVImportModalUpdated') }}</p>
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
                  <p class="stat-label">{{ t('process.execFailed') }}</p>
                </div>
              </div>
            </div>

            <!-- Errors -->
            <div v-if="importResults.errors && importResults.errors.length > 0" class="max-h-64 overflow-y-auto">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('import.cSVImportModalImportErrors') }}</h4>
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
                <strong>✓</strong>{{ t('import.cSVImportModalAllRecordsImportedSuccessfully') }}</p>
            </div>
          </div>
        </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-8 mt-8 border-t-2 border-gray-200 dark:border-gray-700">
            <button 
              v-if="step > 0 && !importing && !importResults && !checkingDuplicates" 
              @click="step--" 
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>{{ t('performance.back') }}</button>
            <div v-else></div>

            <div class="flex gap-3">
              <button 
                @click="$emit('close')" 
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
              >
                {{ importResults ? 'Close' : 'Cancel' }}
              </button>
              
              <!-- Check Duplicates button (Step 2, when checking is selected, before checking) -->
              <button 
                v-if="step === 2 && shouldCheckDuplicates && !duplicateData && !importing && !importResults"
                @click="checkDuplicates" 
                :disabled="duplicateCheckFields.length === 0 || checkingDuplicates"
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="!checkingDuplicates" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <div v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {{ checkingDuplicates ? 'Checking...' : 'Check Duplicates' }}
              </button>
              
              <!-- Import Now button (Step 2, when NOT checking duplicates) -->
              <button 
                v-if="step === 2 && !shouldCheckDuplicates && !duplicateData && !importing && !importResults"
                @click="performImport" 
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/30"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>{{ t('import.cSVImportModalImportNowSkipDuplicateCheck') }}</button>
              
              <!-- Next/Import button (all other steps) -->
              <button 
                v-if="(step < 2 || (step === 2 && duplicateData)) && !importing && !importResults"
                @click="nextStep" 
                :disabled="!canProceed"
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ step === 0 ? 'Next' : step === 1 ? 'Next' : 'Import Now' }}
                <svg v-if="step < 2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              
              <button 
                v-if="importResults"
                @click="$emit('import-complete'); $emit('close')"
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/30"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>{{ t('import.cSVImportModalDone') }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, reactive, computed, watch } from 'vue';
import apiClient from '@/utils/apiClient';

/** Collapse labels and keys for header ↔ field matching (e.g. First Name, first_name, firstname). */
function normalizeImportFieldToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getImportFieldsForEntityType(entityType) {
  if (entityType === 'Contacts') {
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
  }
  if (entityType === 'Deals') {
    return [
      { label: 'Name', value: 'name' },
      { label: 'Amount', value: 'amount' },
      { label: 'Stage', value: 'stage' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Expected Close Date', value: 'expectedCloseDate' }
    ];
  }
  if (entityType === 'Tasks') {
    return [
      { label: 'Title', value: 'title' },
      { label: 'Description', value: 'description' },
      { label: 'Status', value: 'status' },
      { label: 'Priority', value: 'priority' },
      { label: 'Due Date', value: 'dueDate' },
      { label: 'Tags', value: 'tags' },
      { label: 'Time Estimate (minutes)', value: 'timeEstimate' }
    ];
  }
  return [
    { label: 'Name', value: 'name' },
    { label: 'Industry', value: 'industry' },
    { label: 'Website', value: 'website' },
    { label: 'Phone', value: 'phone' },
    { label: 'Email', value: 'email' },
    { label: 'Address', value: 'address' }
  ];
}

/**
 * Default mapping: each CSV column maps to at most one module field (first column wins for a field).
 * Matches header text to field API key or display label (case- and separator-insensitive).
 */
function buildAutoImportFieldMapping(csvHeaders, fields) {
  const usedValues = new Set();
  const mapping = {};
  for (const header of csvHeaders) {
    const hNorm = normalizeImportFieldToken(header);
    let chosen = '';
    if (hNorm) {
      for (const field of fields) {
        if (usedValues.has(field.value)) continue;
        const keyNorm = normalizeImportFieldToken(field.value);
        const labelNorm = normalizeImportFieldToken(field.label);
        if (hNorm === keyNorm || hNorm === labelNorm) {
          chosen = field.value;
          usedValues.add(field.value);
          break;
        }
      }
    }
    mapping[header] = chosen;
  }
  return mapping;
}

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

const { t } = useI18n();

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
  { title: 'Upload CSV File', shortTitle: 'Upload', description: 'Select your CSV file to import' },
  { title: 'Map Fields', shortTitle: 'Map Fields', description: 'Match CSV columns to fields' },
  { title: 'Check Duplicates', shortTitle: 'Duplicates', description: 'Review potential duplicates' },
  { title: 'Import Results', shortTitle: 'Results', description: 'Review import results' }
];

const availableFields = computed(() => getImportFieldsForEntityType(props.entityType));

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

const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0];
  if (!file || !file.name.endsWith('.csv')) {
    alert(t('import.cSVImportModalToastPleaseUploadACsvFile'));
    return;
  }

  fileName.value = file.name;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    csvData.value = e.target.result;
    parseCSV();
    step.value = 1;
  };
  
  reader.readAsText(file);
};

const clearFile = () => {
  fileName.value = '';
  csvData.value = '';
  csvHeaders.value = [];
  preview.value = [];
  totalRows.value = 0;
  Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
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
      alert(t('import.cSVImportModalToastCsvFileIsEmpty'));
      return;
    }

    // Parse headers
    csvHeaders.value = parseCSVLine(lines[0]);

    Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
    const fields = getImportFieldsForEntityType(props.entityType);
    const autoMap = buildAutoImportFieldMapping(csvHeaders.value, fields);
    for (const header of csvHeaders.value) {
      fieldMapping[header] = autoMap[header] ?? '';
    }

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
    alert(t('import.cSVImportModalToastErrorParsingCsvFilePlease'));
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
    alert(t('import.cSVImportModalToastErrorCheckingForDuplicatesPlease'));
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
    alert(t('import.cSVImportModalToastErrorImportingDataPleaseTry'));
    step.value = 1;
  } finally {
    importing.value = false;
  }
};

// Remove a field from the duplicate check selection
const removeField = (fieldValue) => {
  duplicateCheckFields.value = duplicateCheckFields.value.filter(f => f !== fieldValue);
};

const toggleDuplicateCheckField = (fieldValue, event) => {
  const isChecked = !!event?.target?.checked;
  if (isChecked) {
    if (!duplicateCheckFields.value.includes(fieldValue)) {
      duplicateCheckFields.value = [...duplicateCheckFields.value, fieldValue];
    }
    return;
  }
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

<style scoped>
/* Custom Scrollbar Styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background-color: #f3f4f6;
  border-radius: 9999px;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-track {
  background-color: #1f2937;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #a78bfa;
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #6049E7;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #5037d9;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #6049E7;
}

/* Slide Up Animation */
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

/* Border Dash */
.border-3 {
  border-width: 3px;
}
</style>
