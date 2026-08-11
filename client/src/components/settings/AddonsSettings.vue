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
              <p v-if="addon.emailPolicy">
                {{ t('settings.addonsEmailCreditsBalanceShort', {
                  count: formatNumber(Number(addon.emailPolicy.creditsRemaining || 0)),
                }) }}
              </p>
              <p v-if="addon.aiCredits">
                {{ t('settings.addonsAiCreditsBalanceShort', {
                  available: formatNumber(Number((addon.aiCredits.tokensAvailable ?? addon.aiCredits.tokensBalance) || 0)),
                  consumed: formatNumber(Number(addon.aiCredits.tokensConsumed || 0)),
                }) }}
              </p>
              <p v-if="addon.subscription.trialEndsAt && addon.subscription.status === 'TRIAL'">
                {{ t('settings.addonsTrialEnds', { date: formatDate(addon.subscription.trialEndsAt) }) }}
              </p>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-if="addon.addonKey === 'email_credits'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openEmailCreditsSettings"
              >
                {{ t('settings.addonsEmailCreditsBuy') }}
              </button>
              <button
                v-if="addon.addonKey === 'ai_credits'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openAiCreditsSettings"
              >
                {{ t('settings.addonsAiCreditsBuy') }}
              </button>
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
                v-if="addon.addonKey === 'articles'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openArticlesSettings"
              >
                {{ t('settings.addonsConfigure') }}
              </button>
              <button
                v-if="addon.addonKey === 'tally'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openTallySettings"
              >
                {{ t('settings.addonsConfigure') }}
              </button>
              <button
                v-if="addon.addonKey === 'announcements'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openAnnouncementsApp"
              >
                {{ t('settings.addonsAnnouncementsOpen') }}
              </button>
              <button
                v-if="addon.addonKey === 'blog'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openBlogSettings"
              >
                {{ t('settings.addonsConfigure') }}
              </button>
              <button
                v-if="addon.addonKey === 'stockroom'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openStockrooms"
              >
                {{ t('settings.addonsStockroomOpen') }}
              </button>
              <button
                v-if="addon.addonKey === 'cpq'"
                type="button"
                class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                @click="openCpqSettings"
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
                <component :is="addonIconComponent(addon.addonKey)" class="h-6 w-6" />
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
                <p v-else-if="addon.pricing?.billingType === 'USAGE'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.addonsUsageBilling') }}
                </p>
                <p
                  v-if="!addon.installEligible && addon.missingApps?.length"
                  class="mt-2 text-xs text-amber-700 dark:text-amber-300"
                >
                  {{ parentAppRequiredMessage(addon) }}
                </p>
              </div>
            </div>
            <button
              v-if="!addon.installEligible && addon.missingApps?.length"
              type="button"
              class="mt-4 w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/40"
              @click="goInstallRequiredApp(addon.missingApps[0])"
            >
              {{ parentAppCtaLabel(addon.missingApps[0]) }}
            </button>
            <button
              v-else
              type="button"
              class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="installingKey === addon.addonKey"
              @click="installAddon(addon)"
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

  <EmailCreditsAddonSettings
    v-else-if="currentView === 'email-credits-settings'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />

  <AiCreditsAddonSettings
    v-else-if="currentView === 'ai-credits-settings'"
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

  <ArticlesAddonSettings
    v-else-if="currentView === 'articles-settings'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />

  <TallyAddonSettings
    v-else-if="currentView === 'tally-settings'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />

  <BlogAddonSettings
    v-else-if="currentView === 'blog-settings'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
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
import ArticlesAddonSettings from '@/components/settings/ArticlesAddonSettings.vue';
import TallyAddonSettings from '@/components/settings/TallyAddonSettings.vue';
import BlogAddonSettings from '@/components/settings/BlogAddonSettings.vue';
import EmailCreditsAddonSettings from '@/components/settings/EmailCreditsAddonSettings.vue';
import AiCreditsAddonSettings from '@/components/settings/AiCreditsAddonSettings.vue';
import LiveChatQueuesSettings from '@/components/settings/LiveChatQueuesSettings.vue';
import LiveChatBotsSettings from '@/components/settings/LiveChatBotsSettings.vue';
import LiveChatWebsiteContentSettings from '@/components/settings/LiveChatWebsiteContentSettings.vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { invalidateAddonNavigationCache } from '@/utils/addonNavigation';
import { captureArticlesAddonInstalled } from '@/config/posthogArticles';
import { captureBlogAddonInstalled } from '@/config/posthogBlog';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDate, formatNumber } from '@/utils/localeFormat';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

function notifyAddonsUpdated() {
  invalidateAddonNavigationCache();
  try {
    window.dispatchEvent(new CustomEvent('arivu:addons-updated'));
  } catch {
    // ignore
  }
  // Refresh entitledAddons.ai so Settings → AI / Astra nav hide immediately.
  void authStore.refreshUser({ force: true });
}

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

const MailIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  }),
]);

const MegaphoneIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  }),
]);

const CubeIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  }),
]);

const SquaresPlusIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
]);

function addonIconComponent(addonKey) {
  if (addonKey === 'email_credits') return MailIcon;
  if (addonKey === 'announcements') return MegaphoneIcon;
  if (addonKey === 'stockroom') return CubeIcon;
  if (addonKey === 'cpq') return SquaresPlusIcon;
  return ChatIcon;
}

const APP_NAME_KEYS = {
  SALES: 'settings.appsNameSales',
  HELPDESK: 'settings.appsNameHelpdesk',
  MARKETING: 'settings.appsNameMarketing',
  INVENTORY: 'settings.appsNameInventory',
  PROJECTS: 'settings.appsNameProjects',
  AUDIT: 'settings.appsNameAudit',
  LMS: 'settings.appsNameLms',
  PORTAL: 'settings.appsNamePortal',
};

function appDisplayName(appKey) {
  const key = String(appKey || '').toUpperCase();
  const nameKey = APP_NAME_KEYS[key];
  return nameKey ? t(nameKey) : key;
}

function parentAppRequiredMessage(addon) {
  const missing = Array.isArray(addon?.missingApps) ? addon.missingApps : [];
  if (missing.length === 1 && String(missing[0]).toUpperCase() === 'INVENTORY') {
    return t('settings.addonsRequiresInventory');
  }
  const names = missing.map(appDisplayName).join(', ');
  return t('settings.addonsRequiresApps', { apps: names });
}

function parentAppCtaLabel(appKey) {
  if (String(appKey || '').toUpperCase() === 'INVENTORY') {
    return t('settings.addonsInstallInventoryFirst');
  }
  return t('settings.addonsInstallAppFirst', { app: appDisplayName(appKey) });
}

function goInstallRequiredApp(appKey) {
  const key = String(appKey || '').toUpperCase();
  if (!key) {
    router.push({ path: '/settings', query: { tab: 'applications' } });
    return;
  }
  router.push({ path: '/settings', query: { tab: 'applications', appKey: key } });
}

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
  if (view === 'articles') return 'articles-settings';
  if (view === 'tally') return 'tally-settings';
  if (view === 'blog') return 'blog-settings';
  if (view === 'email-credits') return 'email-credits-settings';
  if (view === 'ai-credits') return 'ai-credits-settings';
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

function openEmailCreditsSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'email-credits' },
  });
}

function openAiCreditsSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'ai-credits' },
  });
}

function openLiveChatSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'settings' },
  });
}

function openArticlesSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'articles' },
  });
}

function openTallySettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'tally' },
  });
}

function openAnnouncementsApp() {
  router.push('/announcements');
}

function openBlogSettings() {
  router.push({
    path: '/settings',
    query: { tab: 'addons', addonView: 'blog' },
  });
}

function openStockrooms() {
  router.push({ path: '/inventory/stockrooms' });
}

function openCpqSettings() {
  router.push({ path: '/settings', query: { tab: 'catalog', catalogView: 'item-groups' } });
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
    return formatUserDate(value);
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

async function installAddon(addonOrKey) {
  const addon = typeof addonOrKey === 'string' ? null : addonOrKey;
  const addonKey = typeof addonOrKey === 'string' ? addonOrKey : addonOrKey?.addonKey;
  if (!addonKey) return;

  const missing = Array.isArray(addon?.missingApps) ? addon.missingApps : [];
  if (addon && addon.installEligible === false && missing.length) {
    notifications.error(parentAppRequiredMessage(addon));
    goInstallRequiredApp(missing[0]);
    return;
  }

  installingKey.value = addonKey;
  try {
    await apiClient.post(`/settings/addons/${addonKey}/install`);
    if (addonKey === 'articles') {
      captureArticlesAddonInstalled();
    }
    if (addonKey === 'blog') {
      captureBlogAddonInstalled();
    }
    notifications.success(t('settings.addonsInstallSuccess'));
    notifyAddonsUpdated();
    await loadAddons();
  } catch (err) {
    const errData = err?.response?.data || {};
    const missingFromErr = Array.isArray(errData.missingApps) ? errData.missingApps : [];
    const code = errData.code || err?.code;
    if (code === 'PARENT_APP_REQUIRED' || missingFromErr.length) {
      notifications.error(
        missingFromErr.length === 1 && String(missingFromErr[0]).toUpperCase() === 'INVENTORY'
          ? t('settings.addonsRequiresInventory')
          : (err?.message || t('settings.addonsRequiresApps', {
              apps: missingFromErr.map(appDisplayName).join(', '),
            })),
      );
      if (missingFromErr[0]) {
        goInstallRequiredApp(missingFromErr[0]);
      }
    } else {
      notifications.error(err?.message || t('settings.addonsInstallFailed'));
    }
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
  if (!await confirmAction(t('settings.addonsUninstallConfirm'))) return;
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
