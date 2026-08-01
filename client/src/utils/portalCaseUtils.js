import { formatDate, formatTime } from '@/utils/localeFormat';

const CLOSED_STATUSES = new Set(['closed', 'resolved']);

export function isPortalCaseClosed(status) {
  return CLOSED_STATUSES.has(String(status || '').toLowerCase());
}

export function portalCaseStatusTone(status) {
  const s = String(status || '').toLowerCase();
  if (CLOSED_STATUSES.has(s)) return 'success';
  if (s === 'new') return 'info';
  if (s === 'waiting for customer') return 'warning';
  return 'neutral';
}

export function portalCaseStatusClass(status) {
  const tone = portalCaseStatusTone(status);
  const map = {
    success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    info: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400',
    warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  };
  return map[tone] || map.neutral;
}

export function portalCaseStatusLabelKey(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'new') return 'cases.portalCaseStatusNew';
  if (s === 'in progress') return 'cases.portalCaseStatusInProgress';
  if (s === 'waiting for customer') return 'cases.portalCaseStatusWaitingOnYou';
  if (s === 'resolved') return 'cases.portalCaseStatusResolved';
  if (s === 'closed') return 'cases.portalCaseStatusClosed';
  return null;
}

export function isPortalActivityFromCustomer(act, userEmail = '') {
  const type = String(act?.activityType || '');
  if (type === 'channel_message_received' || type === 'email_received') return true;
  const email = String(userEmail || '').toLowerCase();
  const actor = String(act?.actorName || '').toLowerCase();
  return Boolean(email && actor.includes(email));
}

export function portalCasePriorityClass(priority) {
  const value = String(priority || '').toLowerCase();
  if (value === 'critical') {
    return 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400';
  }
  if (value === 'high') {
    return 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400';
  }
  if (value === 'low') {
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';
  }
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

export function portalActivityInitials(act, user = {}) {
  if (isPortalActivityFromCustomer(act, user?.email)) {
    const first = String(user?.firstName || '').trim();
    const last = String(user?.lastName || '').trim();
    if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    const email = String(user?.email || '').trim();
    return (email.charAt(0) || 'Y').toUpperCase();
  }
  const name = String(act?.actorName || 'Support').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'S';
}

export function groupPortalActivitiesByDay(activities = []) {
  const groups = [];
  let currentKey = null;
  for (const act of activities) {
    const created = act?.createdAt ? new Date(act.createdAt) : null;
    const dayKey = created && !Number.isNaN(created.getTime()) ? created.toDateString() : 'unknown';
    if (dayKey !== currentKey) {
      groups.push({ dayKey, date: created, items: [] });
      currentKey = dayKey;
    }
    groups[groups.length - 1].items.push(act);
  }
  return groups;
}

export function formatPortalDayLabel(date, translate) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOf(new Date());
  const target = startOf(date);
  const diffDays = Math.round((today - target) / 86400000);
  if (diffDays === 0) return translate('cases.portalCasesToday');
  if (diffDays === 1) return translate('cases.portalCasesYesterday');
  return formatDate(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function formatPortalMessageTime(value) {
  if (!value) return '';
  return formatTime(value, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function filterPortalCases(cases, { search = '', filter = 'all' } = {}) {
  const query = String(search || '').trim().toLowerCase();
  return (Array.isArray(cases) ? cases : []).filter((item) => {
    if (filter === 'open' && item.isClosed) return false;
    if (filter === 'closed' && !item.isClosed) return false;
    if (filter === 'action' && !item.needsCustomerAction) return false;
    if (!query) return true;
    const haystack = [
      item.caseId,
      item.title,
      item.description,
      item.status
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
