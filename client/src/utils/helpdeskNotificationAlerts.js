import { showHelpdeskNotificationToast } from '@/utils/notificationToast';

const HELPDESK_ALERT_EVENTS = new Set([
  'CASE_CREATED',
  'CASE_ASSIGNED',
  'CASE_EMAIL_RECEIVED',
  'CASE_CHAT_MESSAGE_RECEIVED',
  'CASE_REOPENED',
  'CASE_ESCALATED',
  'CASE_SLA_WARNING',
  'CASE_SLA_BREACHED'
]);

/**
 * Toast + optional sound for realtime helpdesk notifications.
 */
export function alertForHelpdeskNotification(notification, { appKey, playSound = true } = {}) {
  if (appKey !== 'HELPDESK' || !notification) return;
  const eventType = String(notification.eventType || '');
  if (!HELPDESK_ALERT_EVENTS.has(eventType)) return;

  showHelpdeskNotificationToast(notification, { appKey, playSound });
}
