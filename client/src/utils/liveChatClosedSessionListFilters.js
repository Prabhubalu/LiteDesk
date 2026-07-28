import { LIVE_CHAT_CLOSED_PICKLIST_VALUES } from '@/constants/liveChatClosedSessionPicklists';
import { isFilterValueActive } from '@/platform/filters/filterValueUtils';
import {
  getTodayRange,
  getThisMonthRange,
  getThisQuarterRange,
  getThisWeekRange,
  getThisYearRange,
  parseDateFilterValue,
} from '@/utils/dateFilterOptions';
import {
  liveChatAgentLabel,
  liveChatChannelLabel,
  liveChatIntentLabel,
  liveChatLifecycleLabel,
  liveChatOutcomeLabel,
  liveChatQueueLabel,
  liveChatSentimentLabel,
  liveChatSessionKeyLabel,
  liveChatSessionPriorityLabel,
  liveChatSessionSummaryLabel,
  liveChatSessionTagsLabel,
  liveChatVisitorLabel,
  liveChatVisitorTypeLabel,
  liveChatYesNoLabel,
} from '@/utils/liveChatSessionDisplay';

export const LIVE_CHAT_CLOSED_COLUMN_FILTER_TYPES = Object.freeze({
  visitor: 'text',
  sessionKey: 'text',
  channel: 'select',
  lifecycleStatus: 'select',
  outcome: 'select',
  queue: 'text',
  assignedAgent: 'text',
  handledBy: 'text',
  startedAt: 'date',
  endedAt: 'date',
  duration: 'text',
  summary: 'text',
  tags: 'text',
  csatScore: 'number',
  messageCount: 'number',
  visitorMessageCount: 'number',
  agentMessageCount: 'number',
  transferCount: 'number',
  waitTime: 'text',
  firstResponseTime: 'text',
  handleTime: 'text',
  visitorType: 'select',
  priority: 'select',
  sentiment: 'select',
  intent: 'select',
  botInvolved: 'boolean',
  consentGiven: 'boolean',
  sessionArchived: 'boolean',
  exported: 'boolean',
});

function picklistOptionLabel(columnKey, value, t) {
  switch (columnKey) {
    case 'channel':
      return liveChatChannelLabel(value, t);
    case 'lifecycleStatus':
      return liveChatLifecycleLabel(value, t);
    case 'outcome':
      return liveChatOutcomeLabel(value, t);
    case 'visitorType':
      return liveChatVisitorTypeLabel(value, t);
    case 'priority':
      return liveChatSessionPriorityLabel(value, t);
    case 'sentiment':
      return liveChatSentimentLabel(value, t);
    case 'intent':
      return liveChatIntentLabel(value, t);
    default:
      return String(value);
  }
}

export function buildOutcomeFilterOptions(outcomes, t) {
  if (!Array.isArray(outcomes) || !outcomes.length) return [];
  return outcomes.map((row) => ({
    value: row.key,
    label: row.system === false
      ? String(row.label || row.key)
      : liveChatOutcomeLabel(row.key, t),
  }));
}

export function buildLiveChatClosedColumnFilterOptions(columnKey, t, { outcomes } = {}) {
  if (columnKey === 'outcome' && Array.isArray(outcomes) && outcomes.length) {
    return buildOutcomeFilterOptions(outcomes, t);
  }
  const values = LIVE_CHAT_CLOSED_PICKLIST_VALUES[columnKey];
  if (!values?.length) return [];
  return values.map((value) => ({
    value,
    label: picklistOptionLabel(columnKey, value, t),
  }));
}

function resolveDateRange(parsed) {
  if (!parsed) return null;
  if (parsed.quick === 'fromNow' || parsed.preset === 'fromNow') {
    return { from: new Date(), to: new Date(8640000000000000) };
  }
  if (parsed.quick === 'beforeNow' || parsed.preset === 'beforeNow') {
    return { from: new Date(0), to: new Date(Date.now() - 1000) };
  }
  if (parsed.preset === 'today') return getTodayRange();
  if (parsed.preset === 'thisWeek') return getThisWeekRange();
  if (parsed.preset === 'thisMonth') return getThisMonthRange();
  if (parsed.preset === 'thisQuarter') return getThisQuarterRange();
  if (parsed.preset === 'thisYear') return getThisYearRange();

  if (parsed.op === 'on' && parsed.date) {
    const from = new Date(parsed.date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    to.setMilliseconds(-1);
    return { from, to };
  }
  if (parsed.op === 'before' && parsed.date) {
    const to = new Date(parsed.date);
    to.setHours(23, 59, 59, 999);
    return { from: new Date(0), to };
  }
  if (parsed.op === 'after' && parsed.date) {
    const from = new Date(parsed.date);
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date(8640000000000000) };
  }
  if (parsed.op === 'between' && parsed.from && parsed.to) {
    const from = new Date(parsed.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(parsed.to);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (parsed.op === 'lastDays' && parsed.days != null) {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - Number(parsed.days));
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (parsed.op === 'nextDays' && parsed.days != null) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + Number(parsed.days));
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  return null;
}

function sessionDateValue(session, columnKey) {
  if (columnKey === 'startedAt') return session?.createdAt || null;
  if (columnKey === 'endedAt') return session?.endedAt || session?.lastMessageAt || null;
  return null;
}

function dateMatchesFilter(session, columnKey, filterValue) {
  const parsed = parseDateFilterValue(filterValue);
  if (!parsed) return true;

  const raw = sessionDateValue(session, columnKey);
  const ms = raw ? new Date(raw).getTime() : NaN;
  const hasValue = Number.isFinite(ms) && ms > 0;

  if (parsed.op === 'empty') return !hasValue;
  if (parsed.op === 'notEmpty') return hasValue;
  if (!hasValue) return false;

  const range = resolveDateRange(parsed);
  if (!range) return true;
  return ms >= range.from.getTime() && ms <= range.to.getTime();
}

function numberMatches(session, columnKey, filterValue) {
  const query = String(filterValue ?? '').trim();
  if (!query) return true;
  const raw = session?.[columnKey];
  const num = Number(raw);
  if (!Number.isFinite(num)) return false;
  if (query === String(num)) return true;
  return String(num).includes(query);
}

export function getLiveChatClosedSessionFieldText(session, columnKey, t) {
  switch (columnKey) {
    case 'visitor':
      return [
        liveChatVisitorLabel(session, t),
        session?.visitor?.email,
      ].filter(Boolean).join(' ');
    case 'sessionKey':
      return liveChatSessionKeyLabel(session);
    case 'channel':
      return liveChatChannelLabel(session?.channel, t);
    case 'lifecycleStatus':
      return liveChatLifecycleLabel(session?.lifecycleStatus, t);
    case 'outcome':
      return liveChatOutcomeLabel(session?.outcome, t);
    case 'queue':
      return liveChatQueueLabel(session, t);
    case 'assignedAgent':
      return liveChatAgentLabel(session?.assignedAgent, t);
    case 'handledBy':
      return liveChatAgentLabel(session?.handledBy, t);
    case 'summary':
      return liveChatSessionSummaryLabel(session);
    case 'tags':
      return liveChatSessionTagsLabel(session).join(' ');
    case 'visitorType':
      return liveChatVisitorTypeLabel(session?.visitorType, t);
    case 'priority':
      return liveChatSessionPriorityLabel(session?.priority, t);
    case 'sentiment':
      return liveChatSentimentLabel(session?.sentiment, t);
    case 'intent':
      return liveChatIntentLabel(session?.intent, t);
    case 'botInvolved':
    case 'consentGiven':
    case 'sessionArchived':
    case 'exported':
      return liveChatYesNoLabel(Boolean(session?.[columnKey]), t);
    default:
      return String(session?.[columnKey] ?? '');
  }
}

function textMatches(session, columnKey, filterValue, t) {
  const query = String(filterValue ?? '').trim().toLowerCase();
  if (!query) return true;
  const haystack = getLiveChatClosedSessionFieldText(session, columnKey, t).toLowerCase();
  return haystack.includes(query);
}

function selectMatches(session, columnKey, filterValue) {
  const query = String(filterValue ?? '').trim();
  if (!query) return true;
  const raw = session?.[columnKey];
  if (raw === null || raw === undefined || raw === '') return false;
  return String(raw).trim() === query;
}

function booleanMatches(session, columnKey, filterValue) {
  const query = String(filterValue ?? '').trim();
  if (!query) return true;
  const boolVal = Boolean(session?.[columnKey]);
  return query === 'true' ? boolVal : !boolVal;
}

export function sessionMatchesColumnFilter(session, columnKey, filterValue, filterType, t) {
  if (!isFilterValueActive(filterValue)) return true;

  const type = filterType || LIVE_CHAT_CLOSED_COLUMN_FILTER_TYPES[columnKey] || 'text';
  if (type === 'date') return dateMatchesFilter(session, columnKey, filterValue);
  if (type === 'number') return numberMatches(session, columnKey, filterValue);
  if (type === 'select') return selectMatches(session, columnKey, filterValue);
  if (type === 'boolean') return booleanMatches(session, columnKey, filterValue);
  return textMatches(session, columnKey, filterValue, t);
}

export function filterLiveChatClosedSessionsByColumns(sessions, filters, t) {
  if (!Array.isArray(sessions) || !filters || typeof filters !== 'object') {
    return sessions;
  }

  const activeKeys = Object.keys(filters).filter((key) => {
    if (key === 'filterQuery') return false;
    return isFilterValueActive(filters[key]);
  });
  if (!activeKeys.length) return sessions;

  return sessions.filter((session) => activeKeys.every((key) => sessionMatchesColumnFilter(
    session,
    key,
    filters[key],
    LIVE_CHAT_CLOSED_COLUMN_FILTER_TYPES[key],
    t,
  )));
}

export function buildLiveChatClosedSessionSearchHaystack(session, t) {
  return [
    session?.visitor?.name,
    session?.visitor?.email,
    session?.sessionKey,
    liveChatSessionKeyLabel(session),
    liveChatOutcomeLabel(session?.outcome, t),
    liveChatChannelLabel(session?.channel, t),
    liveChatLifecycleLabel(session?.lifecycleStatus, t),
    session?.queue?.name,
    liveChatQueueLabel(session, t),
    liveChatAgentLabel(session?.assignedAgent, t),
    liveChatAgentLabel(session?.handledBy, t),
    liveChatSessionSummaryLabel(session),
    liveChatSentimentLabel(session?.sentiment, t),
    liveChatIntentLabel(session?.intent, t),
    liveChatVisitorTypeLabel(session?.visitorType, t),
    liveChatSessionPriorityLabel(session?.priority, t),
    ...(Array.isArray(session?.tags) ? session.tags : []),
    session?.lastMessage?.body,
  ]
    .map((part) => String(part || '').toLowerCase())
    .join(' ');
}
