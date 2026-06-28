'use strict';

const mongoose = require('mongoose');
const DeferredAutomationAction = require('../models/DeferredAutomationAction');
const { isOpen, nextOpenInstant, formatPauseReason } = require('./businessHoursEngine');
const { resolveBusinessSchedule } = require('./businessHoursResolveService');

function buildDeferDedupeKey(eventId, ruleId, actionIndex) {
  return `auto-bh:${eventId}:${ruleId}:${actionIndex}`;
}

/**
 * @param {object} event Domain event
 * @param {object} rule Automation rule doc (respectBusinessHours flag)
 */
async function evaluateAutomationDeferral(event, rule) {
  if (!rule?.respectBusinessHours) {
    return { shouldDefer: false };
  }

  const organizationId = event?.organizationId;
  if (!organizationId) {
    return { shouldDefer: false };
  }

  const at = new Date();
  const userId = event.assignedTo || event.triggeredBy || null;
  const resolved = await resolveBusinessSchedule({
    organizationId,
    userId: userId ? String(userId) : null,
    at
  });

  if (isOpen(at, resolved.schedule)) {
    return { shouldDefer: false, scheduleName: resolved.name };
  }

  const next = nextOpenInstant(at, resolved.schedule, { inclusive: false });
  return {
    shouldDefer: true,
    executeAt: next ? new Date(next) : null,
    pauseReason: formatPauseReason(at, resolved.schedule),
    scheduleName: resolved.name,
    timezone: resolved.timezone
  };
}

async function enqueueDeferredAutomationAction({
  event,
  rule,
  actionIndex,
  actionType,
  actionParams,
  executeAt,
  pauseReason
}) {
  if (!executeAt || Number.isNaN(new Date(executeAt).getTime())) {
    return { queued: false, reason: 'no_execute_at' };
  }

  const eventId = event.eventId;
  const ruleId = rule._id?.toString() || String(rule._id);
  const dedupeKey = buildDeferDedupeKey(eventId, ruleId, actionIndex);

  try {
    await DeferredAutomationAction.create({
      organizationId: event.organizationId,
      eventId,
      ruleId: new mongoose.Types.ObjectId(ruleId),
      actionIndex,
      actionType,
      actionParams: actionParams || null,
      eventPayload: event,
      executeAt: new Date(executeAt),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      dedupeKey,
      pauseReason: pauseReason || null
    });
    return { queued: true, dedupeKey, executeAt };
  } catch (err) {
    if (err?.code === 11000) {
      return { queued: false, reason: 'duplicate' };
    }
    throw err;
  }
}

module.exports = {
  evaluateAutomationDeferral,
  enqueueDeferredAutomationAction,
  buildDeferDedupeKey
};
