<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { usePlatformHome } from '@/composables/usePlatformHome';
import { useAttentionItems } from '@/composables/useAttentionItems';
import AttentionItemRow from '@/components/platform/AttentionItemRow.vue';
import AppPulseCard from '@/components/platform/AppPulseCard.vue';
import { formatPlatformGreeting, getLocalTimeOfDay } from '@/utils/platformHomeGreeting';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ArrowRightIcon,
  SparklesIcon,
  XCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  LifebuoyIcon,
  RectangleStackIcon,
  GlobeAltIcon,
  Squares2X2Icon,
  TicketIcon,
  InboxIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const { openTab } = useTabs();

const { loading: homeLoading, error: homeError, snapshot, fetchSnapshot } = usePlatformHome();
const { completeTask } = useAttentionItems();

const pageLoading = ref(true);
const quickAccessApps = ref([]);
const alerts = ref([]);

const quickAccessIconByAppKey = {
  AUDIT: ShieldCheckIcon,
  SALES: BriefcaseIcon,
  HELPDESK: LifebuoyIcon,
  PROJECTS: RectangleStackIcon,
  PORTAL: GlobeAltIcon
};

const quickAccessIconByRawIcon = {
  calendar: CalendarIcon,
  briefcase: BriefcaseIcon,
  'check-circle': CheckCircleIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  squares: Squares2X2Icon,
  'squares-2x2': Squares2X2Icon,
  globe: GlobeAltIcon,
  'globe-alt': GlobeAltIcon,
  lifebuoy: LifebuoyIcon,
  ticket: TicketIcon,
  shield: ShieldCheckIcon,
  'shield-check': ShieldCheckIcon,
  'shield-check-icon': ShieldCheckIcon
};

const quickAccessIconByEmoji = {
  '📅': CalendarIcon,
  '💼': BriefcaseIcon,
  '🛟': LifebuoyIcon,
  '🧩': RectangleStackIcon,
  '🌐': GlobeAltIcon,
  '🛡️': ShieldCheckIcon,
  '✅': CheckCircleIcon
};

const normalizeIconKey = (rawIcon) => {
  if (!rawIcon || typeof rawIcon !== 'string') return '';
  return rawIcon.trim().toLowerCase().replace(/_/g, '-');
};

const getQuickAccessIcon = (app) => {
  const appKey = String(app?.appKey || '').toUpperCase();
  if (quickAccessIconByAppKey[appKey]) return quickAccessIconByAppKey[appKey];

  const rawIcon = normalizeIconKey(app?.icon);
  if (rawIcon && quickAccessIconByRawIcon[rawIcon]) return quickAccessIconByRawIcon[rawIcon];
  if (app?.icon && quickAccessIconByEmoji[app.icon]) return quickAccessIconByEmoji[app.icon];

  return Squares2X2Icon;
};

const attentionItems = computed(() => snapshot.value.attention.items);
const attentionSummary = computed(() => snapshot.value.attention.summary);
const attentionTotal = computed(() => snapshot.value.attention.total);
const attentionPreview = computed(() => attentionItems.value);
const hasMoreAttention = computed(() => attentionTotal.value > attentionItems.value.length);
const resumeItems = computed(() => snapshot.value.resume || []);
const appPulses = computed(() => snapshot.value.appPulses || []);
const shellCounts = computed(() => snapshot.value.shell);
const focusLine = computed(() => snapshot.value.focusLine || '');

const greetingTitle = computed(() => {
  const user = authStore.user;
  const fallbackName = user?.firstName || user?.name?.split?.(' ')?.[0] || '';
  return formatPlatformGreeting(snapshot.value.greeting, t, fallbackName, getLocalTimeOfDay());
});

const attentionChipLabel = computed(() =>
  t('platform.platformHomeNeedAttentionCount', { count: attentionTotal.value })
);

const approvalsChipLabel = computed(() =>
  t(
    shellCounts.value?.approvalsPending === 1
      ? 'platform.platformHomeApprovalCountOne'
      : 'platform.platformHomeApprovalCountMany',
    { count: shellCounts.value?.approvalsPending ?? 0 }
  )
);

const unreadChipLabel = computed(() =>
  t(
    shellCounts.value?.mail?.unread === 1
      ? 'platform.platformHomeUnreadCountOne'
      : 'platform.platformHomeUnreadCountMany',
    { count: shellCounts.value?.mail?.unread ?? 0 }
  )
);

const attentionSummaryCountLabel = computed(() => {
  if (attentionSummary.value?.overdue > 0) {
    return t('platform.platformHomeOverdueCount', { count: attentionSummary.value.overdue });
  }
  if (attentionSummary.value?.dueToday > 0) {
    return t('platform.platformHomeDueTodayCount', { count: attentionSummary.value.dueToday });
  }
  return t(
    attentionSummary.value?.total === 1
      ? 'platform.platformHomeItemCountOne'
      : 'platform.platformHomeItemCountMany',
    { count: attentionSummary.value?.total ?? 0 }
  );
});

const pulseAppKeys = computed(() => new Set(appPulses.value.map((p) => p.appKey)));

const quickAccessWithoutPulses = computed(() =>
  quickAccessApps.value.filter((app) => !pulseAppKeys.value.has(String(app.appKey || '').toUpperCase()))
);

const showTodayStrip = computed(() => {
  const s = shellCounts.value;
  return (
    attentionTotal.value > 0 ||
    (s?.approvalsPending ?? 0) > 0 ||
    (s?.mail?.unread ?? 0) > 0
  );
});

const hasAnyData = computed(() => {
  return (
    attentionTotal.value > 0 ||
    resumeItems.value.length > 0 ||
    appPulses.value.length > 0 ||
    (shellCounts.value?.approvalsPending ?? 0) > 0 ||
    (shellCounts.value?.mail?.unread ?? 0) > 0 ||
    quickAccessApps.value.length > 0 ||
    alerts.value.length > 0
  );
});

// Load Quick Access Apps
const loadQuickAccessApps = async () => {
  try {
    if (!appShellStore.availableApps?.length) {
      await appShellStore.ensureCachedAppRegistry();
    }
    
    const availableApps = appShellStore.availableApps || [];
    const appsWithAccess = availableApps
      .filter(app => {
        const appKeyUpper = app.appKey?.toUpperCase();
        return appKeyUpper !== 'CONTROL_PLANE' && authStore.hasAssignedAppAccess(app.appKey);
      })
      .slice(0, 6) // Limit to 6 apps
      .map(app => {
        // Normalize defaultRoute to dashboard format if needed
        let route = app.defaultRoute || getDefaultRouteForApp(app.appKey);
        
        // Convert legacy routes to standard dashboard format
        if (route && !route.startsWith('/dashboard') && !route.startsWith('/audit') && !route.startsWith('/portal') && !route.startsWith('/helpdesk') && !route.startsWith('/projects')) {
          const appKeyLower = app.appKey?.toLowerCase();
          if (route.startsWith(`/${appKeyLower}/`)) {
            // Convert /sales/people -> /dashboard/sales
            route = `/dashboard/${appKeyLower}`;
          } else if (route === `/${appKeyLower}`) {
            // Convert /sales -> /dashboard/sales
            route = `/dashboard/${appKeyLower}`;
          }
        }
        
        return {
          ...app,
          route
        };
      });
    
    quickAccessApps.value = appsWithAccess;
  } catch (error) {
    console.error('[PlatformHome] Error loading quick access apps:', error);
  }
};

// Get default route for app
const getDefaultRouteForApp = (appKey) => {
  const upperKey = appKey?.toUpperCase();
  switch (upperKey) {
    case 'SALES':
      return '/dashboard/sales';
    case 'HELPDESK':
      return '/helpdesk/cases';
    case 'PROJECTS':
      return '/projects/projects';
    case 'AUDIT':
      return '/audit/dashboard';
    case 'PORTAL':
      return '/portal/dashboard';
    default:
      return '/dashboard';
  }
};

// Load Alerts/Warnings
const loadAlerts = async () => {
  try {
    const org = authStore.organization;
    if (!org) return;
    
    const subscription = org.subscription || {};
    const status = subscription.status || 'trial';
    
    // Check for instance suspension
    if (status === 'suspended' || status === 'expired') {
      alerts.value.push({
        type: 'error',
        title: t('platform.platformHomeAlertInstanceSuspendedTitle'),
        message: t('platform.platformHomeAlertInstanceSuspendedMessage'),
        icon: XCircleIcon
      });
    }
    
    // Check for trial expiration
    if (status === 'trial' && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining < 0) {
        alerts.value.push({
          type: 'warning',
          title: t('platform.platformHomeAlertTrialEndedTitle'),
          message: t('platform.platformHomeAlertTrialEndedMessage'),
          icon: ExclamationTriangleIcon
        });
      } else if (daysRemaining <= 3) {
        alerts.value.push({
          type: 'warning',
          title: t('platform.platformHomeAlertTrialEndingSoonTitle'),
          message: t(
            daysRemaining === 1
              ? 'platform.platformHomeAlertTrialEndingSoonMessageOne'
              : 'platform.platformHomeAlertTrialEndingSoonMessageMany',
            { count: daysRemaining }
          ),
          icon: ExclamationTriangleIcon
        });
      }
    }
    
    // TODO: Add SLA breaches and automation failures when backend APIs are available
  } catch (error) {
    console.error('[PlatformHome] Error loading alerts:', error);
  }
};

const goToAttention = () => {
  router.push('/platform/attention');
};

const handleAttentionSelect = (item) => {
  if (item.routeTarget) {
    router.push(item.routeTarget);
  }
};

const handleAttentionComplete = async (item) => {
  const result = await completeTask(item);
  if (result && typeof result === 'object' && result.navigate) {
    router.push(result.navigate);
    return;
  }
  if (result === true) {
    await fetchSnapshot();
  }
};

const goToApprovals = () => router.push('/approvals');
const goToInbox = () => router.push('/inbox');

const handleResumeSelect = (item) => {
  if (item?.route) {
    router.push(item.route);
  }
};

const navigateToApp = (app) => {
  const appKeyUpper = app.appKey?.toUpperCase();
  if (appKeyUpper === 'AUDIT') {
    openTab(app.route, {
      title: app.name || t('platform.platformHomeAuditDashboard'),
      icon: 'document'
    });
  } else {
    router.push(app.route);
  }
};

const openAppPulse = (pulse) => {
  const appKeyUpper = pulse?.appKey?.toUpperCase();
  if (appKeyUpper === 'AUDIT') {
    openTab(pulse.route, {
      title: pulse.name || t('platform.platformHomeAuditDashboard'),
      icon: 'document'
    });
  } else if (pulse?.route) {
    router.push(pulse.route);
  }
};

const loadData = async () => {
  pageLoading.value = true;
  alerts.value = [];
  try {
    await Promise.all([
      fetchSnapshot(),
      loadQuickAccessApps(),
      loadAlerts()
    ]);
  } catch (error) {
    console.error('[PlatformHome] Error loading data:', error);
  } finally {
    pageLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ greetingTitle }}
        </h1>
        <p
          v-if="focusLine"
          class="text-base text-gray-700 dark:text-gray-300 max-w-2xl"
        >
          {{ focusLine }}
        </p>
        <p
          v-else
          class="text-gray-600 dark:text-gray-400"
        >{{ t('platform.platformHomeWhatNeedsYourAttentionRightNow') }}</p>
      </header>

      <!-- Loading State -->
      <div v-if="pageLoading" class="space-y-6">
        <div
          v-for="i in 4"
          :key="i"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
        >
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div class="space-y-3">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasAnyData" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <SparklesIcon class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('platform.platformHomeWelcomeToYourHome') }}</h3>
        <p class="text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ t('platform.platformHomeTasksEventsAndAlertsFromYour') }}</p>
      </div>

      <!-- Content Sections -->
      <div v-else class="space-y-6">
        <!-- Today strip: counts → owning surfaces -->
        <div
          v-if="showTodayStrip"
          class="flex flex-wrap gap-2"
        >
          <button
            v-if="attentionTotal > 0"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            @click="goToAttention"
          >
            <CheckCircleIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {{ attentionChipLabel }}
          </button>
          <button
            v-if="shellCounts.approvalsPending > 0"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            @click="goToApprovals"
          >
            <ClipboardDocumentCheckIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {{ approvalsChipLabel }}
          </button>
          <button
            v-if="shellCounts.mail.unread > 0"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            @click="goToInbox"
          >
            <InboxIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {{ unreadChipLabel }}
          </button>
        </div>

        <!-- Attention preview (GET /api/platform/home) -->
        <section
          v-if="attentionTotal > 0 || homeError"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('platform.platformHomeNeedsYourAttention') }}</h2>
              <p
                v-if="attentionSummary.total > 0"
                class="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                <span v-if="attentionSummary.overdue > 0" class="text-red-600 dark:text-red-400">
                  {{ t('platform.platformHomeOverdueCount', { count: attentionSummary.overdue }) }}
                </span>
                <span v-if="attentionSummary.overdue > 0 && attentionSummary.dueToday > 0"> · </span>
                <span v-if="attentionSummary.dueToday > 0">
                  {{ t('platform.platformHomeDueTodayCount', { count: attentionSummary.dueToday }) }}
                </span>
                <span v-if="attentionSummary.overdue === 0 && attentionSummary.dueToday === 0">
                  {{ attentionSummaryCountLabel }}
                </span>
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              @click="goToAttention"
            >{{ t('settings.roleDrawerPermViewAll') }}<span v-if="hasMoreAttention">({{ attentionSummary.total }})</span>
              <ArrowRightIcon class="w-4 h-4" />
            </button>
          </div>

          <div v-if="homeError && attentionTotal === 0" class="p-6">
            <p class="text-sm text-red-600 dark:text-red-400">{{ homeError }}</p>
          </div>

          <div v-else class="px-6 pb-2">
            <AttentionItemRow
              v-for="(item, index) in attentionPreview"
              :key="item.id"
              :item="item"
              :show-divider="index < attentionPreview.length - 1"
              compact
              @select="handleAttentionSelect"
              @complete="handleAttentionComplete"
            />
          </div>
        </section>

        <!-- Resume -->
        <section
          v-if="resumeItems.length > 0"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('platform.platformHomeContinueWhereYouLeftOff') }}</h2>
          </div>
          <div class="p-6 space-y-2">
            <button
              v-for="item in resumeItems"
              :key="`${item.moduleKey}-${item.id}`"
              type="button"
              class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group flex items-center justify-between gap-3"
              @click="handleResumeSelect(item)"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {{ item.title }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ item.sourceApp }}
                </p>
              </div>
              <ArrowRightIcon class="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          </div>
        </section>

        <!-- App pulse cards -->
        <section v-if="appPulses.length > 0">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">{{ t('platform.platformHomeYourApps') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AppPulseCard
              v-for="pulse in appPulses"
              :key="pulse.appKey"
              :pulse="pulse"
              @open="openAppPulse"
            />
          </div>
        </section>

        <!-- Quick Access (apps without pulse metrics) -->
        <div
          v-if="quickAccessWithoutPulses.length > 0"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />{{ t('platform.platformHomeQuickAccess') }}</h2>
          </div>
          
          <div class="p-6">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                v-for="app in quickAccessWithoutPulses"
                :key="app.appKey"
                @click="navigateToApp(app)"
                class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-left group"
              >
                <div class="flex items-center gap-3">
                  <component
                    :is="getQuickAccessIcon(app)"
                    class="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {{ app.name || app.appKey }}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
        <!-- Alerts -->
        <div
          v-if="alerts.length > 0"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ExclamationTriangleIcon class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />{{ t('platform.platformHomeAlerts') }}</h2>
          </div>
          
          <div class="p-6">
            <div class="space-y-3">
              <div
                v-for="(alert, index) in alerts"
                :key="index"
                :class="[
                  'p-4 rounded-lg border',
                  alert.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                ]"
              >
                <div class="flex items-start gap-3">
                  <component
                    :is="alert.icon || InformationCircleIcon"
                    :class="[
                      'w-5 h-5 mt-0.5 flex-shrink-0',
                      alert.type === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : alert.type === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-blue-600 dark:text-blue-400'
                    ]"
                  />
                  <div class="flex-1">
                    <h3 class="font-medium mb-1" :class="[
                      alert.type === 'error'
                        ? 'text-red-800 dark:text-red-200'
                        : alert.type === 'warning'
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : 'text-blue-800 dark:text-blue-200'
                    ]">
                      {{ alert.title }}
                    </h3>
                    <p class="text-sm" :class="[
                      alert.type === 'error'
                        ? 'text-red-700 dark:text-red-300'
                        : alert.type === 'warning'
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-blue-700 dark:text-blue-300'
                    ]">
                      {{ alert.message }}
                    </p>
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
