import { playHelpdeskNotificationSound } from '@/utils/helpdeskNotificationSound';
import { buildInternalChatToastPresentation } from '@/utils/toastPresentation';
import { pushToast } from '@/composables/useNotifications';
import { isViewingInternalChatSpace } from '@/utils/internalChatFocus';
import { i18n } from '@/i18n';

const t = i18n.global.t.bind(i18n.global);

export const INTERNAL_CHAT_ALERT_EVENTS = new Set([
  'INTERNAL_CHAT_MENTIONED',
  'INTERNAL_CHAT_MESSAGE_POSTED',
]);

let lastSoundAt = 0;
const SOUND_DEBOUNCE_MS = 900;

/**
 * Debounced chime shared by notification toast + chat SSE fallback.
 */
export function playInternalChatAlertSound() {
  const now = Date.now();
  if (now - lastSoundAt < SOUND_DEBOUNCE_MS) return;
  lastSoundAt = now;
  playHelpdeskNotificationSound();
}

/**
 * Fan-out to open Internal Chat views so the conversation can catch up even when
 * chat SSE lags behind the notification stream (same pattern as live chat).
 * @param {object} [detail]
 */
export function dispatchInternalChatWorkspaceEvent(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('arivu:internal-chat-workspace', { detail }));
}

/**
 * Toast + sound for realtime Internal Chat notifications (PLATFORM appKey).
 * Skips toast when the user is already viewing that space.
 * Always attempts a background Chat-tab pulse (no-op if Chat tab is active/missing).
 */
export function alertForInternalChatNotification(notification, { appKey, playSound = true } = {}) {
  const resolvedAppKey = appKey || notification?.appKey || 'PLATFORM';
  if (resolvedAppKey !== 'PLATFORM' || !notification) return;

  const eventType = String(notification.eventType || '');
  if (!INTERNAL_CHAT_ALERT_EVENTS.has(eventType)) return;

  const spaceId = notification?.entity?.spaceId;
  const alertKind = eventType === 'INTERNAL_CHAT_MENTIONED' ? 'mention' : 'internal';
  void import('@/composables/useTabs').then(({ markInternalChatTabAlert }) => {
    markInternalChatTabAlert(alertKind);
  }).catch(() => {});

  if (isViewingInternalChatSpace(spaceId)) return;

  const presentation = buildInternalChatToastPresentation(
    { ...notification, appKey: resolvedAppKey },
    t,
  );
  if (!presentation) return;

  pushToast(presentation);

  if (playSound) {
    playInternalChatAlertSound();
  }
}

/**
 * Sound-only fallback when a chat SSE message arrives and the user is not viewing that space.
 * Avoids double-toasting when the notification pipeline also fires.
 */
export function alertForInternalChatSseMessage({ spaceId, authorId, currentUserId } = {}) {
  if (!spaceId) return;
  if (authorId && currentUserId && String(authorId) === String(currentUserId)) return;
  if (isViewingInternalChatSpace(spaceId)) return;
  playInternalChatAlertSound();
}
