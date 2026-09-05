/**
 * SSE for internal chat realtime (P0 shell).
 */

import { getApiUrlForEventSource } from '@/config/apiBase';
import { INTERNAL_CHAT_SSE_EVENT } from '@/utils/internalChatConstants';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

function getReconnectDelay(attempt) {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * 2 ** attempt, MAX_RECONNECT_DELAY);
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

/**
 * @param {object} options
 * @param {() => string|null|undefined} options.getToken
 * @param {(event: object) => void} [options.onEvent]
 * @param {() => void} [options.onConnected]
 * @param {() => void} [options.onDisconnected]
 * @returns {{ connect: () => void, disconnect: () => void }}
 */
export function createInternalChatStream(options = {}) {
  const { getToken, onEvent, onConnected, onDisconnected } = options;
  let eventSource = null;
  let reconnectTimer = null;
  let attemptCount = 0;
  let stopped = false;

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

  function disconnect() {
    stopped = true;
    closeConnection();
    onDisconnected?.();
  }

  function scheduleReconnect() {
    if (stopped || attemptCount >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = getReconnectDelay(attemptCount);
    attemptCount += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (stopped) return;
    const token = getToken?.();
    if (!token) return;

    closeConnection();

    const url = getApiUrlForEventSource(
      `/api/internal-chat/stream?token=${encodeURIComponent(token)}`
    );

    try {
      eventSource = new EventSource(url);

      eventSource.addEventListener('connected', () => {
        attemptCount = 0;
        onConnected?.();
      });

      eventSource.addEventListener(INTERNAL_CHAT_SSE_EVENT, (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          onEvent?.(data);
        } catch {
          /* ignore malformed */
        }
      });

      eventSource.onerror = () => {
        closeConnection();
        onDisconnected?.();
        scheduleReconnect();
      };
    } catch (err) {
      console.error('[createInternalChatStream] Failed to create EventSource', err);
      onDisconnected?.();
      scheduleReconnect();
    }
  }

  return { connect, disconnect };
}
