<template>
  <Teleport to="body">
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-black/60 via-black/50 to-black/60 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="'import-csv-title'"
    @keydown.escape.stop
  >
    <div class="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slide-up dark:border-gray-700 dark:bg-gray-900" @click.stop>
      <!-- Background import confirmation -->
      <div
        v-if="showBackgroundConfirm"
        class="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 p-6 backdrop-blur-[2px]"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('import.importBackgroundConfirmTitle') }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('import.importBackgroundConfirmMessage') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showBackgroundConfirm = false"
            >
              {{ t('import.importKeepWatching') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              @click="confirmRunInBackground"
            >
              {{ t('import.importRunInBackground') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Discard confirmation -->
      <div
        v-if="showDiscardConfirm"
        class="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 p-6 backdrop-blur-[2px]"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('import.importDiscardTitle') }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('import.importDiscardMessage') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showDiscardConfirm = false"
            >
              {{ t('import.importKeepWorking') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              @click="confirmDiscard"
            >
              {{ t('import.importDiscardProgress') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Header with Gradient -->
      <div class="relative bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 px-8 py-6">
          <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              v-if="allowModuleChange"
              type="button"
              @click="requestChangeModule"
              class="p-2.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200"
              :title="t('performance.back')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-indigo-200">
                {{ t('import.importWizardProgressStep', { current: wizardStepNumber, total: totalWizardSteps }) }}
              </p>
              <h2 id="import-csv-title" class="text-2xl font-bold text-white">
                {{ t('import.cSVImportModalImportEntity', { entityType }) }}
              </h2>
              <p class="mt-0.5 text-sm text-indigo-100">{{ t('import.cSVImportModalUploadAndMapYourCsvData') }}</p>
            </div>
          </div>
          <button @click="requestClose" class="p-2.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200">
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
      <div class="flex-1 overflow-y-auto bg-gray-50 px-8 py-6 dark:bg-gray-800/50">
        <div class="mx-auto max-w-3xl">
          <!-- Error banner -->
          <div
            v-if="bannerError"
            class="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            role="alert"
          >
            <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <p class="flex-1 text-sm text-red-800 dark:text-red-200">{{ bannerError }}</p>
            <button type="button" class="text-red-500 hover:text-red-700" :aria-label="t('actions.close')" @click="bannerError = ''">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Step Title & Description -->
          <div class="mb-8 text-center">
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{{ steps[step].title }}</h3>
            <p class="text-gray-600 dark:text-gray-400">{{ steps[step].description }}</p>
          </div>

          <!-- Step 1: Upload File -->
          <div v-if="step === 0">
            <div v-if="stagingUploading" class="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center dark:border-indigo-800 dark:bg-indigo-900/20">
              <div class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 mb-3"></div>
              <p class="text-sm font-medium text-indigo-900 dark:text-indigo-100">{{ t('import.importStagingUploading') }}</p>
            </div>
            <div class="relative group">
              <div
                class="cursor-pointer rounded-2xl border-3 border-dashed bg-white p-12 text-center shadow-sm transition-all duration-300 dark:bg-gray-900 sm:p-16"
                :class="isDragOver
                  ? 'border-indigo-500 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-900/20'
                  : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-gray-600 dark:hover:border-indigo-400 dark:hover:bg-indigo-900/10'"
                @click="$refs.fileInput.click()"
                @dragover.prevent="isDragOver = true"
                @dragleave.prevent="isDragOver = false"
                @drop.prevent="handleFileDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept=".csv"
                  class="hidden"
                  @change="handleFileSelect"
                />

                <div v-if="!fileName" class="space-y-4">
                  <div class="mb-2 inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 transition-transform duration-300 group-hover:scale-110 dark:from-indigo-900/30 dark:to-indigo-800/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-12 w-12 text-indigo-600 dark:text-indigo-400">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                      {{ isDragOver ? t('import.importDragActive') : t('import.cSVImportModalUploadYourCsvFile') }}
                    </h4>
                    <p class="mx-auto mb-6 max-w-md text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalDragAndDropYourFileHere') }}</p>
                    <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      {{ t('import.cSVImportModalChooseFile') }}
                    </button>
                  </div>
                  <p class="pt-4 text-xs text-gray-500 dark:text-gray-500">{{ t('import.cSVImportModalSupportedFormatCsvFilesOnly') }}</p>
                </div>

                <div v-else class="space-y-4">
                  <div class="mb-2 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-10 w-10 text-green-600 dark:text-green-400">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="mb-1 text-lg font-bold text-gray-900 dark:text-white">{{ t('import.cSVImportModalFileSelected') }}</h4>
                    <p class="text-lg font-medium text-indigo-600 dark:text-indigo-400">{{ fileName }}</p>
                    <p v-if="fileMetaLabel" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ fileMetaLabel }}</p>
                    <button type="button" class="mt-4 text-sm text-gray-600 underline transition-colors hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400" @click.stop="clearFile">
                      {{ t('import.cSVImportModalChooseADifferentFile') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex justify-center">
              <button
                type="button"
                class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                @click="handleDownloadTemplate"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {{ t('import.importDownloadTemplate') }}
              </button>
            </div>
          </div>

          <!-- Step 2: Map Fields -->
          <div v-if="step === 1 && csvHeaders.length > 0">
            <!-- Info Banner -->
            <div class="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-6 shadow-lg">
              <div class="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div class="flex items-start gap-4">
                  <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-white">
                      <span class="text-lg font-bold">{{ t('import.cSVImportModalRowCount', { count: totalRows }) }}</span>
                      {{ t('import.cSVImportModalDetectedInYourCsvFile') }}
                    </p>
                    <p class="mt-1 text-sm text-blue-100">
                      {{ t('import.cSVImportModalMapColumnsHint', { entityType }) }}
                    </p>
                  </div>
                </div>
                <div class="text-right text-sm text-white/90">
                  <p class="font-semibold">{{ t('import.importMappingProgress', { mapped: mappingStats.mapped, total: mappingStats.total }) }}</p>
                  <p v-if="autoMappedCount > 0" class="mt-0.5 text-xs text-blue-100">
                    {{ t('import.importAutoMappedCount', { count: autoMappedCount }) }}
                  </p>
                </div>
              </div>
              <div class="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-white/5" />
            </div>

            <!-- Mapping progress bar -->
            <div class="mb-5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-full rounded-full bg-indigo-600 transition-all duration-300"
                :style="{ width: `${mappingStats.percent}%` }"
              />
            </div>

            <div v-if="fieldsLoading" class="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('import.importFieldsLoading') }}
            </div>
            <div class="custom-scrollbar max-h-[420px] space-y-3 overflow-y-auto pr-2">
              <div
                v-for="header in csvHeaders"
                :key="header"
                class="group rounded-xl border-2 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-gray-900"
                :class="fieldMapping[header]
                  ? 'border-green-200 dark:border-green-800/60'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600'"
              >
                <div class="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
                  <!-- CSV Column -->
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full" :class="fieldMapping[header] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'" />
                      <label class="text-sm font-bold text-gray-900 dark:text-white">{{ header }}</label>
                      <span
                        class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        :class="fieldMapping[header]
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
                      >
                        {{ fieldMapping[header] ? t('import.importMappedColumn') : t('import.importUnmappedColumn') }}
                      </span>
                    </div>
                    <p v-if="preview[0] && preview[0][header]" class="truncate pl-4 text-xs italic text-gray-500 dark:text-gray-400">
                      {{ preview[0][header] }}
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
                    <HeadlessSelect
                      :model-value="fieldMapping[header]"
                      :option-groups="getFieldOptionGroupsForHeader(header).length ? getFieldOptionGroupsForHeader(header) : undefined"
                      :options="getFieldOptionGroupsForHeader(header).length ? [] : getAvailableFieldsForHeader(header)"
                      allow-empty
                      :empty-label="`⊘ ${t('import.cSVImportModalSkipField')}`"
                      teleport
                      :disabled="fieldsLoading"
                      button-class="!px-4 !py-2.5 !bg-gray-50 dark:!bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium !shadow-none focus:!outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                      options-class="z-[250]"
                      @update:model-value="(value) => setFieldMapping(header, value)"
                    />
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
                        <strong>{{ t('import.cSVImportModalAndLogic') }}</strong>{{ t('import.cSVImportModalARecordIsOnlyConsideredA') }}                        <strong>{{ t('import.cSVImportModalAll') }}</strong> {{ t('import.cSVImportModalSelectedFieldsWillBeConsideredDuplicates') }}
                        {{ t('import.cSVImportModalAndLogicExample') }}
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
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">{{ t('import.cSVImportModalComparingRecords', { count: totalRows }) }}</p>
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
                {{ t('import.cSVImportModalHowHandleDuplicates') }}
              </h4>
              <div class="space-y-3">
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'skip' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="skip" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalSkipDuplicates') }}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalOnlyImportNew', { count: duplicateData.unique }) }}</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'update' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="update" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalUpdateExistingRecords') }}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalUpdateDuplicatesCount', { count: duplicateData.duplicates }) }}</p>
                  </div>
                </label>
                
                <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                  :class="duplicateAction === 'import-all' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
                  <input type="radio" value="import-all" v-model="duplicateAction" class="mt-1 w-4 h-4 text-indigo-600" />
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportAllCreateDuplicates') }}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('import.cSVImportModalImportAllCount', { count: duplicateData.total }) }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Duplicate Records List -->
            <div v-if="duplicateData.duplicates > 0" class="max-h-64 overflow-y-auto">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 sticky top-0 bg-white dark:bg-gray-900 py-2">
                {{ t('import.cSVImportModalDuplicateRecordsTitle', { count: duplicateData.duplicates }) }}
              </h4>
              <div class="space-y-2">
                <div v-for="(dup, index) in duplicateData.duplicateRecords.slice(0, 10)" :key="index" 
                  class="p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ t('import.importDuplicateRow', { row: dup.rowNumber, preview: Object.values(dup.data).slice(0, 3).join(', ') }) }}
                      </p>
                      <p class="mt-1 text-xs text-warning-700 dark:text-warning-300">
                        {{ t('import.importDuplicateMatchesBy', { field: dup.matchedField, value: dup.matchedValue }) }}
                      </p>
                      <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {{ t('import.importDuplicateExistingRecord', {
                          name: dup.existingRecord.first_name || dup.existingRecord.name,
                          date: new Date(dup.existingRecord.createdAt).toLocaleDateString()
                        }) }}
                      </p>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-200 rounded">{{ t('forms.builderDuplicate') }}</span>
                  </div>
                </div>
                <p v-if="duplicateData.duplicateRecords.length > 10" class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  {{ t('import.cSVImportModalDuplicateRecordsMore', { count: duplicateData.duplicateRecords.length - 10 }) }}
                </p>
                <p v-if="duplicateData.samplesTruncated" class="text-sm text-amber-600 dark:text-amber-400 text-center py-2">
                  {{ t('import.cSVImportModalDuplicateSamplesTruncated') }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Import Results -->
        <div v-if="step === 3">
          <div v-if="importing" class="py-12 px-4">
            <div class="mx-auto max-w-md space-y-5">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                <p class="text-lg font-medium text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportingRecords') }}</p>
                <p class="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {{ t('import.importRecordsProgress', { processed: formattedImportProcessed, total: formattedImportTotal }) }}
                </p>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
                  :style="{ width: `${importProgressPercent}%` }"
                />
              </div>
              <p class="text-center text-xs text-gray-500 dark:text-gray-400">
                {{ t('import.cSVImportModalThisMayTakeAMoment') }}
              </p>
            </div>
          </div>

          <div v-else-if="importResults" class="space-y-6">
            <!-- Outcome headline -->
            <div
              class="rounded-2xl border p-5"
              :class="{
                'border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20': importResultSummary.variant === 'success',
                'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20': importResultSummary.variant === 'warning',
                'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20': importResultSummary.variant === 'info',
                'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20': importResultSummary.variant === 'error',
              }"
            >
              <div class="flex items-start gap-3">
                <div
                  class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  :class="{
                    'bg-success-100 text-success-600 dark:bg-success-900/40 dark:text-success-400': importResultSummary.variant === 'success',
                    'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400': importResultSummary.variant === 'warning',
                    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400': importResultSummary.variant === 'info',
                    'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400': importResultSummary.variant === 'error',
                  }"
                >
                  <svg v-if="importResultSummary.variant === 'success'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else-if="importResultSummary.variant === 'warning'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <svg v-else-if="importResultSummary.variant === 'info'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <h4
                    class="font-semibold"
                    :class="{
                      'text-success-900 dark:text-success-100': importResultSummary.variant === 'success',
                      'text-amber-900 dark:text-amber-100': importResultSummary.variant === 'warning',
                      'text-blue-900 dark:text-blue-100': importResultSummary.variant === 'info',
                      'text-red-900 dark:text-red-100': importResultSummary.variant === 'error',
                    }"
                  >
                    {{ importResultSummary.title }}
                  </h4>
                  <p
                    class="mt-1 text-sm"
                    :class="{
                      'text-success-800 dark:text-success-200': importResultSummary.variant === 'success',
                      'text-amber-800 dark:text-amber-200': importResultSummary.variant === 'warning',
                      'text-blue-800 dark:text-blue-200': importResultSummary.variant === 'info',
                      'text-red-800 dark:text-red-200': importResultSummary.variant === 'error',
                    }"
                  >
                    {{ importResultSummary.message }}
                  </p>
                  <p
                    v-if="importResults.skipped > 0"
                    class="mt-2 text-xs opacity-80"
                    :class="{
                      'text-success-700 dark:text-success-300': importResultSummary.variant === 'success',
                      'text-amber-700 dark:text-amber-300': importResultSummary.variant === 'warning',
                      'text-blue-700 dark:text-blue-300': importResultSummary.variant === 'info',
                    }"
                  >
                    {{ t('import.importResultsSkippedHint') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Summary metrics -->
            <p class="text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('import.importResultsTotalProcessed', { count: importResults.total || 0 }) }}
            </p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-success-500 to-success-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-7 w-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.created || 0 }}</p>
                  <p class="stat-label">{{ t('forms.hubColCreated') }}</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-7 w-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.updated || 0 }}</p>
                  <p class="stat-label">{{ t('import.cSVImportModalUpdated') }}</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-amber-500 to-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-7 w-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.skipped || 0 }}</p>
                  <p class="stat-label">{{ t('import.importResultsSkipped') }}</p>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bg-gradient-to-br from-danger-500 to-danger-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-7 w-7 text-white">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="stat-value">{{ importResults.failed || 0 }}</p>
                  <p class="stat-label">{{ t('process.execFailed') }}</p>
                </div>
              </div>
            </div>

            <!-- Errors -->
            <div v-if="importResults.errors && importResults.errors.length > 0" class="max-h-64 overflow-y-auto">
              <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('import.cSVImportModalImportErrors') }}</h4>
              <div class="space-y-2">
                <div v-for="(error, index) in importResults.errors" :key="index" class="rounded-lg border border-danger-200 bg-danger-50 p-3 dark:border-danger-800 dark:bg-danger-900/20">
                  <p class="text-sm text-danger-800 dark:text-danger-200">
                    <strong>{{ t('import.cSVImportModalImportRowError', { row: error.row }) }}</strong> {{ error.error }}
                  </p>
                </div>
              </div>
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
                @click="requestClose" 
                class="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
              >
                {{ importResults ? t('import.cSVImportModalClose') : t('import.cSVImportModalCancel') }}
              </button>
              
              <!-- Check Duplicates button (Step 2, when checking is selected, before checking) -->
              <button
                v-if="step === 2 && shouldCheckDuplicates && !duplicateData && !importing && !importResults && !checkingDuplicates"
                @click="checkDuplicates"
                :disabled="duplicateCheckFields.length === 0"
                class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {{ t('import.cSVImportModalCheckDuplicates') }}
              </button>

              <!-- Re-scan after changing duplicate settings -->
              <button
                v-if="step === 2 && shouldCheckDuplicates && duplicateData && !importing && !importResults && !checkingDuplicates"
                type="button"
                @click="recheckDuplicates"
                class="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {{ t('import.importRecheckDuplicates') }}
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
                {{ step === 0 ? t('import.cSVImportModalNext') : step === 1 ? t('import.cSVImportModalNext') : t('import.cSVImportModalImportNow') }}
                <svg v-if="step < 2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              
              <button
                v-if="importResults"
                type="button"
                class="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 font-semibold text-white transition-all shadow-lg"
                :class="{
                  'bg-gradient-to-r from-green-600 to-green-700 shadow-green-500/30 hover:from-green-700 hover:to-green-800': importResultSummary.variant === 'success',
                  'bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/30 hover:from-amber-600 hover:to-amber-700': importResultSummary.variant === 'warning',
                  'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-500/30 hover:from-blue-700 hover:to-blue-800': importResultSummary.variant === 'info',
                  'bg-gradient-to-r from-red-600 to-red-700 shadow-red-500/30 hover:from-red-700 hover:to-red-800': importResultSummary.variant === 'error',
                }"
                @click="$emit('import-complete'); $emit('close')"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                {{ t('import.cSVImportModalDone') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { useImportModuleFields } from '@/composables/useImportModuleFields';
import { downloadImportTemplate, formatImportFileSize } from '@/utils/importTemplateUtils';
import {
  shouldStageCsvUpload,
  stageCsvForImport,
  uploadCsvImport,
} from '@/utils/importUploadUtils';
import { useActiveImportsStore } from '@/stores/activeImports';
import { ref, reactive, computed, watch, toRef, onMounted, onBeforeUnmount } from 'vue';
import apiClient from '@/utils/apiClient';

const IMPORT_MAX_ROWS = Number(import.meta.env.VITE_IMPORT_MAX_ROWS || 1000000);

/** Collapse labels and keys for header ↔ field matching (e.g. First Name, first_name, firstname). */
function normalizeImportFieldToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
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

function filterImportFieldOptionGroups(groups, usedValues) {
  if (!usedValues.size) return groups;
  return groups
    .map((group) => ({
      ...group,
      options: (group.options || []).filter((opt) => !usedValues.has(opt.value)),
    }))
    .filter((group) => group.options.length > 0);
}

function filterImportFieldOptions(options, usedValues) {
  if (!usedValues.size) return options;
  return options.filter((opt) => !usedValues.has(opt.value));
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
  },
  allowModuleChange: {
    type: Boolean,
    default: false
  },
  wizardStepOffset: {
    type: Number,
    default: 1
  }
});

const { t } = useI18n();
const activeImportsStore = useActiveImportsStore();

const {
  availableFields,
  fieldOptionGroups,
  loading: fieldsLoading,
} = useImportModuleFields(toRef(props, 'entityType'));

const emit = defineEmits(['close', 'import-complete', 'change-module']);

const step = ref(0);
const fileName = ref(props.fileName || '');
const fileSizeBytes = ref(0);
const csvData = ref('');
const sourceFile = ref(null);
const stagingId = ref(null);
const stagingUploading = ref(false);
const csvHeaders = ref([]);
const preview = ref([]);
const totalRows = ref(0);
const fieldMapping = reactive({});
const isDragOver = ref(false);
const bannerError = ref('');
const showDiscardConfirm = ref(false);
const showBackgroundConfirm = ref(false);
const pendingDiscardAction = ref(null);
const activeImportId = ref(null);
const autoMappedCount = ref(0);

const totalWizardSteps = 5;
const wizardStepNumber = computed(() => props.wizardStepOffset + step.value);

const fileMetaLabel = computed(() => {
  if (!totalRows.value && !fileSizeBytes.value) return '';
  return t('import.importFileMeta', {
    rows: totalRows.value,
    size: formatImportFileSize(fileSizeBytes.value),
  });
});

const mappingStats = computed(() => {
  const total = csvHeaders.value.length;
  const mapped = csvHeaders.value.filter((header) => !!fieldMapping[header]).length;
  return {
    total,
    mapped,
    percent: total ? Math.round((mapped / total) * 100) : 0,
  };
});

const importProgressPercent = computed(() => {
  const { processed, total } = importProgress.value;
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
});

const formattedImportProcessed = computed(() =>
  (importProgress.value.processed ?? 0).toLocaleString()
);

const formattedImportTotal = computed(() =>
  (importProgress.value.total ?? 0).toLocaleString()
);

const importResultSummary = computed(() => {
  const r = importResults.value;
  if (!r) {
    return { variant: 'success', title: '', message: '' };
  }

  const created = r.created || 0;
  const updated = r.updated || 0;
  const skipped = r.skipped || 0;
  const failed = r.failed || 0;
  const succeeded = created + updated + skipped;

  if (failed > 0 && created === 0 && updated === 0 && skipped === 0) {
    return {
      variant: 'error',
      title: t('import.importResultsFailedTitle'),
      message: t('import.importResultsFailedMessage', { failed }),
    };
  }

  if (skipped > 0 && created === 0 && updated === 0 && failed === 0) {
    return {
      variant: 'warning',
      title: t('import.importResultsAllSkippedTitle'),
      message: t('import.importResultsAllSkippedMessage', { count: skipped }),
    };
  }

  if (failed > 0) {
    return {
      variant: 'warning',
      title: t('import.importResultsPartialErrorsTitle'),
      message: t('import.importResultsPartialErrorsMessage', { succeeded, failed }),
    };
  }

  if (skipped > 0) {
    const skippedPart = t('import.importResultsSuccessMixedSkipped', { count: skipped });
    return {
      variant: 'info',
      title: t('import.importResultsSuccessTitle'),
      message: t('import.importResultsSuccessMixed', { created, updated, skippedPart }),
    };
  }

  const parts = [];
  if (created > 0) parts.push(t('import.importResultsSuccessCreated', { count: created }));
  if (updated > 0) parts.push(t('import.importResultsSuccessUpdated', { count: updated }));

  return {
    variant: 'success',
    title: t('import.importResultsSuccessTitle'),
    message: parts.join(' ') || t('import.cSVImportModalAllRecordsImportedSuccessfully'),
  };
});

function getUsedImportFieldValues(excludeHeader) {
  const used = new Set();
  for (const [header, value] of Object.entries(fieldMapping)) {
    if (header !== excludeHeader && value) {
      used.add(value);
    }
  }
  return used;
}

function getFieldOptionGroupsForHeader(header) {
  if (!fieldOptionGroups.value.length) return [];
  return filterImportFieldOptionGroups(fieldOptionGroups.value, getUsedImportFieldValues(header));
}

function getAvailableFieldsForHeader(header) {
  return filterImportFieldOptions(availableFields.value, getUsedImportFieldValues(header));
}

function setFieldMapping(header, value) {
  if (value) {
    for (const otherHeader of csvHeaders.value) {
      if (otherHeader !== header && fieldMapping[otherHeader] === value) {
        fieldMapping[otherHeader] = '';
      }
    }
  }
  fieldMapping[header] = value;
}

const updateExisting = ref(false);
const importing = ref(false);
const importProgress = ref({ processed: 0, total: 0 });
const importResults = ref(null);
const checkingDuplicates = ref(false);
const duplicateData = ref(null);
const duplicateAction = ref('skip'); // 'skip', 'update', 'import-all'
const duplicateCheckFields = ref([]); // Fields to check for duplicates
const showFieldDropdown = ref(false); // Control dropdown visibility
const shouldCheckDuplicates = ref(true); // Whether to check duplicates or not

const steps = computed(() => [
  { title: t('import.cSVImportModalStepUploadTitle'), shortTitle: t('import.cSVImportModalStepUploadShort'), description: t('import.cSVImportModalStepUploadDesc') },
  { title: t('import.cSVImportModalStepMapTitle'), shortTitle: t('import.cSVImportModalStepMapShort'), description: t('import.cSVImportModalStepMapDesc') },
  { title: t('import.cSVImportModalStepDuplicatesTitle'), shortTitle: t('import.cSVImportModalStepDuplicatesShort'), description: t('import.cSVImportModalStepDuplicatesDesc') },
  { title: t('import.cSVImportModalStepResultsTitle'), shortTitle: t('import.cSVImportModalStepResultsShort'), description: t('import.cSVImportModalStepResultsDesc') }
]);

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
      { label: 'Name', value: 'name', description: 'recommended', recommended: true }
    ];
    return fields.filter(field => {
      if (field.value === 'name') return mappedFields.includes('name');
      return false;
    });
  }
});

const canProceed = computed(() => {
  if (step.value === 0) {
    return (csvData.value || stagingId.value) && csvHeaders.value.length > 0 && !stagingUploading.value;
  }
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

const hasProgress = computed(() => {
  if (importResults.value) return false;
  return !!(csvData.value || stagingId.value || step.value > 0);
});

const requestClose = () => {
  if (checkingDuplicates.value) return;
  if (importing.value && activeImportId.value) {
    showBackgroundConfirm.value = true;
    return;
  }
  if (importing.value) return;
  if (hasProgress.value) {
    pendingDiscardAction.value = 'close';
    showDiscardConfirm.value = true;
    return;
  }
  emit('close');
};

const confirmRunInBackground = () => {
  showBackgroundConfirm.value = false;
  emit('close');
};

const requestChangeModule = () => {
  if (importing.value || checkingDuplicates.value) return;
  if (hasProgress.value) {
    pendingDiscardAction.value = 'change-module';
    showDiscardConfirm.value = true;
    return;
  }
  emit('change-module');
};

const confirmDiscard = () => {
  showDiscardConfirm.value = false;
  const action = pendingDiscardAction.value;
  pendingDiscardAction.value = null;
  if (action === 'change-module') {
    emit('change-module');
  } else {
    emit('close');
  }
};

const showBannerError = (message) => {
  bannerError.value = message;
};

const handleDownloadTemplate = () => {
  downloadImportTemplate(props.entityType, availableFields.value);
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  processSelectedFile(file);
};

const handleFileDrop = (event) => {
  isDragOver.value = false;
  const file = event.dataTransfer.files[0];
  if (!file || !file.name.toLowerCase().endsWith('.csv')) {
    showBannerError(t('import.cSVImportModalToastPleaseUploadACsvFile'));
    return;
  }
  processSelectedFile(file);
};

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function stageSelectedFile(file) {
  try {
    stagingUploading.value = true;
    const staged = await stageCsvForImport(file);
    stagingId.value = staged.stagingId;
    csvHeaders.value = staged.headers || [];
    preview.value = staged.preview || [];
    totalRows.value = staged.totalRows || 0;
    csvData.value = '';
    applyAutoFieldMapping();
  } catch (error) {
    console.error('Error staging CSV:', error);
    showBannerError(error.message || t('import.importStagingFailed'));
    clearFile();
  } finally {
    stagingUploading.value = false;
  }
}

const processSelectedFile = async (file) => {
  bannerError.value = '';
  fileName.value = file.name;
  fileSizeBytes.value = file.size;
  sourceFile.value = file;
  stagingId.value = null;

  if (shouldStageCsvUpload(file.size)) {
    await stageSelectedFile(file);
    return;
  }

  try {
    const text = await readFileAsText(file);
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      showBannerError(t('import.cSVImportModalToastCsvFileIsEmpty'));
      clearFile();
      return;
    }

    const rowCount = lines.length - 1;
    if (shouldStageCsvUpload(file.size, rowCount)) {
      await stageSelectedFile(file);
      return;
    }

    csvData.value = text;
    applyParsedCsvFromLines(lines);
  } catch (error) {
    console.error('Error reading CSV:', error);
    showBannerError(t('import.cSVImportModalToastErrorParsingCsvFilePlease'));
    clearFile();
  }
};

function applyAutoFieldMapping() {
  Object.keys(fieldMapping).forEach((k) => delete fieldMapping[k]);
  const fields = availableFields.value;
  if (!csvHeaders.value.length || !fields.length) {
    autoMappedCount.value = 0;
    return;
  }
  const autoMap = buildAutoImportFieldMapping(csvHeaders.value, fields);
  let mapped = 0;
  for (const header of csvHeaders.value) {
    fieldMapping[header] = autoMap[header] ?? '';
    if (fieldMapping[header]) mapped += 1;
  }
  autoMappedCount.value = mapped;
}

watch(availableFields, () => {
  if (csvHeaders.value.length > 0) {
    applyAutoFieldMapping();
  }
});

const clearFile = () => {
  fileName.value = '';
  fileSizeBytes.value = 0;
  sourceFile.value = null;
  stagingId.value = null;
  csvData.value = '';
  csvHeaders.value = [];
  preview.value = [];
  totalRows.value = 0;
  autoMappedCount.value = 0;
  bannerError.value = '';
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

function applyParsedCsvFromLines(lines) {
  csvHeaders.value = parseCSVLine(lines[0]);
  applyAutoFieldMapping();

  preview.value = lines.slice(1, 6).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    csvHeaders.value.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  totalRows.value = lines.length - 1;
}

const parseCSV = () => {
  try {
    const lines = csvData.value.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      showBannerError(t('import.cSVImportModalToastCsvFileIsEmpty'));
      clearFile();
      return;
    }

    applyParsedCsvFromLines(lines);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    showBannerError(t('import.cSVImportModalToastErrorParsingCsvFilePlease'));
    clearFile();
  }
};

const nextStep = async () => {
  if (step.value === 2 && duplicateData.value) {
    await performImport();
    return;
  }

  step.value++;

  if (step.value === 2 && shouldCheckDuplicates.value && duplicateCheckFields.value.length > 0) {
    await checkDuplicates();
  }
};

const recheckDuplicates = async () => {
  duplicateData.value = null;
  await checkDuplicates();
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
      fieldMapping: fieldMapping,
      checkFields: duplicateCheckFields.value,
      ...(stagingId.value
        ? { stagingId: stagingId.value }
        : { csvData: csvData.value }),
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
    showBannerError(t('import.cSVImportModalToastErrorCheckingForDuplicatesPlease'));
  } finally {
    checkingDuplicates.value = false;
  }
};

const performImport = async () => {
  const mapImportRecordToResults = (record) => ({
    total: record.stats?.total ?? 0,
    created: record.stats?.created ?? 0,
    updated: record.stats?.updated ?? 0,
    skipped: record.stats?.skipped ?? 0,
    failed: record.stats?.failed ?? 0,
    errors: record.importErrors ?? [],
    importId: record._id,
  });

  if (totalRows.value > IMPORT_MAX_ROWS) {
    showBannerError(t('import.importRowLimitExceeded', {
      count: totalRows.value.toLocaleString(),
      max: IMPORT_MAX_ROWS.toLocaleString(),
    }));
    return;
  }

  try {
    importing.value = true;
    step.value = 3;
    importProgress.value = { processed: 0, total: totalRows.value };
    activeImportId.value = null;

    const entityTypeMap = {
      'Contacts': 'contacts',
      'Deals': 'deals',
      'Tasks': 'tasks',
      'Organizations': 'organizations'
    };
    const endpoint = `/csv/import/${entityTypeMap[props.entityType] || 'contacts'}`;
    
    // Determine updateExisting based on duplicate action
    const shouldUpdate = duplicateAction.value === 'update' || duplicateAction.value === 'import-all';
    
    const config = {
      fieldMapping: fieldMapping,
      updateExisting: shouldUpdate,
      fileName: fileName.value,
      shouldCheckDuplicates: shouldCheckDuplicates.value,
      duplicateCheckFields: shouldCheckDuplicates.value ? duplicateCheckFields.value : [],
    };

    let response;
    if (stagingId.value) {
      response = await apiClient.post(endpoint, {
        ...config,
        stagingId: stagingId.value,
      });
    } else if (sourceFile.value && shouldStageCsvUpload(fileSizeBytes.value, totalRows.value)) {
      response = await uploadCsvImport(endpoint, sourceFile.value, config);
    } else if (sourceFile.value && csvData.value) {
      response = await apiClient.post(endpoint, {
        ...config,
        csvData: csvData.value,
      });
    } else if (sourceFile.value) {
      response = await uploadCsvImport(endpoint, sourceFile.value, config);
    } else {
      response = await apiClient.post(endpoint, {
        ...config,
        csvData: csvData.value,
      });
    }

    if (!response.success) return;

    if (response.data?.accepted) {
      const importId = String(response.data.importId);
      activeImportId.value = importId;
      importProgress.value.total = response.data.total ?? totalRows.value;

      activeImportsStore.trackImport({
        importId,
        fileName: fileName.value,
        module: entityTypeMap[props.entityType] || 'contacts',
        total: importProgress.value.total,
      });

      const record = await activeImportsStore.waitForImport(importId);
      importResults.value = mapImportRecordToResults(record);

      if (record.status === 'failed') {
        showBannerError(t('import.cSVImportModalToastErrorImportingDataPleaseTry'));
        step.value = 2;
        importResults.value = null;
      }
    } else {
      importResults.value = response.data;
    }
  } catch (error) {
    console.error('Error importing:', error);
    const limitCode = error.response?.data?.code;
    if (limitCode === 'IMPORT_ROW_LIMIT_EXCEEDED') {
      const maxRows = error.response?.data?.maxRows ?? IMPORT_MAX_ROWS;
      showBannerError(t('import.importRowLimitExceeded', {
        count: Number(error.response?.data?.rowCount || totalRows.value).toLocaleString(),
        max: Number(maxRows).toLocaleString(),
      }));
    } else if (limitCode === 'IMPORT_INLINE_LIMIT_EXCEEDED') {
      showBannerError(t('import.importInlineLimitExceeded'));
    } else {
      showBannerError(t('import.cSVImportModalToastErrorImportingDataPleaseTry'));
    }
    step.value = 2;
  } finally {
    activeImportId.value = null;
    importing.value = false;
  }
};

watch(
  () => (activeImportId.value ? activeImportsStore.getImport(activeImportId.value) : null),
  (item) => {
    if (!item) return;
    importProgress.value = {
      processed: item.processed ?? 0,
      total: item.total ?? importProgress.value.total,
    };
  },
  { deep: true }
);

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

// Reset duplicate results when toggling duplicate check off/on
watch(shouldCheckDuplicates, () => {
  if (step.value === 2) {
    duplicateData.value = null;
  }
});

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

function onEscapeKey(event) {
  if (event.key !== 'Escape') return;
  if (showDiscardConfirm.value) {
    showDiscardConfirm.value = false;
    pendingDiscardAction.value = null;
    return;
  }
  requestClose();
}

onMounted(() => {
  document.addEventListener('keydown', onEscapeKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscapeKey);
});
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
