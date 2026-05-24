<template>
  <!-- Density Mode: Balanced (entity detail screen) -->
  <div class="mx-auto max-w-7xl density-balanced">
    <!-- Loading State (Skeleton Structure) -->
    <div v-if="loading">
      <!-- Header Skeleton -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div class="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>

      <!-- App Participations Card Skeleton -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-dashed border-gray-300 dark:border-gray-600">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div class="px-6 py-4">
          <div class="flex flex-wrap gap-2">
            <div class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>

      <!-- Attach to App Card Skeleton -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div class="px-6 py-4">
          <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      <!-- Core Information Card Skeleton -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
        <div class="px-6 py-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div>
              <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div>
              <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div>
              <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- App Section Card Skeleton -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
        <div class="px-6 py-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div>
              <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-danger-800 dark:text-danger-200 mb-2">{{ t('people.peopleDetailErrorLoadingProfile') }}</h3>
          <p class="text-sm text-danger-700 dark:text-danger-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Profile Content -->
    <div v-else-if="profileData">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('process.designerModulePerson') }}</span>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ getPersonDisplayName() }}
            </h1>
            <p v-if="appContext" class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleDetailViewingIn') }}<span class="font-medium">{{ appContext.appKey }}</span>{{ t('people.peopleDetailAppContext') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Other header actions can go here -->
          </div>
        </div>
      </div>

      <!-- Participation Overview Panel -->
      <ParticipationOverviewPanel
        :person="profileData"
        @edit="handleParticipationEdit"
        @convert="handleParticipationConvert"
        @detach="handleParticipationDetach"
        @attach="handleParticipationAttach"
      />

      <!-- Attach to App Section (App-owned: Action card) -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.modFieldsBadgeApp') }}</span>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleDetailAttachToApp2') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailAddThisPersonToAnotherApp2') }}</p>
        </div>
        <div class="px-6 py-4">
          <div class="flex items-start gap-2">
            <button
              @click="showAttachModal = true"
              :disabled="!hasAvailableAttachIntents"
              :class="hasAvailableAttachIntents
                ? 'text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline decoration-dotted underline-offset-2 transition-colors py-2 px-2 min-h-[40px] flex items-center'
                : 'text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed py-2 px-2 min-h-[40px] flex items-center'"
            >{{ t('people.peopleDetailAttachToAnotherApp') }}</button>
            <span v-if="hasAvailableAttachIntents" class="text-xs text-gray-400 dark:text-gray-500">·</span>
            <p v-if="hasAvailableAttachIntents" class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.peopleDetailAddsThisPersonToANew') }}</p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('people.peopleDetailThisPersonIsAlreadyPartOf2') }}</p>
          </div>
        </div>
      </div>

      <!-- Core Information Section (Always First) -->
      <div v-if="profileData.core?.canView" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.peopleDetailEntity4') }}</span>
              </div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleDetailCoreInformation') }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailSharedAcrossAllApps') }}</p>
            </div>
            <!-- Edit Controls (Only when canEdit is true) -->
            <div v-if="profileData.core.canEdit && !isEditingCore" class="flex items-center gap-2">
              <button
                @click="enterEditMode"
                class="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 min-h-[40px]"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>{{ t('settings.groupsEditTitle') }}</button>
            </div>
            <div v-else-if="profileData.core.canEdit && isEditingCore" class="flex items-center gap-2">
              <button
                @click="cancelEdit"
                class="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[40px]"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                @click="saveCoreFields"
                :disabled="saving"
                class="px-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 min-h-[40px]"
              >
                <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
            <div v-else-if="!profileData.core.canEdit" class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('settings.modFieldsDepReadonly') }}</div>
          </div>
        </div>
        <div class="px-6 py-4">
          <!-- Read-only View -->
          <dl v-if="!isEditingCore" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div v-if="profileData.core.fields.first_name || profileData.core.fields.last_name">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhFieldName') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                {{ profileData.core.fields.first_name }} {{ profileData.core.fields.last_name }}
              </dd>
            </div>
            <div v-if="profileData.core.fields.email">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.settingsAddFieldTypeEmail') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                <a :href="`mailto:${profileData.core.fields.email}`" class="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {{ profileData.core.fields.email }}
                </a>
              </dd>
            </div>
            <div v-if="profileData.core.fields.phone || profileData.core.fields.mobile">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.settingsAddFieldTypePhone') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                {{ profileData.core.fields.phone || profileData.core.fields.mobile }}
              </dd>
            </div>
            <div v-if="profileData.core.fields.source">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.peopleDetailCreatedVia') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {{ profileData.core.fields.source }}
                </span>
              </dd>
            </div>
            <div v-if="profileData.core.fields.organization">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.profileMetaOrg') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                <template v-if="typeof profileData.core.fields.organization === 'object'">
                  {{ profileData.core.fields.organization.name || '-' }}
                </template>
                <template v-else>
                  {{ profileData.core.fields.organization || '-' }}
                </template>
              </dd>
            </div>
            <div v-if="profileData.core.fields.tags && profileData.core.fields.tags.length > 0">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesCondFieldTags') }}</dt>
              <dd class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="tag in profileData.core.fields.tags"
                  :key="tag"
                  class="inline-flex items-center px-2 py-2 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                >
                  {{ tag }}
                </span>
              </dd>
            </div>
            <div v-if="profileData.core.fields.do_not_contact !== undefined">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.peopleDetailDoNotContact3') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                <span :class="profileData.core.fields.do_not_contact ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'">
                  {{ profileData.core.fields.do_not_contact ? 'Yes' : 'No' }}
                </span>
              </dd>
            </div>
            <div v-if="profileData.core.fields.createdAt">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.hubColCreated') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                {{ formatDate(profileData.core.fields.createdAt) }}
              </dd>
            </div>
            <div v-if="profileData.core.fields.updatedAt">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.peopleDetailLastUpdated') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                {{ formatDate(profileData.core.fields.updatedAt) }}
              </dd>
            </div>
          </dl>

          <!-- Edit Mode -->
          <form v-else @submit.prevent="saveCoreFields" class="space-y-4">
            <div v-if="editError" class="p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
              <p class="text-sm text-danger-700 dark:text-danger-300">{{ editError }}</p>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- First Name -->
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.inviteFirstName') }}</label>
                <input
                  v-model="editForm.first_name"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <!-- Last Name -->
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.inviteLastName') }}</label>
                <input
                  v-model="editForm.last_name"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <!-- Email -->
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.settingsAddFieldTypeEmail') }}</label>
                <input
                  v-model="editForm.email"
                  type="email"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <!-- Phone -->
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.settingsAddFieldTypePhone') }}</label>
                <PhoneInput
                  :model-value="editForm.phone"
                  :placeholder="t('settings.profilePhone')"
                  input-class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  @update:model-value="editForm.phone = $event"
                />
              </div>
              <!-- Mobile -->
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('people.peopleDetailMobile') }}</label>
                <PhoneInput
                  :model-value="editForm.mobile"
                  :placeholder="t('people.peopleDetailMobileNumber')"
                  input-class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  @update:model-value="editForm.mobile = $event"
                />
              </div>
              <!-- Do Not Contact -->
              <div class="sm:col-span-2">
                <label class="flex items-center gap-2">
                  <HeadlessCheckbox
                    v-model="editForm.do_not_contact"
                    checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('people.peopleDetailDoNotContact2') }}</span>
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- App-Specific Sections (Only when context exists) -->
      <div
        v-for="(appSection, appKey) in profileData.apps"
        :key="appKey"
        v-show="appSection.canView"
        class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.modFieldsBadgeApp') }}</span>
              </div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ appKey }} Information
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailAppSpecificFields') }}</p>
            </div>
            <!-- Action Controls -->
            <div class="flex items-start gap-2">
              <!-- Convert Lead to Contact button (Sales only) - Shows even if read-only -->
              <div v-if="appKey === 'SALES' && appSection.fields && isPeopleSalesLeadFromFields(appSection.fields) && !isEditingApp[appKey]" class="flex flex-col gap-2">
                <button
                  @click="showConvertModal = true"
                  class="px-4 py-2 text-sm font-semibold text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 border-2 border-gray-900 dark:border-gray-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>{{ t('records.genericConvertToContact') }}</button>
                <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ t('people.peopleDetailChangesThisPersonsRoleWithinSales') }}</p>
              </div>
              <!-- Edit button (only if canEdit) -->
              <button
                v-if="appSection.canEdit && !isEditingApp[appKey]"
                @click="enterAppEditMode(appKey, appSection)"
                class="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 min-h-[40px]"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>{{ t('settings.groupsEditTitle') }}</button>
              <!-- Edit mode buttons -->
              <template v-if="appSection.canEdit && isEditingApp[appKey]">
                <button
                  @click="cancelAppEdit(appKey)"
                  class="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[40px]"
                >{{ t('performance.cancelWizard') }}</button>
                <button
                  @click="saveAppFields(appKey)"
                  :disabled="savingApp[appKey]"
                  class="px-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 min-h-[40px]"
                >
                  <svg v-if="savingApp[appKey]" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ savingApp[appKey] ? 'Saving...' : 'Save' }}
                </button>
              </template>
              <!-- Read-only indicator (only if no buttons shown) -->
              <div v-if="!appSection.canEdit && appKey !== 'SALES' && (!appSection.fields || !isPeopleSalesLeadFromFields(appSection.fields))" class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('settings.modFieldsDepReadonly') }}</div>
            </div>
          </div>
        </div>
        <div class="px-6 py-4">
          <!-- Read-only View -->
          <dl v-if="!isEditingApp[appKey]" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <template
              v-for="(value, fieldKey) in appSection.fields"
              :key="fieldKey"
            >
              <div
                v-if="value !== null && value !== undefined && value !== ''"
              >
                <dt class="text-sm text-gray-500 dark:text-gray-400">
                  {{ formatFieldLabel(fieldKey) }}
                </dt>
                <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                  <template v-if="Array.isArray(value)">
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(item, index) in value"
                        :key="index"
                        class="inline-flex items-center px-2 py-2 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-900/40 dark:text-secondary-200"
                      >
                        {{ formatRawValueForDisplay(item, { key: fieldKey }) }}
                      </span>
                    </div>
                  </template>
                  <template v-else-if="fieldKey === 'birthday' || fieldKey === 'qualification_date'">
                    {{ formatDate(value) }}
                  </template>
                  <template v-else>
                    {{ formatRawValueForDisplay(value, { key: fieldKey }) }}
                  </template>
                </dd>
              </div>
            </template>
            <div v-if="Object.keys(appSection.fields).length === 0" class="col-span-2">
              <p class="text-sm text-gray-500 dark:text-gray-400 italic">
                No {{ appKey }}-specific fields set for this person yet.
                <span v-if="appSection.canEdit" class="text-indigo-600 dark:text-indigo-400">
                  Click "Edit" to add {{ appKey }}-specific fields.
                </span>
              </p>
            </div>
          </dl>

          <!-- Edit Mode -->
          <form v-else @submit.prevent="saveAppFields(appKey)" class="space-y-4">
            <div v-if="editErrorsApp[appKey]" class="p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
              <p class="text-sm text-danger-700 dark:text-danger-300">{{ editErrorsApp[appKey] }}</p>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                v-for="(fieldKey) in Object.keys(appEditForms[appKey] || {})"
                :key="fieldKey"
                class="col-span-1"
              >
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {{ formatFieldLabel(fieldKey) }}
                </label>
                <!-- Select for Type -->
                <select
                  v-if="isPeopleSalesRoleFieldKey(fieldKey)"
                  v-model="appEditForms[appKey][fieldKey]"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">{{ t('settings.groupFormSelectType') }}</option>
                  <option value="Lead">{{ t('forms.hubLinkedLead') }}</option>
                  <option value="Contact">{{ t('forms.hubLinkedContact') }}</option>
                </select>
                <!-- Date Input -->
                <input
                  v-else-if="fieldKey === 'birthday' || fieldKey === 'qualification_date'"
                  v-model="appEditForms[appKey][fieldKey]"
                  type="date"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  @click="openDatePicker"
                />
                <!-- Textarea for notes -->
                <textarea
                  v-else-if="fieldKey.includes('notes')"
                  v-model="appEditForms[appKey][fieldKey]"
                  rows="3"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                ></textarea>
                <!-- Number Input for scores/values -->
                <input
                  v-else-if="fieldKey.includes('score') || fieldKey.includes('value')"
                  v-model.number="appEditForms[appKey][fieldKey]"
                  type="number"
                  step="0.01"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <!-- Text Input (default) -->
                <input
                  v-else
                  v-model="appEditForms[appKey][fieldKey]"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Notes Section (Always visible, uses Notes core entity) -->
      <div v-if="profileData.core?.canView && personId" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.peopleDetailEntity3') }}</span>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.fieldNotes') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailAppAwareNotesForThisPerson') }}</p>
        </div>
        <div class="px-6 py-4">
          <Notes
            :entity-type="'Person'"
            :entity-id="personId"
            :app-key="appContext?.appKey || route.query.appKey"
            :can-create="profileData.core?.canEdit || false"
            @note-created="handleNoteCreated"
          />
        </div>
      </div>

      <!-- Files Section (Always visible, uses Files core entity) -->
      <div v-if="profileData.core?.canView && personId" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.peopleDetailEntity2') }}</span>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleDetailFiles') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailAppAwareAttachmentsForThisPerson') }}</p>
        </div>
        <div class="px-6 py-4">
          <Files
            :entity-type="'Person'"
            :entity-id="personId"
            :app-key="appContext?.appKey || route.query.appKey"
            :can-upload="profileData.core?.canEdit || false"
            @file-uploaded="handleFileUploaded"
          />
        </div>
      </div>

      <!-- Activity Timeline Section (Always visible, uses Activity core entity) -->
      <div v-if="profileData.core?.canView && personId" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.peopleDetailEntity') }}</span>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleDetailActivityTimeline') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.peopleDetailImmutableAuditStreamForThisPerson') }}</p>
        </div>
        <div class="px-6 py-4">
          <ActivityTimeline
            :key="`activity-${personId}-${activityTimelineKey}`"
            :entity-type="'Person'"
            :entity-id="personId"
            :app-key="appContext?.appKey || route.query.appKey || 'SALES'"
          />
        </div>
      </div>
    </div>

    <!-- Attach to App Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAttachModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
          @click.self="closeAttachModal"
        >
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
            <!-- Header -->
            <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('people.peopleDetailAttachToApp') }}</h2>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleDetailAddThisPersonToAnotherApp') }}</p>
              </div>
              <button
                @click="closeAttachModal"
                class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-6">
              <!-- Error State -->
              <div v-if="attachError" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm text-danger-700 dark:text-danger-300">{{ attachError }}</p>
                  </div>
                </div>
              </div>

              <!-- Validation Errors Summary -->
              <div v-if="Object.keys(attachValidationErrors).length > 0" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <h3 class="text-sm font-semibold text-danger-800 dark:text-danger-200 mb-2">{{ t('people.peopleDetailValidationErrors') }}</h3>
                    <ul class="list-disc list-inside space-y-2">
                      <li v-for="(message, field) in attachValidationErrors" :key="field" class="text-sm text-danger-700 dark:text-danger-300">
                        <span class="font-medium">{{ field }}:</span> {{ message }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Intent Selection (before intent is selected) -->
              <div v-if="!selectedAttachIntent">
                <div v-if="hasAvailableAttachIntents">
                  <div class="mb-4">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">{{ t('people.peopleDetailSelectIntent') }}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleDetailChooseHowYouWantToAdd') }}</p>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="intent in availableAttachIntents"
                      :key="intent.id"
                      @click="selectAttachIntent(intent)"
                      class="text-left p-4 border-2 rounded-lg transition-all border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="font-medium text-gray-900 dark:text-white">
                            {{ intent.label }}
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {{ intent.description }}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
                <div v-else class="text-center py-8">
                  <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('people.peopleDetailAllAppsAttached') }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.peopleDetailThisPersonIsAlreadyPartOf') }}</p>
                </div>
              </div>

              <!-- Attach Form (after intent is selected) -->
              <div v-else>
                <!-- Intent Banner -->
                <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-success-600 dark:text-success-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <div>
                      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.peopleDetailYouAreAddingThisPersonTo') }}</div>
                      <div class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ getAttachIntentDisplayName(selectedAttachIntent) }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Participation Display (Read-only) -->
                <div v-if="selectedAttachIntent.appKey && selectedAttachIntent.participationType" class="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-success-600 dark:text-success-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <div>
                      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.modFieldsGroupParticipation') }}</div>
                      <div class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ formatAppName(selectedAttachIntent.appKey) }} — {{ selectedAttachIntent.participationType }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- App-Specific Fields (only for Sales app contacts) -->
                <form @submit.prevent="handleAttachSubmit" class="space-y-4">
                  <!-- Contact Status (if type is CONTACT) -->
                  <div v-if="selectedAttachIntent.appKey === 'SALES' && selectedAttachIntent.participationType === 'CONTACT'">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('people.peopleDetailContactStatus') }}</label>
                    <select
                      v-model="attachFormData.contact_status"
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">{{ t('people.peopleDetailSelectStatus2') }}</option>
                      <option value="Active">{{ t('settings.settingsBhStatusActive') }}</option>
                      <option value="Inactive">{{ t('settings.settingsBhStatusInactive') }}</option>
                      <option value="DoNotContact">{{ t('people.peopleDetailDoNotContact') }}</option>
                    </select>
                    <p v-if="attachValidationErrors.contact_status" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
                      {{ attachValidationErrors.contact_status }}
                    </p>
                  </div>

                  <!-- Role (if type is CONTACT) -->
                  <div v-if="selectedAttachIntent.appKey === 'SALES' && selectedAttachIntent.participationType === 'CONTACT'">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.modFieldsPbAssignRole') }}</label>
                    <select
                      v-model="attachFormData.role"
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">{{ t('people.peopleDetailSelectRole') }}</option>
                      <option value="Decision Maker">{{ t('people.peopleDetailDecisionMaker') }}</option>
                      <option value="Influencer">{{ t('people.peopleDetailInfluencer') }}</option>
                      <option value="Support">{{ t('appointments.typeSupport') }}</option>
                      <option value="Other">{{ t('settings.settingsBhTzGroupOther') }}</option>
                    </select>
                    <p v-if="attachValidationErrors.role" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
                      {{ attachValidationErrors.role }}
                    </p>
                  </div>

                  <!-- Lead Status (if type is LEAD) -->
                  <div v-if="selectedAttachIntent.appKey === 'SALES' && selectedAttachIntent.participationType === 'LEAD'">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('people.peopleDetailLeadStatus') }}</label>
                    <select
                      v-model="attachFormData.lead_status"
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">{{ t('people.peopleDetailSelectStatus') }}</option>
                      <option value="New">{{ t('settings.salesPipeStageNew') }}</option>
                      <option value="Contacted">{{ t('people.peopleDetailContacted') }}</option>
                      <option value="Qualified">{{ t('people.peopleDetailQualified') }}</option>
                      <option value="Disqualified">{{ t('people.peopleDetailDisqualified') }}</option>
                      <option value="Nurturing">{{ t('people.peopleDetailNurturing') }}</option>
                      <option value="Re-Engage">{{ t('people.peopleDetailReEngage') }}</option>
                    </select>
                    <p v-if="attachValidationErrors.lead_status" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
                      {{ attachValidationErrors.lead_status }}
                    </p>
                  </div>

                  <!-- Form Actions -->
                  <div class="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-8">
                    <button
                      type="button"
                      @click="closeAttachModal"
                      class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[40px]"
                    >{{ t('performance.cancelWizard') }}</button>
                    <button
                      type="submit"
                      :disabled="attachLoading"
                      class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 min-h-[40px]"
                    >
                      <svg v-if="attachLoading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {{ attachLoading ? 'Attaching...' : 'Attach' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Convert Lead to Contact Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showConvertModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
          @click.self="showConvertModal = false"
        >
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" @click.stop>
            <!-- Header -->
            <div class="px-6 py-4 border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('people.peopleDetailConvertSalesLeadToContact') }}</h2>
              </div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('people.peopleDetailThisWillUpdateThisPersonsRole') }}</p>
            </div>

            <!-- Content -->
            <div class="px-6 py-4">
              <div class="mb-4 p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <h3 class="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">
                      What happens when you convert?
                    </h3>
                    <ul class="text-sm text-warning-700 dark:text-warning-300 space-y-2 list-disc list-inside">
                      <li>{{ t('people.peopleDetailPersonsRoleChangesFromLeadTo') }}</li>
                      <li>{{ t('people.peopleDetailLeadSpecificFieldsWillBeCleared') }}</li>
                      <li>{{ t('people.peopleDetailContactStatusWillBeSetTo') }}</li>
                      <li>{{ t('people.peopleDetailThisActionWillBeLoggedIn') }}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div v-if="convertError" class="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                <p class="text-sm text-danger-700 dark:text-danger-300">{{ convertError }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-2">
              <button
                @click="showConvertModal = false"
                :disabled="converting"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                @click="handleConvertLeadToContact"
                :disabled="converting"
                class="px-4 py-2 text-sm font-semibold text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 border-2 border-gray-900 dark:border-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm min-h-[40px]"
              >
                <svg v-if="converting" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {{ converting ? 'Converting...' : 'Convert to Contact' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import PhoneInput from '@/components/common/PhoneInput.vue';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { getDefaultEmailValidations } from '@/utils/defaultFieldValidations';
import { validateField } from '@/utils/fieldValidation';
import { toAttachRole } from '@/utils/getParticipation';
import { openDatePicker } from '@/utils/dateUtils';
import { formatRawValueForDisplay } from '@/utils/fieldDisplay';
import { useRecordPageLifecycle } from '@/components/record-page/composables/useRecordPageLifecycle';
import ActivityTimeline from '@/components/ActivityTimeline.vue';
import Notes from '@/components/Notes.vue';
import Files from '@/components/Files.vue';
import ParticipationOverviewPanel from '@/components/people/ParticipationOverviewPanel.vue';
import {
  isPeopleSalesRoleFieldKey,
  isPeopleSalesLeadFromFields,
} from '@/utils/peopleParticipationUi';

const route = useRoute();
const authStore = useAuthStore();

// Computed: Ensure personId is always a string or null (never undefined)
// IMPORTANT: In the tabbed UI, this view can remain mounted while the global
// route changes (e.g. to `/organizations/:id`). In that case `route.params.id`
// is not a person id; only treat it as one on the People route.
const personId = computed(() => {
  if (route.name !== 'person-detail') return null;
  return route.params.id || null;
});

// State
const loading = ref(true);
const error = ref(null);
const profileData = ref(null);
const appContext = ref(null);
const isEditingCore = ref(false);
const editForm = ref({});
const saving = ref(false);
const editError = ref(null);
// App-specific edit state (tracked per app)
const isEditingApp = ref({});
const appEditForms = ref({});
const savingApp = ref({});
const editErrorsApp = ref({});

// Attach to App state
const showAttachModal = ref(false);
const attachLoading = ref(false);
const attachError = ref(null);
const attachValidationErrors = ref({});
const selectedAttachIntent = ref(null);
const attachFormData = ref({});
const enabledApps = ref([]);

// Convert Lead to Contact state
const showConvertModal = ref(false);
const converting = ref(false);
const convertError = ref(null);
const activityTimelineKey = ref(0); // Key to force ActivityTimeline refresh
const lastRoutedPersonId = ref(String(personId.value || ''));

// Methods
const loadProfile = async () => {
  try {
    // Guard: this view should only fetch when we are actually on the person route.
    // In the tabbed UI, components can remain mounted while the global route changes
    // (e.g. to `/organizations/:id`), which would otherwise trigger a bad fetch.
    if (route.name !== 'person-detail') {
      return;
    }

    const id = personId.value;
    // Return early if person ID is missing (e.g., when tab is closed)
    if (!id) {
      return;
    }
    
    loading.value = true;
    error.value = null;
    
    // Build route info for app context resolution
    const routeInfo = {
      path: route.path,
      name: route.name,
      params: route.params,
      query: route.query,
      meta: route.meta
    };
    
    // Load composed profile from API
    // Pass route info and appKey (if present) for app context resolution
    const response = await apiClient.get(`/people/${id}/profile`, {
      params: {
        routePath: route.path,
        routeName: route.name,
        appKey: route.query.appKey || null // Pass appKey from query if available
      }
    });
    
    if (response.success && response.data) {
      profileData.value = response.data.profile;
      appContext.value = response.data.appContext;
    } else {
      throw new Error('Failed to load profile');
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    error.value = err.message || 'Failed to load person profile';
  } finally {
    loading.value = false;
  }
};

const getPersonDisplayName = () => {
  if (!profileData.value?.core?.fields) return 'Person';
  const { first_name, last_name, email } = profileData.value.core.fields;
  const name = `${first_name || ''} ${last_name || ''}`.trim();
  return name || email || 'Person';
};

const formatFieldLabel = (fieldKey) => {
  if (isPeopleSalesRoleFieldKey(fieldKey)) return 'Type';
  // Convert snake_case to Title Case
  return fieldKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  try {
    const date = new Date(dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return String(dateValue);
  }
};

// Edit mode handlers
const enterEditMode = () => {
  if (!profileData.value?.core?.fields) return;
  
  // Initialize edit form with current core field values
  // Only include editable core fields (exclude system/audit fields)
  editForm.value = {
    first_name: profileData.value.core.fields.first_name || '',
    last_name: profileData.value.core.fields.last_name || '',
    email: profileData.value.core.fields.email || '',
    phone: sanitizeInternationalPhone(profileData.value.core.fields.phone || ''),
    mobile: sanitizeInternationalPhone(profileData.value.core.fields.mobile || ''),
    do_not_contact: profileData.value.core.fields.do_not_contact || false
  };
  
  isEditingCore.value = true;
  editError.value = null;
};

const cancelEdit = () => {
  isEditingCore.value = false;
  editForm.value = {};
  editError.value = null;
};

const saveCoreFields = async () => {
  if (!profileData.value?.core) return;
  
  try {
    saving.value = true;
    editError.value = null;
    
    const personId = route.params.id;
    if (!personId) {
      throw new Error('Person ID is required');
    }
    
    // Validate at least one of first_name, last_name, or email is present
    if (!editForm.value.first_name && !editForm.value.last_name && !editForm.value.email) {
      editError.value = 'At least one of First Name, Last Name, or Email is required.';
      saving.value = false;
      return;
    }

    editForm.value.phone = sanitizeInternationalPhone(editForm.value.phone || '');
    editForm.value.mobile = sanitizeInternationalPhone(editForm.value.mobile || '');
    const phoneValidation = validatePhoneValue(editForm.value.phone);
    const mobileValidation = validatePhoneValue(editForm.value.mobile);
    if (!phoneValidation.isValid || !mobileValidation.isValid) {
      editError.value = phoneValidation.error || mobileValidation.error;
      saving.value = false;
      return;
    }

    const emailTrimmed = (editForm.value.email || '').trim();
    if (emailTrimmed) {
      const emailCheck = validateField(emailTrimmed, getDefaultEmailValidations());
      if (!emailCheck.isValid) {
        editError.value = emailCheck.error || 'Invalid email format';
        saving.value = false;
        return;
      }
    }
    
    // Submit update
    const response = await apiClient.put(`/people/${personId}/update-core`, {
      formData: editForm.value
    });
    
    if (response.success) {
      // Refresh profile data
      await loadProfile();
      // Exit edit mode
      isEditingCore.value = false;
      editForm.value = {};
    } else {
      editError.value = response.message || 'Failed to update core information';
    }
  } catch (err) {
    console.error('Error saving core fields:', err);
    editError.value = err.message || 'Failed to update core information';
    
    // If there are validation errors, show them
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      const errorMessages = Object.values(errors).join(', ');
      editError.value = errorMessages || editError.value;
    }
  } finally {
    saving.value = false;
  }
};

// App-specific edit mode handlers
const enterAppEditMode = async (appKey, appSection) => {
  // Get the list of app-specific fields for this app from the backend
  // We need to know which fields are available for this app, even if they're not set yet
  try {
    // Fetch the field definitions for this app
    // For now, we'll use the fields that exist in appSection.fields
    // In the future, we could fetch APP_FIELD_KEYS_BY_APP from an API endpoint
    
    // Initialize edit form - start with empty values for all possible fields
    appEditForms.value[appKey] = {};
    
    // Get all possible fields for this app from the SALES app definition
    // For SALES app, these are the fields defined in APP_FIELD_KEYS_BY_APP[SALES]
    const salesFields = [
      'sales_type', 'lead_status', 'lead_owner', 'lead_score', 'interest_products',
      'qualification_date', 'qualification_notes', 'estimated_value',
      'contact_status', 'role', 'birthday', 'preferred_contact_method'
    ];
    
    // Initialize with empty values for all possible fields
    // This allows users to add fields to a person that doesn't have any yet
    const fieldsToInitialize = appSection?.fields ? Object.keys(appSection.fields) : [];
    
    // If no fields exist yet, initialize with all possible fields for SALES
    // (For other apps, we'd need to fetch their field definitions)
    if (fieldsToInitialize.length === 0 && appKey === 'SALES') {
      salesFields.forEach(fieldKey => {
        appEditForms.value[appKey][fieldKey] = '';
      });
    } else {
      // Copy existing field values to edit form
      fieldsToInitialize.forEach(fieldKey => {
        const value = appSection.fields[fieldKey];
        // Handle date fields - convert to YYYY-MM-DD format for date inputs
        if (fieldKey === 'birthday' || fieldKey === 'qualification_date') {
          if (value) {
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                appEditForms.value[appKey][fieldKey] = date.toISOString().split('T')[0];
              } else {
                appEditForms.value[appKey][fieldKey] = '';
              }
            } catch (e) {
              appEditForms.value[appKey][fieldKey] = '';
            }
          } else {
            appEditForms.value[appKey][fieldKey] = '';
          }
        } else if (Array.isArray(value)) {
          // For arrays, join with comma (simple handling)
          appEditForms.value[appKey][fieldKey] = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          // For objects, stringify (but this shouldn't happen for editable fields)
          appEditForms.value[appKey][fieldKey] = JSON.stringify(value);
        } else {
          appEditForms.value[appKey][fieldKey] = value || '';
        }
      });
      
      // Also add any missing fields that are possible for this app
      if (appKey === 'SALES') {
        salesFields.forEach(fieldKey => {
          if (!appEditForms.value[appKey].hasOwnProperty(fieldKey)) {
            appEditForms.value[appKey][fieldKey] = '';
          }
        });
      }
    }
    
    isEditingApp.value[appKey] = true;
    editErrorsApp.value[appKey] = null;
  } catch (err) {
    console.error(`Error entering edit mode for ${appKey}:`, err);
    editErrorsApp.value[appKey] = 'Failed to initialize edit form';
  }
};

const cancelAppEdit = (appKey) => {
  isEditingApp.value[appKey] = false;
  appEditForms.value[appKey] = {};
  editErrorsApp.value[appKey] = null;
};

const saveAppFields = async (appKey) => {
  if (!profileData.value?.apps?.[appKey] || !appEditForms.value[appKey]) return;
  
  try {
    savingApp.value[appKey] = true;
    editErrorsApp.value[appKey] = null;
    
    const personId = route.params.id;
    if (!personId) {
      throw new Error('Person ID is required');
    }
    
    // Prepare form data - handle arrays and empty strings
    const formData = {};
    Object.keys(appEditForms.value[appKey]).forEach(fieldKey => {
      const value = appEditForms.value[appKey][fieldKey];
      
      // Handle empty strings - convert to null for optional fields
      if (value === '') {
        // For some fields, empty string is valid, for others we want null
        // Let the backend handle validation
        formData[fieldKey] = null;
      } else if (typeof value === 'string' && value.includes(',') && fieldKey.includes('products')) {
        // Handle comma-separated arrays (like interest_products)
        formData[fieldKey] = value.split(',').map(item => item.trim()).filter(item => item);
      } else {
        formData[fieldKey] = value;
      }
    });

    if (appKey === 'SALES') {
      if (formData.type != null && formData.sales_type == null) {
        formData.sales_type = formData.type;
      }
      delete formData.type;
    }
    
    // Submit update for this app
    const response = await apiClient.put(`/people/${personId}/update-app-fields`, {
      appKey: appKey,
      formData: formData
    });
    
    if (response.success) {
      // Refresh profile data
      await loadProfile();
      // Exit edit mode for this app
      isEditingApp.value[appKey] = false;
      appEditForms.value[appKey] = {};
    } else {
      editErrorsApp.value[appKey] = response.message || `Failed to update ${appKey} fields`;
    }
  } catch (err) {
    console.error(`Error saving ${appKey} fields:`, err);
    editErrorsApp.value[appKey] = err.message || `Failed to update ${appKey} fields`;
    
    // If there are validation errors, show them
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      const errorMessages = Object.values(errors).join(', ');
      editErrorsApp.value[appKey] = errorMessages || editErrorsApp.value[appKey];
    }
  } finally {
    savingApp.value[appKey] = false;
  }
};

useRecordPageLifecycle({
  route,
  recordId: personId,
  routePrefix: '/people',
  fetchRecord: async () => {
    await loadProfile();
    lastRoutedPersonId.value = String(personId.value || '');
  },
  onRouteChange: async ({ recordId }) => {
    if (route.name !== 'person-detail') return;
    const nextId = String(recordId || '');
    if (!nextId || nextId === lastRoutedPersonId.value) return;
    lastRoutedPersonId.value = nextId;
    await loadProfile();
  }
});

// Handle note creation (refresh Activity timeline)
const handleNoteCreated = () => {
  // Reload profile to refresh Activity timeline
  loadProfile();
};

// Handle file upload (refresh Activity timeline)
const handleFileUploaded = () => {
  // Reload profile to refresh Activity timeline
  loadProfile();
};

// Attach to App functionality
const intentMappings = [
  { id: 'sales-lead', label: 'Add to Sales as Lead', description: 'Add as a Sales Lead', appKey: 'SALES', participationType: 'LEAD' },
  { id: 'sales-contact', label: 'Add to Sales as Contact', description: 'Add as a Sales Contact', appKey: 'SALES', participationType: 'CONTACT' },
  { id: 'support-contact', label: 'Add to Helpdesk as Contact', description: 'Add as a Support Contact', appKey: 'HELPDESK', participationType: 'CONTACT' },
  { id: 'audit-member', label: 'Add to Audit as Member', description: 'Add as an Audit Member', appKey: 'AUDIT', participationType: 'MEMBER' },
  { id: 'portal-user', label: 'Add to Portal as User', description: 'Add as a Portal User', appKey: 'PORTAL', participationType: 'USER' },
  { id: 'project-member', label: 'Add to Projects as Member', description: 'Add as a Project Member', appKey: 'PROJECTS', participationType: 'MEMBER' }
];

// Get currently attached apps (apps where person actually participates, not just enabled)
const currentAppParticipations = computed(() => {
  if (!profileData.value?.apps) return [];
  
  const participations = [];
  Object.entries(profileData.value.apps).forEach(([appKey, appSection]) => {
    // Check if person actually participates in this app (has fields set)
    // For SALES, check if type field is set
    if (appKey === 'SALES') {
      if (appSection.fields?.type) {
        participations.push(appKey);
      }
    } else {
      // For other apps, check if any fields are set
      if (appSection.fields && Object.keys(appSection.fields).length > 0) {
        participations.push(appKey);
      }
    }
  });
  
  return participations;
});

// Filter available attach intents (exclude already-attached apps completely)
const availableAttachIntents = computed(() => {
  const currentApps = currentAppParticipations.value;
  
  // Filter out intents for apps where participation already exists
  return intentMappings.filter(intent => {
    // For SALES app, check if person already has type (Lead or Contact)
    if (intent.appKey === 'SALES' && currentApps.includes('SALES')) {
      return false; // Exclude all SALES intents if person already participates in SALES
    }
    // For other apps, check if app is already in participations
    if (currentApps.includes(intent.appKey)) {
      return false; // Exclude intents for apps where participation already exists
    }
    return true; // Include intent if person doesn't participate in this app
  });
});

// Check if there are any available attach intents
const hasAvailableAttachIntents = computed(() => {
  return availableAttachIntents.value.length > 0;
});

// Check if convert button should be shown for a given app section
// Note: Convert button shows even without edit permission (read-only users can convert)
const shouldShowConvertButton = (appKey, appSection) => {
  // Must be Sales app
  if (appKey !== 'SALES') return false;
  
  // Must have fields
  if (!appSection || !appSection.fields) return false;
  
  // Must be Lead type (exactly 'Lead', case-sensitive check)
  const role = appSection.fields.sales_type;
  if (role !== 'Lead' && role !== 'lead') return false;
  
  // Must not be in edit mode
  if (isEditingApp.value[appKey]) return false;
  
  // Note: We show convert button even if canEdit is false
  // Conversion is a lifecycle change, not a field edit
  
  return true;
};

// Format app name
const formatAppName = (appKey) => {
  const appNames = {
    'SALES': 'Sales',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects'
  };
  return appNames[appKey] || appKey;
};

// Get display name for attach intent
const getAttachIntentDisplayName = (intent) => {
  if (!intent) return '';
  // Convert "Add to Sales as Lead" to "Sales — Lead", etc.
  return intent.label.replace('Add to ', '').replace(' as ', ' — ');
};

// Select attach intent
const selectAttachIntent = (intent) => {
  selectedAttachIntent.value = intent;
  attachFormData.value = {};
  attachError.value = null;
  attachValidationErrors.value = {};
};

// Close attach modal
const closeAttachModal = () => {
  showAttachModal.value = false;
  selectedAttachIntent.value = null;
  attachFormData.value = {};
  attachError.value = null;
  attachValidationErrors.value = {};
};

// Watch for changes in available intents - close modal if none available
watch(hasAvailableAttachIntents, (hasIntents) => {
  if (!hasIntents && showAttachModal.value) {
    closeAttachModal();
  }
});

// Participation Overview Panel handlers
const handleParticipationEdit = (appKey) => {
  // Open edit mode for the app section
  const appSection = profileData.value?.apps?.[appKey];
  if (appSection) {
    enterAppEditMode(appKey, appSection);
  }
};

const handleParticipationConvert = (appKey) => {
  // Show convert modal for Sales Lead to Contact
  if (appKey === 'SALES') {
    showConvertModal.value = true;
  }
};

const handleParticipationDetach = (appKey) => {
  // TODO: Implement detach functionality
  // For now, just show a console log
  console.log('[ParticipationOverviewPanel] Detach from', appKey);
  // This should open a detach confirmation modal
};

const handleParticipationAttach = (appKey) => {
  // Open attach modal with the app pre-selected
  showAttachModal.value = true;
  // Find the appropriate intent for this app
  const intent = intentMappings.find(i => i.appKey === appKey);
  if (intent) {
    selectAttachIntent(intent);
  }
};

// Convert Lead to Contact handler
const handleConvertLeadToContact = async () => {
  try {
    converting.value = true;
    convertError.value = null;

    const personId = route.params.id;
    const response = await apiClient.post(`/people/${personId}/convert-lead-to-contact`);

    if (response.success) {
      // Close modal
      showConvertModal.value = false;
      // Force ActivityTimeline to refresh first (before profile reload)
      activityTimelineKey.value += 1;
      // Wait for component to unmount/remount
      await nextTick();
      // Refresh profile to show updated participation
      await loadProfile();
      // Force ActivityTimeline to refresh again after profile loads
      await nextTick();
      activityTimelineKey.value += 1;
    } else {
      convertError.value = response.message || 'Failed to convert Lead to Contact';
    }
  } catch (err) {
    console.error('Error converting Lead to Contact:', err);
    console.error('Error response:', err.response?.data);
    
    if (err.response?.data?.message) {
      // Handle duplicate participation error with user-friendly message
      const errorMessage = err.response.data.message;
      if (errorMessage.includes('already participates') || err.response.data.code === 'PARTICIPATION_EXISTS') {
        convertError.value = 'This person is already part of this app.';
      } else {
        convertError.value = errorMessage;
      }
    } else {
      convertError.value = err.message || 'Error converting Lead to Contact';
    }
  } finally {
    converting.value = false;
  }
};

// Handle attach submission
const handleAttachSubmit = async () => {
  if (!selectedAttachIntent.value) return;

  try {
    attachLoading.value = true;
    attachError.value = null;
    attachValidationErrors.value = {};

    // Clean form data: convert empty strings to null for enum fields
    const cleanedFormData = { ...attachFormData.value };
    const enumFields = ['lead_status', 'contact_status', 'role'];
    enumFields.forEach(field => {
      if (cleanedFormData[field] === '') {
        cleanedFormData[field] = null;
      }
    });

    const personId = route.params.id;
    const role = toAttachRole(selectedAttachIntent.value.participationType);
    if (!role) {
      attachError.value = 'Participation type (role) is required';
      attachLoading.value = false;
      return;
    }
    const response = await apiClient.post(`/people/${personId}/attach`, {
      appKey: selectedAttachIntent.value.appKey,
      role,
      formData: cleanedFormData
    });

    if (response.success) {
      // Refresh profile to show new participation
      await loadProfile();
      // Wait for Vue reactivity to update
      await nextTick();
      // Reset modal state to show updated intent list
      selectedAttachIntent.value = null;
      attachFormData.value = {};
      attachError.value = null;
      attachValidationErrors.value = {};
      // Keep modal open so user can see the updated list
    } else {
      if (response.errors) {
        attachValidationErrors.value = response.errors;
        attachError.value = response.message || 'Validation failed. Please check the fields below.';
      } else {
        attachError.value = response.message || 'Failed to attach app participation';
      }
    }
  } catch (err) {
    console.error('Error attaching app participation:', err);
    console.error('Error response:', err.response?.data);
    
    if (err.response?.data?.errors) {
      attachValidationErrors.value = err.response.data.errors;
      attachError.value = err.response.data.message || 'Validation failed. Please check the fields below.';
    } else if (err.response?.data?.message) {
      // Handle duplicate participation error with user-friendly message
      const errorMessage = err.response.data.message;
      if (errorMessage.includes('already participates') || err.response.data.code === 'PARTICIPATION_EXISTS') {
        attachError.value = 'This person is already part of this app.';
      } else {
        attachError.value = errorMessage;
      }
    } else {
      attachError.value = err.message || 'Error attaching app participation';
    }
  } finally {
    attachLoading.value = false;
  }
};

</script>
