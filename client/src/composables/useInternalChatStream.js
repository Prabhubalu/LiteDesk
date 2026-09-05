/**
 * Singleton SSE for internal chat realtime.
 * Kept alive while entitled so open DMs do not wait on a view-scoped socket
 * (toasts already arrive via the global notification stream).
 */

import { getApiUrlForEventSource } from '@/config/apiBase';
import { INTERNAL_CHAT_SSE_EVENT } from '@/utils/internalChatConstants';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 20;
const TOKEN_RETRY_DELAY = 1500;

const listeners = new Set();
let eventSource = null;
let reconnectTimer = null;
let attemptCount = 0;
let stopped = true;
let getTokenFn = null;
let onConnectedFn = null;
let onDisconnectedFn = null;
let live = false;

function getReconnectDelay(attempt) {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * 2 ** attempt, MAX_RECONNECT_DELAY);
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

function emitToListeners(data) {
  for (const fn of listeners) {
    try {
      fn(data);
    } catch (err) {
      console.error('[internalChatStream] listener error', err);
    }
  }
}

function closeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function scheduleReconnect(delayMs) {
  if (stopped) return;
  if (reconnectTimer) return;
  const delay = delayMs != null
    ? delayMs
    : (attemptCount >= MAX_RECONNECT_ATTEMPTS
      ? MAX_RECONNECT_DELAY
      : getReconnectDelay(attemptCount));
  if (delayMs == null) attemptCount += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (stopped) return;
  const token = getTokenFn?.();
  if (!token) {
    scheduleReconnect(TOKEN_RETRY_DELAY);
    return;
  }

  closeConnection();

  const url = getApiUrlForEventSource(
    `/api/internal-chat/stream?token=${encodeURIComponent(token)}`
  );

  try {
    eventSource = new EventSource(url, { withCredentials: true });

    eventSource.addEventListener('connected', () => {
      attemptCount = 0;
      live = true;
      onConnectedFn?.();
    });

    eventSource.addEventListener(INTERNAL_CHAT_SSE_EVENT, (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        emitToListeners(data);
      } catch {
        /* ignore malformed */
      }
    });

    eventSource.addEventListener('ping', () => {
      attemptCount = 0;
      live = true;
    });

    eventSource.onerror = () => {
      live = false;
      closeConnection();
      onDisconnectedFn?.();
      scheduleReconnect();
    };
  } catch (err) {
    console.error('[internalChatStream] Failed to create EventSource', err);
    live = false;
    onDisconnectedFn?.();
    scheduleReconnect();
  }
}

/**
 * Start/keep the shared chat SSE connection.
 * @param {object} options
 * @param {() => string|null|undefined} options.getToken
 * @param {() => void} [options.onConnected]
 * @param {() => void} [options.onDisconnected]
 */
export function startInternalChatStream(options = {}) {
  getTokenFn = options.getToken || getTokenFn;
  if (options.onConnected) onConnectedFn = options.onConnected;
  if (options.onDisconnected) onDisconnectedFn = options.onDisconnected;
  stopped = false;
  if (!eventSource && !reconnectTimer) {
    connect();
  }
  return {
    connect,
    disconnect: stopInternalChatStream,
    isLive: () => live,
  };
}

export function stopInternalChatStream() {
  stopped = true;
  live = false;
  closeConnection();
  onDisconnectedFn?.();
}

/**
 * @param {(event: object) => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribeInternalChatStream(handler) {
  if (typeof handler !== 'function') return () => {};
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export function isInternalChatStreamLive() {
  return live;
}

/**
 * Back-compat for views: subscribe + ensure stream is running.
 * Disconnect only unsubscribes this view (singleton stays up for other listeners).
 * @param {object} options
 * @param {() => string|null|undefined} options.getToken
 * @param {(event: object) => void} [options.onEvent]
 * @param {() => void} [options.onConnected]
 * @param {() => void} [options.onDisconnected]
 */
export function createInternalChatStream(options = {}) {
  const { getToken, onEvent, onConnected, onDisconnected } = options;
  let unsub = null;

  return {
    connect() {
      startInternalChatStream({
        getToken,
        onConnected,
        onDisconnected,
      });
      if (onEvent && !unsub) {
        unsub = subscribeInternalChatStream(onEvent);
      }
    },
    disconnect() {
      if (unsub) {
        unsub();
        unsub = null;
      }
      // Do not tear down the singleton — GlobalSurfaces / other tabs may still need it.
    },
  };
}
