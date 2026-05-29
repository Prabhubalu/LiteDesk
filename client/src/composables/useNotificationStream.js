/**
 * Server-Sent Events (SSE) composable for real-time notification delivery.
 * 
 * Handles:
 * - Connection management per app context
 * - Automatic reconnection with exponential backoff
 * - Message parsing and forwarding to store
 * - Offline detection (Audit app)
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useOffline } from './useOffline';
import { withApiOrigin } from '@/config/apiBase';

const connections = new Map(); // appKey -> EventSource
const reconnectTimers = new Map(); // appKey -> timer
const reconnectAttempts = new Map(); // appKey -> attempt count

const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

/**
 * Get current app key from route
 */
function getCurrentAppKey() {
  const path = window.location.pathname || '';
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  if (path.startsWith('/helpdesk/')) return 'HELPDESK';
  return 'SALES';
}

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay(attempt) {
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

/**
 * Standalone connection function (no lifecycle hooks).
 * Use this when calling from watch callbacks or other non-setup contexts.
 * 
 * @param {string} appKey - 'CRM' | 'AUDIT' | 'PORTAL'
 * @param {Function} onNotification - Callback when notification arrives
 * @param {Object} options - { isOnline, authStore }
 * @returns {Function} Disconnect function
 */
export function connectNotificationStream(appKey, onNotification, options = {}) {
  const authStore = options.authStore || useAuthStore();
  const isOnline = options.isOnline ?? (typeof window !== 'undefined' ? navigator.onLine : true);
  const onConnected = options.onConnected;

  let eventSource = null;
  let reconnectTimer = null;
  let attemptCount = 0;
  let disposed = false;

  function connect() {
    // Don't connect if offline
    if (!isOnline) {
      console.log(`[connectNotificationStream] Skipping connection for ${appKey} (offline)`);
      return;
    }

    // Don't connect if not authenticated
    if (!authStore.isAuthenticated || !authStore.user?.token) {
      console.log(`[connectNotificationStream] Skipping connection for ${appKey} (not authenticated)`);
      return;
    }

    // Close existing connection if any
    disconnect();

    const token = authStore.user?.token;
    if (!token) {
      console.warn(`[connectNotificationStream] No token available for ${appKey}`);
      return;
    }

    const url = withApiOrigin(
      `/api/notifications/stream?appKey=${appKey}&token=${encodeURIComponent(token)}`
    );
    console.log(`[connectNotificationStream] Connecting to ${url}...`);

    try {
      eventSource = new EventSource(url, {
        withCredentials: true
      });

      eventSource.onopen = () => {
        console.log(`[connectNotificationStream] Connected to ${appKey} stream`);
        attemptCount = 0;
        reconnectAttempts.set(appKey, 0);
        onConnected?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle ping/heartbeat
          if (data.timestamp) {
            return;
          }

          // Handle notification
          if (data.id && onNotification) {
            onNotification(data);
          }
        } catch (err) {
          console.error(`[connectNotificationStream] Error parsing message:`, err);
        }
      };

      eventSource.addEventListener('connected', (event) => {
        console.log(`[connectNotificationStream] Stream connected:`, event.data);
      });

      eventSource.addEventListener('ping', () => {
        // Heartbeat received
      });

      eventSource.onerror = (err) => {
        if (disposed) return;
        console.error(`[connectNotificationStream] Stream error for ${appKey}:`, err);

        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        attemptCount = reconnectAttempts.get(appKey) || 0;
        const delay = getReconnectDelay(Math.min(attemptCount, 8));
        reconnectTimer = setTimeout(() => {
          if (disposed) return;
          reconnectAttempts.set(appKey, attemptCount + 1);
          connect();
        }, delay);
        reconnectTimers.set(appKey, reconnectTimer);
      };

      connections.set(appKey, eventSource);
    } catch (err) {
      console.error(`[connectNotificationStream] Failed to create EventSource:`, err);
    }
  }

  function disconnect() {
    disposed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      reconnectTimers.delete(appKey);
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
      connections.delete(appKey);
    }
  }

  connect();

  return disconnect;
}

/**
 * Composable for use in component setup (with lifecycle hooks).
 * 
 * @param {string} appKey - 'CRM' | 'AUDIT' | 'PORTAL'
 * @param {Function} onNotification - Callback when notification arrives
 * @returns {Object} { isConnected, error, connect, disconnect }
 */
export function useNotificationStream(appKey, onNotification) {
  const authStore = useAuthStore();
  const { isOnline } = useOffline();
  const isConnected = ref(false);
  const error = ref(null);

  let eventSource = null;
  let reconnectTimer = null;
  let attemptCount = 0;

  function connect() {
    // Don't connect if offline (especially important for Audit app)
    if (!isOnline.value) {
      console.log(`[useNotificationStream] Skipping connection for ${appKey} (offline)`);
      return;
    }

    // Don't connect if not authenticated
    if (!authStore.isAuthenticated || !authStore.user?.token) {
      console.log(`[useNotificationStream] Skipping connection for ${appKey} (not authenticated)`);
      return;
    }

    // Close existing connection if any
    disconnect();

    const token = authStore.user?.token;
    if (!token) {
      console.warn(`[useNotificationStream] No token available for ${appKey}`);
      return;
    }

    const url = withApiOrigin(
      `/api/notifications/stream?appKey=${appKey}&token=${encodeURIComponent(token)}`
    );
    console.log(`[useNotificationStream] Connecting to ${url}...`);

    try {
      eventSource = new EventSource(url, {
        withCredentials: true
      });

      eventSource.onopen = () => {
        console.log(`[useNotificationStream] Connected to ${appKey} stream`);
        isConnected.value = true;
        error.value = null;
        attemptCount = 0;
        reconnectAttempts.set(appKey, 0);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle ping/heartbeat
          if (data.timestamp) {
            return;
          }

          // Handle notification
          if (data.id && onNotification) {
            onNotification(data);
          }
        } catch (err) {
          console.error(`[useNotificationStream] Error parsing message:`, err);
        }
      };

      eventSource.addEventListener('connected', (event) => {
        console.log(`[useNotificationStream] Stream connected:`, event.data);
      });

      eventSource.addEventListener('ping', () => {
        // Heartbeat received
      });

      eventSource.onerror = (err) => {
        console.error(`[useNotificationStream] Stream error for ${appKey}:`, err);
        isConnected.value = false;
        error.value = 'Connection error';

        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        attemptCount = reconnectAttempts.get(appKey) || 0;
        const delay = getReconnectDelay(Math.min(attemptCount, 8));
        reconnectTimer = setTimeout(() => {
          reconnectAttempts.set(appKey, attemptCount + 1);
          connect();
        }, delay);
        reconnectTimers.set(appKey, reconnectTimer);
      };

      connections.set(appKey, eventSource);
    } catch (err) {
      console.error(`[useNotificationStream] Failed to create EventSource:`, err);
      error.value = err.message;
      isConnected.value = false;
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      reconnectTimers.delete(appKey);
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
      connections.delete(appKey);
      isConnected.value = false;
    }
  }

  // Watch online status - reconnect when coming back online
  watch(isOnline, (online) => {
    if (online && authStore.isAuthenticated) {
      connect();
    } else if (!online) {
      disconnect();
    }
  });

  // Watch auth status - disconnect on logout
  watch(() => authStore.isAuthenticated, (authenticated) => {
    if (!authenticated) {
      disconnect();
    } else if (authenticated && isOnline.value) {
      connect();
    }
  });

  onMounted(() => {
    if (authStore.isAuthenticated && isOnline.value) {
      connect();
    }
  });

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    isConnected,
    error,
    connect,
    disconnect
  };
}

/**
 * Disconnect all streams (for logout, app switch, etc.)
 */
export function disconnectAllStreams() {
  for (const [appKey, eventSource] of connections.entries()) {
    try {
      eventSource.close();
    } catch (err) {
      // Ignore errors during cleanup
    }
  }
  connections.clear();

  for (const timer of reconnectTimers.values()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();
  reconnectAttempts.clear();
}

