<template>
  <div class="w-full max-w-4xl mx-auto">
    <!-- Header -->
    <header class="mb-6">
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
        <span class="text-gray-900 dark:text-white">{{ t('settings.roleDrawerTabOverview') }}</span>
      </nav>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.notificationOverviewNotificationOverview') }}</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('common.notificationOverviewLearnHowNotificationsWorkAndWhat') }}</p>
    </header>

    <!-- Section 1: What you're notified about -->
    <section class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.notificationOverviewWhatYoureNotifiedAbout') }}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">{{ t('common.notificationOverviewNotificationsAreOrganizedByIntentTo') }}</p>

      <div class="space-y-4">
        <!-- Assignments -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewAssignments') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewWhenTasksAuditsOrCorrectiveActions') }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Audit assigned to you</p>
            <p>• Task assigned to you</p>
            <p>• Corrective action assigned to you</p>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewSystemDefined3') }}</span>
          </div>
        </div>

        <!-- Updates -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('records.activityFilterUpdates') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewStatusChangesSubmissionsApprovalsAndOther') }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Audit status changed</p>
            <p>• Task completed</p>
            <p>• Audit submitted for review</p>
            <p>• Evidence uploaded</p>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-xs text-gray-500 dark:text-gray-400">System-defined • Rule-based</span>
          </div>
        </div>

        <!-- Deadlines -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewDeadlines') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewRemindersForUpcomingOrOverdueItems') }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Corrective action due soon</p>
            <p>• Task deadline approaching</p>
            <p>• Overdue corrective actions</p>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-xs text-gray-500 dark:text-gray-400">System-defined • User-controlled</span>
          </div>
        </div>

        <!-- Conversations -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewConversations') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewActivityThatInvolvesCollaborationAndReview') }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Audit needs review</p>
            <p>• Audit approved or rejected</p>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewSystemDefined2') }}</span>
          </div>
        </div>

        <!-- Compliance & System Events -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Compliance & system events
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewAccountActivitySystemUpdatesAndCompliance') }}</p>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Portal account created</p>
            <p>• User added to app</p>
            <p>• Trial expiring</p>
            <p>• Subscription status changes</p>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewSystemDefined') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 2: How you're notified -->
    <section class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.notificationOverviewHowYoureNotified') }}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">{{ t('common.notificationOverviewChooseWhereAndHowYouReceive') }}</p>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
        <div class="space-y-4">
          <!-- In-App -->
          <div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsPbAlertInApp') }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Always available • All apps
              </p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewAlwaysOn') }}</span>
          </div>

          <!-- Email -->
          <div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('settings.settingsAddFieldTypeEmail') }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Optional • All apps
              </p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewConfigurable4') }}</span>
          </div>

          <!-- Push -->
          <div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('common.notificationOverviewPush') }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                High-priority alerts • Available in selected apps
              </p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewConfigurable3') }}</span>
          </div>

          <!-- WhatsApp -->
          <div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('common.notificationOverviewWhatsapp') }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Critical events • Audit, Portal
              </p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewConfigurable2') }}</span>
          </div>

          <!-- SMS -->
          <div class="flex items-start justify-between last:border-0 last:pb-0">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                SMS
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Emergency fallback • Portal
              </p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.notificationOverviewConfigurable') }}</span>
          </div>
        </div>
      </div>

      <router-link
        to="/settings?tab=notifications&notificationPage=preferences"
        class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
      >{{ t('common.notificationOverviewManageDeliveryChannels') }}<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </router-link>
    </section>

    <!-- Section 3: Your notification control -->
    <section class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.notificationOverviewYourNotificationControl') }}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">{{ t('common.notificationOverviewCustomizeYourNotificationExperienceToMatch') }}</p>

      <div class="space-y-4">
        <!-- Preferences -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewPreferences') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewToggleWhatTypesOfNotificationsYou') }}</p>
              <router-link
                to="/settings?tab=notifications&notificationPage=preferences"
                class="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >{{ t('common.notificationOverviewManagePreferences') }}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Rules -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('settings.assignRulesRulesTitle') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewCreateCustomNotificationConditionsSetUp') }}</p>
              <router-link
                to="/settings?tab=notifications&notificationPage=rules"
                class="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >{{ t('common.notificationOverviewManageRules') }}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Digests -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewDigests') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewReceiveDailyOrWeeklySummariesOf') }}</p>
              <router-link
                to="/settings?tab=notifications&notificationPage=preferences#digests"
                class="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >{{ t('common.notificationOverviewManageDigests') }}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: Admin visibility (admin only) -->
    <section v-if="authStore.isAdminLike" class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.notificationOverviewAdminTools') }}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">{{ t('common.notificationOverviewMonitorNotificationDeliveryHealthAndAnalytics') }}</p>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('common.notificationOverviewHealthDashboard') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ t('common.notificationOverviewViewDeliveryStatisticsChannelHealthEvent') }}</p>
            <router-link
              to="/settings?tab=notifications&notificationPage=health"
              class="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >{{ t('common.notificationOverviewOpenHealthDashboard') }}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { useAuthStore } from '@/stores/authRegistry';

const authStore = useAuthStore();
</script>
