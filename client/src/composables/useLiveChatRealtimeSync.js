import { onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useLiveChatWorkspaceAlerts } from '@/composables/useLiveChatWorkspaceAlerts';
import { sessionIdFromLiveChatNotification } from '@/utils/liveChatTabAlerts';

/**
 * Refresh open-session list and workspace badges on realtime Live Chat events.
 */
export function useLiveChatRealtimeSync({
  reloadSessions,
  selectedSessionId = null,
  enabled = true,
} = {}) {
  const route = useRoute();
  const { incrementSessionsAlert } = useLiveChatWorkspaceAlerts();
  let reloadDebounceTimer = null;

  function shouldRefreshList(detail) {
    const eventType = String(detail?.eventType || '');
    return (
      eventType === 'LIVE_CHAT_SESSION_STARTED'
      || eventType === 'LIVE_CHAT_MESSAGE_RECEIVED'
      || eventType === 'LIVE_CHAT_SESSION_ASSIGNED'
      || eventType === 'LIVE_CHAT_SESSION_ENDED'
    );
  }

  function scheduleSessionsReload() {
    if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = setTimeout(() => {
      reloadDebounceTimer = null;
      reloadSessions?.();
    }, 750);
  }

  function onWorkspaceEvent(event) {
    if (!enabled) return;
    const detail = event?.detail || {};
    if (!shouldRefreshList(detail)) return;

    scheduleSessionsReload();

    const eventType = String(detail.eventType || '');
    const sessionId = String(detail.sessionId || sessionIdFromLiveChatNotification(detail) || '');
    const activeSessionId = String(
      selectedSessionId?.value ?? selectedSessionId ?? route.params.sessionId ?? '',
    ).trim();
    const onSessionsRoute = String(route.path || '').startsWith('/live-chat/sessions');

    if (eventType === 'LIVE_CHAT_SESSION_STARTED') {
      if (!onSessionsRoute) {
        incrementSessionsAlert(1);
      }
      return;
    }

    if (eventType === 'LIVE_CHAT_MESSAGE_RECEIVED') {
      if (!onSessionsRoute) {
        incrementSessionsAlert(1);
      } else if (sessionId && activeSessionId && sessionId !== activeSessionId) {
        incrementSessionsAlert(1);
      }
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('arivu:live-chat-workspace', onWorkspaceEvent);
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return;
    if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
    window.removeEventListener('arivu:live-chat-workspace', onWorkspaceEvent);
  });
}
