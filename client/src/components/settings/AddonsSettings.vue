<template>
  <SettingsScrollPanel v-if="currentView === 'overview'">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabAddons') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.addonsHubDesc') }}
        </p>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-8">
      <section v-if="masterPricingOption">
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('settings.addonsPlatformSection') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            class="rounded-xl border border-gray-200 bg-white p-6 text-left transition-all hover:border-indigo-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-400"
            @click="navigateToOption(masterPricingOption)"
          >
            <div class="flex items-start gap-4">
              <div :class="['flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white', masterPricingOption.iconBg]">
                <component :is="masterPricingOption.icon" class="h-6 w-6" />
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t(masterPricingOption.nameKey) }}</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t(masterPricingOption.descriptionKey) }}</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section v-if="installedAddons.length">
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('settings.addonsInstalledSection') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="addon in installedAddons"
            :key="addon.addonKey"
            class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ addon.name }}</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ addon.description }}</p>
              </div>
              <span :class="statusBadgeClass(addon.status)">{{ statusLabel(addon.status) }}</span>
            </div>
            <div v-if="addon.subscription" class="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p v-if="addon.pricing?.billingType === 'PER_AGENT'">
                {{ t('settings.addonsAgentsUsage', {
                  used: addon.subscription.agentsUsed ?? 0,
                  limit: addon.subscription.agentLimit ?? t('settings.addonsUnlimited'),
                }) }}
              </p>
              <p v-if="addon.subscription.trialEndsAt && addon.subscription.status === 'TRIAL'">
                {{ t('settings.addonsTrialEnds', { date: formatDate(addon.subscription.trialEndsAt) }) }}
              </p>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-if="addon.addonKey === 'live_chat'"
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                @click="openLiveChatQueues"
              >
                {{ t('settings.addonsLiveChatQueuesNav') }}
              </button>
              <button
                v-if="addon.addonKey === 'live_chat'"
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                @click="openLiveChatBots"
              >
                {{ t('settings.addonsLiveChatBotsNav') }}
              </button>
              <button
                v-if="addon.addonKey === 'live_chat'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openLiveChatSettings"
              >
                {{ t('settings.addonsConfigure') }}
              </button>
              <button
                v-if="addon.enabled"
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                @click="disableAddon(addon.addonKey)"
              >
                {{ t('settings.addonsDisable') }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="enableAddon(addon.addonKey)"
              >
                {{ t('settings.addonsEnable') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                @click="uninstallAddon(addon.addonKey)"
              >
                {{ t('settings.addonsUninstall') }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="catalogAddons.length">
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('settings.addonsMarketplaceSection') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="addon in catalogAddons"
            :key="addon.addonKey"
            class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <ChatIcon class="h-6 w-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ addon.name }}</h4>
                  <span v-if="addon.marketplace?.beta" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {{ t('settings.addonsBeta') }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{{ addon.description }}</p>
                <p v-if="addon.pricing?.billingType === 'PER_AGENT'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.addonsPerAgentBilling') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="installingKey === addon.addonKey"
              @click="installAddon(addon.addonKey)"
            >
              {{ installingKey === addon.addonKey ? t('states.loading') : t('settings.addonsInstall') }}
            </button>
          </div>
        </div>
      </section>

      <div
        v-if="!loading && !installedAddons.length && !catalogAddons.length"
        class="rounded-xl border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-700"
      >
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsEmpty') }}</p>
      </div>
    </div>
  </SettingsScrollPanel>

  <AddonPlatformPricingSettings
    v-else-if="currentView === 'platform-pricing'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />

  <LiveChatAddonSettings
    v-else-if="currentView === 'live-chat-settings'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
    @open-queues="openLiveChatQueues"
    @open-bots="openLiveChatBots"
    @open-website-content="openLiveChatWebsiteContent"
  />

  <LiveChatQueuesSettings
    v-else-if="currentView === 'live-chat-queues'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />

  <LiveChatBotsSettings
    v-else-if="currentView === 'live-chat-bots'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
    @open-website-content="openLiveChatWebsiteContent"
  />

  <LiveChatWebsiteContentSettings
    v-else-if="currentView === 'live-chat-website-content'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />
</template>

<script setup>
import { computed, h, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import AddonPlatformPricingSettings from '@/components/settings/AddonPlatformPricingSettings.vue';
import LiveChatAddonSettings from '@/components/settings/LiveChatAddonSettings.vue';
import LiveChatQueuesSettings from '@/components/settings/LiveChatQueuesSettings.vue';
import LiveChatBotsSettings from '@/components/settings/LiveChatBotsSettings.vue';
import LiveChatWebsiteContentSettings from '@/components/settings/LiveChatWebsiteContentSettings.vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { invalidateAddonNavigationCache } from '@/utils/addonNavigation';

function notifyAddonsUpdated() {
  invalidateAddonNavigationCache();
  try {
    window.dispatchEvent(new CustomEvent('arivu:addons-updated'));
  } catch {
    // ignore
  }
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const loading = ref(true);
const error = ref('');
const addons = ref([]);
const installingKey = ref('');

const ChatIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  }),
]);

const PricingIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
]);

const installedAddons = computed(() => addons.value.filter((row) => row.installed));
const catalogAddons = computed(() => addons.value.filter((row) => !row.installed));

const masterPricingOption = computed(() => {
  if (!authStore.isMasterOrganization) return null;
  return {
    id: 'platform-pricing',
    nameKey: 'settings.addonsPlatformPricing',
    descriptionKey: 'settings.addonsPlatformPricingDesc',
    icon: PricingIcon,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    inShell: true,
  };
});

const currentView = computed(() => {
  const view = route.query.addonView;
  if (view === 'platform-pricing') return 'platform-pricing';
  if (view === 'live-chat' && route.query.liveChatView === 'settings') return 'live-chat-settings';
  if (view === 'live-chat' && route.query.liveChatView === 'queues') return 'live-chat-queues';
  if (view === 'live-chat' && route.query.liveChatView === 'bots') return 'live-chat-bots';
  if (view === 'live-chat' && route.query.liveChatView === 'website-content') return 'live-chat-website-content';
  return 'overview';
});

function navigateToOverview() {
  router.push({ path: '/settings', query: { tab: 'addons' } });
}

function navigateToOption(option) {
  router.push({
    path: '/settings',
    query: { ...route.query, tab: 'addons', addonView: option.id },
  });
}

function openLiveChatSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'settings' },
  });
}

function openLiveChatQueues() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'queues' },
  });
}

function openLiveChatBots() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'bots' },
  });
}

function openLiveChatWebsiteContent() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'website-content' },
  });
}

function statusLabel(status) {
  const map = {
    TRIAL: t('settings.addonsStatusTrial'),
    ACTIVE: t('settings.addonsStatusActive'),
    DISABLED: t('settings.addonsStatusDisabled'),
    ARCHIVED: t('settings.addonsStatusArchived'),
    SUSPENDED: t('settings.addonsStatusSuspended'),
    INSTALLED: t('settings.addonsStatusInstalled'),
    AVAILABLE: t('settings.addonsStatusAvailable'),
  };
  return map[status] || status;
}

function statusBadgeClass(status) {
  const classes = {
    TRIAL: 'rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    ACTIVE: 'rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300',
    DISABLED: 'rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    ARCHIVED: 'rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    SUSPENDED: 'rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return classes[status] || classes.DISABLED;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value || '');
  }
}

async function loadAddons() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/settings/addons', { method: 'GET' });
    addons.value = Array.isArray(res?.addons) ? res.addons : [];
  } catch (err) {
    error.value = err?.message || t('settings.addonsLoadFailed');
    addons.value = [];
  } finally {
    loading.value = false;
  }
}

async function installAddon(addonKey) {
  installingKey.value = addonKey;
  try {
    await apiClient.post(`/settings/addons/${addonKey}/install`);
    notifications.success(t('settings.addonsInstallSuccess'));
    notifyAddonsUpdated();
    await loadAddons();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsInstallFailed'));
  } finally {
    installingKey.value = '';
  }
}

async function disableAddon(addonKey) {
  try {
    await apiClient.post(`/settings/addons/${addonKey}/disable`);
    notifications.success(t('settings.addonsDisableSuccess'));
    notifyAddonsUpdated();
    await loadAddons();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsDisableFailed'));
  }
}

async function enableAddon(addonKey) {
  try {
    await apiClient.post(`/settings/addons/${addonKey}/enable`);
    notifications.success(t('settings.addonsEnableSuccess'));
    notifyAddonsUpdated();
    await loadAddons();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsEnableFailed'));
  }
}

async function uninstallAddon(addonKey) {
  if (!window.confirm(t('settings.addonsUninstallConfirm'))) return;
  try {
    await apiClient.post(`/settings/addons/${addonKey}/uninstall`);
    notifications.success(t('settings.addonsUninstallSuccess'));
    notifyAddonsUpdated();
    await loadAddons();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsUninstallFailed'));
  }
}

onMounted(loadAddons);
</script>
