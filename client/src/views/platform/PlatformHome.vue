<script setup>
import { ref, computed, onMounted, onActivated, onBeforeUnmount, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { usePlatformHome } from '@/composables/usePlatformHome';
import { usePlatformHomeLayout } from '@/composables/usePlatformHomeLayout';
import { useOnboarding } from '@/composables/useOnboarding';
import { useAttentionItems } from '@/composables/useAttentionItems';
import { useApprovalDecision } from '@/composables/useApprovalDecision';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import { useColorMode } from '@/composables/useColorMode';
import { useWorkspaceCustomizeDrawer } from '@/composables/useWorkspaceCustomizeDrawer';
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
import PlatformHomeGrid from '@/components/platform/PlatformHomeGrid.vue';
import PlatformHomeCustomizePanel from '@/components/platform/PlatformHomeCustomizePanel.vue';
import PlatformHomeWidgetShell from '@/components/platform/PlatformHomeWidgetShell.vue';
import PlatformHomeWidgetHeader from '@/components/platform/PlatformHomeWidgetHeader.vue';
import DashboardWidgetCell from '@/components/analytics/DashboardWidgetCell.vue';
import apiClient from '@/utils/apiClient';
import { getBuiltinWidgetDefinition, PLATFORM_HOME_WIDTH_CLASS, clonePlatformHomeLayout } from '@/utils/platformHomeWidgetRegistry';
import {
  PLATFORM_HOME_ALERT_ERROR_CLASS,
  PLATFORM_HOME_ALERT_WARNING_CLASS,
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_LIST_SCROLL_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';
import { extractPlatformHomeBriefSignals } from '@/utils/platformHomeApps';
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
  InformationCircleIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const notificationStore = useNotificationStore();
const { openTab } = useTabs();
const { effectiveDark } = useColorMode();

const { error: homeError, snapshot, fetchSnapshot } = usePlatformHome();
const {
  layout,
  customizeMode,
  saving: layoutSaving,
  fetchLayout,
  saveLayout,
  saveDefaultLayout,
  enterCustomizeMode,
  cancelCustomizeMode,
  finishCustomizeMode,
  toggleBuiltinWidget,
  addAnalyticsWidget,
  removeLayoutItem,
  updateLayoutItems,
  setWidthMode,
} = usePlatformHomeLayout();

const customizeAnchorRef = ref(null);
const platformHomeGridRef = ref(null);
const {
  workspaceDrawerHost,
  workspaceDrawerHostReady,
  syncDrawerPosition,
  drawerInsetStyle,
} = useWorkspaceCustomizeDrawer(customizeMode, customizeAnchorRef);
const { widgets: paletteWidgets, fetchWidgets } = useAnalyticsWidgets();
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
const analyticsExecuting = ref(false);
const analyticsPayloadByInstance = ref(new Map());
const analyticsWidgetMeta = ref(new Map());
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
  const aiHeadline = String(snapshot.value.focusAi?.headline || '').trim();
  if (aiHeadline) return aiHeadline;
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

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const analyticsLayoutItems = computed(() =>
  layout.value.items.filter((item) => item.type === 'analytics' && item.enabled !== false && item.widgetId)
);

async function executeAnalyticsWidgets() {
  const items = analyticsLayoutItems.value;
  if (!items.length) return;

  analyticsExecuting.value = true;
  try {
    await Promise.all(items.map(async (item) => {
      const widgetId = String(item.widgetId);
      try {
        const response = await apiClient.post(`/analytics/widgets/${widgetId}/execute`, {});

        if (response?.success && response.data) {
          analyticsPayloadByInstance.value.set(item.instanceId, {
            instanceId: item.instanceId,
            widgetId: item.widgetId,
            name: response.data.name,
            chartType: response.data.chartType,
            columnMapping: response.data.columnMapping,
            thresholds: response.data.thresholds,
            kpiValueField: response.data.kpiValueField,
            kpiLabel: response.data.kpiLabel,
            kpiPrefix: response.data.kpiPrefix,
            kpiSuffix: response.data.kpiSuffix,
            showLegend: response.data.showLegend,
            orientation: response.data.orientation,
            stacked: response.data.stacked,
            smooth: response.data.smooth,
            showDataLabels: response.data.showDataLabels,
            result: response.data.result,
          });
          return;
        }

        analyticsPayloadByInstance.value.set(item.instanceId, {
          instanceId: item.instanceId,
          widgetId: item.widgetId,
          chartType: widgetCellChartType(item),
          error: response?.message || t('analytics.dashboardWidgetLoadError'),
          result: null,
        });
      } catch (error) {
        analyticsPayloadByInstance.value.set(item.instanceId, {
          instanceId: item.instanceId,
          widgetId: item.widgetId,
          chartType: widgetCellChartType(item),
          error: error?.message || t('analytics.dashboardWidgetLoadError'),
          result: null,
        });
      }
    }));
  } finally {
    analyticsExecuting.value = false;
  }
}

function widgetCellTitle(item) {
  if (item.type === 'analytics') {
    const meta = analyticsWidgetMeta.value.get(String(item.widgetId));
    return meta?.name || t('analytics.dashboardWidgetPlaceholder');
  }
  const def = getBuiltinWidgetDefinition(item.type);
  return def ? t(def.labelKey) : item.type;
}

function widgetCellChartType(item) {
  if (item.type !== 'analytics') return null;
  const meta = analyticsWidgetMeta.value.get(String(item.widgetId));
  return meta?.chartType || analyticsPayloadByInstance.value.get(item.instanceId)?.chartType || null;
}

function analyticsPayload(item) {
  return analyticsPayloadByInstance.value.get(item.instanceId) || null;
}

function handleToggleBuiltin(type, enabled) {
  toggleBuiltinWidget(type, enabled);
  nextTick(() => platformHomeGridRef.value?.syncGridToLayout?.());
}

function handleAddAnalyticsWidget(widget) {
  const added = addAnalyticsWidget(String(widget._id), widget.name);
  if (!added) return;
  analyticsWidgetMeta.value.set(String(widget._id), widget);
  nextTick(() => {
    platformHomeGridRef.value?.syncGridToLayout?.();
    executeAnalyticsWidgets();
  });
}

function handleRemoveAnalyticsWidget(instanceId) {
  const item = layout.value.items.find((entry) => entry.instanceId === instanceId);
  if (!item) return;
  removeLayoutItem(instanceId);
  analyticsPayloadByInstance.value.delete(instanceId);
  nextTick(() => platformHomeGridRef.value?.syncGridToLayout?.());
}

let layoutSaveTimer = null;
let pendingLayoutSave = false;

function flushLayoutSave() {
  if (customizeMode.value) return;
  clearTimeout(layoutSaveTimer);
  layoutSaveTimer = null;
  if (!pendingLayoutSave) return;
  pendingLayoutSave = false;
  void saveLayout(clonePlatformHomeLayout(layout.value));
}

function handleLayoutUpdate(items) {
  updateLayoutItems(items);
  if (customizeMode.value) return;
  void saveLayout(clonePlatformHomeLayout(layout.value));
}

function handleEnterCustomize() {
  syncDrawerPosition();
  enterCustomizeMode();
}

function handleCustomizeDone() {
  void finishCustomizeMode().then(() => executeAnalyticsWidgets());
}

function handleCustomizeCancel() {
  cancelCustomizeMode();
}

function hydrateAnalyticsMeta() {
  for (const widget of paletteWidgets.value) {
    analyticsWidgetMeta.value.set(String(widget._id), widget);
  }
}

watch(
  () => layout.value.items
    .filter((item) => item.type === 'analytics' && item.enabled !== false)
    .map((item) => `${item.instanceId}:${item.widgetId}`)
    .sort()
    .join('|'),
  () => {
    if (!pageLoading.value) {
      void executeAnalyticsWidgets();
    }
  },
);

const showMainContent = computed(() =>
  layout.value.items.some((item) => item.enabled !== false)
);

const homeWidthClass = computed(
  () => PLATFORM_HOME_WIDTH_CLASS[layout.value.widthMode ?? 'wide'],
);

const canSaveDefaultLayout = computed(() => authStore.isAdminLike || authStore.isPlatformAdmin);
const savingDefaultLayout = ref(false);

async function handleSaveDefaultLayout() {
  if (!canSaveDefaultLayout.value || savingDefaultLayout.value) return;
  savingDefaultLayout.value = true;
  try {
    platformHomeGridRef.value?.syncGridToLayout?.();
    await nextTick();
    const snapshot = clonePlatformHomeLayout(layout.value);
    await saveLayout(snapshot);
    await saveDefaultLayout(snapshot);
  } finally {
    savingDefaultLayout.value = false;
  }
}

function handleWidthModeUpdate(mode) {
  setWidthMode(mode);
}

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
    await Promise.all([
      fetchSnapshot(),
      fetchLayout(),
      loadQuickAccessApps(),
      loadAlerts(),
      fetchWidgets({ status: 'published', limit: 200 }),
    ]);
    hydrateAnalyticsMeta();
    await executeAnalyticsWidgets();
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
  window.addEventListener('beforeunload', flushLayoutSave);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushLayoutSave);
  flushLayoutSave();
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
    <div class="mx-auto w-full space-y-4 pb-2" :class="homeWidthClass">
      <header ref="customizeAnchorRef" class="flex items-start justify-between gap-4">
        <h1 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
          {{ greetingTitle }}
        </h1>
        <div v-if="!pageLoading && !customizeMode" class="flex shrink-0 items-center gap-2">
          <button
            v-if="canSaveDefaultLayout"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:bg-neutral-800/55 dark:text-neutral-200 dark:hover:bg-neutral-800"
            :disabled="savingDefaultLayout || layoutSaving"
            @click="handleSaveDefaultLayout"
          >
            {{ savingDefaultLayout ? t('states.saving') : t('platform.platformHomeSaveDefaultView') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800/55 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="handleEnterCustomize"
          >
            <AdjustmentsHorizontalIcon class="h-4 w-4" />
            {{ t('platform.platformHomeCustomizeHome') }}
          </button>
        </div>
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
        <PlatformHomeGrid
          ref="platformHomeGridRef"
          :items="layout.items"
          :customize-mode="customizeMode"
          @update:items="handleLayoutUpdate"
        >
          <template #cell="{ item }">
            <PlatformHomeWidgetShell
              :item="item"
              :show-drag-handle="!customizeMode"
            >
              <PlatformHomeIntentBar
                v-if="item.type === 'intent-bar'"
              />

              <PlatformHomeTodayBrief
                v-else-if="item.type === 'today-brief'"
                :focus-text="focusSubtitle"
                :signals="briefSignals"
                @signal-select="handleSignalSelect"
              />

              <div
                v-else-if="item.type === 'alerts'"
                :class="['flex h-full flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
              >
                <PlatformHomeWidgetHeader
                  :title="t('platform.platformHomeWidgetAlerts')"
                  divider
                />
                <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
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
                <p
                  v-if="alerts.length === 0"
                  class="px-4 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {{ t('platform.platformHomeWidgetAlertsEmpty') }}
                </p>
                </div>
              </div>

              <PlatformHomeSection
                v-else-if="item.type === 'apps'"
                analytics-id="apps"
                :title="t('platform.platformHomeYourApps')"
              >
                <div
                  v-if="displayApps.length > 0"
                  class="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <PlatformHomeAppPill
                    v-for="app in displayApps"
                    :key="app.appKey"
                    :app="app"
                    @open="openApp"
                  />
                </div>
                <p v-else class="py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('platform.platformHomeWidgetAppsEmpty') }}
                </p>
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

              <section
                v-else-if="item.type === 'up-next'"
                :class="['flex h-full flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
              >
                <PlatformHomeWidgetHeader
                  :title="t('platform.platformHomeUpNext')"
                  divider
                >
                  <template #actions>
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
                  </template>
                </PlatformHomeWidgetHeader>

                <div v-if="homeError && !hasUpNextItems" class="px-5 py-6">
                  <p class="text-sm text-danger-600 dark:text-danger-400">{{ homeError }}</p>
                </div>

                <div v-else-if="!hasUpNextItems" class="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
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
                    'flex min-h-0 flex-1 flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
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
                    v-for="approvalItem in approvalsPreview"
                    :key="`approval-${approvalItem.id}`"
                    class="px-1.5"
                    :item="approvalItem"
                    :processing-id="approvalProcessingId"
                    :processing-action="approvalProcessingAction"
                    @select="handleApprovalSelect"
                    @approve="handleApprovalApprove"
                    @reject="handleApprovalReject"
                  />

                  <button
                    v-for="docItem in documentsPreview"
                    :key="`document-${docItem.id}`"
                    type="button"
                    class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    @click="handleQueueSelect(docItem)"
                  >
                    <span class="flex-1">
                      <span class="block truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {{ docItem.title }}
                      </span>
                      <span v-if="docItem.subtitle" class="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {{ docItem.subtitle }}
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
                    v-for="attentionItem in attentionItems"
                    :key="attentionItem.id"
                    class="px-1.5"
                    :item="attentionItem"
                    :show-divider="false"
                    compact
                    @select="handleAttentionSelect"
                    @complete="handleAttentionComplete"
                  />
                </div>
              </section>

              <section
                v-else-if="item.type === 'recent-work'"
                :class="['flex h-full flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
              >
                <PlatformHomeWidgetHeader
                  :title="t('platform.platformHomeRecentWork')"
                  divider
                />

                <div v-if="resumeItems.length === 0" class="flex flex-1 items-center justify-center px-5 py-8 text-center">
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ t('platform.platformHomeTasksEventsAndAlertsFromYour') }}
                  </p>
                </div>

                <div
                  v-else
                  :class="[
                    'flex min-h-0 flex-1 flex-col px-1.5 py-0.5',
                    PLATFORM_HOME_LIST_SCROLL_CLASS
                  ]"
                >
                  <PlatformHomeRecentRow
                    v-for="resumeItem in resumeItems"
                    :key="`${resumeItem.moduleKey}-${resumeItem.id}`"
                    :item="resumeItem"
                    @select="handleResumeSelect"
                  />
                </div>
              </section>

              <PlatformHomeInboxCard
                v-else-if="item.type === 'inbox'"
                :notification-preview="notificationsPreview"
                :mail-preview="mailPreview"
                :notifications-unread="notificationsUnread"
                :unread-mail="unreadMail"
                @open-notifications="goToNotifications"
                @open-inbox="goToInbox"
                @select-notification="handleNotificationSelect"
                @select-mail="handleMailSelect"
              />

              <DashboardWidgetCell
                v-else-if="item.type === 'analytics'"
                surface="platform-home"
                :title="widgetCellTitle(item)"
                :chart-type="widgetCellChartType(item)"
                :payload="analyticsPayload(item)"
                :theme-mode="themeMode"
                :loading="analyticsExecuting"
                :show-remove="false"
              />
            </PlatformHomeWidgetShell>
          </template>
        </PlatformHomeGrid>

        <div
          v-if="!showMainContent"
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

    <Teleport v-if="workspaceDrawerHostReady" :to="workspaceDrawerHost">
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <PlatformHomeCustomizePanel
          v-if="customizeMode"
          :layout-items="layout.items"
          :width-mode="layout.widthMode ?? 'wide'"
          :palette-widgets="paletteWidgets"
          :inset-style="drawerInsetStyle"
          :saving="layoutSaving"
          @close="handleCustomizeCancel"
          @cancel="handleCustomizeCancel"
          @save="handleCustomizeDone"
          @toggle-builtin="handleToggleBuiltin"
          @add-analytics="handleAddAnalyticsWidget"
          @remove-analytics="handleRemoveAnalyticsWidget"
          @update-width-mode="handleWidthModeUpdate"
        />
      </Transition>
    </Teleport>

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
