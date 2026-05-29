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

const POLL_INTERVAL_MS = 8_000;
const HELPDESK_POLL_INTERVAL_MS = 5_000;

export const notificationStreamConnected = ref(false);
let started = false;
let pollTimer = null;
let visibilityHandler = null;
let onlineHandler = null;
let lastPollAt = 0;
let lastSseActivityAt = 0;
const disconnectByAppKey = new Map();

function markSseActivity() {
  lastSseActivityAt = Date.now();
  notificationStreamConnected.value = true;
}

function markSseDisconnected() {
  notificationStreamConnected.value = false;
}

function syncConnections(appKeys, onNotification, authStore, store) {
  const desired = new Set(appKeys);
  for (const [appKey, disconnect] of [...disconnectByAppKey.entries()]) {
    if (!desired.has(appKey)) {
      disconnect();
      disconnectByAppKey.delete(appKey);
    }
  }
  for (const appKey of desired) {
    if (disconnectByAppKey.has(appKey)) continue;
    const disconnect = connectNotificationStream(appKey, onNotification, {
      authStore,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      onConnected: () => {
        markSseActivity();
        const sinceMs = lastPollAt || Date.now() - 5000;
        store.syncIncomingNotificationsFromServer({ sinceMs, appKeys: [appKey] });
        lastPollAt = Date.now();
      },
      onHeartbeat: markSseActivity,
      onDisconnected: markSseDisconnected
    });
    disconnectByAppKey.set(appKey, disconnect);
  }
}

async function pollForNewNotifications(store) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  const sinceMs = lastPollAt || Date.now() - 3000;
  lastPollAt = Date.now();
  await store.syncIncomingNotificationsFromServer({ sinceMs });
  await store.fetchUnreadPreview({ force: true });
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
    pollForNewNotifications(store);
    return;
  }

  started = true;
  lastPollAt = Date.now();
  lastSseActivityAt = 0;
  notificationStreamConnected.value = false;

  const onNotification = (notification) => {
    markSseActivity();
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
  store.fetchUnreadPreview({ force: true });
  refreshStreams();
  pollForNewNotifications(store);
  schedulePoll(store);

  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return;
    lastPollAt = Date.now() - 3000;
    refreshStreams();
    pollForNewNotifications(store);
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
  notificationStreamConnected.value = false;
  lastPollAt = 0;
  lastSseActivityAt = 0;

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
    markSseActivity();
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

/** Re-run when route changes app context (helpdesk vs sales poll interval). */
export function onNotificationRouteChange() {
  if (!started) return;
  const store = useNotificationStore();
  schedulePoll(store);
  if (resolveNotificationAppKeyFromPath() === 'HELPDESK') {
    pollForNewNotifications(store);
  }
}
