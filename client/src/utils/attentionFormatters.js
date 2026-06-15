/**
 * Shared formatters for Attention / InboxItem UI.
 * @see docs/architecture/inbox-aggregation.md
 */

/**
 * @param {string|Date|null|undefined} dueAt
 * @param {boolean} isOverdue
 * @param {(key: string, params?: Record<string, unknown>) => string} [t]
 */
export function formatAttentionDueTime(dueAt, isOverdue, t) {
  if (isOverdue) {
    return t ? t('common.attentionDueOverdue') : 'overdue';
  }

  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return diffDays === 1
      ? (t ? t('common.attentionDueInOneDay') : 'in 1 day')
      : (t ? t('common.attentionDueInManyDays', { count: diffDays }) : `in ${diffDays} days`);
  }

  if (diffHours > 0) {
    return diffHours === 1
      ? (t ? t('common.attentionDueInOneHour') : 'in 1 hour')
      : (t ? t('common.attentionDueInManyHours', { count: diffHours }) : `in ${diffHours} hours`);
  }

  if (diffHours < 0) {
    const absHours = Math.abs(diffHours);
    return absHours === 1
      ? (t ? t('common.attentionDueOneHourAgo') : '1 hour ago')
      : (t ? t('common.attentionDueManyHoursAgo', { count: absHours }) : `${absHours} hours ago`);
  }

  return t ? t('common.attentionDueSoon') : 'soon';
}

/**
 * @param {string|Date|null|undefined} startAt
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function formatUpcomingEventTime(startAt, t) {
  if (!startAt || !t) return '';
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return '';

  const now = new Date();
  const diffMs = start - now;
  if (diffMs <= 0) return t('common.attentionDueSoon');

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return diffMinutes <= 1
      ? t('common.upcomingEventInOneMinute')
      : t('common.upcomingEventInManyMinutes', { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1
      ? t('common.upcomingEventInOneHour')
      : t('common.upcomingEventInManyHours', { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1
    ? t('common.upcomingEventInOneDay')
    : t('common.upcomingEventInManyDays', { count: diffDays });
}

export function getEventAttentionType(item) {
  if (item?.kind === 'event' && 'eventAttentionType' in item) {
    return item.eventAttentionType;
  }
  return null;
}

/**
 * @param {string|null|undefined} attentionType
 * @param {(key: string) => string} [t]
 */
export function getEventAttentionBadgeLabel(attentionType, t) {
  if (!attentionType) {
    return t ? t('common.eventAttentionActionRequired') : 'Action Required';
  }
  const keys = {
    start: 'common.eventAttentionStartingSoon',
    review: 'common.eventAttentionNeedsReview',
    corrective: 'common.eventAttentionCorrectiveActions',
    approval: 'common.eventAttentionApprovalRequired'
  };
  const key = keys[attentionType];
  if (key && t) return t(key);
  const labels = {
    start: 'Starting Soon',
    review: 'Needs Review',
    corrective: 'Corrective Actions',
    approval: 'Approval Required'
  };
  return labels[attentionType] || (t ? t('common.eventAttentionActionRequired') : 'Action Required');
}

export function getEventAttentionBadgeVariant(attentionType) {
  if (!attentionType) return 'default';
  const variants = {
    start: 'info',
    review: 'warning',
    corrective: 'danger',
    approval: 'primary'
  };
  return variants[attentionType] || 'default';
}

/** Summarize attention items for home hero chips. */
export function summarizeAttentionItems(items) {
  const list = Array.isArray(items) ? items : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let overdue = 0;
  let dueToday = 0;

  for (const item of list) {
    if (item.isOverdue) {
      overdue += 1;
      continue;
    }
    if (!item.dueAt) continue;
    const due = new Date(item.dueAt);
    if (due >= today && due < tomorrow) {
      dueToday += 1;
    }
  }

  return {
    total: list.length,
    overdue,
    dueToday
  };
}
