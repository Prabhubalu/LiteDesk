'use strict';

const MailroomMessageEvent = require('../../../models/MailroomMessageEvent');
const { buildMailroomEventEnvelope } = require('./eventEnvelope');
const { dispatchMailroomEvent } = require('./dispatcher');

function getPublishList(policies = {}) {
  const list = policies?.dispatch?.publish;
  return Array.isArray(list) ? list : [];
}

function shouldPublish(eventType, publishList) {
  return publishList.includes(eventType);
}

function collectProcessingEvents({
  normalizedMessage,
  policyEvaluation = {},
  caseResult = null,
  conversationResult = null
}) {
  const events = [];
  const channel = normalizedMessage?.channel || 'email';
  const caseId = caseResult?.caseId || conversationResult?.message?.linkedCaseId || null;
  const conversationId = conversationResult?.conversation?._id || null;
  const mailroomMessageId = conversationResult?.message?._id || null;

  events.push({ eventType: 'message.received', data: { subject: normalizedMessage?.subject || '' } });
  events.push({
    eventType: 'message.normalized',
    data: {
      externalMessageId: normalizedMessage?.externalMessageId || null,
      subject: normalizedMessage?.subject || ''
    }
  });

  if (conversationResult?.conversationCreated) {
    events.push({ eventType: 'conversation.created', data: { resolution: conversationResult?.threadingLog?.resolution || '' } });
  } else if (conversationResult?.conversation && !conversationResult?.duplicate) {
    events.push({ eventType: 'conversation.updated', data: {} });
  }

  if (policyEvaluation?.dedup?.isDuplicate) {
    events.push({
      eventType: 'duplicate.detected',
      data: {
        behavior: policyEvaluation.dedup.behavior || null,
        matchedSignal: policyEvaluation.dedup.matchedSignal || null
      }
    });
  }

  const action = caseResult?.action || '';
  if (action === 'created_case' || action === 'created_case_flagged') {
    events.push({
      eventType: 'case.created',
      data: {
        action,
        assignedTo: caseResult?.caseRecord?.assignedTo || null,
        currentState: { status: caseResult?.caseRecord?.status || null }
      }
    });
  } else if (action === 'reopened_and_appended') {
    events.push({
      eventType: 'case.reopened',
      data: {
        action,
        previousState: { status: 'ResolvedOrClosed' },
        currentState: { status: caseResult?.caseRecord?.status || 'In Progress' }
      }
    });
  }

  const attachments = normalizedMessage?.attachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    events.push({
      eventType: 'attachment.uploaded',
      data: { count: attachments.length, filenames: attachments.map((a) => a.filename || a.name).filter(Boolean) }
    });
  }

  return events.map((evt) => ({
    ...evt,
    channel,
    caseId,
    conversationId,
    mailroomMessageId
  }));
}

async function persistAndDispatchEvent(envelope, { publishList, caseResult }) {
  let dispatched = false;
  if (shouldPublish(envelope.eventType, publishList)) {
    const result = dispatchMailroomEvent(envelope, { caseResult });
    dispatched = result.dispatched === true;
  }

  await MailroomMessageEvent.create({
    organizationId: envelope.organizationId,
    eventType: envelope.eventType,
    eventId: envelope.eventId,
    channel: envelope.channel,
    rawPayloadId: envelope.rawPayloadId || null,
    conversationId: envelope.conversationId || null,
    mailroomMessageId: envelope.mailroomMessageId || null,
    caseId: envelope.caseId || null,
    dispatched,
    payload: envelope
  });

  return { eventId: envelope.eventId, eventType: envelope.eventType, dispatched };
}

/**
 * Publish Mailroom processing events after successful pipeline run (M4).
 */
async function publishMailroomProcessingEvents({
  organizationId,
  normalizedMessage,
  policies = {},
  policyEvaluation = {},
  caseResult = null,
  conversationResult = null,
  rawPayloadId = null
}) {
  const publishList = getPublishList(policies);
  const eventSpecs = collectProcessingEvents({
    normalizedMessage,
    policyEvaluation,
    caseResult,
    conversationResult
  });

  const published = [];
  for (const spec of eventSpecs) {
    const envelope = buildMailroomEventEnvelope({
      eventType: spec.eventType,
      organizationId,
      channel: spec.channel,
      rawPayloadId,
      conversationId: spec.conversationId,
      mailroomMessageId: spec.mailroomMessageId,
      caseId: spec.caseId,
      data: spec.data
    });
    // eslint-disable-next-line no-await-in-loop
    const row = await persistAndDispatchEvent(envelope, { publishList, caseResult });
    published.push(row);
  }

  return { published, publishList };
}

/**
 * Record and optionally dispatch processing.failed (M4).
 */
async function publishProcessingFailedEvent({
  organizationId,
  rawPayloadId,
  channel = 'email',
  errorMessage,
  policies = {}
}) {
  const publishList = getPublishList(policies);
  const envelope = buildMailroomEventEnvelope({
    eventType: 'processing.failed',
    organizationId,
    channel,
    rawPayloadId,
    data: { errorMessage: String(errorMessage || '').slice(0, 500) }
  });

  let dispatched = false;
  if (shouldPublish('processing.failed', publishList)) {
    const result = dispatchMailroomEvent(envelope);
    dispatched = result.dispatched === true;
  }

  await MailroomMessageEvent.create({
    organizationId,
    eventType: envelope.eventType,
    eventId: envelope.eventId,
    channel: envelope.channel,
    rawPayloadId: envelope.rawPayloadId,
    dispatched,
    payload: envelope
  });

  return { eventId: envelope.eventId, dispatched };
}

module.exports = {
  getPublishList,
  collectProcessingEvents,
  publishMailroomProcessingEvents,
  publishProcessingFailedEvent
};
