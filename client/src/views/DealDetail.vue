<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">{{ t('deals.dealDetailLoadingDeal') }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('records.dealErrorTitle') }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/deals')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">{{ t('deals.dealDetailBackToDeals') }}</button>
      </div>
    </div>

    <!-- Deal Detail -->
    <div v-else-if="deal" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/deals')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">{{ t('performance.back') }}</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            v-if="primaryContact?.email"
            @click="showEmailModal = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-all"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>{{ t('settings.settingsAddFieldTypeEmail') }}</button>
          <button @click="editDeal" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>{{ t('settings.groupsEditTitle') }}</button>
          <button @click="deleteDeal" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>{{ t('settings.modFieldsDelete') }}</button>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Deal Info Card -->
        <div class="lg:col-span-1">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <!-- Deal Header -->
            <div class="mb-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <h1 class="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {{ deal.name }}
                  </h1>
                  <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${{ deal.amount?.toLocaleString() || 0 }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-2 mb-2">
                <!-- Stage: Primary Control (prominent) -->
                <span 
                  class="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold border-2"
                  :class="getStageClass(deal.stage)"
                >
                  {{ deal.stage }}
                </span>
                <!-- Status: Read-only badge when derivedStatus exists -->
                <span 
                  v-if="deal.derivedStatus"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getStatusClass(deal.status)"
                  :title="t('deals.dealDetailSystemOwnedComputedFromStage')"
                >
                  {{ deal.status }}
                </span>
                <span 
                  v-else
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getStatusClass(deal.status)"
                >
                  {{ deal.status }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getPriorityClass(deal.priority)"
                >
                  {{ deal.priority || 'Medium' }}
                </span>
                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    :style="{ width: `${deal.probability || 0}%` }"
                  ></div>
                </div>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ deal.probability || 0 }}%</span>
              </div>
            </div>

            <!-- Primary Contact (from dealPeople or legacy contactId) -->
            <div v-if="primaryContact" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('deals.dealDetailPrimaryContact') }}</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ primaryContact.first_name }} {{ primaryContact.last_name }}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-400">{{ primaryContact.email }}</p>
            </div>
            
            <!-- Primary Customer Organization (from dealOrganizations or legacy accountId) -->
            <div v-if="primaryCustomer" class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('deals.dealDetailPrimaryCustomer') }}</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ primaryCustomer.name }}
              </p>
            </div>

            <!-- All Participants (progressive disclosure) -->
            <div class="mb-4">
              <button
                v-if="hasMultipleParticipants"
                type="button"
                @click="showAllParticipants = !showAllParticipants"
                class="w-full flex items-center justify-between text-left py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ showAllParticipants ? 'Hide' : 'All' }} Participants
                </span>
                <svg
                  :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform', { 'rotate-180': showAllParticipants }]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="showAllParticipants && hasMultipleParticipants" class="mt-2 space-y-3">
                <!-- People on this Deal -->
                <div v-if="allPeople.length" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ t('deals.dealDetailPeopleOnThisDeal') }}</span>
                  </div>
                  <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                    <li
                      v-for="(entry, idx) in allPeople"
                      :key="`p-${entry.personId?._id || entry.personId}-${entry.role}-${idx}`"
                      class="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {{ participantPersonName(entry) }}
                        </p>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ participantRoleLabel(entry.role, 'person') }}</span>
                          <span v-if="entry.isPrimary" class="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{{ t('forms.rtColorPrimary') }}</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
                <!-- Organizations on this Deal -->
                <div v-if="allOrgs.length" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ t('deals.dealDetailOrganizationsOnThisDeal') }}</span>
                  </div>
                  <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                    <li
                      v-for="(entry, idx) in allOrgs"
                      :key="`o-${entry.organizationId?._id || entry.organizationId}-${entry.role}-${idx}`"
                      class="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {{ participantOrgName(entry) }}
                        </p>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ participantRoleLabel(entry.role, 'org') }}</span>
                          <span v-if="entry.isPrimary" class="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{{ t('forms.rtColorPrimary') }}</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Quick Info -->
            <div class="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div v-if="deal.ownerId" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.roleUsersOwner') }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">
                    {{ deal.ownerId.firstName }} {{ deal.ownerId.lastName }}
                  </p>
                </div>
              </div>

              <div v-if="deal.type" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsValidationType') }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ deal.type }}</p>
                </div>
              </div>

              <div v-if="deal.source" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.metricsSource') }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ deal.source }}</p>
                </div>
              </div>

              <div v-if="deal.expectedCloseDate" class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('deals.dealDetailExpectedClose') }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ formatDate(deal.expectedCloseDate) }}</p>
                </div>
              </div>

              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubColCreated') }}</p>
                  <p class="text-xs font-medium text-gray-900 dark:text-white">{{ formatDate(deal.createdAt) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Details & Activity -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Stats Row -->
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ t('settings.assignRulesDistWeighted') }}</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                    ${{ ((deal.amount || 0) * (deal.probability || 0) / 100).toLocaleString() }}
                  </p>
                </div>
                <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ t('forms.fieldNotes') }}</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ deal.notes?.length || 0 }}</p>
                </div>
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ t('deals.dealDetailAge') }}</p>
                  <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ getDealAge() }}d</p>
                </div>
                <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div v-if="deal.description" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">{{ t('settings.coreModDetailDescription') }}</h3>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ deal.description }}</p>
          </div>

          <!-- Stage History -->
          <div v-if="deal.stageHistory && deal.stageHistory.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-3">{{ t('records.stageHistoryTitle') }}</h3>
            <div class="space-y-2">
              <div v-for="(history, index) in deal.stageHistory.slice(0, 5)" :key="index" class="flex items-center gap-2 text-xs">
                <div class="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500"></div>
                <span class="font-medium text-gray-900 dark:text-white">{{ history.stage }}</span>
                <span class="text-gray-500 dark:text-gray-400">•</span>
                <span class="text-gray-600 dark:text-gray-400">{{ formatDate(history.changedAt) }}</span>
                <span v-if="history.changedBy" class="text-gray-500 dark:text-gray-400">by {{ history.changedBy.firstName }}</span>
              </div>
            </div>
          </div>

          <!-- Related Events -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ t('settings.coreModDetailModuleEvents') }}</h3>
              <button @click="openCreateEvent" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>{{ t('deals.dealDetailAddEvent') }}</button>
            </div>
            
            <RelatedEventsWidget
              v-if="deal._id"
              related-type="Deal"
              :related-id="deal._id"
              :limit="5"
              @create-event="openCreateEvent"
              @view-event="viewEvent"
              ref="eventsWidgetRef"
            />
          </div>

          <!-- Related Records Panel (Phase 1B: Read-only visibility) -->
          <div v-if="deal._id" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-4">{{ t('records.taskRelatedRecordsTab') }}</h3>
            <RelatedRecordsPanel
              app-key="SALES"
              module-key="deals"
              :record-id="deal._id"
              :read-only="true"
            />
          </div>

          <!-- Automation Context -->
          <AutomationContext
            v-if="deal._id"
            entity-type="deal"
            :entity-id="deal._id"
          />

          <!-- Activity Timeline -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">Activity & Notes</h3>
              <button @click="showNoteForm = true" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>{{ t('actions.add') }}</button>
            </div>

            <!-- Note Form -->
            <div v-if="showNoteForm" class="mb-4">
              <textarea 
                v-model="newNote" 
                :placeholder="t('deals.dealDetailAddANote')"
                rows="2"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent resize-none transition-all"
              ></textarea>
              <div class="flex items-center justify-end gap-2 mt-2">
                <button @click="showNoteForm = false; newNote = ''" class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{{ t('performance.cancelWizard') }}</button>
                <button @click="addNote" :disabled="!newNote.trim()" class="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">{{ t('actions.save') }}</button>
              </div>
            </div>

            <!-- Notes List -->
            <div class="space-y-2">
              <div v-if="deal.notes && deal.notes.length > 0">
                <div v-for="(note, index) in deal.notes" :key="index" class="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Avatar
                    :user="{
                      firstName: note.createdBy?.firstName,
                      lastName: note.createdBy?.lastName,
                      email: note.createdBy?.email,
                      avatar: note.createdBy?.avatar
                    }"
                    size="sm"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="font-semibold text-gray-900 dark:text-white text-xs">
                        {{ note.createdBy?.firstName || 'Unknown' }} {{ note.createdBy?.lastName || '' }}
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">• {{ formatTimeAgo(note.createdAt) }}</span>
                    </div>
                    <p class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{{ note.text }}</p>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-8">
                <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p class="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">{{ t('common.summaryNoActivity') }}</p>
                <p class="text-gray-400 dark:text-gray-500 text-xs">Click "Add" to start tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showEditModal"
      moduleKey="deals"
      :record="deal"
      @close="showEditModal = false"
      @saved="handleDealUpdated"
    />

    <!-- Event Form Drawer -->
    <CreateRecordDrawer
      :isOpen="showEventModal"
      moduleKey="events"
      :record="eventToEdit"
      @close="showEventModal = false"
      @saved="handleEventSaved"
    />

    <!-- Email Compose Drawer -->
    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="(deal?.id ?? deal?._id) ? { moduleKey: 'deals', recordId: String(deal?.id ?? deal?._id ?? '') } : null"
      :initial-to="primaryContact?.email || ''"
      @close="showEmailModal = false"
      @submit="handleEmailSubmit"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import AutomationContext from '@/components/automation/AutomationContext.vue';
import Avatar from '@/components/common/Avatar.vue';

const route = useRoute();
const router = useRouter();
const notifications = useNotifications();

// Use tabs composable
const { openTab } = useTabs();

const deal = ref(null);
const loading = ref(true);
const error = ref(null);
const showEditModal = ref(false);
const showNoteForm = ref(false);
const newNote = ref('');
const showEventModal = ref(false);
const showEmailModal = ref(false);
const eventToEdit = ref(null);
const eventsWidgetRef = ref(null);
const showAllParticipants = ref(false);

const isDealDetailRoute = () => {
  if (route.name === 'deal-detail') return true;
  return typeof route.path === 'string' && route.path.startsWith('/deals/');
};

// Primary Contact: from dealPeople (role=primary_contact, isPrimary=true) or legacy contactId
const primaryContact = computed(() => {
  if (!deal.value) return null;
  
  // Check role-based relationships first
  if (deal.value.dealPeople && Array.isArray(deal.value.dealPeople)) {
    const primary = deal.value.dealPeople.find(
      (p) => p.isPrimary && p.isActive && p.role === 'primary_contact' && p.personId
    );
    if (primary && primary.personId) {
      return typeof primary.personId === 'object' ? primary.personId : null;
    }
  }
  
  // Fallback to legacy contactId
  if (deal.value.contactId) {
    return typeof deal.value.contactId === 'object' ? deal.value.contactId : null;
  }
  
  return null;
});

// Primary Customer: from dealOrganizations (role=customer, isPrimary=true) or legacy accountId
const primaryCustomer = computed(() => {
  if (!deal.value) return null;
  
  // Check role-based relationships first
  if (deal.value.dealOrganizations && Array.isArray(deal.value.dealOrganizations)) {
    const primary = deal.value.dealOrganizations.find(
      (o) => o.isPrimary && o.isActive && o.role === 'customer' && o.organizationId
    );
    if (primary && primary.organizationId) {
      return typeof primary.organizationId === 'object' ? primary.organizationId : null;
    }
  }
  
  // Fallback to legacy accountId
  if (deal.value.accountId) {
    return typeof deal.value.accountId === 'object' ? deal.value.accountId : null;
  }
  
  return null;
});

const allPeople = computed(() => {
  if (!deal.value?.dealPeople || !Array.isArray(deal.value.dealPeople)) return [];
  return deal.value.dealPeople.filter((p) => p.personId && p.isActive !== false);
});
const allOrgs = computed(() => {
  if (!deal.value?.dealOrganizations || !Array.isArray(deal.value.dealOrganizations)) return [];
  return deal.value.dealOrganizations.filter((o) => o.organizationId && o.isActive !== false);
});
const hasMultipleParticipants = computed(() => {
  return allPeople.value.length > 1 || allOrgs.value.length > 1;
});

const personRoleLabels = { primary_contact: 'Primary contact', decision_maker: 'Decision maker', influencer: 'Influencer', partner_contact: 'Partner contact' };
const orgRoleLabels = { customer: 'Customer', partner: 'Partner', reseller: 'Reseller' };

function participantPersonName(entry) {
  const p = entry.personId;
  if (!p) return '—';
  const o = typeof p === 'object' ? p : null;
  if (o) return [o.first_name, o.last_name].filter(Boolean).join(' ') || o.email || '—';
  return '—';
}
function participantOrgName(entry) {
  const o = entry.organizationId;
  if (!o) return '—';
  const obj = typeof o === 'object' ? o : null;
  return obj?.name || '—';
}
function participantRoleLabel(role, kind) {
  if (kind === 'person') return personRoleLabels[role] || role;
  return orgRoleLabels[role] || role;
}

const fetchDeal = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const data = await apiClient.get(`/deals/${route.params.id}`);
    
    if (data.success) {
      deal.value = data.data;
      console.log('Deal loaded:', deal.value);
    }
  } catch (err) {
    console.error('Error fetching deal:', err);
    if (err?.status === 404 || err?.is404) {
      error.value = err?.response?.data?.message || err?.message || 'Deal not found or access denied.';
    } else {
      error.value = err?.message || 'Failed to load deal';
    }
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return `${seconds} secs ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

const getDealAge = () => {
  if (!deal.value?.createdAt) return 0;
  const days = Math.floor((new Date() - new Date(deal.value.createdAt)) / (1000 * 60 * 60 * 24));
  return days;
};

const getStageClass = (stage) => {
  const classes = {
    'Qualification': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'Proposal': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    'Negotiation': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    'Contract Sent': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Closed Won': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Closed Lost': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
  };
  return classes[stage] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const getStatusClass = (status) => {
  const classes = {
    'Open': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Won': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
    'Lost': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'Stalled': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
  };
  return classes[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const getPriorityClass = (priority) => {
  const classes = {
    'High': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'Medium': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Low': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
  };
  return classes[priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
};

const editDeal = () => {
  showEditModal.value = true;
};

const handleEmailSubmit = async (payload) => {
  showEmailModal.value = false;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success('Email sent');
      fetchDeal();
    } else {
      notifications.error(res.message || 'Failed to send email');
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || 'Failed to send email');
  }
};

const handleDealUpdated = () => {
  showEditModal.value = false;
  fetchDeal();
};

const deleteDeal = async () => {
  if (!confirm('Are you sure you want to delete this deal?')) return;
  
  try {
    await apiClient.delete(`/deals/${route.params.id}`);
    router.push('/deals');
  } catch (err) {
    console.error('Error deleting deal:', err);
    alert(t('common.dealDetailToastFailedToDeleteDeal'));
  }
};

const addNote = async () => {
  if (!newNote.value.trim()) return;
  
  try {
    const data = await apiClient.post(`/deals/${route.params.id}/notes`, {
      text: newNote.value.trim()
    });
    
    if (data.success) {
      deal.value = data.data;
      newNote.value = '';
      showNoteForm.value = false;
    }
  } catch (err) {
    console.error('Error adding note:', err);
    alert(t('common.dealDetailToastFailedToAddNote'));
  }
};

const openCreateEvent = () => {
  eventToEdit.value = {
    relatedTo: {
      type: 'Deal',
      id: deal.value._id
    }
  };
  showEventModal.value = true;
};

const viewEvent = (eventId) => {
  openTab(`/events/${eventId}`, {
    title: 'Event Detail',
    icon: '📅',
    insertAdjacent: true
  });
};

const handleEventSaved = () => {
  showEventModal.value = false;
  eventToEdit.value = null;
  if (eventsWidgetRef.value) {
    eventsWidgetRef.value.refresh();
  }
};

// Only fetch when this component is bound to an actual deal-detail route.
watch(
  () => [route.name, route.path, route.params.id],
  ([, , newId], oldValue) => {
    const oldId = Array.isArray(oldValue) ? oldValue[2] : undefined;
    if (!isDealDetailRoute()) return;
    if (newId && newId !== oldId) {
      fetchDeal();
    }
  },
  { immediate: true }
);
</script>
