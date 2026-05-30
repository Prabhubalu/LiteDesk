<template>
  <div class="space-y-4">
    <div
      v-if="!loading && !hasLoaded && error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ t('common.notificationPreferencesWeCouldntLoadYourNotificationPreferences') }}
    </div>

    <div v-if="loading" class="h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"></div>

    <div
      v-else-if="!loading"
      class="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z"
              fill="currentColor"
            />
          </svg>
          <div>
            <h3 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              {{ t('common.notificationPreferencesNotificationDigests') }}
            </h3>
            <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {{ t('common.notificationPreferencesReceiveSummariesInsteadOfRealTime') }}
            </p>
          </div>
        </div>
      </div>

      <div class="px-4 py-4 sm:px-5 sm:py-5 space-y-4">
        <div class="py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {{ t('common.notificationPreferencesDailyDigest') }}
          </h4>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {{ t('common.notificationPreferencesReceiveADailySummaryOfYour') }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.modFieldsPbAlertInApp') }}</span>
              <button
                type="button"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                :class="digestDailyInApp ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
                role="switch"
                :aria-checked="digestDailyInApp"
                @click="handleToggle('DIGEST_DAILY', 'inApp', !digestDailyInApp)"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="digestDailyInApp ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.settingsAddFieldTypeEmail') }}</span>
              <button
                type="button"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                :class="digestDailyEmail ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
                role="switch"
                :aria-checked="digestDailyEmail"
                @click="handleToggle('DIGEST_DAILY', 'email', !digestDailyEmail)"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="digestDailyEmail ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>
          </div>
        </div>

        <div class="py-3">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {{ t('common.notificationPreferencesWeeklyDigest') }}
          </h4>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {{ t('common.notificationPreferencesReceiveAWeeklySummaryViaEmail') }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.settingsAddFieldTypeEmail') }}</span>
              <button
                type="button"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                :class="digestWeeklyEmail ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
                role="switch"
                :aria-checked="digestWeeklyEmail"
                @click="handleToggle('DIGEST_WEEKLY', 'email', !digestWeeklyEmail)"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="digestWeeklyEmail ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useNotificationPreferencesPage } from '@/composables/useNotificationPreferencesPage';

const { t } = useI18n();

const {
  loading,
  hasLoaded,
  error,
  digestDailyInApp,
  digestDailyEmail,
  digestWeeklyEmail,
  handleToggle
} = useNotificationPreferencesPage();
</script>
