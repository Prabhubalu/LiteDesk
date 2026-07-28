<template>
  <SettingsScrollPanel>
    <template #header>
      <button
        @click="goBack"
        class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>{{ t('settings.settingsSubDetailBack') }}</span>
      </button>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ subscription?.appName || t('settings.settingsSubDetailTitleFallback') }}</h2>
        </div>
        <div v-if="subscription" class="flex items-center gap-2">
          <span
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              getPlanBadgeClass(subscription.plan)
            ]"
          >
            {{ planLabel(subscription.plan) }}
          </span>
        </div>
      </div>
    </template>

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
          {{ error.message || t('settings.settingsSubDetailLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Subscription Details -->
    <div v-else-if="subscription" class="space-y-6">
      <!-- Description -->
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.settingsSubDetailSectionDescription') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ subscription.description }}
        </p>
      </div>

      <!-- Plan Details -->
      <div v-if="subscription.planDetails" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.settingsSubDetailSectionPlanDetails') }}</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailPlanName') }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ subscription.planDetails.name }}</span>
          </div>
          <div v-if="subscription.planDetails.period?.start" class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailPeriodStart') }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ formatSubscriptionDate(subscription.planDetails.period.start) }}
            </span>
          </div>
          <div v-if="subscription.planDetails.period?.end" class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ subscription.plan === 'Trial' ? t('settings.settingsSubDetailTrialEnds') : t('settings.settingsSubDetailPeriodEnd') }}
            </span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ formatSubscriptionDate(subscription.planDetails.period.end) }}
            </span>
          </div>
          <div v-if="subscription.planDetails.daysRemaining !== undefined" class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailDaysRemaining') }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ daysRemainingLabel(subscription.planDetails.daysRemaining) }}
            </span>
          </div>
          <div v-if="subscription.planDetails.autoRenew !== undefined" class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailAutoRenew') }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ subscription.planDetails.autoRenew ? t('settings.settingsAppsStatusEnabled') : t('settings.settingsAppsStatusDisabled') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Usage Section -->
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.settingsSubDetailSectionUsage') }}</h3>
        <div class="space-y-4">
          <!-- Agents Usage (addons) -->
          <div v-if="subscription.usage?.agents" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsSubsUsageAgents') }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ subscription.usage.agents.current }}
                /
                {{ subscription.usage.agents.limit ?? t('settings.addonsUnlimited') }}
              </span>
            </div>
            <div v-if="subscription.usage.agents.limit" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all"
                :style="{ width: `${Math.min(100, (subscription.usage.agents.current / subscription.usage.agents.limit) * 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- Users Usage -->
          <div v-if="subscription.usage?.users" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsSubsUsageUsers') }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ subscription.usage.users.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.users.limit, t) }} {{ subscription.usage.users.unit || '' }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.users.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.users.current, subscription.usage.users.limit) }"
              ></div>
            </div>
            <p v-if="isFiniteSubscriptionLimit(subscription.usage.users.limit)" class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {{ t('settings.settingsSubDetailUsagePercent', { percent: getUsagePercentage(subscription.usage.users.current, subscription.usage.users.limit) }) }}
            </p>
          </div>

          <!-- Contacts Usage -->
          <div v-if="subscription.usage?.contacts" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsSubsUsageContacts') }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ subscription.usage.contacts.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.contacts.limit, t) }} {{ subscription.usage.contacts.unit || '' }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.contacts.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.contacts.current, subscription.usage.contacts.limit) }"
              ></div>
            </div>
            <p v-if="isFiniteSubscriptionLimit(subscription.usage.contacts.limit)" class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {{ t('settings.settingsSubDetailUsagePercent', { percent: getUsagePercentage(subscription.usage.contacts.current, subscription.usage.contacts.limit) }) }}
            </p>
          </div>

          <!-- Deals Usage -->
          <div v-if="subscription.usage?.deals" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsSubDetailUsageDeals') }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ subscription.usage.deals.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.deals.limit, t) }} {{ subscription.usage.deals.unit || '' }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.deals.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.deals.current, subscription.usage.deals.limit) }"
              ></div>
            </div>
            <p v-if="isFiniteSubscriptionLimit(subscription.usage.deals.limit)" class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {{ t('settings.settingsSubDetailUsagePercent', { percent: getUsagePercentage(subscription.usage.deals.current, subscription.usage.deals.limit) }) }}
            </p>
          </div>

          <!-- Storage Usage -->
          <div v-if="subscription.usage?.storage" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.settingsSubsUsageStorage') }}</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ subscription.usage.storage.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.storage.limit, t) }} {{ subscription.usage.storage.unit || 'GB' }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.storage.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.storage.current, subscription.usage.storage.limit) }"
              ></div>
            </div>
            <p v-if="isFiniteSubscriptionLimit(subscription.usage.storage.limit)" class="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {{ t('settings.settingsSubDetailUsagePercent', { percent: getUsagePercentage(subscription.usage.storage.current, subscription.usage.storage.limit) }) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Limits Section -->
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.settingsSubDetailSectionLimits') }}</h3>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-if="subscription.limits?.users !== undefined" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailMaxUsers') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatSubscriptionLimitLabel(subscription.limits.users, t) }}</span>
            </div>
            <div v-if="subscription.limits?.contacts !== undefined" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailMaxContacts') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatSubscriptionLimitLabel(subscription.limits.contacts, t) }}</span>
            </div>
            <div v-if="subscription.limits?.deals !== undefined" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailMaxDeals') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatSubscriptionLimitLabel(subscription.limits.deals, t) }}</span>
            </div>
            <div v-if="subscription.limits?.storage !== undefined" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubDetailMaxStorage') }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ isFiniteSubscriptionLimit(subscription.limits.storage)
                  ? t('settings.settingsSubsStorageGb', { amount: subscription.limits.storage })
                  : t('settings.addonsUnlimited') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Upgrade CTA (only for eligible apps) -->
      <div v-if="subscription.canUpgrade" class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-indigo-800 dark:text-indigo-300">{{ t('settings.settingsSubDetailUpgradeTitle') }}</h3>
            <p class="mt-1 text-sm text-indigo-700 dark:text-indigo-400">
              {{ t('settings.settingsSubDetailUpgradeBody', { app: subscription.appName }) }}
            </p>
            <button
              @click="handleUpgrade"
              class="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <span>{{ t('settings.settingsSubsUpgradeCta', { appName: subscription.appName }) }}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useLocale } from '@/composables/useLocale';
import {
  formatSubscriptionLimitLabel,
  getUsagePercentage,
  isFiniteSubscriptionLimit,
  usageBarWidthPercent,
} from '@/utils/subscriptionLimits';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


function daysRemainingLabel(count) {
  return count === 1
    ? t('settings.settingsSubDetailDaysCountOne', { count })
    : t('settings.settingsSubDetailDaysCountOther', { count });
}
const { formatDate } = useLocale();
const route = useRoute();
const router = useRouter();

const subscription = ref(null);
const loading = ref(true);
const error = ref(null);

const PLAN_LABEL_KEYS = {
  Trial: 'settings.settingsSubsPlanTrial',
  Paid: 'settings.settingsSubsPlanPaid',
  Active: 'settings.settingsSubsPlanActive',
  Suspended: 'settings.settingsSubsPlanSuspended',
  'Not Subscribed': 'settings.settingsSubsPlanNotSubscribed',
  DISABLED: 'settings.settingsAppsStatusDisabled',
  BASIC: 'settings.settingsSubsPlanBasic',
  PRO: 'settings.settingsSubsPlanPro',
  ENTERPRISE: 'settings.settingsSubsPlanEnterprise',
  Archived: 'settings.settingsSubsPlanArchived',
};

const appKey = computed(() => {
  return route.query.appKey || route.params.appKey;
});

const planLabel = (plan) => {
  const key = PLAN_LABEL_KEYS[plan];
  return key ? t(key) : plan;
};

const fetchSubscription = async () => {
  if (!appKey.value) {
    error.value = new Error(t('settings.settingsSubDetailAppKeyRequired'));
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient(`/settings/subscriptions/${encodeURIComponent(appKey.value)}`, {
      method: 'GET'
    });

    if (data && data.success && data.appKey) {
      subscription.value = data;
    } else {
      error.value = new Error(t('settings.settingsSubDetailInvalidResponse'));
      subscription.value = null;
    }
  } catch (err) {
    console.error('Failed to fetch subscription:', err);
    error.value = err;
    subscription.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/settings?tab=subscriptions');
};

const handleUpgrade = () => {
  notifications.error(t('settings.settingsSubDetailUpgradeAlert', { app: subscription.value?.appName }));
};

const formatSubscriptionDate = (dateString) => {
  if (!dateString) return '-';
  return formatDate(dateString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) || '-';
};

const getPlanBadgeClass = (plan) => {
  const classes = {
    'Trial': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'Paid': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Active': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Suspended': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
    'Not Subscribed': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'DISABLED': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'Archived': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'BASIC': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    'PRO': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    'ENTERPRISE': 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300',
  };
  return classes[plan] || classes['Not Subscribed'];
};

onMounted(() => {
  fetchSubscription();
});
</script>
