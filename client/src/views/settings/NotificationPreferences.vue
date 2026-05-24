<template>
  <div class="w-full">
    <div class="w-full">
      <!-- Header -->
      <header class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <!-- Breadcrumb -->
          <nav class="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <router-link to="/settings" class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{{ t('settings.modFieldsSourceSettings') }}</router-link>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <router-link to="/settings?tab=notifications&notificationPage=overview" class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{{ t('settings.helpdeskExecNotifications') }}</router-link>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span class="text-gray-900 dark:text-white">{{ t('common.notificationPreferencesPreferences') }}</span>
          </nav>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.notificationPreferencesNotificationPreferences') }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesControlInAppAndEmailNotifications') }}</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Link to notification rules (Phase 17) -->
          <router-link
            to="/settings?tab=notifications&notificationPage=rules"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>{{ t('common.notificationPreferencesNotificationRules') }}</router-link>
          <!-- Admin link to health dashboard (Phase 15) -->
          <router-link
            v-if="authStore.isAdminLike"
            to="/settings?tab=notifications&notificationPage=health"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" fill="currentColor" />
            </svg>{{ t('common.notificationPreferencesHealthDashboard') }}</router-link>
        </div>
        <div class="flex items-center gap-3 text-xs sm:text-sm">
          <span
            v-if="saving"
            class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
          >
            <span class="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>{{ t('settings.integrationsSavingGmailOAuth') }}</span>
          <span
            v-else-if="lastSavedAt && !error"
            class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z"
                fill="currentColor"
              />
            </svg>{{ t('states.saved') }}</span>
          <span
            v-if="error"
            class="inline-flex items-center gap-1 text-red-600 dark:text-red-400"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 3a7 7 0 1 0 0 14A7 7 0 0 0 10 3Zm0 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7Zm0 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 10 14Z"
                fill="currentColor"
              />
            </svg>
            <span>{{ t('common.notificationPreferencesCouldntSaveChangesPleaseTryAgain') }}</span>
          </span>
        </div>
      </header>

      <!-- Error state for initial load -->
      <div
        v-if="!loading && !hasLoaded && error"
        class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
      >{{ t('common.notificationPreferencesWeCouldntLoadYourNotificationPreferences') }}</div>

      <!-- Loading state -->
      <div v-if="loading" class="space-y-3">
        <div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="i in 4"
            :key="i"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2"
          >
            <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div class="h-3 w-48 bg-gray-100 dark:bg-gray-700/80 rounded animate-pulse"></div>
            <div class="mt-3 flex justify-end gap-3">
              <div class="h-5 w-16 bg-gray-100 dark:bg-gray-700/80 rounded-full animate-pulse"></div>
              <div class="h-5 w-16 bg-gray-100 dark:bg-gray-700/80 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preferences content (including channel overview) -->
      <div
        v-else-if="!loading"
        class="space-y-6 mt-4"
      >
        <!-- Channel Overview (Phase 14) -->
        <div
          class="mb-6 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.notificationPreferencesNotificationDelivery') }}</h2>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <ChannelBadge
              channel="inApp"
              :enabled="channelSummary.inApp.enabled"
              :available="true"
              :clickable="true"
              @click="scrollToChannel('inApp')"
            />
            <ChannelBadge
              channel="email"
              :enabled="channelSummary.email.enabled"
              :available="true"
              :clickable="true"
              @click="scrollToChannel('email')"
            />
            <ChannelBadge
              v-if="currentAppKey === 'SALES' || currentAppKey === 'AUDIT'"
              channel="push"
              :enabled="channelSummary.push.enabled"
              :available="true"
              :clickable="true"
              @click="scrollToChannel('push')"
            />
            <ChannelBadge
              v-if="currentAppKey === 'AUDIT' || currentAppKey === 'PORTAL'"
              channel="whatsapp"
              :enabled="channelSummary.whatsapp.enabled"
              :available="true"
              :clickable="true"
              @click="scrollToChannel('whatsapp')"
            />
            <ChannelBadge
              v-if="currentAppKey === 'PORTAL'"
              channel="sms"
              :enabled="channelSummary.sms.enabled"
              :available="true"
              :clickable="true"
              @click="scrollToChannel('sms')"
            />
          </div>
          <p class="mt-3 text-xs text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesClickAChannelToJumpTo') }}</p>
        </div>
        <div
          v-for="group in groupedEvents"
          :key="`${group.id}-${renderKey}`"
          :data-event-group="group.id"
          class="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800"
        >
          <!-- Group header -->
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4"
            @click="toggleGroup(group.id)"
            :aria-expanded="isGroupOpen(group.id)"
          >
            <div class="text-left">
              <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {{ group.label }}
              </h2>
              <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {{ group.description }}
              </p>
            </div>
            <svg
              class="w-5 h-5 text-gray-400"
              :class="{
                'rotate-180': isGroupOpen(group.id)
              }"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.188l3.71-3.957a.75.75 0 1 1 1.1 1.02l-4.25 4.53a.75.75 0 0 1-1.1 0l-4.25-4.53a.75.75 0 0 1 .02-1.06Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <!-- Group rows -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform scale-y-95 opacity-0"
            enter-to-class="transform scale-y-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform scale-y-100 opacity-100"
            leave-to-class="transform scale-y-95 opacity-0"
          >
            <div
              v-if="isGroupOpen(group.id)"
              class="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
            >
              <div
                v-for="event in group.events"
                :key="`${event.eventType}-${event.inAppEnabled}-${event.emailEnabled}-${renderKey}`"
                class="px-4 py-3 sm:px-5 sm:py-4"
              >
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <!-- Label & description -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ event.label }}
                    </p>
                    <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {{ event.description }}
                    </p>
                    <p
                      v-if="event.isUnknown"
                      class="mt-1 text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold"
                    >{{ t('common.notificationPreferencesSystemEventManagedByArivu') }}</p>
                  </div>

                  <!-- Channel badges and toggles (Phase 14) -->
                  <div class="flex flex-col gap-3 sm:gap-2 justify-end sm:items-end">
                    <!-- Channel badges (inline) -->
                    <div class="flex flex-wrap items-center gap-2 justify-end">
                      <ChannelBadge
                        channel="inApp"
                        :enabled="event.inAppEnabled"
                        :available="event.inAppAvailable"
                      />
                      <ChannelBadge
                        channel="email"
                        :enabled="event.emailEnabled"
                        :available="event.emailAvailable"
                      />
                      <ChannelBadge
                        v-if="event.pushAvailable"
                        channel="push"
                        :enabled="event.pushEnabled"
                        :available="event.pushAvailable"
                      />
                      <ChannelBadge
                        v-if="event.whatsappAvailable"
                        channel="whatsapp"
                        :enabled="event.whatsappEnabled"
                        :available="event.whatsappAvailable"
                      />
                      <ChannelBadge
                        v-if="event.smsAvailable"
                        channel="sms"
                        :enabled="event.smsEnabled"
                        :available="event.smsAvailable"
                      />
                    </div>
                    
                    <!-- Toggles (compact) -->
                    <div class="flex gap-3 sm:gap-2 justify-end">
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesInApp') }}</span>
                        <button
                          :key="`inApp-${event.eventType}-${event.inAppEnabled}-${renderKey}`"
                          type="button"
                          class="relative inline-flex h-11 w-11 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed"
                          :class="event.inAppAvailable ? (event.inAppEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700') : 'bg-gray-100 dark:bg-gray-800 opacity-60'"
                          role="switch"
                          :aria-checked="event.inAppEnabled"
                          :aria-label="`Toggle in-app notifications for ${event.label}`"
                          :disabled="!event.inAppAvailable"
                          @click="handleToggle(event.eventType, 'inApp', !event.inAppEnabled)"
                        >
                          <span
                            aria-hidden="true"
                            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                            :class="event.inAppEnabled ? 'translate-x-5' : 'translate-x-0'"
                          ></span>
                        </button>
                      </div>

                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.settingsAddFieldTypeEmail') }}</span>
                        <button
                          :key="`email-${event.eventType}-${event.emailEnabled}-${renderKey}`"
                          type="button"
                          class="relative inline-flex h-11 w-11 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed"
                          :class="event.emailAvailable ? (event.emailEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700') : 'bg-gray-100 dark:bg-gray-800 opacity-60'"
                          role="switch"
                          :aria-checked="event.emailEnabled"
                          :aria-label="`Toggle email notifications for ${event.label}`"
                          :disabled="!event.emailAvailable"
                          @click="handleToggle(event.eventType, 'email', !event.emailEnabled)"
                        >
                          <span
                            aria-hidden="true"
                            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                            :class="event.emailEnabled ? 'translate-x-5' : 'translate-x-0'"
                          ></span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- Empty state (no events for this app) -->
        <div
          v-if="groupedEvents.length === 0 && hasLoaded"
          class="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400"
        >{{ t('common.notificationPreferencesThereAreNoConfigurableNotificationEvents') }}</div>

        <!-- Channel-Specific Sections (Phase 14) -->
        <div class="space-y-4 mt-8">
          <!-- Push Notifications Section -->
          <!-- Show for Sales and Audit apps -->
          <div
            v-if="currentAppKey === 'SALES' || currentAppKey === 'AUDIT'"
            id="channel-section-push"
          >
            <NotificationChannelSection
              channel="push"
              :title="t('common.notificationPreferencesPushNotifications')"
              description="Receive notifications even when the app is closed"
              helper-text="Used for critical alerts only. Requires browser permission."
              :available="true"
              :enabled="channelSummary.push.enabled"
              :status-text="pushStatusText"
              :default-open="false"
              @toggle="handleChannelGlobalToggle('push', $event)"
            >
              <div class="space-y-3">
                <button
                  v-if="pushPermissionStatus === 'default'"
                  type="button"
                  @click="requestPushPermission"
                  class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >{{ t('common.notificationPreferencesEnablePushNotifications') }}</button>
                <button
                  v-if="pushPermissionStatus === 'granted'"
                  type="button"
                  @click="testPushNotification"
                  class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >{{ t('common.notificationPreferencesTestNotification') }}</button>
                <p
                  v-if="pushPermissionStatus === 'denied'"
                  class="text-xs text-amber-600 dark:text-amber-400"
                >{{ t('common.notificationPreferencesPushNotificationsAreBlockedEnableThem') }}</p>
              </div>
            </NotificationChannelSection>
          </div>

          <!-- WhatsApp Section -->
          <div
            v-if="currentAppKey === 'AUDIT' || currentAppKey === 'PORTAL'"
            id="channel-section-whatsapp"
          >
            <NotificationChannelSection
              channel="whatsapp"
              :title="t('common.notificationPreferencesWhatsappNotifications')"
              description="Receive critical alerts via WhatsApp"
              helper-text="Used for critical lifecycle events only. One message per event. No marketing content."
              :available="true"
              :enabled="channelSummary.whatsapp.enabled"
              :default-open="false"
              @toggle="handleChannelGlobalToggle('whatsapp', $event)"
            >
              <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesWhatsappNotificationsAreOnlySentFor') }}</p>
            </NotificationChannelSection>
          </div>

          <!-- SMS Section -->
          <div
            v-if="currentAppKey === 'PORTAL'"
            id="channel-section-sms"
          >
            <NotificationChannelSection
              channel="sms"
              :title="t('common.notificationPreferencesSmsNotifications')"
              description="Emergency fallback for critical alerts"
              helper-text="Used only when push and email are both unavailable. Short messages under 160 characters."
              :available="true"
              :enabled="channelSummary.sms.enabled"
              status-text="Emergency use only"
              :default-open="false"
              @toggle="handleChannelGlobalToggle('sms', $event)"
            >
              <div class="space-y-2">
                <p class="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Use sparingly
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesSmsIsOnlyUsedAsA') }}</p>
              </div>
            </NotificationChannelSection>
          </div>

          <!-- Digests Section -->
          <div
            id="channel-section-digests"
          >
            <div class="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 overflow-hidden">
              <!-- Section header -->
              <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" fill="currentColor" />
                  </svg>
                  <div>
                    <h3 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{{ t('common.notificationPreferencesNotificationDigests') }}</h3>
                    <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{{ t('common.notificationPreferencesReceiveSummariesInsteadOfRealTime') }}</p>
                  </div>
                </div>
              </div>

              <!-- Digest settings -->
              <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-5 sm:py-5 space-y-4">
                <!-- Daily Digest -->
                <div class="flex items-start justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('common.notificationPreferencesDailyDigest') }}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationPreferencesReceiveADailySummaryOfYour') }}</p>
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
                </div>

                <!-- Weekly Digest -->
                <div class="flex items-start justify-between py-3">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('common.notificationPreferencesWeeklyDigest') }}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationPreferencesReceiveAWeeklySummaryViaEmail') }}</p>
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications';
import { useNotificationPreferencesStore } from '@/stores/notificationPreferences';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import ChannelBadge from '@/components/notifications/ChannelBadge.vue';
import NotificationChannelSection from '@/components/notifications/NotificationChannelSection.vue';

const route = useRoute();
const notificationStore = useNotificationStore();
const prefsStore = useNotificationPreferencesStore();
const authStore = useAuthStore();
const toast = useNotifications();

const { loading, saving, error, hasLoaded, lastSavedAt, rawPreferences, fetchPreferences, updatePreference, applyOptimisticUpdate } =
  prefsStore;

// Access appPreferences directly from store (don't destructure - it's a computed!)
const appPreferences = computed(() => prefsStore.appPreferences);

// Force re-render key to ensure template updates when preferences change
const renderKey = ref(0);

// Simple group open/close state
const openGroups = ref(new Set());

const currentAppKey = computed(() => notificationStore.currentAppKey());

// Digest preferences (computed from appPreferences)
// Note: Backend transforms always convert to object format { enabled: boolean, available: boolean }
const digestDailyInApp = computed(() => {
  const prefs = appPreferences.value;
  const digest = prefs?.['DIGEST_DAILY'];
  if (!digest) return false;
  const inApp = digest.inApp;
  // After transform, inApp should always be an object with { enabled, available }
  if (typeof inApp === 'object' && inApp !== null) {
    return !!inApp.enabled;
  }
  // Fallback for legacy boolean format (shouldn't happen after transform)
  return !!inApp;
});

const digestDailyEmail = computed(() => {
  const prefs = appPreferences.value;
  const digest = prefs?.['DIGEST_DAILY'];
  if (!digest) return false;
  const email = digest.email;
  // After transform, email should always be an object with { enabled, available }
  if (typeof email === 'object' && email !== null) {
    return !!email.enabled;
  }
  // Fallback for legacy boolean format (shouldn't happen after transform)
  return !!email;
});

const digestWeeklyEmail = computed(() => {
  const prefs = appPreferences.value;
  const digest = prefs?.['DIGEST_WEEKLY'];
  if (!digest) return false;
  const email = digest.email;
  // After transform, email should always be an object with { enabled, available }
  if (typeof email === 'object' && email !== null) {
    return !!email.enabled;
  }
  // Fallback for legacy boolean format (shouldn't happen after transform)
  return !!email;
});

// Phase 14: Channel summary for overview section
const channelSummary = computed(() => {
  const appPrefs = appPreferences.value || {};
  const events = Object.values(appPrefs);
  
  const summary = {
    inApp: { enabled: false, available: true },
    email: { enabled: false, available: true },
    push: { enabled: false, available: false },
    whatsapp: { enabled: false, available: false },
    sms: { enabled: false, available: false }
  };
  
  events.forEach(event => {
    if (event.inApp?.enabled) summary.inApp.enabled = true;
    if (event.inApp?.available === false) summary.inApp.available = false;
    
    if (event.email?.enabled) summary.email.enabled = true;
    if (event.email?.available === false) summary.email.available = false;
    
    if (event.push?.enabled) summary.push.enabled = true;
    if (event.push?.available) summary.push.available = true;
    
    if (event.whatsapp?.enabled) summary.whatsapp.enabled = true;
    if (event.whatsapp?.available) summary.whatsapp.available = true;
    
    if (event.sms?.enabled) summary.sms.enabled = true;
    if (event.sms?.available) summary.sms.available = true;
  });
  
  return summary;
});

function scrollToChannel(channel) {
  // For push, whatsapp, sms - they have dedicated sections with IDs
  if (channel === 'push' || channel === 'whatsapp' || channel === 'sms') {
    const element = document.getElementById(`channel-section-${channel}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Open the section if it's collapsible
      setTimeout(() => {
        const button = element.querySelector('button');
        if (button && button.getAttribute('aria-expanded') === 'false') {
          button.click();
        }
      }, 300);
    }
  } 
  // For digests - scroll to digest section
  else if (channel === 'digests') {
    const element = document.getElementById('channel-section-digests');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  // For inApp and email - scroll to the first event group where they're configured
  else if (channel === 'inApp' || channel === 'email') {
    // Find the first event group element using data attribute
    const firstGroup = document.querySelector('[data-event-group]');
    if (firstGroup) {
      firstGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Try to open the first group if it's collapsed
      setTimeout(() => {
        const button = firstGroup.querySelector('button[aria-expanded]');
        if (button && button.getAttribute('aria-expanded') === 'false') {
          button.click();
        }
      }, 300);
    }
  }
}

// UI-only grouping definitions per app.
// These keys must match backend eventType values; we only group and label.
const GROUP_DEFINITIONS = {
  SALES: [
    {
      id: 'audit-lifecycle',
      label: 'Audit lifecycle',
      description: 'Stay informed as audits move through key workflow steps.',
      events: [
        'AUDIT_ASSIGNED',
        'AUDIT_CHECKED_IN',
        'AUDIT_SUBMITTED',
        'AUDIT_APPROVED',
        'AUDIT_REJECTED'
      ]
    },
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Get notified when corrective actions are created or approaching due dates.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments, creation, and key status changes.',
      events: [
        'TASK_ASSIGNED',
        'TASK_CREATED',
        'TASK_STATUS_CHANGED',
        'TASK_DUE_SOON'
      ]
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and account-level updates.',
      events: [
        'USER_ADDED_TO_APP',
        'PORTAL_ACCOUNT_CREATED',
        'SYSTEM_TRIAL_EXPIRING',
        'SYSTEM_SUBSCRIPTION_SUSPENDED'
      ]
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: [
        'EVIDENCE_UPLOADED'
      ]
    }
  ],
  AUDIT: [
    {
      id: 'audit-workflow',
      label: 'Audit workflow',
      description: 'Key steps in the audit workflow.',
      events: [
        'AUDIT_ASSIGNED',
        'AUDIT_CHECKED_IN',
        'AUDIT_SUBMITTED',
        'AUDIT_APPROVED',
        'AUDIT_REJECTED'
      ]
    },
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Corrective actions tied to audits.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments and task status changes.',
      events: [
        'TASK_ASSIGNED',
        'TASK_CREATED',
        'TASK_STATUS_CHANGED',
        'TASK_DUE_SOON'
      ]
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and account-level updates.',
      events: [
        'USER_ADDED_TO_APP',
        'SYSTEM_TRIAL_EXPIRING',
        'SYSTEM_SUBSCRIPTION_SUSPENDED'
      ]
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: [
        'EVIDENCE_UPLOADED'
      ]
    }
  ],
  PORTAL: [
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Corrective actions and due-date reminders.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'account-access',
      label: 'Account & access',
      description: 'Account creation and access updates.',
      events: [
        'PORTAL_ACCOUNT_CREATED',
        'USER_ADDED_TO_APP'
      ]
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments and due-date reminders.',
      events: [
        'TASK_ASSIGNED',
        'TASK_DUE_SOON'
      ]
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and subscription updates.',
      events: [
        'SYSTEM_TRIAL_EXPIRING',
        'SYSTEM_SUBSCRIPTION_SUSPENDED'
      ]
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: [
        'EVIDENCE_UPLOADED'
      ]
    }
  ]
};

// Build UI model from backend-provided preferences and UI groups.
const groupedEvents = computed(() => {
  const appKey = currentAppKey.value || 'SALES';
  const raw = appPreferences.value || {};

  const definitions = GROUP_DEFINITIONS[appKey] || [];

  // Flatten known events from group definitions
  const knownEventTypes = new Set(
    definitions.flatMap((g) => g.events)
  );

  const result = [];

  for (const group of definitions) {
    const events = group.events
      .map((eventType) => {
        const conf = raw[eventType] || {};
        const inApp = conf.inApp || {};
        const email = conf.email || {};

        return {
          eventType,
          label: eventTypeToLabel(eventType),
          description: eventTypeToDescription(eventType, appKey),
          isUnknown: false,
          inAppEnabled: typeof inApp === 'object' ? !!inApp.enabled : !!inApp,
          inAppAvailable: typeof inApp === 'object' ? inApp.available !== false : true,
          emailEnabled: typeof email === 'object' ? !!email.enabled : !!email,
          emailAvailable: typeof email === 'object' ? email.available !== false : true,
          pushEnabled: conf.push?.enabled || false,
          pushAvailable: conf.push?.available !== false,
          whatsappEnabled: conf.whatsapp?.enabled || false,
          whatsappAvailable: conf.whatsapp?.available !== false,
          smsEnabled: conf.sms?.enabled || false,
          smsAvailable: conf.sms?.available !== false
        };
      })
      .filter(Boolean);

    if (events.length > 0) {
      result.push({
        id: group.id,
        label: group.label,
        description: group.description,
        events
      });
    }
  }

  // Handle unknown event types from backend (render as a separate group)
  // Exclude digest events as they have their own dedicated section
  const digestEventTypes = new Set(['DIGEST_DAILY', 'DIGEST_WEEKLY']);
  const unknownEvents = Object.keys(raw)
    .filter((eventType) => !knownEventTypes.has(eventType) && !digestEventTypes.has(eventType))
    .map((eventType) => {
      const conf = raw[eventType] || {};
      const inApp = conf.inApp || {};
      const email = conf.email || {};

      // Use eventTypeToLabel and eventTypeToDescription to generate proper labels
      // These functions will format event types nicely (e.g., TASK_ASSIGNED → "Task assigned")
      // or fall back to formatted eventType or generic description
      const label = eventTypeToLabel(eventType);
      const description = eventTypeToDescription(eventType, appKey);

      return {
        eventType,
        label,
        description,
        isUnknown: true,
        inAppEnabled: typeof inApp === 'object' ? !!inApp.enabled : !!inApp,
        inAppAvailable: typeof inApp === 'object' ? inApp.available !== false : true,
        emailEnabled: typeof email === 'object' ? !!email.enabled : !!email,
        emailAvailable: typeof email === 'object' ? email.available !== false : true,
        pushEnabled: conf.push?.enabled || false,
        pushAvailable: conf.push?.available !== false,
        whatsappEnabled: conf.whatsapp?.enabled || false,
        whatsappAvailable: conf.whatsapp?.available !== false,
        smsEnabled: conf.sms?.enabled || false,
        smsAvailable: conf.sms?.available !== false
      };
    });

  if (unknownEvents.length > 0) {
    result.push({
      id: 'system-events',
      label: 'Other system events',
      description: 'Read-only events managed by the system. Channels may be limited.',
      events: unknownEvents
    });
  }

  return result;
});

function isGroupOpen(id) {
  return openGroups.value.has(id);
}

function toggleGroup(id) {
  const copy = new Set(openGroups.value);
  if (copy.has(id)) {
    copy.delete(id);
  } else {
    copy.add(id);
  }
  openGroups.value = copy;
}

function eventTypeToLabel(eventType) {
  // Simple, UI-only mapping. We do not change backend semantics.
  const map = {
    AUDIT_ASSIGNED: 'Audit assigned',
    AUDIT_CHECKED_IN: 'Audit checked in',
    AUDIT_SUBMITTED: 'Audit submitted',
    AUDIT_APPROVED: 'Audit approved',
    AUDIT_REJECTED: 'Audit rejected',
    CORRECTIVE_ACTION_CREATED: 'Corrective action created',
    CORRECTIVE_ACTION_DUE_SOON: 'Corrective action due soon',
    CORRECTIVE_ACTION_OVERDUE: 'Corrective action overdue',
    // Task events
    TASK_ASSIGNED: 'Task assigned',
    TASK_CREATED: 'Task created',
    TASK_STATUS_CHANGED: 'Task status changed',
    TASK_DUE_SOON: 'Task due soon',
    // Other events
    EVIDENCE_UPLOADED: 'Evidence uploaded',
    PORTAL_ACCOUNT_CREATED: 'Portal account created',
    USER_ADDED_TO_APP: 'Added to workspace',
    // System events
    SYSTEM_TRIAL_EXPIRING: 'Trial expiring',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'Subscription suspended'
  };

  // If not in map, format the event type nicely (e.g., "TASK_ASSIGNED" → "Task assigned")
  if (map[eventType]) return map[eventType];
  
  // Fallback: format underscore-separated event types to readable labels
  return eventType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function eventTypeToDescription(eventType, appKey) {
  // Short, user-facing descriptions (UI-only).
  const map = {
    AUDIT_ASSIGNED: 'When you are assigned to an audit.',
    AUDIT_CHECKED_IN: 'When an audit is checked in.',
    AUDIT_SUBMITTED: 'When an audit is submitted for review.',
    AUDIT_APPROVED: 'When an audit is approved.',
    AUDIT_REJECTED: 'When an audit is rejected.',
    CORRECTIVE_ACTION_CREATED: 'When a corrective action is created.',
    CORRECTIVE_ACTION_DUE_SOON: 'When a corrective action is approaching its due date.',
    CORRECTIVE_ACTION_OVERDUE: 'When a corrective action passes its due date.',
    // Task events
    TASK_ASSIGNED: 'When a task is assigned to you.',
    TASK_CREATED: 'When a new task is created.',
    TASK_STATUS_CHANGED: 'When the status of a task changes.',
    TASK_DUE_SOON: 'When a task is approaching its due date.',
    // Other events
    EVIDENCE_UPLOADED: 'When evidence or files are uploaded to an audit.',
    PORTAL_ACCOUNT_CREATED: 'When a new portal account is created.',
    USER_ADDED_TO_APP: 'When you are added to a workspace or module.',
    // System events
    SYSTEM_TRIAL_EXPIRING: 'When your trial period is about to expire.',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'When your subscription has been suspended.'
  };

  if (map[eventType]) return map[eventType];

  // Fallback description with app context
  if (appKey === 'PORTAL') {
    return 'Portal notification managed by Arivu.';
  }
  if (appKey === 'AUDIT') {
    return 'Audit notification managed by Arivu.';
  }
  return 'Notification managed by Arivu.';
}

// Phase 14: Push notification state
const pushPermissionStatus = ref('default'); // 'default' | 'granted' | 'denied'

// Check push permission status on mount
onMounted(async () => {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    pushPermissionStatus.value = Notification.permission;
  }
  
  // Handle hash navigation to digest section
  if (route.hash === '#digests') {
    setTimeout(() => {
      const element = document.getElementById('channel-section-digests');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }
});

const pushStatusText = computed(() => {
  if (pushPermissionStatus.value === 'granted') {
    return 'Active';
  }
  if (pushPermissionStatus.value === 'denied') {
    return 'Denied';
  }
  return 'Not enabled';
});

async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    alert(t('common.notificationPreferencesToastPushNotificationsAreNotSupported'));
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    pushPermissionStatus.value = permission;
    
    if (permission === 'granted') {
      // Subscribe to push notifications
      await subscribeToPush();
    }
  } catch (error) {
    console.error('[NotificationPreferences] Failed to request push permission:', error);
  }
}

async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key
    const response = await fetch('/api/push/public-key');
    const { publicKey } = await response.json();
    
    if (!publicKey) {
      console.error('[NotificationPreferences] No VAPID public key available');
      return;
    }
    
    // Convert VAPID key
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    
    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    
    // Send subscription to backend
    const appKey = currentAppKey.value;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appKey,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: arrayBufferToBase64(subscription.getKey('auth'))
        }
      })
    });
    
    // Enable push in preferences
    // This will be handled by the backend when subscription is created
  } catch (error) {
    console.error('[NotificationPreferences] Failed to subscribe to push:', error);
  }
}

async function testPushNotification() {
  // Double-check permission status (it might have changed)
  const currentPermission = Notification.permission;
  if (currentPermission !== 'granted') {
    alert(`Push notification permission is "${currentPermission}". Please enable push notifications first by clicking t('common.notificationPreferencesToastEnablePushNotifications').`);
    pushPermissionStatus.value = currentPermission; // Update status
    return;
  }
  
  if (!('Notification' in window)) {
    alert(t('common.notificationPreferencesToastNotificationsAreNotSupportedIn'));
    return;
  }
  
  // Update permission status
  pushPermissionStatus.value = currentPermission;
  
  try {
    // Try to use service worker if available (better for push notifications)
    // But fall back to regular Notification API if service worker isn't registered for current scope
    if ('serviceWorker' in navigator) {
      try {
        // Prefer an existing registration for the current scope (avoids waiting/timeout)
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration) {
          // Use service worker's showNotification (better for push)
          await registration.showNotification('Test Notification', {
            body: 'Push notifications are working!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'test-notification',
            requireInteraction: false
          });
          console.log('[NotificationPreferences] Test notification shown via service worker');
          toast.success(t('common.notificationPreferencesToastTestNotificationTriggeredCheckYour'));
          return;
        }
      } catch (swError) {
        console.warn('[NotificationPreferences] Service worker not available, falling back to Notification API:', swError?.message);
        // Fall through to use regular Notification API
      }
    }
    
    // Fallback: Use regular Notification API (works even without service worker)
    // Permission already checked at the start of function
    
    // Ensure window is focused (some browsers require focus for notifications)
    if (!document.hasFocus()) {
      console.warn('[NotificationPreferences] Window is not focused, notifications may be suppressed');
      window.focus();
      // Wait a moment for focus
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Create notification (use unique tag so it doesn't instantly replace/close)
    const testTag = `test-notification-${Date.now()}`;
    const notification = new Notification('Test Notification', {
      body: 'Push notifications are working!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: testTag,
      // Keep it visible longer for manual verification (best-effort; browser may ignore)
      requireInteraction: true,
      renotify: true,
      silent: false
    });
    
    // Add event handlers
    notification.onclick = () => {
      console.log('[NotificationPreferences] Notification clicked');
      window.focus();
      notification.close();
    };
    
    notification.onshow = () => {
      console.log('[NotificationPreferences] Notification shown');
    };
    
    notification.onerror = (error) => {
      console.error('[NotificationPreferences] Notification error:', error);
    };
    
    notification.onclose = () => {
      console.log('[NotificationPreferences] Notification closed');
    };
    
    // Store notification temporarily to prevent garbage collection
    // Keep reference to prevent immediate garbage collection
    window._lastTestNotification = notification;
    setTimeout(() => {
      delete window._lastTestNotification;
    }, 5000); // Clean up after 5 seconds
    
    // Verify notification was created
    if (!notification) {
      throw new Error('Failed to create notification object');
    }
    
    console.log('[NotificationPreferences] Test notification created via Notification API', { 
      notification: {
        title: notification.title,
        body: notification.body,
        tag: notification.tag
      },
      permission: Notification.permission,
      documentVisibility: document.visibilityState,
      windowFocused: document.hasFocus()
    });
    toast.success(t('common.notificationPreferencesToastTestNotificationTriggeredIfYou'));
  } catch (error) {
    console.error('[NotificationPreferences] Failed to show test notification:', error);
    alert(`Failed to show test notification: ${error.message || t('common.notificationPreferencesToastUnknownError')}. Please check the console for details.`);
    toast.error(t('common.notificationPreferencesToastTestNotificationFailedSeeConsole'));
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Phase 14: Debounce timers
// - Global toggle: one timer for batching
// - Individual toggles: one timer per (eventType, channel) so multiple edits don't clobber each other
let globalToggleDebounceTimer = null;
const perToggleDebounceTimers = new Map(); // key: `${eventType}:${channel}`

// Phase 14: Handle global channel toggle
async function handleChannelGlobalToggle(channel, enabled) {
  // Enable/disable channel for all events that have this channel available
  const appPrefs = appPreferences.value || {};
  const eventTypes = Object.keys(appPrefs);
  
  // For push, whatsapp, and sms: only toggle if channel is available for the event
  // For inApp and email: always toggle (they're always available)
  const optionalChannels = ['push', 'whatsapp', 'sms'];
  const shouldCheckAvailability = optionalChannels.includes(channel);
  
  // Collect all events to toggle (batch optimistic updates first)
  const eventsToToggle = [];
  for (const eventType of eventTypes) {
    const event = appPrefs[eventType];
    const channelData = event?.[channel];
    
    // For optional channels (push, whatsapp, sms), check availability
    // For standard channels (inApp, email), always toggle
    if (shouldCheckAvailability) {
      // Only toggle if channel is available for this event (or not explicitly set to false)
      if (channelData?.available !== false) {
        eventsToToggle.push(eventType);
      }
    } else {
      // inApp and email are always available, so always toggle
      eventsToToggle.push(eventType);
    }
  }
  
  // Apply optimistic updates for all events first (no debouncing on optimistic updates)
  for (const eventType of eventsToToggle) {
    const success = applyOptimisticUpdate({ eventType, channel, enabled });
    if (!success) {
      console.warn('[NotificationPreferences] Could not apply optimistic update for', { eventType, channel });
    }
  }
  
  // Force template re-render
  renderKey.value += 1;
  
  // Batch API calls: call updatePreference for each event (each has its own debounce internally)
  // But clear any existing global toggle debounce timer first
  if (globalToggleDebounceTimer) {
    clearTimeout(globalToggleDebounceTimer);
    globalToggleDebounceTimer = null;
  }
  
  // Update all events with a single batched debounce
  globalToggleDebounceTimer = setTimeout(() => {
    console.log('[NotificationPreferences] Calling batch updatePreference API for', eventsToToggle.length, 'events');
    // Call updatePreference for each event (they will be debounced individually in the store)
    for (const eventType of eventsToToggle) {
      updatePreference({ eventType, channel, enabled });
    }
  }, 350);
}

// Handle toggle with immediate optimistic update and debounced API call
// Note: debounceTimer is declared above with globalToggleDebounceTimer
function handleToggle(eventType, channel, enabled) {
  console.log('[NotificationPreferences] Toggle clicked:', { eventType, channel, enabled });
  
  const debounceKey = `${eventType}:${channel}`;
  const existingTimer = perToggleDebounceTimers.get(debounceKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    perToggleDebounceTimers.delete(debounceKey);
  }

  // Apply optimistic update immediately using store method (triggers reactivity properly)
  const success = applyOptimisticUpdate({ eventType, channel, enabled });
  if (!success) {
    console.warn('[NotificationPreferences] Could not apply optimistic update - channel not available', {
      eventType,
      channel,
      enabled,
      appPreferences: appPreferences.value,
      digestExists: {
        daily: !!appPreferences.value?.['DIGEST_DAILY'],
        weekly: !!appPreferences.value?.['DIGEST_WEEKLY']
      }
    });
    return;
  }

  // Force template re-render by updating key
  renderKey.value += 1;
  
  // Debug: Check if the computed property has the updated value
  try {
    const groupedEventsValue = groupedEvents.value;
    const updatedGroup = groupedEventsValue?.find(g => 
      g?.events?.some(e => e?.eventType === eventType)
    );
    const updatedEvent = updatedGroup?.events?.find(e => e?.eventType === eventType);
    
    const appKey = notificationStore?.currentAppKey() || 'SALES';
    // Access from store directly - appPreferences is a computed, so access via .value
    const rawPrefsValue = prefsStore.rawPreferences;
    const appPrefsValue = appPreferences.value; // Use our component's computed, not prefsStore.appPreferences
    
    console.log('[NotificationPreferences] Optimistic update applied, debouncing API call.', {
      groupedEventsLength: groupedEventsValue?.length || 0,
      updatedEvent: updatedEvent ? {
        eventType: updatedEvent.eventType,
        inAppEnabled: updatedEvent.inAppEnabled,
        emailEnabled: updatedEvent.emailEnabled
      } : null,
      appPrefsValue: appPrefsValue?.[eventType] || null,
      rawPrefsApps: rawPrefsValue?.apps?.[appKey]?.[eventType] || null,
      allAppPrefs: Object.keys(appPrefsValue || {}),
      digestDaily: appPrefsValue?.['DIGEST_DAILY'],
      digestWeekly: appPrefsValue?.['DIGEST_WEEKLY'],
      currentRawValue: rawPrefsValue?.apps?.[appKey]?.['DIGEST_DAILY']?.email
    });
  } catch (err) {
    console.error('[NotificationPreferences] Error in debug logging:', err);
  }

  // Debounce per toggle (so multiple toggles don't overwrite each other)
  const timer = setTimeout(() => {
    perToggleDebounceTimers.delete(debounceKey);
    console.log('[NotificationPreferences] Calling updatePreference API', { eventType, channel, enabled });
    updatePreference({ eventType, channel, enabled });
  }, 250);
  perToggleDebounceTimers.set(debounceKey, timer);
}

onMounted(async () => {
  // Always load preferences on first mount; backend handles defaults.
  await fetchPreferences();

  // Open all groups by default for better discoverability on larger screens
  const appKey = currentAppKey.value || 'SALES';
  const defs = GROUP_DEFINITIONS[appKey] || [];
  const initial = new Set(defs.map((g) => g.id));
  if (defs.length > 0) {
    openGroups.value = initial;
  }
  
  // Check push permission status
  if ('Notification' in window && 'serviceWorker' in navigator) {
    pushPermissionStatus.value = Notification.permission;
  }
});
</script>


