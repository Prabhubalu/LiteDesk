/**
 * Localized focus subtitle for platform home from API focus payload.
 */

/**
 * @param {{
 *   key?: string,
 *   overdue?: number,
 *   dueToday?: number,
 *   approvals?: number,
 *   unread?: number,
 *   attentionTotal?: number,
 *   dangerSignal?: string | null
 * } | null | undefined} focus
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function formatPlatformFocus(focus, t) {
  if (!focus?.key) return '';

  const {
    key,
    overdue = 0,
    dueToday = 0,
    approvals = 0,
    unread = 0,
    attentionTotal = 0,
    dangerSignal = ''
  } = focus;

  switch (key) {
    case 'overdue':
      if (dueToday > 0) {
        return t('platform.platformHomeFocusOverdueAndDueToday', { overdue, dueToday });
      }
      return overdue === 1
        ? t('platform.platformHomeFocusOverdueOne')
        : t('platform.platformHomeFocusOverdueMany', { count: overdue });

    case 'app_danger':
      return t('platform.platformHomeFocusAppDanger', { signal: dangerSignal || '' });

    case 'approvals':
      return approvals === 1
        ? t('platform.platformHomeFocusApprovalsOne')
        : t('platform.platformHomeFocusApprovalsMany', { count: approvals });

    case 'due_today':
      return dueToday === 1
        ? t('platform.platformHomeFocusDueTodayOne')
        : t('platform.platformHomeFocusDueTodayMany', { count: dueToday });

    case 'unread_mail':
      return unread === 1
        ? t('platform.platformHomeFocusUnreadOne')
        : t('platform.platformHomeFocusUnreadMany', { count: unread });

    case 'attention':
      return attentionTotal === 1
        ? t('platform.platformHomeFocusAttentionOne')
        : t('platform.platformHomeFocusAttentionMany', { count: attentionTotal });

    case 'caught_up':
      return t('platform.platformHomeFocusCaughtUp');

    case 'quiet':
    default:
      return t('platform.platformHomeFocusQuiet');
  }
}
