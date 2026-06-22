import { playHelpdeskNotificationSound } from '@/utils/helpdeskNotificationSound';
import { buildLiveChatToastPresentation } from '@/utils/toastPresentation';
import { pushToast } from '@/composables/useNotifications';
import { i18n } from '@/i18n';

const t = i18n.global.t.bind(i18n.global);

const LIVE_CHAT_ALERT_EVENTS = new Set([
  'LIVE_CHAT_MESSAGE_RECEIVED',
  'LIVE_CHAT_SESSION_STARTED',
]);

/**
 * Toast + sound for realtime Live Chat notifications (PLATFORM appKey).
 */
export function alertForLiveChatNotification(notification, { appKey, playSound = true } = {}) {
  const resolvedAppKey = appKey || notification?.appKey || 'PLATFORM';
  if (resolvedAppKey !== 'PLATFORM' || !notification) return;

  const eventType = String(notification.eventType || '');
  if (!LIVE_CHAT_ALERT_EVENTS.has(eventType)) return;

  const presentation = buildLiveChatToastPresentation(
    { ...notification, appKey: resolvedAppKey },
    t,
  );
  if (!presentation) return;

  pushToast(presentation);

  if (playSound) {
    playHelpdeskNotificationSound();
  }
}

export function dispatchLiveChatWorkspaceEvent(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('arivu:live-chat-workspace', { detail }));
}
