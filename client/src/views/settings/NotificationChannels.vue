<template>
  <div class="space-y-4">
    <div
      v-if="!loading && !hasLoaded && error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ t('common.notificationPreferencesWeCouldntLoadYourNotificationPreferences') }}
    </div>

    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
      ></div>
    </div>

    <template v-else-if="!loading">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="card in channelCards"
          :key="card.channel"
          class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ card.label }}</p>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ card.description }}</p>
            </div>
            <span
              class="text-xs px-2 py-0.5 rounded-full shrink-0"
              :class="card.enabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
            >
              {{ card.statusLabel }}
            </span>
          </div>
          <p v-if="card.countLabel" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {{ card.countLabel }}
          </p>
        </div>
      </div>

      <div
        v-if="currentAppKey === 'SALES' || currentAppKey === 'AUDIT'"
        id="channel-section-push"
      >
        <NotificationChannelSection
          channel="push"
          :title="t('common.notificationPreferencesPushNotifications')"
          :description="t('settings.notificationsPushDescription')"
          :helper-text="t('settings.notificationsPushHelper')"
          :available="true"
          :enabled="channelSummary.push.enabled"
          :status-text="pushStatusText"
          :default-open="true"
          @toggle="handleChannelGlobalToggle('push', $event)"
        >
          <div class="space-y-3">
            <button
              v-if="pushPermissionStatus === 'default'"
              type="button"
              class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              @click="requestPushPermission()"
            >
              {{ t('common.notificationPreferencesEnablePushNotifications') }}
            </button>
            <button
              v-if="pushPermissionStatus === 'granted'"
              type="button"
              class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              @click="testPushNotification()"
            >
              {{ t('common.notificationPreferencesTestNotification') }}
            </button>
            <p
              v-if="pushPermissionStatus === 'denied'"
              class="text-xs text-amber-600 dark:text-amber-400"
            >
              {{ t('common.notificationPreferencesPushNotificationsAreBlockedEnableThem') }}
            </p>
          </div>
        </NotificationChannelSection>
      </div>

      <div
        v-if="currentAppKey === 'AUDIT' || currentAppKey === 'PORTAL'"
        id="channel-section-whatsapp"
      >
        <NotificationChannelSection
          channel="whatsapp"
          :title="t('common.notificationPreferencesWhatsappNotifications')"
          :description="t('settings.notificationsWhatsappDescription')"
          :helper-text="t('settings.notificationsWhatsappHelper')"
          :available="true"
          :enabled="channelSummary.whatsapp.enabled"
          :default-open="true"
          @toggle="handleChannelGlobalToggle('whatsapp', $event)"
        >
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {{ t('common.notificationPreferencesWhatsappNotificationsAreOnlySentFor') }}
          </p>
        </NotificationChannelSection>
      </div>

      <div v-if="currentAppKey === 'PORTAL'" id="channel-section-sms">
        <NotificationChannelSection
          channel="sms"
          :title="t('common.notificationPreferencesSmsNotifications')"
          :description="t('settings.notificationsSmsDescription')"
          :helper-text="t('settings.notificationsSmsHelper')"
          :available="true"
          :enabled="channelSummary.sms.enabled"
          :status-text="t('settings.notificationsSmsEmergencyOnly')"
          :default-open="true"
          @toggle="handleChannelGlobalToggle('sms', $event)"
        >
          <div class="space-y-2">
            <p class="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {{ t('settings.notificationsSmsWarning') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ t('common.notificationPreferencesSmsIsOnlyUsedAsA') }}
            </p>
          </div>
        </NotificationChannelSection>
      </div>

      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.notificationsInAppEmailTitle') }}
        </h3>
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {{ t('settings.notificationsInAppEmailDesc') }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="handleChannelGlobalToggle('email', false)"
          >
            {{ t('settings.notificationsMuteAllEmail') }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="handleChannelGlobalToggle('email', true)"
          >
            {{ t('settings.notificationsEnableAllEmail') }}
          </button>
          <router-link
            to="/settings?tab=notifications&notificationPage=preferences"
            class="px-3 py-1.5 text-xs font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            {{ t('settings.notificationsCustomizePerEvent') }}
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import NotificationChannelSection from '@/components/notifications/NotificationChannelSection.vue';
import { useNotificationPreferencesPage } from '@/composables/useNotificationPreferencesPage';

const { t } = useI18n();

const {
  loading,
  hasLoaded,
  error,
  currentAppKey,
  channelSummary,
  pushStatusText,
  pushPermissionStatus,
  handleChannelGlobalToggle,
  requestPushPermission,
  testPushNotification
} = useNotificationPreferencesPage();

const channelCards = computed(() => {
  const summary = channelSummary.value;
  const appKey = currentAppKey.value;
  const statusText = pushStatusText.value;
  const cards = [
    {
      channel: 'inApp',
      label: t('settings.modFieldsPbAlertInApp'),
      description: t('settings.notificationsInAppCardDesc'),
      enabled: summary.inApp.enabled,
      statusLabel: t('settings.notificationsChannelOn'),
      countLabel: formatCount('inApp', summary)
    },
    {
      channel: 'email',
      label: t('settings.settingsAddFieldTypeEmail'),
      description: t('settings.notificationsEmailCardDesc'),
      enabled: summary.email.enabled,
      statusLabel: summary.email.enabled
        ? t('settings.notificationsChannelOn')
        : t('settings.notificationsChannelOff'),
      countLabel: formatCount('email', summary)
    }
  ];

  if (appKey === 'SALES' || appKey === 'AUDIT') {
    cards.push({
      channel: 'push',
      label: t('common.notificationOverviewPush'),
      description: t('settings.notificationsPushCardDesc'),
      enabled: summary.push.enabled,
      statusLabel: statusText,
      countLabel: formatCount('push', summary)
    });
  }

  if (appKey === 'AUDIT' || appKey === 'PORTAL') {
    cards.push({
      channel: 'whatsapp',
      label: t('common.notificationOverviewWhatsapp'),
      description: t('settings.notificationsWhatsappCardDesc'),
      enabled: summary.whatsapp.enabled,
      statusLabel: summary.whatsapp.enabled
        ? t('settings.notificationsChannelOn')
        : t('settings.notificationsChannelOff'),
      countLabel: formatCount('whatsapp', summary)
    });
  }

  if (appKey === 'PORTAL') {
    cards.push({
      channel: 'sms',
      label: 'SMS',
      description: t('settings.notificationsSmsCardDesc'),
      enabled: summary.sms.enabled,
      statusLabel: t('settings.notificationsSmsEmergencyOnly'),
      countLabel: formatCount('sms', summary)
    });
  }

  return cards;
});

function formatCount(channel, summary) {
  const data = summary[channel];
  if (!data?.total) return null;
  return t('settings.notificationsChannelEventCount', {
    enabled: data.count,
    total: data.total
  });
}
</script>
