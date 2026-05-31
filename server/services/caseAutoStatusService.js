'use strict';

const { canTransitionCaseStatus, applyStatusToSlaCycle } = require('./caseLifecycleService');
const { shouldMarkFirstResponseSla, tryMarkResponseSlaMetOnCycle } = require('./helpdeskSlaClockService');

const LIVE_CHAT_CHANNELS = new Set(['Live Chat']);

const CUSTOMER_INBOUND_ACTIVITY_TYPES = new Set([
  'email_received',
  'channel_message_received'
]);

/**
 * Resolve automatic next status after an agent's customer-visible action.
 */
function resolveAgentReplyTargetStatus(currentStatus, channel) {
  if (['On Hold', 'Resolved', 'Closed'].includes(currentStatus)) {
    return null;
  }

  if (currentStatus === 'In Progress') {
    const ch = String(channel || '').trim();
    if (LIVE_CHAT_CHANNELS.has(ch)) return null;
    return 'Waiting for Customer';
  }

  if (['New', 'Assigned', 'Waiting for Customer'].includes(currentStatus)) {
    return 'In Progress';
  }

  return null;
}

/**
 * Resolve automatic next status after customer inbound activity.
 */
function resolveCustomerInboundTargetStatus(currentStatus) {
  if (['On Hold', 'Resolved', 'Closed', 'In Progress'].includes(currentStatus)) {
    return null;
  }

  if (['Waiting for Customer', 'New', 'Assigned'].includes(currentStatus)) {
    return 'In Progress';
  }

  return null;
}

function inferAutoStatusTrigger({ activityType, internal, actorId }) {
  const type = String(activityType || '').trim();

  if (CUSTOMER_INBOUND_ACTIVITY_TYPES.has(type)) {
    return 'customer_inbound';
  }

  if (shouldMarkFirstResponseSla({ activityType: type, internal, actorId })) {
    return 'agent_reply';
  }

  return null;
}

function applyAutoStatusChange(caseRecord, toStatus, { actorId, actorName, fromStatus, source }) {
  if (!toStatus || caseRecord.status === toStatus) {
    return { changed: false, fromStatus: caseRecord.status, toStatus: caseRecord.status };
  }

  if (!canTransitionCaseStatus(caseRecord.status, toStatus)) {
    return { changed: false, fromStatus: caseRecord.status, toStatus: caseRecord.status };
  }

  const previous = fromStatus || caseRecord.status;
  caseRecord.status = toStatus;
  caseRecord.currentSlaCycle = applyStatusToSlaCycle(
    caseRecord.currentSlaCycle?.toObject?.() || caseRecord.currentSlaCycle,
    toStatus
  );

  caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
  caseRecord.activities.push({
    activityType: 'status_changed',
    message: `Status automatically changed from ${previous} to ${toStatus}`,
    internal: true,
    metadata: {
      fromStatus: previous,
      toStatus,
      source: source || 'auto_status',
      automatic: true
    },
    actorId: actorId || null,
    actorName: actorName || 'System',
    createdAt: new Date()
  });

  return { changed: true, fromStatus: previous, toStatus };
}

/**
 * Apply lifecycle auto-transition based on agent reply or customer inbound activity.
 */
function maybeAutoTransitionCaseStatus(caseRecord, {
  activityType,
  internal = true,
  actorId = null,
  actorName = 'System',
  channel = null,
  trigger = null
} = {}) {
  if (!caseRecord || ['Resolved', 'Closed'].includes(caseRecord.status)) {
    return { changed: false, fromStatus: caseRecord?.status, toStatus: caseRecord?.status };
  }

  const effectiveTrigger = trigger || inferAutoStatusTrigger({ activityType, internal, actorId });
  if (!effectiveTrigger) {
    return { changed: false, fromStatus: caseRecord.status, toStatus: caseRecord.status };
  }

  const effectiveChannel = channel || caseRecord.channel;
  let targetStatus = null;

  if (effectiveTrigger === 'agent_reply') {
    targetStatus = resolveAgentReplyTargetStatus(caseRecord.status, effectiveChannel);
  } else if (effectiveTrigger === 'customer_inbound') {
    targetStatus = resolveCustomerInboundTargetStatus(caseRecord.status);
  }

  if (!targetStatus) {
    return { changed: false, fromStatus: caseRecord.status, toStatus: caseRecord.status };
  }

  return applyAutoStatusChange(caseRecord, targetStatus, {
    actorId,
    actorName,
    source: effectiveTrigger
  });
}

/**
 * Apply response SLA + auto-status after a timeline activity is appended.
 */
function applyCaseActivitySideEffects(caseRecord, {
  activityType,
  internal = true,
  actorId = null,
  actorName = 'System',
  channel = null,
  trigger = null
} = {}) {
  const slaMarked = tryMarkResponseSlaMetOnCycle(caseRecord.currentSlaCycle, {
    activityType,
    internal,
    actorId
  });

  const statusResult = maybeAutoTransitionCaseStatus(caseRecord, {
    activityType,
    internal,
    actorId,
    actorName,
    channel,
    trigger
  });

  return { slaMarked, statusResult };
}

module.exports = {
  resolveAgentReplyTargetStatus,
  resolveCustomerInboundTargetStatus,
  inferAutoStatusTrigger,
  maybeAutoTransitionCaseStatus,
  applyCaseActivitySideEffects
};
