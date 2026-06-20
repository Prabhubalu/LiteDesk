<script setup>
import { ref, computed, onMounted, onActivated, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { usePlatformHome } from '@/composables/usePlatformHome';
import { useOnboarding } from '@/composables/useOnboarding';
import { useAttentionItems } from '@/composables/useAttentionItems';
import { useApprovalDecision } from '@/composables/useApprovalDecision';
import {
  capturePlatformHomeApprovalAction,
  capturePlatformHomeAppPillClick,
  capturePlatformHomeInboxClick,
  capturePlatformHomeNextEventClick,
  capturePlatformHomeSignalClick,
  capturePlatformHomeViewed
} from '@/config/posthogPlatformHome';
import { navigatePlatformHomeRoute, resolvePlatformHomeRoute } from '@/utils/platformHomeNavigation';
import {
  buildNotificationOpenTabOptions,
  getNotificationPath
} from '@/utils/navigateFromNotification';
import { useNotificationStore } from '@/stores/notifications';
import AttentionItemRow from '@/components/platform/AttentionItemRow.vue';
import PlatformHomeRecentRow from '@/components/platform/PlatformHomeRecentRow.vue';
import PlatformHomeApprovalRow from '@/components/platform/PlatformHomeApprovalRow.vue';
import PlatformHomeNextEventRow from '@/components/platform/PlatformHomeNextEventRow.vue';
import PlatformHomeInboxCard from '@/components/platform/PlatformHomeInboxCard.vue';
import PlatformHomeIntentBar from '@/components/platform/PlatformHomeIntentBar.vue';
import PlatformHomeTodayBrief from '@/components/platform/PlatformHomeTodayBrief.vue';
import PlatformHomeAppPill from '@/components/platform/PlatformHomeAppPill.vue';
import PlatformHomeSection from '@/components/platform/PlatformHomeSection.vue';
import { extractPlatformHomeBriefSignals } from '@/utils/platformHomeApps';
import {
  PLATFORM_HOME_ALERT_ERROR_CLASS,
  PLATFORM_HOME_ALERT_WARNING_CLASS,
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_LIST_SCROLL_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';
import OnboardingWelcomePanel from '@/components/onboarding/OnboardingWelcomePanel.vue';
import OnboardingChecklistCard from '@/components/onboarding/OnboardingChecklistCard.vue';
import OnboardingTrialBanner from '@/components/onboarding/OnboardingTrialBanner.vue';
import OnboardingSampleDataCard from '@/components/onboarding/OnboardingSampleDataCard.vue';
import { formatPlatformGreeting, getLocalTimeOfDay } from '@/utils/platformHomeGreeting';
import { formatPlatformFocus } from '@/utils/platformHomeFocus';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const notificationStore = useNotificationStore();
const { openTab } = useTabs();

const { error: homeError, snapshot, fetchSnapshot } = usePlatformHome();
const { completeTask } = useAttentionItems();
const {
  processingId: approvalProcessingId,
  processingAction: approvalProcessingAction,
  approve: approveApproval,
  reject: rejectApproval
} = useApprovalDecision();
const {
  dismissWelcome,
  loading: onboardingLoading,
  acceptSampleData,
  declineSampleData
} = useOnboarding();

const onboarding = computed(() => snapshot.value.onboarding);
const showWelcomePanel = computed(() => Boolean(onboarding.value?.showWelcome && onboarding.value?.welcome));
const memberChecklistSteps = computed(() => (
  onboarding.value?.persona === 'member' ? (onboarding.value?.steps || []) : []
));
const orgSetupSteps = computed(() => (
  onboarding.value?.showSetupProgress ? (onboarding.value?.orgSteps || []) : []
));

const pageLoading = ref(true);
const quickAccessApps = ref([]);
const alerts = ref([]);
const rejectingApproval = ref(null);
const rejectReason = ref('');

const attentionItems = computed(() => snapshot.value.attention.items);
const attentionTotal = computed(() => snapshot.value.attention.total);
const hasMoreAttention = computed(() => attentionTotal.value > attentionItems.value.length);
const resumeItems = computed(() => snapshot.value.resume || []);
const appPulses = computed(() => snapshot.value.appPulses || []);
const shellCounts = computed(() => snapshot.value.shell);

const greetingTitle = computed(() => {
  const user = authStore.user;
  const fallbackName = user?.firstName || user?.name?.split?.(' ')?.[0] || '';
  return formatPlatformGreeting(snapshot.value.greeting, t, fallbackName, getLocalTimeOfDay());
});

const focusSubtitle = computed(() => {
  const text = formatPlatformFocus(snapshot.value.focus, t);
  if (text) return text;
  return t('platform.platformHomeFocusQuiet');
});

const briefSignals = computed(() => extractPlatformHomeBriefSignals(appPulses.value));

const approvalsPending = computed(() => shellCounts.value?.approvalsPending ?? 0);
const unreadMail = computed(() => shellCounts.value?.mail?.unread ?? 0);
const approvalsPreview = computed(() => shellCounts.value?.approvalsPreview || []);
const mailPreview = computed(() => shellCounts.value?.mail?.preview || []);
const notificationsPreview = computed(() => shellCounts.value?.notifications?.preview || []);
const notificationsUnread = computed(() => shellCounts.value?.notifications?.unread ?? 0);
const nextEvent = computed(() => shellCounts.value?.nextEvent || null);
const documentsPendingReview = computed(() => shellCounts.value?.documents?.pendingReview ?? 0);
const documentsExpiringSoon = computed(() => shellCounts.value?.documents?.expiringSoon ?? 0);
const documentsPreview = computed(() => shellCounts.value?.documents?.preview || []);

const hasMoreApprovals = computed(() => approvalsPending.value > approvalsPreview.value.length);

const hasUpNextItems = computed(() =>
  attentionTotal.value > 0
  || approvalsPending.value > 0
  || Boolean(nextEvent.value)
  || documentsPendingReview.value > 0
  || documentsExpiringSoon.value > 0
  || documentsPreview.value.length > 0
);

const showInboxCard = computed(() =>
  unreadMail.value > 0
  || notificationsUnread.value > 0
  || mailPreview.value.length > 0
  || notificationsPreview.value.length > 0
);

const approvalsLabel = computed(() =>
  t(
    approvalsPending.value === 1
      ? 'platform.platformHomeApprovalCountOne'
      : 'platform.platformHomeApprovalCountMany',
    { count: approvalsPending.value }
  )
);

const documentsPendingReviewLabel = computed(() =>
  t(
    documentsPendingReview.value === 1
      ? 'platform.platformHomeDocumentsPendingReviewOne'
      : 'platform.platformHomeDocumentsPendingReviewMany',
    { count: documentsPendingReview.value }
  )
);

const documentsExpiringSoonLabel = computed(() =>
  t(
    documentsExpiringSoon.value === 1
      ? 'platform.platformHomeDocumentsExpiringSoonOne'
      : 'platform.platformHomeDocumentsExpiringSoonMany',
    { count: documentsExpiringSoon.value }
  )
);

const handleQueueSelect = (item) => {
  if (!item?.route) return;
  navigatePlatformHomeRoute(router, openTab, item.route, { title: item.title });
};

const handleMailSelect = (item) => {
  capturePlatformHomeInboxClick('mail', item.id);
  handleQueueSelect(item);
};

const handleNotificationSelect = async (item) => {
  if (!item?.id) return;
  capturePlatformHomeInboxClick('notification', item.id, { app_key: item.appKey });
  const path = getNotificationPath(item.appKey, item.entity);
  if (path) {
    await notificationStore.markRead(item.id);
    openTab(path, buildNotificationOpenTabOptions(item.entity));
    await fetchSnapshot();
    return;
  }
  goToNotifications();
};

const handleApprovalSelect = (item) => {
  handleQueueSelect(item);
};

const handleApprovalApprove = async (item) => {
  if (!item?.id) return;
  capturePlatformHomeApprovalAction('approve', item.id);
  await approveApproval(item.id, { onSuccess: fetchSnapshot });
};

const handleApprovalReject = (item) => {
  rejectingApproval.value = item;
  rejectReason.value = '';
};

const closeRejectModal = () => {
  rejectingApproval.value = null;
  rejectReason.value = '';
};

const confirmApprovalReject = async () => {
  if (!rejectingApproval.value?.id || !rejectReason.value.trim()) return;
  capturePlatformHomeApprovalAction('reject', rejectingApproval.value.id);
  const ok = await rejectApproval(rejectingApproval.value.id, rejectReason.value, {
    onSuccess: fetchSnapshot
  });
  if (ok) closeRejectModal();
};

const displayApps = computed(() => {
  const pulseByKey = new Map(
    appPulses.value.map((pulse) => [String(pulse.appKey || '').toUpperCase(), pulse])
  );
  const seen = new Set();

  const fromRegistry = quickAccessApps.value.map((app) => {
    const appKey = String(app.appKey || '').toUpperCase();
    seen.add(appKey);
    return {
      appKey,
      name: app.name || pulseByKey.get(appKey)?.name || appKey,
      route: app.route || pulseByKey.get(appKey)?.route,
      pulse: pulseByKey.get(appKey) || null
    };
  });

  const pulseOnly = appPulses.value
    .filter((pulse) => !seen.has(String(pulse.appKey || '').toUpperCase()))
    .map((pulse) => ({
      appKey: String(pulse.appKey || '').toUpperCase(),
      name: pulse.name || pulse.appKey,
      route: pulse.route,
      pulse
    }));

  return [...fromRegistry, ...pulseOnly];
});

const showMainContent = computed(() =>
  hasUpNextItems.value
  || showInboxCard.value
  || resumeItems.value.length > 0
  || displayApps.value.length > 0
  || alerts.value.length > 0
);

const loadQuickAccessApps = async () => {
  try {
    if (!appShellStore.availableApps?.length) {
      await appShellStore.ensureCachedAppRegistry();
    }

    quickAccessApps.value = (appShellStore.availableApps || [])
      .filter((app) => {
        const appKeyUpper = app.appKey?.toUpperCase();
        return appKeyUpper !== 'CONTROL_PLANE' && authStore.hasAssignedAppAccess(app.appKey);
      })
      .slice(0, 8)
      .map((app) => ({
        ...app,
        route: normalizeAppRoute(app)
      }));
  } catch (error) {
    console.error('[PlatformHome] Error loading quick access apps:', error);
  }
};

function normalizeAppRoute(app) {
  let route = app.defaultRoute || getDefaultRouteForApp(app.appKey);

  if (
    route
    && !route.startsWith('/dashboard')
    && !route.startsWith('/audit')
    && !route.startsWith('/portal')
    && !route.startsWith('/helpdesk')
    && !route.startsWith('/projects')
  ) {
    const appKeyLower = app.appKey?.toLowerCase();
    if (route.startsWith(`/${appKeyLower}/`) || route === `/${appKeyLower}`) {
      route = `/dashboard/${appKeyLower}`;
    }
  }

  return route;
}

function getDefaultRouteForApp(appKey) {
  switch (String(appKey || '').toUpperCase()) {
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
}

const loadAlerts = async () => {
  try {
    const org = authStore.organization;
    if (!org) return;

    const subscription = org.subscription || {};
    const status = subscription.status || 'trial';

    if (status === 'suspended' || status === 'expired') {
      alerts.value.push({
        type: 'error',
        title: t('platform.platformHomeAlertInstanceSuspendedTitle'),
        message: t('platform.platformHomeAlertInstanceSuspendedMessage'),
        icon: XCircleIcon
      });
    }

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
  } catch (error) {
    console.error('[PlatformHome] Error loading alerts:', error);
  }
};

const handleSignalSelect = (signal) => {
  capturePlatformHomeSignalClick(signal);
  const route = resolvePlatformHomeRoute({
    route: signal?.route,
    appKey: signal?.appKey,
    pulseRoute: displayApps.value.find((app) => app.appKey === signal?.appKey)?.route
  });
  navigatePlatformHomeRoute(router, openTab, route, { title: signal?.text });
};

const handleNextEventSelect = (item) => {
  if (!item?.id) return;
  capturePlatformHomeNextEventClick(item.id);
  navigatePlatformHomeRoute(router, openTab, item.route, { title: item.title });
};

const goToAttention = () => router.push('/platform/attention');
const goToApprovals = () => router.push('/approvals');
const goToDocumentsPendingReview = () => router.push('/documents?status=pending_review');
const goToDocumentsExpiringSoon = () => router.push('/documents?expiringOnly=1');
const goToInbox = () => router.push('/inbox');
const goToNotifications = () => {
  window.dispatchEvent(new CustomEvent('arivu:open-notifications-panel'));
};
const goToAppRegistry = () => router.push('/platform/apps');

const handleAttentionSelect = (item) => {
  if (item.routeTarget) router.push(item.routeTarget);
};

const handleAttentionComplete = async (item) => {
  const result = await completeTask(item);
  if (result && typeof result === 'object' && result.navigate) {
    router.push(result.navigate);
    return;
  }
  if (result === true) await fetchSnapshot();
};

const handleResumeSelect = (item) => {
  if (!item?.route) return;
  openTab(item.route, {
    title: item.title,
    background: false,
    insertAdjacent: true
  });
};

const openApp = (app) => {
  capturePlatformHomeAppPillClick(app);
  const appKeyUpper = String(app.appKey || '').toUpperCase();
  if (appKeyUpper === 'AUDIT') {
    openTab(app.route, {
      title: app.name || t('platform.platformHomeAuditDashboard'),
      icon: 'document'
    });
    return;
  }
  if (app.route) router.push(app.route);
};

const loadData = async () => {
  pageLoading.value = true;
  alerts.value = [];
  try {
    await Promise.all([fetchSnapshot(), loadQuickAccessApps(), loadAlerts()]);
  } catch (error) {
    console.error('[PlatformHome] Error loading data:', error);
  } finally {
    pageLoading.value = false;
  }
};

const handleWelcomeDismiss = async () => {
  const ok = await dismissWelcome();
  if (ok) {
    if (authStore.user?.onboarding) {
      authStore.user.onboarding.redirectTo = null;
    }
    await fetchSnapshot();
  }
};

const handleSampleDataAccept = async () => {
  if (await acceptSampleData()) await fetchSnapshot();
};

const handleSampleDataDecline = async () => {
  if (await declineSampleData()) await fetchSnapshot();
};

const resetScroll = () => {
  nextTick(() => {
    const scrollRoot = document.querySelector('[data-platform-scroll-root]');
    if (scrollRoot) {
      scrollRoot.scrollTop = 0;
      scrollRoot.style.overflow = 'hidden';
      void scrollRoot.offsetHeight;
      scrollRoot.style.overflow = '';
      scrollRoot.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  });
};

onMounted(() => {
  loadData();
  capturePlatformHomeViewed();
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
});

onActivated(() => {
  resetScroll();
  if (!pageLoading.value) {
    fetchSnapshot();
  }
});
</script>

<template>
  <div class="min-h-full w-full">
    <div class="mx-auto w-full max-w-5xl space-y-4 pb-2">
      <header class="flex items-start justify-between gap-4">
        <h1 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
          {{ greetingTitle }}
        </h1>
      </header>

      <div v-if="!pageLoading && onboarding" class="space-y-3">
        <OnboardingTrialBanner :trial="onboarding.trial" />
        <OnboardingSampleDataCard
          :offer="onboarding.sampleDataOffer"
          :loading="onboardingLoading"
          @accept="handleSampleDataAccept"
          @decline="handleSampleDataDecline"
        />
        <OnboardingWelcomePanel
          v-if="showWelcomePanel"
          :welcome="onboarding.welcome"
          :loading="onboardingLoading"
          @dismiss="handleWelcomeDismiss"
          @primary="handleWelcomeDismiss"
        />
        <OnboardingChecklistCard
          v-if="memberChecklistSteps.length"
          :steps="memberChecklistSteps"
          :progress="onboarding.progress"
          :loading="onboardingLoading"
        />
        <OnboardingChecklistCard
          v-if="orgSetupSteps.length"
          title-key="onboarding.setupProgressTitle"
          :steps="orgSetupSteps"
          :progress="onboarding.orgProgress"
          :loading="onboardingLoading"
        />
      </div>

      <div v-if="pageLoading" class="space-y-4">
        <div class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
        <div class="h-28" :class="PLATFORM_HOME_SKELETON_CLASS" />
        <div class="h-16" :class="PLATFORM_HOME_SKELETON_CLASS" />
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="h-64" :class="PLATFORM_HOME_SKELETON_CLASS" />
          <div class="h-64" :class="PLATFORM_HOME_SKELETON_CLASS" />
        </div>
      </div>

      <template v-else>
        <PlatformHomeIntentBar />

        <PlatformHomeTodayBrief
          :focus-text="focusSubtitle"
          :signals="briefSignals"
          @signal-select="handleSignalSelect"
        />

        <div
          v-for="(alert, index) in alerts"
          :key="index"
          :class="[
            'flex items-start gap-3 px-4 py-3.5',
            alert.type === 'error' ? PLATFORM_HOME_ALERT_ERROR_CLASS : PLATFORM_HOME_ALERT_WARNING_CLASS
          ]"
        >
          <component
            :is="alert.icon || InformationCircleIcon"
            :class="[
              'mt-0.5 h-5 w-5 shrink-0',
              alert.type === 'error' ? 'text-danger-600 dark:text-danger-400' : 'text-warning-600 dark:text-warning-400'
            ]"
          />
          <div class="min-w-0 text-left">
            <p
              class="text-sm font-medium"
              :class="alert.type === 'error' ? 'text-danger-900 dark:text-danger-100' : 'text-warning-900 dark:text-warning-100'"
            >
              {{ alert.title }}
            </p>
            <p
              class="mt-0.5 text-sm"
              :class="alert.type === 'error' ? 'text-danger-700 dark:text-danger-300' : 'text-warning-700 dark:text-warning-300'"
            >
              {{ alert.message }}
            </p>
          </div>
        </div>

        <PlatformHomeSection
          v-if="displayApps.length > 0"
          analytics-id="apps"
          :title="t('platform.platformHomeYourApps')"
        >
          <div class="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PlatformHomeAppPill
              v-for="app in displayApps"
              :key="app.appKey"
              :app="app"
              @open="openApp"
            />
          </div>
          <template #action>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              @click="goToAppRegistry"
            >
              {{ t('platform.platformHomeExploreApps') }}
              <ArrowRightIcon class="h-3.5 w-3.5" />
            </button>
          </template>
        </PlatformHomeSection>

        <div v-if="showMainContent" class="pt-1">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('platform.platformHomeWorkspaceTitle') }}
            </h2>
          </div>

          <div class="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <section
              :class="['flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
            >
              <div :class="['flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
                <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
                  {{ t('platform.platformHomeUpNext') }}
                </h3>
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <button
                    v-if="approvalsPending > 0 && hasMoreApprovals"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    @click="goToApprovals"
                  >
                    {{ approvalsLabel }}
                    <ArrowRightIcon class="h-3 w-3" />
                  </button>
                  <button
                    v-if="attentionTotal > 0"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    @click="goToAttention"
                  >
                    {{ t('settings.roleDrawerPermViewAll') }}
                    <span v-if="hasMoreAttention">({{ attentionTotal }})</span>
                    <ArrowRightIcon class="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div v-if="homeError && !hasUpNextItems" class="px-5 py-6">
                <p class="text-sm text-danger-600 dark:text-danger-400">{{ homeError }}</p>
              </div>

              <div v-else-if="!hasUpNextItems" class="flex flex-col items-center justify-center px-5 py-8 text-center">
                <CheckCircleIcon class="mb-2 h-6 w-6 text-success-500" />
                <p class="text-sm font-medium text-neutral-900 dark:text-white">
                  {{ t('platform.platformHomeAllClear') }}
                </p>
                <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('platform.platformHomeAllClearHint') }}
                </p>
              </div>

              <div
                v-else
                :class="[
                  'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
                  PLATFORM_HOME_LIST_SCROLL_CLASS
                ]"
              >
                <PlatformHomeNextEventRow
                  v-if="nextEvent"
                  class="px-1.5"
                  :item="nextEvent"
                  @select="handleNextEventSelect"
                />

                <PlatformHomeApprovalRow
                  v-for="item in approvalsPreview"
                  :key="`approval-${item.id}`"
                  class="px-1.5"
                  :item="item"
                  :processing-id="approvalProcessingId"
                  :processing-action="approvalProcessingAction"
                  @select="handleApprovalSelect"
                  @approve="handleApprovalApprove"
                  @reject="handleApprovalReject"
                />

                <button
                  v-for="item in documentsPreview"
                  :key="`document-${item.id}`"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  @click="handleQueueSelect(item)"
                >
                  <span class="flex-1">
                    <span class="block truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {{ item.title }}
                    </span>
                    <span v-if="item.subtitle" class="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {{ item.subtitle }}
                    </span>
                  </span>
                  <ArrowRightIcon class="h-4 w-4 text-neutral-300 group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-500" />
                </button>

                <button
                  v-if="!documentsPreview.length && documentsPendingReview > 0"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  @click="goToDocumentsPendingReview"
                >
                  <span class="flex-1 text-sm font-medium text-neutral-900 dark:text-white">
                    {{ documentsPendingReviewLabel }}
                  </span>
                  <ArrowRightIcon class="h-4 w-4 text-neutral-300 group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-500" />
                </button>

                <button
                  v-if="documentsExpiringSoon > 0"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  @click="goToDocumentsExpiringSoon"
                >
                  <span class="flex-1 text-sm font-medium text-neutral-900 dark:text-white">
                    {{ documentsExpiringSoonLabel }}
                  </span>
                  <ArrowRightIcon class="h-4 w-4 text-neutral-300 group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-500" />
                </button>

                <button
                  v-if="!approvalsPreview.length && approvalsPending > 0"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  @click="goToApprovals"
                >
                  <span class="flex-1 text-sm font-medium text-neutral-900 dark:text-white">
                    {{ approvalsLabel }}
                  </span>
                  <ArrowRightIcon class="h-4 w-4 text-neutral-300 group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-500" />
                </button>

                <AttentionItemRow
                  v-for="item in attentionItems"
                  :key="item.id"
                  class="px-1.5"
                  :item="item"
                  :show-divider="false"
                  compact
                  @select="handleAttentionSelect"
                  @complete="handleAttentionComplete"
                />
              </div>
            </section>

            <section
              :class="['flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
            >
              <div :class="['px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
                <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
                  {{ t('platform.platformHomeRecentWork') }}
                </h3>
              </div>

              <div v-if="resumeItems.length === 0" class="flex items-center justify-center px-5 py-8 text-center">
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('platform.platformHomeTasksEventsAndAlertsFromYour') }}
                </p>
              </div>

              <div
                v-else
                :class="[
                  'flex flex-col px-1.5 py-0.5',
                  PLATFORM_HOME_LIST_SCROLL_CLASS
                ]"
              >
                <PlatformHomeRecentRow
                  v-for="item in resumeItems"
                  :key="`${item.moduleKey}-${item.id}`"
                  :item="item"
                  @select="handleResumeSelect"
                />
              </div>
            </section>
          </div>

          <div v-if="showInboxCard" class="mt-4">
            <PlatformHomeInboxCard
              :notification-preview="notificationsPreview"
              :mail-preview="mailPreview"
              :notifications-unread="notificationsUnread"
              :unread-mail="unreadMail"
              @open-notifications="goToNotifications"
              @open-inbox="goToInbox"
              @select-notification="handleNotificationSelect"
              @select-mail="handleMailSelect"
            />
          </div>
        </div>

        <div
          v-else-if="!displayApps.length"
          :class="['px-8 py-12 text-center', PLATFORM_HOME_CARD_CLASS]"
        >
          <SparklesIcon class="mx-auto mb-4 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
            {{ t('platform.platformHomeAllClear') }}
          </h2>
          <p class="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('platform.platformHomeAllClearHint') }}
          </p>
        </div>
      </template>
    </div>

    <div
      v-if="rejectingApproval"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeRejectModal"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-lg dark:border-white/12 dark:bg-neutral-800"
        role="dialog"
        aria-modal="true"
        :aria-label="t('common.approvalInboxRejectApproval')"
      >
        <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
          {{ t('common.approvalInboxRejectApproval') }}
        </h3>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('common.approvalInboxRejectingWillBlockThisActionPlease') }}
        </p>
        <label class="mt-4 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {{ t('common.approvalInboxReason') }}
          <textarea
            v-model="rejectReason"
            rows="3"
            class="mt-1.5 w-full rounded-xl border border-neutral-200/70 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-neutral-900/50 dark:text-white"
            :placeholder="t('common.approvalInboxEnterRejectionReason')"
          />
        </label>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-200/80 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="closeRejectModal"
          >
            {{ t('performance.cancelWizard') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!rejectReason.trim() || Boolean(approvalProcessingId)"
            @click="confirmApprovalReject"
          >
            {{ approvalProcessingAction === 'reject' ? t('platform.platformHomeApprovalProcessing') : t('forms.hubActionReject') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
