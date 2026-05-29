import { playHelpdeskNotificationSound } from '@/utils/helpdeskNotificationSound';
import { showGlobalNotification } from '@/composables/useNotifications';

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

const HIGH_PRIORITY_EVENTS = new Set([
  'CASE_CREATED',
  'CASE_EMAIL_RECEIVED',
  'CASE_CHAT_MESSAGE_RECEIVED',
  'CASE_ESCALATED',
  'CASE_SLA_BREACHED'
]);

/**
 * Toast + optional sound for realtime helpdesk notifications.
 */
export function alertForHelpdeskNotification(notification, { appKey, playSound = true } = {}) {
  if (appKey !== 'HELPDESK' || !notification) return;
  const eventType = String(notification.eventType || '');
  if (!HELPDESK_ALERT_EVENTS.has(eventType)) return;

  const title = String(notification.title || 'Helpdesk').trim();
  const body = String(notification.body || '').trim();
  const message = body ? `${title} — ${body}` : title;

  const isHighPriority = HIGH_PRIORITY_EVENTS.has(eventType);
  showGlobalNotification(message, {
    type: isHighPriority ? 'warning' : 'info',
    duration: isHighPriority ? 6000 : 4500,
    appKey: 'HELPDESK',
    entity: notification.entity,
    notificationId: notification.id
  });

  if (playSound) {
    playHelpdeskNotificationSound();
  }
}
