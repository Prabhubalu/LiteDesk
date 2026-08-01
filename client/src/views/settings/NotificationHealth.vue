<template>
  <div class="w-full">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
      <div class="flex items-center gap-3">
        <!-- App Filter -->
        <select
          v-model="selectedAppKey"
          @change="loadData"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{{ t('process.filterApps') }}</option>
          <option value="SALES">{{ t('settings.peopleTypesAppSales') }}</option>
          <option value="AUDIT">{{ t('settings.appsNameAudit') }}</option>
          <option value="PORTAL">{{ t('settings.appsNamePortal') }}</option>
        </select>
        <button
          @click="loadData"
          :disabled="loading"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >{{ t('settings.integrationsRefresh') }}</button>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-if="error && !loading"
      class="mb-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
        ></div>
      </div>
      <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
    </div>

    <!-- Content -->
    <div v-else class="space-y-6">
      <!-- Anti-Overload Insights (Phase 15) -->
      <div
        v-if="insights && insights.length > 0"
        class="space-y-2"
      >
        <div
          v-for="(insight, index) in insights"
          :key="index"
          class="rounded-lg border px-4 py-3 text-sm"
          :class="
            insight.severity === 'warning'
              ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-700 dark:text-amber-300'
              : 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 text-blue-700 dark:text-blue-300'
          "
        >
          <div class="flex items-start gap-2">
            <svg
              v-if="insight.severity === 'warning'"
              class="w-5 h-5 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clip-rule="evenodd"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5 flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="flex-1">
              <p class="font-medium">{{ insight.message }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Notifications Today -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthTotalNotifications') }}</p>
              <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {{ overview?.stats?.total || 0 }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">{{ t('process.flowHealthLast7') }}</p>
            </div>
            <div class="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Read Rate -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthReadRate') }}</p>
              <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {{ overview?.stats?.readRate || 0 }}%
              </p>
            </div>
            <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Active Channels -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthActiveChannels') }}</p>
              <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {{ overview?.channelHealth?.active || 0 }}
              </p>
            </div>
            <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a2 2 0 0 0-2 2v1.382l7 4.236 7-4.236V6a2 2 0 0 0-2-2H3Zm0 3.618V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.618l-5.5 3.323a1 1 0 0 1-1 0L3 7.618Z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Degraded Channels -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthDegradedChannels') }}</p>
              <p class="mt-1 text-2xl font-bold"
                 :class="
                   (overview?.channelHealth?.degraded || 0) > 0
                     ? 'text-amber-600 dark:text-amber-400'
                     : 'text-gray-900 dark:text-white'
                 "
              >
                {{ overview?.channelHealth?.degraded || 0 }}
              </p>
            </div>
            <div class="p-3 rounded-lg"
                 :class="
                   (overview?.channelHealth?.degraded || 0) > 0
                     ? 'bg-amber-100 dark:bg-amber-900/30'
                     : 'bg-gray-100 dark:bg-gray-800'
                 "
            >
              <svg class="w-6 h-6"
                   :class="
                     (overview?.channelHealth?.degraded || 0) > 0
                       ? 'text-amber-600 dark:text-amber-400'
                       : 'text-gray-400 dark:text-gray-600'
                   "
                   viewBox="0 0 20 20"
                   fill="currentColor"
              >
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Channel Health Table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{{ t('common.notificationHealthChannelHealth') }}</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.assignRulesCondFieldChannel') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.settingsBhFieldStatus') }}</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.notificationHealthSent') }}</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('process.execFailed') }}</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Failure %
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.notificationHealthLastFailure') }}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="channelHealth.length === 0">
                <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthNoChannelDataAvailable') }}</td>
              </tr>
              <tr
                v-for="channel in channelHealth"
                :key="channel.channel"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatChannelName(channel.channel) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="
                      channel.status === 'OK'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : channel.status === 'DEGRADED'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    "
                  >
                    {{ channel.status }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                  {{ formatNumber(channel.sent) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                  {{ formatNumber(channel.failed) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right"
                    :class="
                      channel.failureRate > 25
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : channel.failureRate > 10
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-900 dark:text-white'
                    "
                >
                  {{ channel.failureRate }}%
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ channel.lastFailure ? formatDate(channel.lastFailure) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Event Volume Chart -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{{ t('common.notificationHealthTopEventTypes') }}</h2>
        </div>
        <div class="p-4 sm:p-5">
          <div class="space-y-3">
            <div
              v-for="event in topEvents"
              :key="event.eventType"
              class="flex items-center justify-between"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ formatEventType(event.eventType) }}
                </p>
                <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {{ event.count }} notifications · {{ event.readRate }}% read
                </p>
              </div>
              <div class="ml-4 flex-shrink-0">
                <div class="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all"
                    :style="{ width: `${Math.min((event.count / (topEvents[0]?.count || 1)) * 100, 100)}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <p
              v-if="topEvents.length === 0"
              class="text-sm text-gray-600 dark:text-gray-400 text-center py-4"
            >{{ t('common.notificationHealthNoEventDataAvailable') }}</p>
          </div>
        </div>
      </div>

      <!-- High-Volume Users -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{{ t('common.notificationHealthHighVolumeUsers') }}</h2>
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('process.flowHealthLast7') }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.settingsBhFieldUser') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.modFieldsBadgeApp') }}</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.notificationHealthReceived') }}</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Unread %
                </th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.notificationHealthFlag') }}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="highVolumeUsers.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">{{ t('common.notificationHealthNoUserDataAvailable') }}</td>
              </tr>
              <tr
                v-for="user in highVolumeUsers"
                :key="user.userId"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {{ user.userName }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ userAppKey || 'All' }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                  {{ formatNumber(user.notificationsReceived) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                  {{ user.unreadRate }}%
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <span
                    v-if="user.highVolume"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  >{{ t('common.notificationHealthHighVolume') }}</span>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div
          v-if="userPagination && userPagination.totalPages > 1"
          class="px-4 py-3 sm:px-5 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between"
        >
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Page {{ userPagination.page }} of {{ userPagination.totalPages }}
          </div>
          <div class="flex gap-2">
            <button
              @click="loadUsers(userPagination.page - 1)"
              :disabled="userPagination.page <= 1"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >{{ t('actions.previous') }}</button>
            <button
              @click="loadUsers(userPagination.page + 1)"
              :disabled="userPagination.page >= userPagination.totalPages"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >{{ t('actions.next') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { formatNumber, formatUserDateTime } from '@/utils/localeFormat';

const loading = ref(false);
const error = ref(null);
const overview = ref(null);
const channelHealth = ref([]);
const topEvents = ref([]);
const highVolumeUsers = ref([]);
const insights = ref([]);
const selectedAppKey = ref('');
const userPagination = ref(null);

const userAppKey = computed(() => selectedAppKey.value || null);

async function loadData() {
  loading.value = true;
  error.value = null;

  try {
    const params = {};
    if (selectedAppKey.value) {
      params.appKey = selectedAppKey.value;
    }

    // Load all data in parallel
    const [overviewRes, channelsRes, eventsRes, insightsRes] = await Promise.all([
      apiClient.get('/admin/notifications/overview', { params }),
      apiClient.get('/admin/notifications/channels', { params }),
      apiClient.get('/admin/notifications/events', { params }),
      apiClient.get('/admin/notifications/insights', { params })
    ]);

    // Safely extract data from responses
    if (overviewRes?.data && overviewRes.data.success !== false) {
      overview.value = overviewRes.data;
    } else {
      overview.value = null;
    }

    if (channelsRes?.data && channelsRes.data.success !== false) {
      channelHealth.value = channelsRes.data.channels || [];
    } else {
      channelHealth.value = [];
    }

    if (eventsRes?.data && eventsRes.data.success !== false) {
      topEvents.value = eventsRes.data.events || [];
    } else {
      topEvents.value = [];
    }

    if (insightsRes?.data && insightsRes.data.success !== false) {
      insights.value = insightsRes.data.insights || [];
    } else {
      insights.value = [];
    }

    // Load users separately (paged)
    await loadUsers(1);
  } catch (err) {
    console.error('[NotificationHealth] Failed to load data:', err);
    console.error('[NotificationHealth] Error details:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    error.value = err.response?.data?.message || err.message || 'Failed to load notification health data';
  } finally {
    loading.value = false;
  }
}

async function loadUsers(page = 1) {
  try {
    const params = { page, limit: 20 };
    if (selectedAppKey.value) {
      params.appKey = selectedAppKey.value;
    }

    const response = await apiClient.get('/admin/notifications/users', { params });
    if (response?.data && response.data.success !== false) {
      highVolumeUsers.value = response.data.users || [];
      userPagination.value = response.data.pagination || null;
    } else {
      highVolumeUsers.value = [];
      userPagination.value = null;
    }
  } catch (err) {
    console.error('[NotificationHealth] Failed to load users:', err);
    highVolumeUsers.value = [];
    userPagination.value = null;
  }
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return formatUserDateTime(date);
}

function formatChannelName(channel) {
  const channelMap = {
    'IN_APP': 'In-App',
    'EMAIL': 'Email',
    'PUSH': 'Push',
    'WHATSAPP': 'WhatsApp',
    'SMS': 'SMS'
  };
  return channelMap[channel] || channel;
}

function formatEventType(eventType) {
  if (!eventType) return 'Unknown';
  // Convert SNAKE_CASE to Title Case
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

onMounted(() => {
  loadData();
});
</script>

