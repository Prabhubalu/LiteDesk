import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_POLL_MS,
  PRESENCE_STALE_MS,
  isRecordPresenceSupported,
} from '@/utils/recordPresence';

function resolveValue(source) {
  return typeof source === 'function' ? source() : source;
}

function isSessionFresh(session, now = Date.now()) {
  const lastSeen = session?.lastSeenAt;
  if (!lastSeen) return true;
  const parsed = new Date(lastSeen).getTime();
  if (Number.isNaN(parsed)) return true;
  return now - parsed <= PRESENCE_STALE_MS;
}

function buildPresencePath(moduleKey, recordId) {
  const mk = encodeURIComponent(String(moduleKey || '').trim().toLowerCase());
  const id = encodeURIComponent(String(recordId || '').trim());
  return `/modules/${mk}/records/${id}/presence`;
}

export function useRecordPresence(getModuleKey, getRecordId, getActivityType = () => 'viewing') {
  const route = useRoute();
  const authStore = useAuthStore();

  const sessions = ref([]);
  let heartbeatTimer = null;
  let pollTimer = null;
  let refreshInFlight = false;
  let trackedModuleKey = '';
  let trackedRecordId = '';

  const currentUserId = computed(() => String(authStore.user?._id || authStore.user?.id || ''));

  const activeSessions = computed(() =>
    sessions.value.filter((session) => session?.userId && isSessionFresh(session))
  );

  const otherSessions = computed(() =>
    activeSessions.value.filter((session) => {
      const user = session?.userId;
      const userId = typeof user === 'object' ? String(user._id || '') : String(user || '');
      return userId && userId !== currentUserId.value;
    })
  );

  function isRouteShowingRecord(moduleKey, recordId) {
    const id = String(recordId || '').trim();
    const mk = String(moduleKey || '').trim().toLowerCase();
    if (!id || !mk) return false;
    const paramId = route.params?.id ?? route.params?.recordId;
    if (paramId && String(paramId) === id) return true;
    return route.path.includes(`/${id}`);
  }

  const presenceAuthOpts = { skipAuthLogout: true };

  async function fetchRecordPresence(moduleKey, recordId) {
    const response = await apiClient.getOptional(buildPresencePath(moduleKey, recordId), presenceAuthOpts);
    if (response?.success) return response.data || [];
    return [];
  }

  async function heartbeatRecordPresence(moduleKey, recordId, activityType) {
    const response = await apiClient.postOptional(
      buildPresencePath(moduleKey, recordId) + '/heartbeat',
      { activityType },
      presenceAuthOpts
    );
    if (response?.success) return response.data;
    return null;
  }

  async function clearRecordPresence(moduleKey, recordId) {
    return apiClient.delete(buildPresencePath(moduleKey, recordId), presenceAuthOpts);
  }

  async function refreshPresence() {
    const moduleKey = trackedModuleKey || resolveValue(getModuleKey);
    const recordId = trackedRecordId || resolveValue(getRecordId);
    if (!moduleKey || !recordId) {
      sessions.value = [];
      return;
    }
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const data = await fetchRecordPresence(moduleKey, recordId);
      sessions.value = Array.isArray(data) ? data : [];
    } catch {
      sessions.value = [];
    } finally {
      refreshInFlight = false;
    }
  }

  async function sendHeartbeat() {
    const moduleKey = trackedModuleKey || resolveValue(getModuleKey);
    const recordId = trackedRecordId || resolveValue(getRecordId);
    if (!moduleKey || !recordId) return;
    const activityType = resolveValue(getActivityType) || 'viewing';
    try {
      await heartbeatRecordPresence(moduleKey, recordId, activityType);
      await refreshPresence();
    } catch {
      /* best-effort */
    }
  }

  async function leavePresence(moduleKey, recordId) {
    const mk = String(moduleKey || '').trim();
    const id = String(recordId || '').trim();
    if (!mk || !id) return;
    try {
      await clearRecordPresence(mk, id);
    } catch {
      /* best-effort */
    }
  }

  function leavePresenceKeepalive(moduleKey, recordId) {
    const mk = String(moduleKey || '').trim().toLowerCase();
    const id = String(recordId || '').trim();
    if (!mk || !id || typeof fetch === 'undefined') return;
    const token = authStore.user?.token;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    void fetch(getApiUrlForFetch(`/api${buildPresencePath(mk, id)}`), {
      method: 'DELETE',
      headers,
      keepalive: true
    });
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    if (!trackedRecordId) return;
    void sendHeartbeat();
    void refreshPresence();
  }

  function handlePageHide() {
    if (trackedModuleKey && trackedRecordId) {
      leavePresenceKeepalive(trackedModuleKey, trackedRecordId);
    }
  }

  function stopPresenceTracking({ leave = false } = {}) {
    const moduleKey = trackedModuleKey;
    const recordId = trackedRecordId;
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pagehide', handlePageHide);
    }
    if (leave && moduleKey && recordId) {
      leavePresenceKeepalive(moduleKey, recordId);
      void leavePresence(moduleKey, recordId);
    }
    trackedModuleKey = '';
    trackedRecordId = '';
  }

  function startPresenceTracking() {
    stopPresenceTracking({ leave: false });
    const moduleKey = String(resolveValue(getModuleKey) || '').trim().toLowerCase();
    const recordId = String(resolveValue(getRecordId) || '').trim();
    if (!isRecordPresenceSupported(moduleKey)) {
      sessions.value = [];
      return;
    }
    if (!moduleKey || !recordId || !isRouteShowingRecord(moduleKey, recordId)) {
      sessions.value = [];
      return;
    }

    trackedModuleKey = moduleKey;
    trackedRecordId = recordId;

    void refreshPresence();
    void sendHeartbeat();

    pollTimer = window.setInterval(() => {
      void refreshPresence();
    }, PRESENCE_POLL_MS);

    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, PRESENCE_HEARTBEAT_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('pagehide', handlePageHide);
    }
  }

  function leaveTrackedRecord() {
    const moduleKey = trackedModuleKey || resolveValue(getModuleKey);
    const recordId = trackedRecordId || resolveValue(getRecordId);
    sessions.value = [];
    stopPresenceTracking({ leave: Boolean(moduleKey && recordId) });
  }

  watch(
    () => [resolveValue(getModuleKey), resolveValue(getRecordId)],
    (value, oldValue) => {
      const moduleKey = value?.[0];
      const recordId = value?.[1];
      const previousModuleKey = oldValue?.[0];
      const previousRecordId = oldValue?.[1];
      if (!moduleKey || !recordId || !isRecordPresenceSupported(moduleKey)) {
        leaveTrackedRecord();
        return;
      }
      if (previousRecordId && previousModuleKey
        && (previousRecordId !== recordId || previousModuleKey !== moduleKey)) {
        void leavePresence(previousModuleKey, previousRecordId);
      }
      if (isRouteShowingRecord(moduleKey, recordId)) {
        startPresenceTracking();
      } else {
        leaveTrackedRecord();
      }
    },
    { immediate: true }
  );

  watch(
    () => resolveValue(getActivityType),
    () => {
      if (trackedRecordId) void sendHeartbeat();
    }
  );

  watch(
    () => route.fullPath,
    () => {
      if (!trackedRecordId || !trackedModuleKey) return;
      if (!isRouteShowingRecord(trackedModuleKey, trackedRecordId)) {
        leaveTrackedRecord();
      }
    }
  );

  onDeactivated(() => {
    leaveTrackedRecord();
  });

  onActivated(() => {
    const moduleKey = resolveValue(getModuleKey);
    const recordId = resolveValue(getRecordId);
    if (moduleKey && recordId && isRouteShowingRecord(moduleKey, recordId)) {
      startPresenceTracking();
    }
  });

  onUnmounted(() => {
    leaveTrackedRecord();
  });

  return {
    sessions,
    activeSessions,
    otherSessions,
    refreshPresence
  };
}
