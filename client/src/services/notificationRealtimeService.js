/**
 * Singleton notification realtime layer: SSE for all entitled apps + polling fallback.
 * Mounted once from App.vue so bell components do not fight over connections.
 */

import { ref } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import { useAuthStore } from '@/stores/authRegistry';
import { connectNotificationStream, disconnectAllStreams } from '@/composables/useNotificationStream';
import { getNotificationStreamAppKeysForUser } from '@/utils/notificationStreamAppKeys';
import { resolveNotificationAppKeyFromPath } from '@/utils/notificationAppKey';

/** Fallback poll only when SSE is down — keep well under general API rate limits. */
const POLL_INTERVAL_MS = 60_000;
const HELPDESK_POLL_INTERVAL_MS = 45_000;
const SSE_HEALTH_MS = 45_000;
const SYNC_ON_CONNECT_MIN_GAP_MS = 60_000;

export const notificationStreamConnected = ref(false);
let started = false;
let pollTimer = null;
let visibilityHandler = null;
let onlineHandler = null;
let lastPollAt = 0;
let lastSseActivityAt = 0;
let lastSyncOnConnectAt = 0;
let pollInFlight = null;
const disconnectByAppKey = new Map();
const connectedAppKeys = new Set();

function refreshStreamConnectedFlag() {
  notificationStreamConnected.value = connectedAppKeys.size > 0;
}

function markSseActivity(appKey) {
  lastSseActivityAt = Date.now();
  if (appKey) connectedAppKeys.add(appKey);
  refreshStreamConnectedFlag();
}

function markSseDisconnected(appKey) {
  if (appKey) connectedAppKeys.delete(appKey);
  refreshStreamConnectedFlag();
}

function isSseHealthy() {
  return lastSseActivityAt > 0 && Date.now() - lastSseActivityAt < SSE_HEALTH_MS;
}

function syncConnections(appKeys, onNotification, authStore, store) {
  const desired = new Set(appKeys);
  for (const [appKey, disconnect] of [...disconnectByAppKey.entries()]) {
    if (!desired.has(appKey)) {
      disconnect();
      disconnectByAppKey.delete(appKey);
      markSseDisconnected(appKey);
    }
  }
  for (const appKey of desired) {
    if (disconnectByAppKey.has(appKey)) continue;
    const disconnect = connectNotificationStream(appKey, onNotification, {
      authStore,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      onConnected: () => {
        markSseActivity(appKey);
        const now = Date.now();
        if (now - lastSyncOnConnectAt >= SYNC_ON_CONNECT_MIN_GAP_MS) {
          lastSyncOnConnectAt = now;
          store.syncIncomingNotificationsFromServer({
            sinceMs: now - 15_000,
            appKeys: [appKey]
          });
          lastPollAt = now;
        }
      },
      onHeartbeat: () => markSseActivity(appKey),
      onDisconnected: () => markSseDisconnected(appKey)
    });
    disconnectByAppKey.set(appKey, disconnect);
  }
}

async function pollForNewNotifications(store) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  if (store.isNotificationApiBackedOff?.()) {
    return;
  }
  if (isSseHealthy()) {
    return;
  }
  if (pollInFlight) {
    return pollInFlight;
  }

  const appKey = resolveNotificationAppKeyFromPath();
  const sinceMs = (lastPollAt || Date.now()) - 15_000;
  lastPollAt = Date.now();

  pollInFlight = store
    .syncIncomingNotificationsFromServer({ sinceMs, appKeys: [appKey] })
    .finally(() => {
      pollInFlight = null;
    });

  return pollInFlight;
}

function getPollIntervalMs() {
  if (typeof window === 'undefined') return POLL_INTERVAL_MS;
  if (window.location.pathname.startsWith('/helpdesk/')) return HELPDESK_POLL_INTERVAL_MS;
  return POLL_INTERVAL_MS;
}

function schedulePoll(store) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    pollForNewNotifications(store);
  }, getPollIntervalMs());
}

/**
 * Start realtime notifications for the authenticated user.
 */
export function startNotificationRealtime() {
  if (typeof window === 'undefined') return;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.user?.token) return;

  const store = useNotificationStore();

  if (started) {
    refreshNotificationRealtimeConnections();
    return;
  }

  started = true;
  store.beginRealtimeAlertSession();
  lastPollAt = Date.now();
  lastSseActivityAt = 0;
  lastSyncOnConnectAt = 0;
  connectedAppKeys.clear();
  notificationStreamConnected.value = false;

  const onNotification = (notification) => {
    const appKey = notification?.appKey || 'HELPDESK';
    markSseActivity(appKey);
    store.handleIncomingNotification(notification);
    lastPollAt = Date.now();
    window.dispatchEvent(
      new CustomEvent('arivu:notification-received', { detail: notification })
    );
  };

  const refreshStreams = () => {
    if (!authStore.isAuthenticated || !authStore.user?.token) return;
    const appKeys = getNotificationStreamAppKeysForUser(authStore.user);
    syncConnections(appKeys, onNotification, authStore, store);
  };

  store.primeUnreadPreviewFromCache();
  store.fetchUnreadPreview();
  refreshStreams();
  if (!isSseHealthy()) {
    pollForNewNotifications(store);
  }
  schedulePoll(store);

  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return;
    refreshStreams();
    if (!isSseHealthy()) {
      pollForNewNotifications(store);
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  onlineHandler = () => refreshStreams();
  window.addEventListener('online', onlineHandler);
}

/**
 * Stop streams and polling (logout).
 */
export function stopNotificationRealtime() {
  if (!started && disconnectByAppKey.size === 0) return;
  started = false;
  connectedAppKeys.clear();
  notificationStreamConnected.value = false;
  lastPollAt = 0;
  lastSseActivityAt = 0;
  lastSyncOnConnectAt = 0;
  pollInFlight = null;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }

  for (const disconnect of disconnectByAppKey.values()) {
    disconnect();
  }
  disconnectByAppKey.clear();
  disconnectAllStreams();
}

/**
 * Reconcile SSE connections after profile / allowedApps change.
 */
export function refreshNotificationRealtimeConnections() {
  if (!started) {
    startNotificationRealtime();
    return;
  }
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    stopNotificationRealtime();
    return;
  }
  const store = useNotificationStore();
  const onNotification = (notification) => {
    const appKey = notification?.appKey || 'HELPDESK';
    markSseActivity(appKey);
    store.handleIncomingNotification(notification);
    lastPollAt = Date.now();
    window.dispatchEvent(
      new CustomEvent('arivu:notification-received', { detail: notification })
    );
  };
  syncConnections(
    getNotificationStreamAppKeysForUser(authStore.user),
    onNotification,
    authStore,
    store
  );
}

/** Reconcile poll interval when route changes (helpdesk vs sales). */
export function onNotificationRouteChange() {
  if (!started) return;
  const store = useNotificationStore();
  schedulePoll(store);
}
