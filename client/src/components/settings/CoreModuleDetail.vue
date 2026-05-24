<template>
  <div class="space-y-6">
    <!-- Back Button -->
    <button
      @click="goBack"
      class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      {{ t('settings.coreModDetailBack') }}
    </button>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-300">
          {{ error.message || t('settings.coreModDetailLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Module Detail -->
    <div v-else-if="module" class="space-y-6">
      <!-- People Tabbed Interface (always show for People module) -->
      <div v-if="isPeopleModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Relationships, Quick Create) -->
        <ModulesAndFields 
          :module-filter="peopleModuleFilter" 
          :title="t('settings.coreModDetailModulePeople')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                          <!-- Lock Icon -->
                          <svg
                            class="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            :title="t('settings.coreModDetailAppRequiredLock')"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                        <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                          {{ app.reason }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Toggle Switch (only for optional apps) -->
                      <div v-if="app.canToggle" class="flex items-center gap-3">
                        <Switch
                          v-model="app.enabled"
                          @update:model-value="() => handleToggleApp(app)"
                          :disabled="updatingApps.includes(app.appKey)"
                          :class="[
                            app.enabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                            updatingApps.includes(app.appKey) ? 'opacity-50 cursor-not-allowed' : ''
                          ]"
                        >
                          <span class="sr-only">{{ appToggleSrLabel(app.enabled, app.appName) }}</span>
                          <span
                            aria-hidden="true"
                            :class="[
                              app.enabled ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            ]"
                          />
                        </Switch>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {{ appStatusLabel(app.enabled) }}
                        </span>
                        <div v-if="updatingApps.includes(app.appKey)" class="ml-2">
                          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        </div>
                      </div>
                      <!-- Read-only Status (for required apps or when can't toggle) -->
                      <span
                        v-else-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Organizations Tabbed Interface (always show for Organizations module) -->
      <div v-else-if="isOrganizationsModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Status & Types, Relationships, Quick Create) -->
        <ModulesAndFields 
          :module-filter="organizationsModuleFilter" 
          :title="t('settings.coreModDetailModuleOrganizations')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Helper Text -->
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  {{ t('settings.coreModDetailNoteOrganizations') }}
                </p>
              </div>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                          <!-- Lock Icon -->
                          <svg
                            class="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            :title="t('settings.coreModDetailAppRequiredLock')"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                        <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                          {{ app.reason }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Read-only Status (Organizations module: no toggle controls) -->
                      <span
                        v-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Tasks Tabbed Interface (always show for Tasks module) -->
      <div v-else-if="isTasksModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Status & Priority, Relationships, Quick Create) -->
        <!-- 
          ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
          - No task lists (belongs in Surfaces /tasks)
          - No task completion (belongs in Work interfaces)
          - No time tracking execution (belongs in Work interfaces)
          - No SLA execution (belongs in app-specific logic)
          - No automation/workflows (belongs in Work interfaces)
          - No bulk actions (belongs in Surfaces)
          See: docs/architecture/task-settings.md
        -->
        <ModulesAndFields 
          :module-filter="tasksModuleFilter" 
          :title="t('settings.coreModDetailModuleTasks')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Helper Text -->
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  {{ t('settings.coreModDetailNoteTasks') }}
                </p>
              </div>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                          <!-- Lock Icon -->
                          <svg
                            class="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            :title="t('settings.coreModDetailAppRequiredLock')"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                        <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                          {{ app.reason }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Read-only Status (Tasks module: no toggle controls) -->
                      <span
                        v-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Events Tabbed Interface (always show for Events module) -->
      <!-- 
        ARCHITECTURE NOTE: Events Settings configure structure only, never execution.
        - No event lists (belongs in Surfaces /events and Calendar)
        - No scheduling (belongs in Calendar and Scheduling API)
        - No execution (belongs in Work interfaces)
        - No audit workflows (belongs in Audit App and Work components)
        - No calendars (belongs in Calendar components)
        - No SLA/KPI monitoring (belongs in Dashboard and Reporting)
        See: docs/architecture/event-settings.md
      -->
      <div v-else-if="isEventsModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
          <!-- Helper Text -->
          <p class="text-sm text-gray-600 dark:text-gray-400 ml-16 mt-2">
            {{ t('settings.coreModDetailEventsIntro') }}
          </p>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Roles & Rules, Quick Create) -->
        <!-- 
          ============================================================================
          ARCHITECTURAL INVARIANT: EVENT SETTINGS
          ============================================================================
          
          Event Settings is the SINGLE SOURCE OF TRUTH for:
          - Which event types exist (EventTypeDefinition model)
          - Which apps can create them (creatableFromApps)
          - Which fields are configurable (editableFields)
          - Which behaviors are locked (lockedFields, executionMode)
          
          WHAT EVENT SETTINGS IS:
          - Configure structure ONLY (fields, visibility, requirements)
          - Configure event type definitions and enablement
          - Configure role requirements per event type
          - Configure geo rules (required/optional per event type)
          
          WHAT EVENT SETTINGS MUST NEVER DO:
          - Event Scheduling (belongs in Calendar interfaces, Scheduling API)
          - Event Execution (belongs in EventExecution components, Work interfaces)
          - Audit Workflows (belongs in Audit App interfaces, Work components)
          - Permissions (belongs in Security Settings)
          - Event Records (belongs in Surfaces, Work interfaces)
          
          INVARIANT LOCKS:
          - Event Settings ≠ Event Scheduling
          - Event Settings ≠ Execution
          - Event Settings ≠ Permissions
          - Audit events are owned by AUDIT app
          - Sales cannot create audit events
          - Command palette must respect creatableFromApps
          - Execution behavior is NOT configurable here
          
          See: docs/architecture/event-settings-doctrine.md
          See: docs/architecture/event-settings.md Section 4
          ============================================================================
        -->
        <ModulesAndFields 
          :module-filter="eventsModuleFilter" 
          :title="t('settings.coreModDetailModuleEvents')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Helper Text -->
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  {{ t('settings.coreModDetailNoteEvents') }}
                </p>
              </div>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                          <!-- Lock Icon -->
                          <svg
                            class="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            :title="t('settings.coreModDetailAppRequiredLock')"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                        <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                          {{ app.reason }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Read-only Status (Events module: no toggle controls) -->
                      <span
                        v-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Forms Tabbed Interface (always show for Forms module) -->
      <!-- 
        ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
        - No form content editing (belongs in Form Builder)
        - No response editing (belongs in Form Responses)
        - No workflow execution (belongs in Work interfaces)
        - No scoring execution (belongs in Scoring engine)
        See: client/src/platform/modules/forms/formsModule.definition.ts
      -->
      <div v-else-if="isFormsModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
          <!-- Helper Text -->
          <p class="text-sm text-gray-600 dark:text-gray-400 ml-16 mt-2">
            {{ t('settings.coreModDetailFormsIntro') }}
          </p>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Logic & Rules, Outcomes, Access) -->
        <ModulesAndFields 
          :module-filter="formsModuleFilter" 
          :title="t('settings.coreModDetailModuleForms')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Form Configuration Section -->
            <section class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 class="module-section-title text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.coreModDetailFormConfigTitle') }}</h2>
              <p class="module-section-help text-sm text-gray-600 dark:text-gray-400 mb-4">
                {{ t('settings.coreModDetailFormConfigHelp') }}
              </p>
              
              <!-- Capability Declaration -->
              <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">{{ t('settings.coreModDetailFormCapabilitiesTitle') }}</p>
                <div class="space-y-1 text-xs text-blue-800 dark:text-blue-400">
                  <p>{{ t('settings.coreModDetailFormCapabilitiesCan') }}</p>
                  <p>{{ t('settings.coreModDetailFormCapabilitiesCannot') }}</p>
                  <p class="mt-2 italic">{{ t('settings.coreModDetailFormCapabilitiesSee') }}</p>
                </div>
              </div>
            </section>

            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Helper Text -->
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  {{ t('settings.coreModDetailNoteForms') }}
                </p>
              </div>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                          <!-- Lock Icon -->
                          <svg
                            class="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            :title="t('settings.coreModDetailAppRequiredLock')"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                        <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                          {{ app.reason }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Read-only Status (Forms module: no toggle controls) -->
                      <span
                        v-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Items Tabbed Interface (always show for Items module) -->
      <div v-else-if="isItemsModule" class="space-y-6">
        <!-- Header with Badges and Description -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Module Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>

            <!-- Module Name and Badges -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ module.name }}
              </h2>
              <div class="flex items-center gap-2 mt-2">
                <!-- Ownership Badge -->
                <span
                  v-if="module.platformOwned"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ t('settings.coreModDetailPlatformOwnedBadge') }}
                </span>

                <!-- Shared Badge -->
                <span
                  v-if="module.applications && module.applications.length > 1"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {{ sharedByLabel(module.applications.length) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ModulesAndFields with its own tabs (Module details, Field Configurations, Status & Types, Relationships, Quick Create) -->
        <ModulesAndFields 
          :module-filter="itemsModuleFilter" 
          :title="t('settings.coreModDetailModuleItems')"
          :hide-field-creation="false"
          :hide-header="true"
        >
          <template #details-extra>
            <!-- Apps Using This Module Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {{ t('settings.coreModDetailAppsUsingTitle') }}
              </h3>

              <!-- Required Applications -->
              <div v-if="requiredApplications.length > 0" class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailRequired') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(requiredApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in requiredApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                            {{ app.appName }}
                          </h4>
                          <!-- Required Badge -->
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            {{ t('settings.coreModDetailRequired') }}
                          </span>
                        </div>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Enabled Status -->
                      <span
                        v-if="app.enabled !== undefined"
                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ t('settings.settingsAppsStatusEnabled') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Applications -->
              <div v-if="optionalApplications.length > 0">
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {{ t('settings.coreModDetailOptional') }}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-500">
                    {{ applicationCountLabel(optionalApplications.length) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="app in optionalApplications"
                    :key="app.appKey"
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-2">
                          {{ app.appName }}
                        </h4>
                        <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                          {{ app.usage }}
                        </p>
                      </div>
                      <!-- Toggle Switch (only for optional apps) -->
                      <div v-if="app.canToggle" class="flex items-center gap-3">
                        <Switch
                          v-model="app.enabled"
                          @update:model-value="() => handleToggleApp(app)"
                          :disabled="updatingApps.includes(app.appKey)"
                          :class="[
                            app.enabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                            updatingApps.includes(app.appKey) ? 'opacity-50 cursor-not-allowed' : ''
                          ]"
                        >
                          <span class="sr-only">{{ appToggleSrLabel(app.enabled, app.appName) }}</span>
                          <span
                            aria-hidden="true"
                            :class="[
                              app.enabled ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            ]"
                          />
                        </Switch>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {{ appStatusLabel(app.enabled) }}
                        </span>
                      </div>
                      <!-- Read-only Status -->
                      <span
                        v-else-if="app.enabled !== undefined"
                        :class="[
                          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                          app.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="app.enabled"
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ appStatusLabel(app.enabled) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Applications Message -->
              <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.coreModDetailNoApps') }}
                </p>
              </div>
            </div>
          </template>
        </ModulesAndFields>
      </div>

      <!-- Standard Module Detail View (for non-People, non-Organizations, non-Tasks, non-Events, non-Forms, non-Items modules) -->
      <div v-else class="space-y-6">
      <!-- Header -->
      <div>
        <div class="flex items-center gap-3 mb-4">
          <!-- Module Icon -->
          <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>

          <!-- Module Name and Badges -->
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ module.name }}
            </h2>
            <div class="flex items-center gap-2 mt-2">
              <!-- Ownership Badge -->
              <span
                v-if="module.platformOwned"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {{ t('settings.coreModDetailPlatformOwnedBadge') }}
              </span>

              <!-- Shared Badge -->
              <span
                v-if="module.applications && module.applications.length > 1"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {{ sharedByLabel(module.applications.length) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Platform Ownership Info Box -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
              {{ t('settings.modFieldsPlatformOwnedTitle') }}
            </h3>
            <p class="text-sm text-blue-800 dark:text-blue-400">
              {{ t('settings.modFieldsPlatformOwnedBody') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.coreModDetailDescription') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ module.description }}
        </p>
      </div>

      <!-- Standard Module Content (for non-People modules) -->
      <!-- Platform Ownership Info Box -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
              {{ t('settings.modFieldsPlatformOwnedTitle') }}
            </h3>
            <p class="text-sm text-blue-800 dark:text-blue-400">
              {{ t('settings.modFieldsPlatformOwnedBody') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.coreModDetailDescription') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ module.description }}
        </p>
      </div>

      <!-- Shared Usage Explanation -->
      <div class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          {{ t('settings.coreModDetailAboutSharedTitle') }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {{ t('settings.coreModDetailAboutSharedBody1') }}
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.coreModDetailAboutSharedBody2') }}
        </p>
      </div>

      <!-- Applications Using This Module -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {{ t('settings.coreModDetailApplicationsUsingTitle') }}
        </h3>

        <!-- Required Applications -->
        <div v-if="requiredApplications.length > 0" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {{ t('settings.coreModDetailRequired') }}
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-500">
              {{ applicationCountLabel(requiredApplications.length) }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="app in requiredApplications"
              :key="app.appKey"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ app.appName }}
                    </h4>
                    <!-- Required Badge -->
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      {{ t('settings.coreModDetailRequired') }}
                    </span>
                    <!-- Lock Icon -->
                    <svg
                      class="w-4 h-4 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      :title="t('settings.coreModDetailAppRequiredLock')"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                    {{ app.usage }}
                  </p>
                  <p v-if="app.reason" class="text-xs text-amber-700 dark:text-amber-400 mt-2 italic">
                    {{ app.reason }}
                  </p>
                </div>
                <!-- Enabled Status -->
                <span
                  v-if="app.enabled !== undefined"
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ t('settings.settingsAppsStatusEnabled') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Optional Applications -->
        <div v-if="optionalApplications.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {{ t('settings.coreModDetailOptional') }}
            </h4>
            <span class="text-xs text-gray-500 dark:text-gray-500">
              {{ applicationCountLabel(optionalApplications.length) }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="app in optionalApplications"
              :key="app.appKey"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ app.appName }}
                    </h4>
                  </div>
                  <p v-if="app.usage" class="text-sm text-gray-600 dark:text-gray-400">
                    {{ app.usage }}
                  </p>
                </div>
                <!-- Toggle Switch (only for optional apps) -->
                <div v-if="app.canToggle" class="flex items-center gap-3">
                  <Switch
                    v-model="app.enabled"
                    @update:model-value="() => handleToggleApp(app)"
                    :disabled="updatingApps.includes(app.appKey)"
                    :class="[
                      app.enabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700',
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                      updatingApps.includes(app.appKey) ? 'opacity-50 cursor-not-allowed' : ''
                    ]"
                  >
                    <span class="sr-only">{{ appToggleSrLabel(app.enabled, app.appName) }}</span>
                    <span
                      aria-hidden="true"
                      :class="[
                        app.enabled ? 'translate-x-5' : 'translate-x-0',
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      ]"
                    />
                  </Switch>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ appStatusLabel(app.enabled) }}
                  </span>
                  <div v-if="updatingApps.includes(app.appKey)" class="ml-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  </div>
                </div>
                <!-- Read-only Status (for required apps or when can't toggle) -->
                <span
                  v-else-if="app.enabled !== undefined"
                  :class="[
                    'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                    app.enabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  ]"
                >
                  <svg
                    v-if="app.enabled"
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ appStatusLabel(app.enabled) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- No Applications Message -->
        <div v-if="requiredApplications.length === 0 && optionalApplications.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.coreModDetailNoApps') }}
          </p>
        </div>
      </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showConfirmModal && pendingAction"
        class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
        @click="cancelToggle"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
      >
        <!-- Modal panel -->
        <div 
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg"
          @click.stop
        >
          <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <svg class="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                  {{ confirmToggleTitle(pendingAction.newState, pendingAction.app.appName) }}
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {{ confirmToggleBody(pendingAction.newState, pendingAction.app.appName) }}
                  </p>
                  <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.coreModDetailImpact') }}</p>
                    <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <li v-for="(impact, index) in getImpactExplanation()" :key="index" class="flex items-start gap-2">
                        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ impact }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
            <button
              @click="confirmToggle"
              :disabled="updatingApps.includes(pendingAction?.app?.appKey)"
              class="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ confirmToggleAction(pendingAction.newState) }}
            </button>
            <button
              @click="cancelToggle"
              :disabled="updatingApps.includes(pendingAction?.app?.appKey)"
              class="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ t('actions.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
// See docs/architecture/form-settings-doctrine.md
// Form Settings are configuration-only and must respect domain boundaries

import { ref, computed, onMounted, Teleport, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Switch } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import ModulesAndFields from './ModulesAndFields.vue';

// DEV-only guards: Forms Settings must never support execution
if (process.env.NODE_ENV === 'development') {
  // This guard ensures Forms Settings never expose execution capabilities
  // Forms Settings configure structure & behavior ONLY.
  // See: docs/architecture/form-settings-doctrine.md
  // See: client/src/platform/modules/forms/formsModule.definition.ts
  console.info(
    '[Form Settings]',
    'Form Settings doctrine enforced. See docs/architecture/form-settings-doctrine.md'
  );
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

function appStatusLabel(enabled) {
  return enabled ? t('settings.settingsAppsStatusEnabled') : t('settings.settingsAppsStatusDisabled');
}

function appToggleSrLabel(enabled, appName) {
  return enabled
    ? t('settings.coreModDetailToggleDisable', { appName })
    : t('settings.coreModDetailToggleEnable', { appName });
}

function applicationCountLabel(count) {
  return count === 1
    ? t('settings.coreModDetailApplicationCountOne', { count })
    : t('settings.coreModDetailApplicationCountOther', { count });
}

function sharedByLabel(count) {
  return count === 1
    ? t('settings.coreModDetailSharedByOne', { count })
    : t('settings.coreModDetailSharedByOther', { count });
}

function confirmToggleTitle(newState, appName) {
  return newState
    ? t('settings.coreModDetailConfirmEnableTitle', { appName })
    : t('settings.coreModDetailConfirmDisableTitle', { appName });
}

function confirmToggleBody(newState, appName) {
  return newState
    ? t('settings.coreModDetailConfirmEnableBody', { appName })
    : t('settings.coreModDetailConfirmDisableBody', { appName });
}

function confirmToggleAction(newState) {
  return newState ? t('settings.coreModDetailEnable') : t('settings.coreModDetailDisable');
}

const module = ref(null);
const loading = ref(true);
const error = ref(null);
const updatingApps = ref([]); // Track which apps are being updated
const showConfirmModal = ref(false);
const pendingAction = ref(null); // { app, newState }

const moduleKey = computed(() => {
  // Try query param first (from Settings navigation), then route param
  return route.query.moduleKey || route.params.moduleKey;
});

// Check if this is the People module (case-insensitive)
const isPeopleModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'PEOPLE') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'PEOPLE') return true;
  }
  return false;
});

// Check if this is the Organizations module (case-insensitive)
const isOrganizationsModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'ORGANIZATIONS') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'ORGANIZATIONS') return true;
  }
  return false;
});

// Check if this is the Tasks module (case-insensitive)
const isTasksModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'TASKS') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'TASKS') return true;
  }
  return false;
});

// Check if this is the Events module (case-insensitive)
// ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
// Excludes: scheduling, execution, audit workflows, calendars.
// See: docs/architecture/event-settings.md
const isEventsModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'EVENTS') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'EVENTS') return true;
  }
  return false;
});

// Check if this is the Forms module (case-insensitive)
// ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
// MUST NOT: Edit sections/questions, Edit responses, Execute workflows, Run scoring
// See: client/src/platform/modules/forms/formsModule.definition.ts
const isFormsModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'FORMS') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'FORMS') return true;
  }
  return false;
});

// Check if this is the Items module (case-insensitive)
const isItemsModule = computed(() => {
  // Check route query/param first
  if (moduleKey.value) {
    const key = String(moduleKey.value).toUpperCase();
    if (key === 'ITEMS') return true;
  }
  // Fall back to module data if available
  if (module.value) {
    const key = (module.value.moduleKey || module.value.key || '').toUpperCase();
    if (key === 'ITEMS') return true;
  }
  return false;
});


const requiredApplications = computed(() => {
  if (!module.value || !module.value.applications) return [];
  return module.value.applications.filter(app => app.required === true);
});

const optionalApplications = computed(() => {
  if (!module.value || !module.value.applications) return [];
  return module.value.applications.filter(app => app.required !== true);
});

const fetchCoreModule = async () => {
  if (!moduleKey.value) {
    error.value = new Error(t('settings.coreModDetailModuleKeyRequired'));
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient(`/settings/core-modules/${moduleKey.value}`, {
      method: 'GET'
    });

    if (data && data.success && data.moduleKey) {
      module.value = data;
    } else {
      error.value = new Error(t('settings.coreModDetailInvalidResponse'));
      module.value = null;
    }
  } catch (err) {
    console.error('Failed to fetch core module:', err);
    error.value = err;
    module.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/settings?tab=core-modules');
};

// Filter for People module
const peopleModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'people';
};

// Filter for Organizations module
const organizationsModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'organizations';
};

// Filter for Tasks module
const tasksModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'tasks';
};

// Filter for Events module
// ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
// See: docs/architecture/event-settings.md
const eventsModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'events';
};

// Filter for Forms module
// ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
// See: client/src/platform/modules/forms/formsModule.definition.ts
const formsModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'forms';
};

// Filter for Items module
const itemsModuleFilter = (module) => {
  return module.key?.toLowerCase() === 'items';
};

// Ensure module query param is set for ModulesAndFields to auto-select People, Organizations, Tasks, Events, Forms, or Items
watch(() => moduleKey.value, (newKey) => {
  const upperKey = newKey?.toUpperCase();
  if ((upperKey === 'PEOPLE' || upperKey === 'ORGANIZATIONS' || upperKey === 'TASKS' || upperKey === 'EVENTS' || upperKey === 'FORMS' || upperKey === 'ITEMS') && !route.query.module) {
    // Set module query param so ModulesAndFields auto-selects the module
    router.replace({ 
      query: { 
        ...route.query,
        module: newKey?.toLowerCase()
      } 
    });
  }
}, { immediate: true });

const handleToggleApp = (app) => {
  if (updatingApps.value.includes(app.appKey)) {
    // Revert the toggle if we're already updating
    app.enabled = !app.enabled;
    return;
  }
  // The Switch has already toggled app.enabled via v-model, so capture the new state
  const newState = app.enabled;
  // Store the previous state for potential rollback
  const previousState = !newState;
  pendingAction.value = { app, newState, previousState };
  showConfirmModal.value = true;
};

const confirmToggle = async () => {
  if (!pendingAction.value) return;

  const { app, newState, previousState } = pendingAction.value;
  const appKey = app.appKey;

  // Close modal first
  showConfirmModal.value = false;

  // The app.enabled is already set to newState by v-model, so we just need to persist it
  updatingApps.value.push(appKey);

  try {
    const response = await apiClient.patch(`/settings/core-modules/${moduleKey.value}/applications/${appKey}`, {
      enabled: newState
    });

    if (response && response.success) {
      // Update successful - refresh module data to get latest state
      await fetchCoreModule();
    } else {
      // Rollback on error
      app.enabled = previousState;
      throw new Error(response?.message || t('settings.coreModDetailUpdateFailed'));
    }
  } catch (err) {
    console.error('Failed to toggle app participation:', err);
    // Rollback on error
    app.enabled = previousState;
    error.value = new Error(
      err.message || err.response?.data?.message || t('settings.coreModDetailUpdateFailedRetry')
    );
  } finally {
    updatingApps.value = updatingApps.value.filter(key => key !== appKey);
    pendingAction.value = null;
  }
};

const cancelToggle = () => {
  if (pendingAction.value) {
    // Revert the toggle since user cancelled
    const { app, previousState } = pendingAction.value;
    app.enabled = previousState;
  }
  showConfirmModal.value = false;
  pendingAction.value = null;
};

const getImpactExplanation = () => {
  if (!pendingAction.value) return [];
  
  const { app, newState } = pendingAction.value;
  const impacts = [];
  
  const appName = app.appName;
  if (newState) {
    impacts.push(t('settings.coreModDetailImpactEnableUse', { appName }));
    impacts.push(t('settings.coreModDetailImpactEnableAccess', { appName }));
  } else {
    impacts.push(t('settings.coreModDetailImpactDisableUse', { appName }));
    impacts.push(t('settings.coreModDetailImpactDisableAccess', { appName }));
    impacts.push(t('settings.coreModDetailImpactDisableData'));
  }
  
  return impacts;
};

onMounted(() => {
  fetchCoreModule();
});
</script>

