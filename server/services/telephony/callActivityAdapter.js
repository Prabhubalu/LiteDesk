'use strict';

const Case = require('../../models/Case');
const telephonyEventService = require('./telephonyEventService');

/**
 * Create case timeline activity when a call is linked to a case.
 * Also emits a domain event for Process Designer consumers.
 */
async function recordCallActivity({ organizationId, call, actorId = null }) {
  if (!organizationId || !call?._id) return { caseUpdated: false };

  if (call.linkedCaseId) {
    try {
      const row = await Case.findOne({
        _id: call.linkedCaseId,
        organizationId,
        deletedAt: null,
      });
      if (row) {
        const direction = call.direction || 'unknown';
        const msg = `${direction} call ${call.from || ''} → ${call.to || ''} (${call.status})${
          call.durationSeconds != null ? ` · ${call.durationSeconds}s` : ''
        }`;
        row.activities = row.activities || [];
        row.activities.push({
          activityType: 'telephony_call',
          message: msg.trim(),
          channel: 'phone',
          internal: true,
          metadata: {
            callId: String(call._id),
            providerCallSid: call.providerCallSid || null,
            status: call.status,
            direction: call.direction,
            durationSeconds: call.durationSeconds,
          },
          actorId: actorId || call.agentUserId || null,
          actorName: 'Telephony',
          createdAt: new Date(),
        });
        await row.save();
      }
    } catch (err) {
      console.warn('[callActivityAdapter] case activity failed', err.message);
    }
  }

  try {
    const Task = require('../../models/Task');
    if (call.status === 'missed' && Task && !call.linkedCaseId) {
      // Optional: generic task creation left to Process Designer recipes.
    }
  } catch {
    /* Task model optional path */
  }

  telephonyEventService.emitTelephonyDomainEvent({
    organizationId,
    callId: call._id,
    eventType: 'telephony_call.activity_logged',
    triggeredBy: actorId,
    metadata: {
      status: call.status,
      linkedCaseId: call.linkedCaseId ? String(call.linkedCaseId) : null,
    },
  });

  return { caseUpdated: Boolean(call.linkedCaseId) };
}

module.exports = {
  recordCallActivity,
};
