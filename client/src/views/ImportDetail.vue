<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">{{ t('import.importDetailLoadingImport') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('import.importDetailErrorLoadingImport') }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="navigateToImportsList" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">{{ t('import.importDetailBackToImports') }}</button>
      </div>
    </div>

    <!-- Import Detail Content -->
    <div v-else-if="importRecord" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="navigateToImportsList" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">{{ t('performance.back') }}</span>
        </button>

        <div class="flex items-center gap-2">
          <button @click="navigateToModule" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all">
            <span>{{ t('import.importDetailGoToModule', { module: formatModule(importRecord.module) }) }}</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Header Card -->
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4 mb-4">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ importRecord.fileName }}</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {{ formatDate(importRecord.createdAt) }} {{ t('import.importDetailAtTime') }} {{ formatTime(importRecord.createdAt) }}
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
            <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ successRate }}%</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">{{ t('process.execLogsSuccess') }}</div>
          </div>
        </div>
      </div>

      <!-- Live import progress -->
      <div
        v-if="importRecord.status === 'processing'"
        class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              {{ t('import.cSVImportModalImportingRecords') }}
            </p>
            <p class="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
              {{ t('import.importRecordsProgress', {
                processed: formatCount(liveProgress.processed),
                total: formatCount(liveProgress.total),
              }) }}
            </p>
          </div>
          <span class="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {{ liveProgressPercent }}%
          </span>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-950">
          <div
            class="h-full rounded-full bg-indigo-600 transition-all duration-300"
            :style="{ width: `${liveProgressPercent}%` }"
          />
        </div>
        <p class="mt-2 text-xs text-indigo-700/80 dark:text-indigo-300/80">
          {{ t('import.importBackgroundHint') }}
        </p>
      </div>

      <!-- Statistics Grid -->
      <div class="grid grid-cols-5 gap-3 mb-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center">
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ importRecord.stats?.total || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('appointments.statsTotal') }}</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.created || 0) === 0 }"
          @click="viewRecords('created')"
        >
          <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ importRecord.stats?.created || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('forms.hubColCreated') }}</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.updated || 0) === 0 }"
          @click="viewRecords('updated')"
        >
          <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ importRecord.stats?.updated || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('import.importDetailUpdated') }}</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.skipped || 0) === 0 }"
          @click="viewRecords('skipped')"
        >
          <div class="text-xl font-bold text-yellow-600 dark:text-yellow-400">{{ importRecord.stats?.skipped || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('process.execSkipped') }}</div>
        </div>
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
          :class="{ 'opacity-50 cursor-not-allowed': (importRecord.stats?.failed || 0) === 0 }"
          @click="viewRecords('failed')"
        >
          <div class="text-xl font-bold text-red-600 dark:text-red-400">{{ importRecord.stats?.failed || 0 }}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('process.execFailed') }}</div>
        </div>
      </div>

      <!-- Records View Modal -->
      <div v-if="showRecordsView" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4 border-2 border-indigo-500">
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
            {{ t('import.importDetailRecordsWereDuring', { count: importRecord.stats[selectedRecordType], action: selectedRecordType }) }}
          </p>
          
          <!-- Loading -->
          <div v-if="loadingRecords" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
          <div v-else class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">{{ t('import.importDetailUnableToFetchRecordsTheyMay') }}</div>

          <!-- Pagination -->
          <div
            v-if="!loadingRecords && recordsPagination.totalPages > 1"
            class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700"
          >
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('import.importDetailRecordsPagination', {
                from: recordsPageFrom,
                to: recordsPageTo,
                total: recordsPagination.total,
              }) }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                :disabled="recordsPagination.currentPage <= 1"
                @click="goToRecordsPage(recordsPagination.currentPage - 1)"
              >
                {{ t('actions.previous') }}
              </button>
              <span class="text-xs text-gray-600 dark:text-gray-400">
                {{ recordsPagination.currentPage }} / {{ recordsPagination.totalPages }}
              </span>
              <button
                type="button"
                class="px-3 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                :disabled="recordsPagination.currentPage >= recordsPagination.totalPages"
                @click="goToRecordsPage(recordsPagination.currentPage + 1)"
              >
                {{ t('actions.next') }}
              </button>
            </div>
          </div>

          <p
            v-if="recordsIdsTruncated"
            class="text-xs text-amber-600 dark:text-amber-400"
          >
            {{ t('import.importDetailRecordIdsTruncated') }}
          </p>
        </div>

        <!-- Skipped Records -->
        <div v-if="selectedRecordType === 'skipped'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('import.importDetailRecordsWereDuring', { count: importRecord.stats.skipped, action: t('process.execSkipped').toLowerCase() }) }}
          </p>
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ t('import.importDetailRecordsSkipped') }}</p>
                <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{{ t('import.importDetailTheseRecordsWereSkippedBecauseThey') }}<span v-if="importRecord.duplicateCheckEnabled">{{ t('import.importDetailCheckedOn') }}<strong>{{ importRecord.duplicateCheckFields?.join(', ') || t('import.importDetailDefaultFields') }}</strong>.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Failed Records -->
        <div v-if="selectedRecordType === 'failed'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('import.importDetailRecordsFailedDuring', { count: importRecord.stats.failed }) }}
          </p>
          <div v-if="importErrors.length > 0" class="space-y-2 max-h-80 overflow-y-auto">
            <div 
              v-for="(error, index) in importErrors"
              :key="index"
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
            >
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <div class="text-xs font-medium text-red-800 dark:text-red-200">{{ t('import.importDetailRowLabel', { row: error.row }) }}</div>
                  <div class="text-xs text-red-700 dark:text-red-300 mt-0.5">{{ error.error }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">{{ t('import.importDetailNoErrorDetailsAvailable') }}</div>
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
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
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
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('import.importDetailImportedBy') }}</span>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                  {{ (importRecord.importedBy?.firstName?.[0] || '') + (importRecord.importedBy?.lastName?.[0] || '') }}
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ importRecord.importedBy?.firstName }} {{ importRecord.importedBy?.lastName }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('import.importDetailProcessingTime') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatProcessingTime(importRecord.processingTime) }}</span>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('import.importDetailTotalRows') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ importRecord.metadata?.totalRows || importRecord.stats?.total || 0 }}</span>
            </div>

            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('import.importDetailDuplicateCheck') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ importRecord.duplicateCheckEnabled ? t('import.importDetailDuplicateEnabled') : t('import.importDetailDuplicateDisabled') }}
                <span v-if="importRecord.duplicateCheckEnabled" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({{ importRecord.duplicateAction }})
                </span>
              </span>
            </div>

            <div v-if="importRecord.duplicateCheckFields?.length" class="flex items-start justify-between py-2">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('import.importDetailCheckedFields') }}</span>
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
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('import.importDetailCsvColumnsWereMappedToThe') }}</p>
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
                  <span class="text-sm text-indigo-600 dark:text-indigo-400 font-medium">{{ crmField }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Errors Tab -->
          <div v-if="activeTab === 'errors'">
            <div v-if="importErrors.length === 0" class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('import.importDetailNoErrorsDuringImport') }}</p>
            </div>
            <div v-else class="space-y-2">
              <div 
                v-for="(error, index) in importErrors"
                :key="index"
                class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <div class="text-xs font-medium text-red-800 dark:text-red-200">{{ t('import.importDetailRowLabel', { row: error.row }) }}</div>
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
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { useActiveImportsStore } from '@/stores/activeImports';
import apiClient from '@/utils/apiClient';
import { formatUserDate, formatNumber, formatTime as formatLocaleTime } from '@/utils/localeFormat';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';

const route = useRoute();
const activeImportsStore = useActiveImportsStore();
const { openTab, findTabByPath, switchToTab, activeTabId, findTabById, closeTab } = useTabs();

const IMPORTS_LIST_PATH = '/imports';

const MODULE_LABEL_KEYS = {
  contacts: 'navigation.modulePeople',
  people: 'navigation.modulePeople',
  deals: 'navigation.moduleDeals',
  tasks: 'navigation.moduleTasks',
  organizations: 'navigation.moduleOrganizations'
};

const MODULE_ROUTES = {
  contacts: '/people',
  people: '/people',
  deals: '/deals',
  tasks: '/tasks',
  organizations: '/organizations'
};

const importRecord = ref(null);
const loading = ref(true);
const error = ref(null);
const activeTab = ref('overview');
const showRecordsView = ref(false);
const selectedRecordType = ref(null);
const loadingRecords = ref(false);
const displayRecords = ref([]);
const recordsPagination = ref({ currentPage: 1, totalPages: 1, total: 0, limit: 50 });
const recordsIdsTruncated = ref(false);

const recordsPageFrom = computed(() => {
  const { currentPage, limit, total } = recordsPagination.value;
  if (!total) return 0;
  return (currentPage - 1) * limit + 1;
});

const recordsPageTo = computed(() => {
  const { currentPage, limit, total } = recordsPagination.value;
  return Math.min(currentPage * limit, total);
});

const importErrors = computed(() => {
  const record = importRecord.value;
  if (!record) return [];
  return record.importErrors || record.errors || [];
});

const tabs = computed(() => [
  { id: 'overview', name: t('import.importDetailTabOverview') },
  { id: 'mapping', name: t('import.importDetailTabFieldMapping'), count: Object.keys(importRecord.value?.metadata?.fieldMapping || {}).length },
  { id: 'errors', name: t('import.importDetailTabErrors'), count: importErrors.value.length }
]);

const successRate = computed(() => {
  if (!importRecord.value?.stats) return 0;
  const total = importRecord.value.stats.total || 0;
  if (total === 0) return 0;
  const successful = (importRecord.value.stats.created || 0) + (importRecord.value.stats.updated || 0);
  return Math.round((successful / total) * 100);
});

const liveProgress = computed(() => {
  const tracked = activeImportsStore.getImport(route.params.id);
  if (tracked) {
    return {
      processed: tracked.processed ?? 0,
      total: tracked.total ?? importRecord.value?.stats?.total ?? 0,
    };
  }
  return {
    processed: importRecord.value?.stats?.processed ?? 0,
    total: importRecord.value?.stats?.total ?? 0,
  };
});

const liveProgressPercent = computed(() => {
  const { processed, total } = liveProgress.value;
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
});

function formatCount(value) {
  return formatNumber(Number(value || 0));
}

let detailRefreshTimer = null;

function ensureDetailRefreshPolling() {
  if (importRecord.value?.status !== 'processing') {
    if (detailRefreshTimer) {
      clearInterval(detailRefreshTimer);
      detailRefreshTimer = null;
    }
    return;
  }
  if (detailRefreshTimer) return;
  detailRefreshTimer = setInterval(() => {
    void fetchImportDetails(true);
  }, 5000);
}

const recordsViewTitle = computed(() => {
  if (!selectedRecordType.value) return '';
  const type = selectedRecordType.value;
  const count = importRecord.value?.stats?.[type] || 0;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  return t('import.importDetailRecordsViewTitle', { type: typeLabel, count });
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

const fetchImportDetails = async (silent = false) => {
  try {
    if (!silent) loading.value = true;
    const response = await apiClient.get(`/imports/${route.params.id}`);
    if (response.success) {
      importRecord.value = response.data;
      if (importRecord.value.status === 'processing') {
        activeImportsStore.trackImport({
          importId: importRecord.value._id,
          fileName: importRecord.value.fileName,
          module: importRecord.value.module,
          total: importRecord.value.stats?.total ?? 0,
        });
      }
      ensureDetailRefreshPolling();
    } else if (!silent) {
      error.value = 'Import record not found';
    }
  } catch (err) {
    console.error('Error fetching import details:', err);
    if (!silent) error.value = err.message || 'Failed to load import details';
  } finally {
    if (!silent) loading.value = false;
  }
};

const formatModule = (module) => {
  const key = MODULE_LABEL_KEYS[module];
  return key ? t(key) : module.charAt(0).toUpperCase() + module.slice(1);
};

const formatStatus = (status) => {
  const statusKeys = {
    completed: 'import.importsStatusCompleted',
    partial: 'import.importsStatusPartial',
    failed: 'import.importsStatusFailed',
    processing: 'import.importsStatusProcessing'
  };
  const key = statusKeys[status];
  return key ? t(key) : status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return formatUserDate(date) || 'N/A';
};

const formatTime = (date) => {
  if (!date) return '';
  return formatLocaleTime(date, { hour: '2-digit', minute: '2-digit' });
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

const fetchRecords = async (type, page = 1) => {
  if (!importRecord.value) return;
  
  loadingRecords.value = true;
  displayRecords.value = [];
  
  try {
    const limit = recordsPagination.value.limit;
    const response = await apiClient.get(
      `/imports/${importRecord.value._id}/records/${type}?page=${page}&limit=${limit}`
    );
    if (response.success) {
      displayRecords.value = response.data || [];
      if (response.pagination) {
        recordsPagination.value = {
          currentPage: response.pagination.currentPage,
          totalPages: response.pagination.totalPages,
          total: response.pagination.total,
          limit: response.pagination.limit,
        };
      }
      recordsIdsTruncated.value = Boolean(response.meta?.idsTruncated);
    }
  } catch (err) {
    console.error('Error fetching records:', err);
    displayRecords.value = [];
  } finally {
    loadingRecords.value = false;
  }
};

const goToRecordsPage = (page) => {
  if (!selectedRecordType.value || page < 1 || page > recordsPagination.value.totalPages) return;
  fetchRecords(selectedRecordType.value, page);
};

const getRecordValue = (record, header) => {
  const module = importRecord.value.module;
  
  const fieldMap = {
    contacts: {
      'Name': r => `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'N/A',
      'Email': r => r.email || 'N/A',
      'Phone': r => r.phone || 'N/A',
      'Company': r => r.company || 'N/A',
      'Created At': r => formatUserDate(r.createdAt) || 'N/A'
    },
    deals: {
      'Name': r => r.name || 'N/A',
      'Amount': r => r.amount ? formatCurrencyValue(r.amount, { currencyCode: resolveOrgCurrencyCode() }) : 'N/A',
      'Stage': r => r.stage || 'N/A',
      'Status': r => r.status || 'N/A',
      'Expected Close': r => r.expectedCloseDate ? formatUserDate(r.expectedCloseDate) : 'N/A',
      'Created At': r => formatUserDate(r.createdAt) || 'N/A'
    },
    tasks: {
      'Title': r => r.title || 'N/A',
      'Status': r => r.status || 'N/A',
      'Priority': r => r.priority || 'N/A',
      'Due Date': r => r.dueDate ? formatUserDate(r.dueDate) : 'N/A',
      'Assigned To': r => r.assignedTo ? `${r.assignedTo.firstName || ''} ${r.assignedTo.lastName || ''}`.trim() : 'N/A',
      'Created At': r => formatUserDate(r.createdAt) || 'N/A'
    },
    organizations: {
      'Name': r => r.name || 'N/A',
      'Industry': r => r.industry || 'N/A',
      'Website': r => r.website || 'N/A',
      'Phone': r => r.phone || 'N/A',
      'Created At': r => formatUserDate(r.createdAt) || 'N/A'
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
  recordsPagination.value = { currentPage: 1, totalPages: 1, total: 0, limit: 50 };
  recordsIdsTruncated.value = false;
  
  if (type === 'created' || type === 'updated') {
    fetchRecords(type, 1);
  }
  
  setTimeout(() => {
    const recordsElement = document.querySelector('.border-indigo-500');
    if (recordsElement) {
      recordsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
};

const closeRecordsView = () => {
  showRecordsView.value = false;
  selectedRecordType.value = null;
  displayRecords.value = [];
  recordsIdsTruncated.value = false;
  recordsPagination.value = { currentPage: 1, totalPages: 1, total: 0, limit: 50 };
};

const navigateToImportsList = () => {
  const listTab = findTabByPath(IMPORTS_LIST_PATH);
  const currentTabId = activeTabId.value;
  const currentTab = currentTabId ? findTabById(currentTabId) : null;

  if (listTab) {
    switchToTab(listTab.id);
    if (currentTab && String(currentTab.path || '').startsWith(`${IMPORTS_LIST_PATH}/`)) {
      closeTab(currentTab.id);
    }
    return;
  }

  openTab(IMPORTS_LIST_PATH, {
    title: t('import.importsImportHistory'),
    icon: 'download'
  });

  if (currentTab && String(currentTab.path || '').startsWith(`${IMPORTS_LIST_PATH}/`)) {
    closeTab(currentTab.id);
  }
};

const navigateToModule = () => {
  const path = MODULE_ROUTES[importRecord.value?.module];
  if (!path) return;

  openTab(path, {
    title: formatModule(importRecord.value.module),
    icon: 'building'
  });
};

onMounted(() => {
  fetchImportDetails();
});

onBeforeUnmount(() => {
  if (detailRefreshTimer) {
    clearInterval(detailRefreshTimer);
    detailRefreshTimer = null;
  }
});
</script>
