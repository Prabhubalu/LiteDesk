/**
 * Singleton notification realtime layer: SSE for all entitled apps + polling fallback.
 * Mounted once from App.vue so bell components do not fight over connections.
 */

import { ref } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import { useAuthStore } from '@/stores/authRegistry';
import { connectNotificationStream, disconnectAllStreams } from '@/composables/useNotificationStream';
import { getNotificationStreamAppKeysForUser } from '@/utils/notificationStreamAppKeys';

const POLL_INTERVAL_MS = 30_000;
const VISIBILITY_STALE_MS = 45_000;

export const notificationStreamConnected = ref(false);
let started = false;
let pollTimer = null;
let visibilityHandler = null;
let lastRealtimeAt = 0;
const disconnectByAppKey = new Map();

function markRealtimeActivity() {
  lastRealtimeAt = Date.now();
  notificationStreamConnected.value = true;
}

function syncConnections(appKeys, onNotification, authStore) {
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
      onConnected: markRealtimeActivity
    });
    disconnectByAppKey.set(appKey, disconnect);
  }
}

async function pollUnreadFallback(store) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  const stale = Date.now() - lastRealtimeAt > VISIBILITY_STALE_MS;
  if (!stale && notificationStreamConnected.value) {
    return;
  }
  await store.fetchUnreadPreview({ force: true });
}

/**
 * Start realtime notifications for the authenticated user.
 */
export function startNotificationRealtime() {
  if (started || typeof window === 'undefined') return;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.user?.token) return;

  started = true;
  const store = useNotificationStore();

  const onNotification = (notification) => {
    markRealtimeActivity();
    store.handleIncomingNotification(notification);
    window.dispatchEvent(
      new CustomEvent('arivu:notification-received', { detail: notification })
    );
  };

  const refreshStreams = () => {
    if (!authStore.isAuthenticated || !authStore.user?.token) return;
    const appKeys = getNotificationStreamAppKeysForUser(authStore.user);
    syncConnections(appKeys, onNotification, authStore);
  };

  store.primeUnreadPreviewFromCache();
  store.fetchUnreadPreview({ force: true });
  refreshStreams();
  markRealtimeActivity();

  pollTimer = window.setInterval(() => {
    pollUnreadFallback(store);
  }, POLL_INTERVAL_MS);

  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return;
    lastRealtimeAt = 0;
    refreshStreams();
    store.fetchUnreadPreview({ force: true });
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  window.addEventListener('online', refreshStreams);
}

/**
 * Stop streams and polling (logout).
 */
export function stopNotificationRealtime() {
  if (!started && disconnectByAppKey.size === 0) return;
  started = false;
  notificationStreamConnected.value = false;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
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
  if (!started) return;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    stopNotificationRealtime();
    return;
  }
  const store = useNotificationStore();
  const onNotification = (notification) => {
    markRealtimeActivity();
    store.handleIncomingNotification(notification);
    window.dispatchEvent(
      new CustomEvent('arivu:notification-received', { detail: notification })
    );
  };
  syncConnections(getNotificationStreamAppKeysForUser(authStore.user), onNotification, authStore);
}
