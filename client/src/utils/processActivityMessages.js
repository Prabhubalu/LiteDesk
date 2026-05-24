/**
 * Human-readable copy for process_* activity log actions on record timelines.
 */

const PROCESS_ACTIONS = new Set([
  'process_completed',
  'process_failed',
  'process_waiting_approval',
  'process_waiting'
]);

export function isProcessActivityAction(action) {
  return PROCESS_ACTIONS.has(String(action || '').trim());
}

/**
 * @param {Record<string, unknown>} event - Timeline event (payload or flat)
 */
export function getProcessActivityMessage(event) {
  if (!event) return '';
  const message = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (message) return message;

  const action = String(event?.action ?? event?.payload?.action ?? '').trim();
  const details = event?.details ?? event?.payload?.details ?? {};
  const name = String(details.processName || 'Process').trim() || 'Process';

  switch (action) {
    case 'process_completed':
      return `Process "${name}" completed`;
    case 'process_failed':
      return details.error
        ? `Process "${name}" failed: ${details.error}`
        : `Process "${name}" failed`;
    case 'process_waiting_approval':
      return `Process "${name}" is waiting for approval`;
    case 'process_waiting':
      return `Process "${name}" is paused until a scheduled time`;
    default:
      return '';
  }
}

export function getProcessActivityActorLabel(event) {
  const action = String(event?.action ?? event?.payload?.action ?? '').trim();
  if (!isProcessActivityAction(action)) return null;
  const author = event?.author ?? event?.actor;
  if (typeof author === 'string' && author.trim()) return author.trim();
  if (author && typeof author === 'object') return null;
  return 'Process automation';
}
