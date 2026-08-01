<template>
  <SettingsScrollPanel>
    <template #header>
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabDemoRequests') }}</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">{{ t('process.controlPlaneDemoRequestsDesc') }}</p>
      </div>
    </template>

    <!-- Stats Cards -->
    <div v-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsTotalRequests') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.thisMonth || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsThisMonth') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.byStatus?.pending || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('process.flowHealthPending') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.byStatus?.converted || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsConverted3') }}</p>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col lg:flex-row gap-4 mb-6">
      <div class="w-full lg:w-80">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            :placeholder="t('common.demoRequestsSearchDemoRequests')"
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <select 
          v-model="filterStatus" 
          @change="fetchDemoRequests"
          class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm"
        >
          <option value="">{{ t('settings.groupsFilterAllStatus') }}</option>
          <option value="pending">{{ t('process.flowHealthPending') }}</option>
          <option value="contacted">{{ t('common.demoRequestsContacted2') }}</option>
          <option value="demo_scheduled">{{ t('common.demoRequestsDemoScheduled2') }}</option>
          <option value="demo_completed">{{ t('common.demoRequestsDemoCompleted2') }}</option>
          <option value="converted">{{ t('common.demoRequestsConverted2') }}</option>
          <option value="rejected">{{ t('process.flowHealthRejected') }}</option>
        </select>

        <button 
          @click="clearFilters" 
          :disabled="!hasActiveFilters"
          class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>{{ t('settings.modFieldsClear') }}</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <p class="text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsLoadingDemoRequests') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <p class="text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <!-- Demo Requests Table -->
    <div v-else-if="demoRequests.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="w-full border-collapse">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('settings.settingsBhScopeCompany') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('forms.hubLinkedContact') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('settings.settingsAddFieldTypeEmail') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('settings.assignRulesCondFieldIndustry') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('common.demoRequestsSize') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('settings.settingsBhFieldStatus') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('settings.settingsAddFieldTypeDate') }}</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ t('navigation.portalActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in demoRequests" :key="request._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">{{ request.companyName }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ request.contactName }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ request.email }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ request.industry }}</td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ request.companySize }}</td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <span :class="getStatusClass(request.status)">
                {{ formatStatus(request.status) }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{{ formatDate(request.createdAt) }}</td>
            <td class="px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-700">
              <div class="flex gap-2">
                <button 
                  @click="viewDetails(request)"
                  class="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-105"
                  :title="t('process.execLogsViewDetails')"
                >{{ t('common.viewRecord') }}</button>
                <button 
                  v-if="request.status !== 'converted'"
                  @click="openConvertModal(request)"
                  class="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all hover:scale-105"
                  :title="t('common.demoRequestsConvertToOrganization2')"
                >{{ t('common.demoRequestsConvert2') }}</button>
                <button
                  v-else
                  @click="resendActivation(request)"
                  class="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                  :disabled="resendingId === request._id"
                  :title="t('common.demoRequestsResendActivation')"
                >{{ resendingId === request._id ? t('common.demoRequestsResendingActivation') : t('common.demoRequestsResendActivation') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p class="text-gray-600 dark:text-gray-400 text-center py-12">{{ t('common.demoRequestsNoDemoRequestsFound') }}</p>
    </div>

    <!-- Details Modal -->
    <div v-if="selectedRequest" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeModal">
      <div class="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.demoRequestsDemoRequestDetails') }}</h2>
          <button @click="closeModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl font-bold">×</button>
        </div>
        
        <div class="p-6">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('common.demoRequestsCompanyInformation') }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsCompanyName') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.companyName }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsIndustry') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.industry }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsCompanySize') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.companySize }}</p>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('common.demoRequestsContactInformation') }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsContactName') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.contactName }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsEmail') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.email }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsPhone') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.phone || 'N/A' }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsJobTitle') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.jobTitle || 'N/A' }}</p>
              </div>
            </div>
          </div>

          <div v-if="selectedRequest.message" class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsMessageLabel') }}</h3>
            <p class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-gray-700 dark:text-gray-300">{{ selectedRequest.message }}</p>
          </div>

          <!-- CRM Integration Section -->
          <div v-if="selectedRequest.organizationId || selectedRequest.contactId" class="mb-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">✅ CRM Integration</h3>
            <div class="flex items-center gap-3 bg-green-100 dark:bg-green-800/30 p-4 rounded-lg mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-green-600 dark:text-green-400">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="font-medium text-green-800 dark:text-green-200">{{ t('common.demoRequestsThisProspectIsAlreadyInYour') }}</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="selectedRequest.organizationId">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsOrganization') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedRequest.organizationId.name }} 
                  <span class="text-gray-500 dark:text-gray-400">({{ selectedRequest.organizationId.industry }})</span>
                </p>
              </div>
              <div v-if="selectedRequest.contactId">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsContact') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ selectedRequest.contactId.first_name }} {{ selectedRequest.contactId.last_name }}
                  <span class="inline-block px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full ml-2">{{ selectedRequest.contactId.lifecycle_stage }}</span>
                </p>
              </div>
              <div v-if="selectedRequest.contactId">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsContactEmail') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.contactId.email }}</p>
              </div>
              <div v-if="selectedRequest.contactId && selectedRequest.contactId.phone">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.demoRequestsContactPhone') }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ selectedRequest.contactId.phone }}</p>
              </div>
            </div>
            
            <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 rounded">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{{ t('settings.modFieldsNoteLabel') }}</strong>{{ t('common.demoRequestsThisContactExistsInASeparate') }}</p>
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{{ t('common.demoRequestsUpdateStatus') }}</h3>
            <div class="flex gap-3">
              <select 
                v-model="updateStatusValue" 
                class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="pending">{{ t('process.flowHealthPending') }}</option>
                <option value="contacted">{{ t('common.demoRequestsContacted') }}</option>
                <option value="demo_scheduled">{{ t('common.demoRequestsDemoScheduled') }}</option>
                <option value="demo_completed">{{ t('common.demoRequestsDemoCompleted') }}</option>
                <option value="converted">{{ t('common.demoRequestsConverted') }}</option>
                <option value="rejected">{{ t('process.flowHealthRejected') }}</option>
              </select>
              <button 
                @click="updateStatus" 
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="updatingStatus"
              >
                {{ updatingStatus ? 'Updating...' : 'Update Status' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Convert Modal -->
    <div v-if="convertModalRequest" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeConvertModal">
      <div class="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full mx-4" @click.stop>
        <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.demoRequestsConvertToOrganization') }}</h2>
          <button @click="closeConvertModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl font-bold">×</button>
        </div>
        
        <div class="p-6">
          <p class="mb-4 text-gray-700 dark:text-gray-300">
            {{ t('common.demoRequestsConvertConfirmBody', { company: convertModalRequest.companyName }) }}
          </p>
          <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
            {{ t('common.demoRequestsConvertActivationHint', { email: convertModalRequest.email }) }}
          </p>

          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('common.demoRequestsSubscriptionTier') }}</label>
            <select v-model="convertTier" class="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="trial">{{ t('common.demoRequestsTrial15Days') }}</option>
              <option value="starter">{{ t('common.demoRequestsStarter') }}</option>
              <option value="professional">{{ t('common.demoRequestsProfessional') }}</option>
              <option value="enterprise">{{ t('common.demoRequestsEnterprise') }}</option>
            </select>
          </div>

          <div class="flex gap-3">
            <button 
              @click="convertRequest" 
              class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="converting"
            >
              {{ converting ? t('common.demoRequestsConverting') : t('common.demoRequestsConvert2') }}
            </button>
            <button @click="closeConvertModal" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">{{ t('performance.cancelWizard') }}</button>
          </div>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, onMounted, computed } from 'vue';
import apiClient from '../utils/apiClient';
import { formatUserDate } from '@/utils/localeFormat';

const demoRequests = ref([]);
const stats = ref(null);
const loading = ref(true);
const error = ref('');
const filterStatus = ref('');
const searchQuery = ref('');

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || filterStatus.value !== '';
});

const selectedRequest = ref(null);
const updateStatusValue = ref('');
const updatingStatus = ref(false);

const convertModalRequest = ref(null);
const convertTier = ref('trial');
const converting = ref(false);
const resendingId = ref(null);

const fetchDemoRequests = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    let url = '/demo/requests';
    if (filterStatus.value) {
      url += `?status=${filterStatus.value}`;
    }

    const data = await apiClient(url);
    
    if (data.success) {
      demoRequests.value = data.data;
    }
  } catch (err) {
    console.error('Error fetching demo requests:', err);
    error.value = 'Failed to load demo requests';
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const data = await apiClient('/demo/requests/stats');
    if (data.success) {
      stats.value = data.data;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
};

const viewDetails = (request) => {
  selectedRequest.value = request;
  updateStatusValue.value = request.status;
};

const closeModal = () => {
  selectedRequest.value = null;
};

const updateStatus = async () => {
  if (!selectedRequest.value) return;
  
  updatingStatus.value = true;
  
  try {
    const data = await apiClient(`/demo/requests/${selectedRequest.value._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: updateStatusValue.value
      })
    });
    
    if (data.success) {
      // Update the request in the list
      const index = demoRequests.value.findIndex(r => r._id === selectedRequest.value._id);
      if (index !== -1) {
        demoRequests.value[index] = data.data;
      }
      
      selectedRequest.value = data.data;
      await fetchStats();
    }
  } catch (err) {
    console.error('Error updating status:', err);
    notifications.error(t('common.demoRequestsToastFailedToUpdateStatus'));
  } finally {
    updatingStatus.value = false;
  }
};

const openConvertModal = (request) => {
  convertModalRequest.value = request;
  convertTier.value = 'trial';
};

const closeConvertModal = () => {
  convertModalRequest.value = null;
};

const convertRequest = async () => {
  if (!convertModalRequest.value) return;
  
  converting.value = true;
  
  try {
    const data = await apiClient(
      `/demo/requests/${convertModalRequest.value._id}/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          subscriptionTier: convertTier.value
        })
      }
    );
    
    if (data.success) {
      const payload = data.data || {};
      if (payload.activationEmailSent) {
        notifications.error(t('common.demoRequestsToastConvertedActivationSent'));
      } else if (payload.activationUrl) {
        notifications.error(t('common.demoRequestsToastConvertedActivationLink', { url: payload.activationUrl }));
      } else {
        notifications.success(t('common.demoRequestsToastSuccessfullyConvertedToOrganization'));
      }
      closeConvertModal();
      await fetchDemoRequests();
      await fetchStats();
    }
  } catch (err) {
    console.error('Error converting request:', err);
    notifications.error(err.message || t('common.demoRequestsToastFailedToConvertRequest'));
  } finally {
    converting.value = false;
  }
};

const resendActivation = async (request) => {
  if (!request?._id) return;
  resendingId.value = request._id;
  try {
    const data = await apiClient(`/demo/requests/${request._id}/resend-activation`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (data.success) {
      const payload = data.data || {};
      if (payload.activationEmailSent) {
        notifications.error(t('common.demoRequestsToastActivationResent'));
      } else if (payload.activationUrl) {
        notifications.error(t('common.demoRequestsToastActivationLink', { url: payload.activationUrl }));
      } else {
        notifications.error(data.message || t('common.demoRequestsToastActivationResent'));
      }
    }
  } catch (err) {
    console.error('Error resending activation:', err);
    notifications.error(err.message || t('common.demoRequestsToastFailedToResendActivation'));
  } finally {
    resendingId.value = null;
  }
};

const getStatusClass = (status) => {
  const classes = {
    pending: 'inline-block px-3 py-1 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full',
    contacted: 'inline-block px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full',
    demo_scheduled: 'inline-block px-3 py-1 text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full',
    demo_completed: 'inline-block px-3 py-1 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full',
    converted: 'inline-block px-3 py-1 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full',
    rejected: 'inline-block px-3 py-1 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full'
  };
  return classes[status] || 'inline-block px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full';
};

const formatStatus = (status) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (dateString) => {
  return formatUserDate(dateString) || '-';
};

// Search and filter methods
let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchDemoRequests();
  }, 300);
};

const clearFilters = () => {
  searchQuery.value = '';
  filterStatus.value = '';
  fetchDemoRequests();
};

onMounted(() => {
  document.title = 'Demo Requests | Arivu';
  fetchDemoRequests();
  fetchStats();
});
</script>


