import {
  formatLiveChatDateTime,
  formatLiveChatDurationBetween,
} from '@/utils/liveChatRelativeTime';

export function liveChatVisitorLabel(session, t) {
  const name = String(session?.visitor?.name || '').trim();
  return name || t('liveChat.visitor');
}

export function liveChatSessionKeyLabel(session) {
  const key = String(session?.sessionKey || '').trim();
  if (key) return key;
  const id = String(session?._id || '').trim();
  return id ? id.slice(-8) : '—';
}

export function liveChatChannelLabel(channel, t) {
  const key = String(channel || 'web').trim();
  const i18nKey = `liveChat.channel.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatLifecycleLabel(lifecycleStatus, t) {
  const key = String(lifecycleStatus || '').trim();
  if (!key) return '—';
  const i18nKey = `liveChat.lifecycle.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

const customOutcomeLabelByKey = new Map();

export function setLiveChatCustomOutcomeLabels(outcomes) {
  customOutcomeLabelByKey.clear();
  for (const row of outcomes || []) {
    const key = String(row?.key || '').trim();
    if (!key || row?.system !== false) continue;
    const label = String(row?.label || '').trim();
    if (label) customOutcomeLabelByKey.set(key, label);
  }
}

export function liveChatOutcomeLabel(outcome, t) {
  const key = String(outcome || '').trim();
  if (!key) return '';
  const custom = customOutcomeLabelByKey.get(key);
  if (custom) return custom;
  const i18nKey = `liveChat.outcomes.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatQueueLabel(session, t) {
  const name = String(session?.queue?.name || '').trim();
  if (name) return name;
  if (session?.queueId) return t('liveChat.detailQueueDefault');
  return '—';
}

export function liveChatAgentLabel(agent, t) {
  const name = String(agent?.displayName || '').trim();
  return name || t('liveChat.unassigned');
}

export function liveChatSessionDuration(session) {
  return formatLiveChatDurationBetween(
    session?.createdAt,
    session?.endedAt || session?.lastMessageAt,
  );
}

export function liveChatSessionStartedAt(session) {
  return formatLiveChatDateTime(session?.createdAt);
}

export function liveChatSessionEndedAt(session) {
  return formatLiveChatDateTime(session?.endedAt || session?.lastMessageAt);
}

export const LIVE_CHAT_OUTCOME_BADGE_VARIANTS = {
  resolved: 'success',
  missed: 'warning',
  follow_up_required: 'warning',
  escalated: 'danger',
  abandoned: 'default',
  spam: 'default',
  informational: 'info',
};

export const LIVE_CHAT_LIFECYCLE_BADGE_VARIANTS = {
  waiting: 'warning',
  queued: 'info',
  assigned: 'primary',
  active: 'success',
  ended: 'default',
  closed: 'default',
};

export const LIVE_CHAT_PRIORITY_BADGE_VARIANTS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const LIVE_CHAT_SENTIMENT_BADGE_VARIANTS = {
  positive: 'success',
  neutral: 'default',
  negative: 'danger',
};

export function liveChatUserRefForAvatar(person) {
  if (!person || typeof person !== 'object') {
    return { firstName: '', lastName: '', email: '' };
  }
  const firstName = String(person.firstName || '').trim();
  const lastName = String(person.lastName || '').trim();
  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      email: String(person.email || '').trim(),
      avatar: person.avatar || null,
    };
  }
  const displayName = String(person.displayName || person.name || '').trim();
  const parts = displayName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    email: String(person.email || '').trim(),
    avatar: person.avatar || null,
  };
}

export function liveChatOutcomeBadgeVariant(session) {
  const key = String(session?.outcome || '').trim();
  return LIVE_CHAT_OUTCOME_BADGE_VARIANTS[key] || 'default';
}

export function liveChatSessionTagsLabel(session) {
  const tags = Array.isArray(session?.tags) ? session.tags : [];
  return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
}

export function liveChatSessionSummaryLabel(session) {
  return String(session?.summary || '').trim();
}

export function liveChatCsatLabel(session) {
  const score = session?.csatScore;
  if (typeof score !== 'number' || !Number.isFinite(score)) return '';
  return String(Math.round(score));
}

export function liveChatResolutionRatingLabel(rating, t) {
  const key = String(rating || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.resolutionRating.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatAssignedByLabel(assignedBy, t) {
  const key = String(assignedBy || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.assignedBy.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatAssignmentActionLabel(action, t) {
  const key = String(action || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.assignmentAction.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatTimingDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '';
  return formatLiveChatDurationBetween(
    new Date(0),
    new Date(ms),
  ).replace(/^—$/, '');
}

export function liveChatSessionWaitTime(session) {
  return liveChatTimingDurationMs(session?.timing?.waitTimeMs);
}

export function liveChatSessionFirstResponseTime(session) {
  return liveChatTimingDurationMs(session?.timing?.firstResponseTimeMs);
}

export function liveChatSessionHandleTime(session) {
  return liveChatTimingDurationMs(session?.timing?.handleTimeMs);
}

export function liveChatAgentsInvolvedLabel(session, t) {
  const agents = Array.isArray(session?.agentsInvolvedAgents) ? session.agentsInvolvedAgents : [];
  if (!agents.length) return '—';
  return agents
    .map((agent) => liveChatAgentLabel(agent, t))
    .filter((name) => name && name !== t('liveChat.unassigned'))
    .join(', ') || '—';
}

export function liveChatDeviceTypeLabel(deviceType, t) {
  const key = String(deviceType || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.deviceType.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatJourneyActionLabel(action, t) {
  const key = String(action || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.journeyAction.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatVisitorTypeLabel(visitorType, t) {
  const key = String(visitorType || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.visitorType.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatSessionPriorityLabel(priority, t) {
  const key = String(priority || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.sessionPriority.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatSessionPriorityBadgeVariant(priority) {
  const key = String(priority || '').trim();
  return LIVE_CHAT_PRIORITY_BADGE_VARIANTS[key] || 'default';
}

export function liveChatBotResolutionLabel(resolution, t) {
  const key = String(resolution || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.botResolution.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatYesNoLabel(value, t) {
  return value ? t('liveChat.valueYes') : t('liveChat.valueNo');
}

export function liveChatSentimentLabel(sentiment, t) {
  const key = String(sentiment || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.sentiment.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatIntentLabel(intent, t) {
  const key = String(intent || '').trim();
  if (!key) return '';
  const i18nKey = `liveChat.intent.${key}`;
  const translated = t(i18nKey, key);
  return translated === i18nKey ? key : translated;
}

export function liveChatAiSentimentScoreLabel(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '';
  return score.toFixed(2);
}
