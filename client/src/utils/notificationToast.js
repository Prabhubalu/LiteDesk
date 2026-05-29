import { playHelpdeskNotificationSound } from '@/utils/helpdeskNotificationSound';
import { buildHelpdeskToastPresentation } from '@/utils/toastPresentation';
import { pushToast } from '@/composables/useNotifications';
import { i18n } from '@/i18n';

const t = i18n.global.t.bind(i18n.global);

/**
 * Show a structured helpdesk realtime toast (+ optional sound).
 * @param {object} notification - SSE / store notification payload
 * @param {{ appKey?: string, playSound?: boolean }} [options]
 */
export function showHelpdeskNotificationToast(notification, { appKey, playSound = true } = {}) {
  const resolvedAppKey = appKey || notification?.appKey || 'HELPDESK';
  if (resolvedAppKey !== 'HELPDESK' || !notification) return;

  const presentation = buildHelpdeskToastPresentation(
    { ...notification, appKey: resolvedAppKey },
    t
  );
  if (!presentation) return;

  pushToast(presentation);

  if (playSound) {
    playHelpdeskNotificationSound();
  }
}
