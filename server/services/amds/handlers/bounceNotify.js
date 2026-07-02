'use strict';

const mongoose = require('mongoose');
const Notification = require('../../../models/Notification');
const Case = require('../../../models/Case');

/**
 * @param {'failed'|'hard_bounce'|'soft_bounce'} severity
 * @param {import('../amds-types').AmdsWebhookEvent} event
 */
function buildBounceTitle(severity, event) {
  const recipient =
    event.bounce?.recipient || event.delivery?.recipient || 'recipient';
  if (severity === 'hard_bounce') {
    return `Email permanently bounced — ${recipient}`;
  }
  if (severity === 'soft_bounce') {
    return `Email temporarily bounced — ${recipient}`;
  }
  return `Email delivery failed — ${recipient}`;
}

/**
 * Notify case assignee (or sender) about delivery failure / bounce.
 * @param {{ communication: object, event: import('../amds-types').AmdsWebhookEvent, severity: 'failed'|'hard_bounce'|'soft_bounce' }} params
 */
async function notifyAgentBounce(params) {
  const { communication, event, severity } = params;
  if (!communication?.organizationId) return;

  const organizationId = communication.organizationId;
  const reason =
    event.bounce?.diagnostic || event.delivery?.error || 'Unknown delivery issue';

  let userId = communication.sentByUserId || null;
  let caseId = null;

  const moduleKey = communication.relatedTo?.moduleKey;
  if (moduleKey === 'cases' && communication.relatedTo?.recordId) {
    caseId = communication.relatedTo.recordId;
    if (!userId) {
      const caseRow = await Case.findOne({
        _id: caseId,
        organizationId,
        deletedAt: null
      })
        .select('assignedTo')
        .lean();
      userId = caseRow?.assignedTo || null;
    }
  }

  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return;

  const title = buildBounceTitle(severity, event);
  const entity = caseId
    ? { type: 'cases', id: caseId, subject: communication.subject || undefined }
    : { type: 'communications', id: communication._id, subject: communication.subject || undefined };

  try {
    await Notification.create({
      userId,
      organizationId,
      appKey: moduleKey === 'cases' ? 'HELPDESK' : 'SALES',
      sourceAppKey: moduleKey === 'cases' ? 'HELPDESK' : 'SALES',
      eventType: 'EMAIL_DELIVERY_BOUNCE',
      title,
      body: String(reason).slice(0, 2000),
      channel: 'IN_APP',
      entity
    });
  } catch (err) {
    console.warn('[bounceNotify] Notification.create failed:', err?.message || err);
  }
}

/**
 * Resolve communication doc for notification after webhook update.
 * @param {import('../amds-types').AmdsWebhookEvent} event
 * @param {object|null} updatedDoc
 */
async function notifyAgentBounceFromEvent(event, updatedDoc) {
  if (!updatedDoc) return;

  let severity = 'failed';
  if (event.event_type === 'message.bounced') {
    severity =
      event.bounce?.classification === 'hard' ? 'hard_bounce' : 'soft_bounce';
  } else if (event.event_type !== 'message.failed') {
    return;
  }

  await notifyAgentBounce({
    communication: updatedDoc,
    event,
    severity
  });
}

module.exports = {
  notifyAgentBounce,
  notifyAgentBounceFromEvent
};
