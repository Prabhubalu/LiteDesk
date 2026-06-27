import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { useOnboarding } from '@/composables/useOnboarding';
import { useNotifications } from '@/composables/useNotifications';
import * as releaseNotesApi from '@/utils/releaseNotesApi';
import { shouldBlockReleaseNotesAutoSurface } from '@/utils/releaseNoteDeferral';
import { prefersReducedMotion } from '@/utils/releaseNoteMotion';
import {
  captureReleaseDismissed,
  captureReleaseOpened,
  captureReleaseSnoozed,
  captureReleaseViewed
} from '@/config/posthogReleaseNotes';

const unseenReleases = ref([]);
const surface = ref('badge_only');
const combinedImportance = ref('patch');
const badgeCount = ref(0);
const highestImportance = ref('patch');
const whatsNewModalOpen = ref(false);
const whatsNewDrawerOpen = ref(false);
const centerOpen = ref(false);
const loading = ref(false);
const historyReleases = ref([]);
const historyPagination = ref(null);
const historyLoading = ref(false);
const historyError = ref(false);
const error = ref(null);

let initPromise = null;
let deferTimer = null;
let autoSurfacePresented = false;
let userDismissedAutoSurface = false;
let surfaceTimerPending = false;
const presentedReleaseIds = new Set();
/** Coalesce concurrent unseen fetches (initializeIfReady + refreshOnFocus on first nav). */
let fetchUnseenInflight = null;
let unseenFetchedAt = 0;
const UNSEEN_FETCH_TTL_MS = 10_000;

function clearDeferTimer() {
  if (deferTimer) {
    clearTimeout(deferTimer);
    deferTimer = null;
  }
}

function applyUnseenPayload(data) {
  const nextReleases = data?.releases || [];
  const hasNewRelease = nextReleases.some((release) => !presentedReleaseIds.has(release.id));
  if (hasNewRelease && nextReleases.length) {
    autoSurfacePresented = false;
  }

  unseenReleases.value = nextReleases;
  surface.value = data?.surface || 'badge_only';
  combinedImportance.value = data?.combinedImportance || 'patch';
  badgeCount.value = unseenReleases.value.length;
  highestImportance.value = combinedImportance.value;
}

function markAutoSurfacePresented() {
  autoSurfacePresented = true;
  for (const release of unseenReleases.value) {
    presentedReleaseIds.add(release.id);
  }
}

function markUserDismissedAutoSurface() {
  userDismissedAutoSurface = true;
  markAutoSurfacePresented();
}

function scheduleAutoSurface() {
  if (userDismissedAutoSurface || autoSurfacePresented || !unseenReleases.value.length) return;
  const currentSurface = surface.value;
  if (currentSurface === 'badge_only') return;
  if (whatsNewModalOpen.value || whatsNewDrawerOpen.value || centerOpen.value) return;
  if (surfaceTimerPending) return;

  surfaceTimerPending = true;
  const delayMs = prefersReducedMotion() ? 0 : 1500;
  clearDeferTimer();
  deferTimer = setTimeout(() => {
    surfaceTimerPending = false;
    deferTimer = null;
    if (userDismissedAutoSurface || autoSurfacePresented || !unseenReleases.value.length) return;
    if (whatsNewModalOpen.value || whatsNewDrawerOpen.value || centerOpen.value) return;

    if (surface.value === 'modal') {
      markAutoSurfacePresented();
      whatsNewModalOpen.value = true;
      captureReleaseOpened({ source: 'auto_modal', release_count: unseenReleases.value.length });
    } else if (surface.value === 'drawer') {
      markAutoSurfacePresented();
      whatsNewDrawerOpen.value = true;
      captureReleaseOpened({ source: 'auto_drawer', release_count: unseenReleases.value.length });
    }
  }, delayMs);
}

/**
 * Global release notes state (mounted in GlobalSurfacesProvider).
 */
export function useReleaseNotes() {
  const authStore = useAuthStore();
  const appShellStore = useAppShellStore();
  const route = useRoute();
  const { t } = useI18n();
  const { error: notifyError } = useNotifications();
  const { fetchOnboarding, state: onboardingState } = useOnboarding();

  const showHelpBadge = computed(() => badgeCount.value > 0);

  const releaseIds = computed(() => unseenReleases.value.map((release) => release.id));

  function isAutoSurfaceBlocked() {
    return shouldBlockReleaseNotesAutoSurface({
      routePath: route.path
    });
  }

  function maybeScheduleAutoSurface() {
    if (!authStore.isAuthenticated || isAutoSurfaceBlocked()) return;
    scheduleAutoSurface();
  }

  function notifyActionFailed() {
    notifyError(t('releaseNotes.actionFailed'));
  }

  async function fetchUnseen(options = {}) {
    if (!authStore.isAuthenticated) return;
    const force = options.force === true;
    if (
      !force
      && unseenFetchedAt
      && Date.now() - unseenFetchedAt < UNSEEN_FETCH_TTL_MS
    ) {
      return;
    }
    if (fetchUnseenInflight) {
      return fetchUnseenInflight;
    }

    const run = async () => {
      loading.value = true;
      error.value = null;
      try {
        const response = await releaseNotesApi.getUnseen();
        if (response?.success) {
          applyUnseenPayload(response.data);
        }
        unseenFetchedAt = Date.now();
      } catch (err) {
        console.error('[useReleaseNotes] fetchUnseen failed:', err);
        error.value = 'load_failed';
      } finally {
        loading.value = false;
      }
    };

    fetchUnseenInflight = run().finally(() => {
      fetchUnseenInflight = null;
    });
    return fetchUnseenInflight;
  }

  async function fetchBadge() {
    if (!authStore.isAuthenticated) return;
    try {
      const response = await releaseNotesApi.getBadge();
      if (response?.success) {
        badgeCount.value = response.data?.count || 0;
        highestImportance.value = response.data?.highestImportance || 'patch';
      }
    } catch (err) {
      console.error('[useReleaseNotes] fetchBadge failed:', err);
    }
  }

  async function fetchHistory({ page = 1, limit = 20 } = {}) {
    historyLoading.value = true;
    historyError.value = false;
    try {
      const response = await releaseNotesApi.getHistory({ page, limit });
      if (response?.success) {
        historyReleases.value = response.data?.releases || [];
        historyPagination.value = response.data?.pagination || null;
      } else {
        historyError.value = true;
      }
    } catch (err) {
      console.error('[useReleaseNotes] fetchHistory failed:', err);
      historyError.value = true;
    } finally {
      historyLoading.value = false;
    }
  }

  async function markAllViewed(source) {
    const ids = releaseIds.value;
    if (!ids.length) return false;
    try {
      await releaseNotesApi.markViewedBatch(ids, source);
      for (const release of unseenReleases.value) {
        captureReleaseViewed(release.id, {
          release_version: release.version,
          importance: release.importance,
          source,
          release_count: ids.length
        });
      }
      captureReleaseDismissed(ids, {
        importance: combinedImportance.value,
        combined_importance: combinedImportance.value,
        source
      });
      unseenReleases.value = [];
      badgeCount.value = 0;
      markUserDismissedAutoSurface();
      await fetchBadge();
      return true;
    } catch (err) {
      console.error('[useReleaseNotes] markAllViewed failed:', err);
      notifyActionFailed();
      return false;
    }
  }

  async function dismissModal() {
    const ok = await markAllViewed('auto_modal');
    if (ok) whatsNewModalOpen.value = false;
  }

  async function dismissDrawer() {
    const ok = await markAllViewed('drawer');
    if (ok) whatsNewDrawerOpen.value = false;
  }

  async function remindLater(source = 'auto_modal') {
    try {
      await releaseNotesApi.snooze(24);
      captureReleaseSnoozed({
        hours: 24,
        release_count: unseenReleases.value.length,
        source
      });
      whatsNewModalOpen.value = false;
      whatsNewDrawerOpen.value = false;
      unseenReleases.value = [];
      badgeCount.value = 0;
      markUserDismissedAutoSurface();
      await fetchBadge();
      return true;
    } catch (err) {
      console.error('[useReleaseNotes] remindLater failed:', err);
      notifyActionFailed();
      return false;
    }
  }

  function openCenter(source = 'help_menu') {
    centerOpen.value = true;
    captureReleaseOpened({ source, release_count: badgeCount.value });
    void fetchHistory();
  }

  async function closeCenter(markSeen = false) {
    if (markSeen && releaseIds.value.length) {
      await markAllViewed('help_center');
    }
    centerOpen.value = false;
  }

  async function initializeIfReady() {
    if (!authStore.isAuthenticated) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!appShellStore.isLoaded) {
        await appShellStore.loadUIMetadata();
      }
      await fetchOnboarding();
      await fetchUnseen();
      maybeScheduleAutoSurface();
    })().finally(() => {
      initPromise = null;
    });

    return initPromise;
  }

  async function retryAutoSurface() {
    if (!authStore.isAuthenticated || userDismissedAutoSurface) return;
    if (isAutoSurfaceBlocked()) return;
    await fetchUnseen();
    maybeScheduleAutoSurface();
  }

  async function refreshOnFocus() {
    if (!authStore.isAuthenticated) return;
    await fetchBadge();
    if (!whatsNewModalOpen.value && !whatsNewDrawerOpen.value && !centerOpen.value) {
      await fetchUnseen();
      maybeScheduleAutoSurface();
    }
  }

  function resetReleaseNotesState() {
    clearDeferTimer();
    surfaceTimerPending = false;
    autoSurfacePresented = false;
    userDismissedAutoSurface = false;
    presentedReleaseIds.clear();
    fetchUnseenInflight = null;
    unseenFetchedAt = 0;
    unseenReleases.value = [];
    surface.value = 'badge_only';
    combinedImportance.value = 'patch';
    badgeCount.value = 0;
    highestImportance.value = 'patch';
    whatsNewModalOpen.value = false;
    whatsNewDrawerOpen.value = false;
    centerOpen.value = false;
    historyReleases.value = [];
    historyPagination.value = null;
    historyError.value = false;
    error.value = null;
  }

  return {
    unseenReleases,
    surface,
    combinedImportance,
    badgeCount,
    highestImportance,
    showHelpBadge,
    whatsNewModalOpen,
    whatsNewDrawerOpen,
    centerOpen,
    loading,
    historyReleases,
    historyPagination,
    historyLoading,
    historyError,
    error,
    releaseIds,
    fetchUnseen,
    fetchBadge,
    fetchHistory,
    markAllViewed,
    dismissModal,
    dismissDrawer,
    remindLater,
    openCenter,
    closeCenter,
    initializeIfReady,
    retryAutoSurface,
    refreshOnFocus,
    resetReleaseNotesState,
    maybeScheduleAutoSurface,
    prefersReducedMotion,
    isAutoSurfaceBlocked
  };
}
