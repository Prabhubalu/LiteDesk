const INBOUND_ACTIVITY_TYPES = new Set([
  'email_received',
  'channel_message_received'
]);

const OUTBOUND_MESSAGE_TYPES = new Set([
  'email_sent',
  'comment',
  'agent_message',
  'message_sent',
  'note'
]);

const SYSTEM_ACTIVITY_TYPES = new Set([
  'case_created',
  'status_changed',
  'case_reopened',
  'sla_recalculated',
  'assignment_auto_applied',
  'assignment_locked',
  'assignment_reverted',
  'assignment_scheduled_applied',
  'assignment_escalated',
  'assignment_queued',
  'assignment_deferred',
  'assignment_rule_matched',
  'email_duplicate_flagged',
  'channel_duplicate_flagged'
]);

export function isCaseSystemActivity(activity) {
  if (!activity) return true;
  const type = String(activity.activityType || '').trim();
  if (SYSTEM_ACTIVITY_TYPES.has(type)) return true;
  if (type.startsWith('assignment_')) return true;
  if (type.startsWith('sla_')) return true;
  return false;
}

export function isCaseInboundMessage(activity) {
  const type = String(activity?.activityType || '').trim();
  return INBOUND_ACTIVITY_TYPES.has(type);
}

export function isCaseOutboundMessage(activity) {
  const type = String(activity?.activityType || '').trim();
  if (OUTBOUND_MESSAGE_TYPES.has(type)) return true;
  return !activity?.internal && type === 'message';
}

export function getCaseActivityDisplayName(activity, caseRecord) {
  if (activity?.actorName) return activity.actorName;
  if (isCaseInboundMessage(activity)) {
    const contact = caseRecord?.contactId;
    if (contact && typeof contact === 'object') {
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
      return name || contact.email || 'Customer';
    }
    return caseRecord?.requesterEmail || 'Customer';
  }
  const owner = caseRecord?.caseOwnerId;
  if (owner && typeof owner === 'object') {
    const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
    return name || owner.email || 'Agent';
  }
  return 'Agent';
}

export function getCaseActivityAvatarUser(activity, caseRecord) {
  if (isCaseInboundMessage(activity)) {
    const contact = caseRecord?.contactId;
    if (contact && typeof contact === 'object') {
      return {
        firstName: contact.first_name || contact.name || 'C',
        lastName: contact.last_name || '',
        email: contact.email
      };
    }
    return { firstName: 'C', lastName: '', email: caseRecord?.requesterEmail };
  }
  if (activity?.actorId && caseRecord?.caseOwnerId && typeof caseRecord.caseOwnerId === 'object') {
    return caseRecord.caseOwnerId;
  }
  return {
    firstName: activity?.actorName?.split(' ')?.[0] || 'A',
    lastName: activity?.actorName?.split(' ')?.slice(1).join(' ') || ''
  };
}

export function formatCaseChannelLabel(channel) {
  const c = String(channel || '').trim();
  return c || 'Internal';
}

function normalizeActivityText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Headline for system / audit timeline rows (conversation tab). */
export function getCaseSystemActivityHeadline(activity, t) {
  const type = String(activity?.activityType || '');
  if (type === 'status_changed' && activity?.metadata?.toStatus) {
    return t('cases.recordEventStatus', {
      from: activity.metadata.fromStatus,
      to: activity.metadata.toStatus
    });
  }
  if (type === 'case_created') return t('cases.recordEventCreated');
  if (type === 'case_reopened') return t('cases.recordEventReopened');
  if (type.startsWith('assignment_')) return t('cases.recordEventAssignment');
  if (type.startsWith('sla_')) return t('cases.recordEventSla');
  const message = String(activity?.message || '').trim();
  if (message) return message;
  return type.replace(/_/g, ' ');
}

function isRedundantSystemMessage(message, headline, activityType) {
  const msg = normalizeActivityText(message);
  const head = normalizeActivityText(headline);
  if (!msg) return true;
  if (msg === head) return true;
  if (activityType === 'status_changed') return true;
  if (msg.startsWith(head)) {
    const suffix = msg.slice(head.length).replace(/^[\s.:·—-]+/, '');
    if (!suffix) return true;
  }
  return false;
}

/** Extra detail when message adds information beyond the headline. */
export function getCaseSystemActivitySupplement(activity, headline) {
  const type = String(activity?.activityType || '');
  const message = String(activity?.message || '').trim();
  if (!message || isRedundantSystemMessage(message, headline, type)) return '';

  const msgNorm = normalizeActivityText(message);
  const headNorm = normalizeActivityText(headline);
  if (msgNorm.startsWith(headNorm)) {
    const suffix = message.slice(headline.length).replace(/^[\s.:·—-]+/, '').trim();
    return suffix || '';
  }
  if (type === 'status_changed') return '';
  return message;
}

/** Single-line label for system events, e.g. "Case created 48 mins ago". */
export function formatCaseSystemActivityLine(activity, { t, formatTime }) {
  const headline = getCaseSystemActivityHeadline(activity, t);
  const supplement = getCaseSystemActivitySupplement(activity, headline);
  const time = formatTime(activity?.createdAt) || '';
  const label = supplement ? `${headline} ${supplement}` : headline;
  return time ? `${label} ${time}` : label;
}

export function sortCaseActivitiesChronologically(activities) {
  const list = Array.isArray(activities) ? [...activities] : [];
  return list.sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime();
    const tb = new Date(b?.createdAt || 0).getTime();
    return ta - tb;
  });
}

export function filterActivitiesForTab(activities, tab) {
  const sorted = sortCaseActivitiesChronologically(activities);
  if (tab === 'conversation') {
    return sorted.filter((a) => {
      if (isCaseSystemActivity(a)) return true;
      if (isCaseInboundMessage(a) || isCaseOutboundMessage(a)) return true;
      return !a?.internal;
    });
  }
  if (tab === 'notes') {
    return sorted.filter(
      (a) =>
        a?.internal === true &&
        (String(a.activityType) === 'comment' || String(a.activityType) === 'note')
    );
  }
  return sorted;
}
