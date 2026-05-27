const crypto = require('crypto');

function createEventId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

/**
 * Build a Mailroom event envelope (spec §17).
 *
 * @param {Object} params
 * @returns {Object}
 */
function buildMailroomEventEnvelope({
  eventType,
  organizationId,
  channel = 'email',
  rawPayloadId = null,
  conversationId = null,
  mailroomMessageId = null,
  caseId = null,
  data = {}
}) {
  return {
    eventId: createEventId(),
    eventType,
    organizationId: organizationId ? String(organizationId) : null,
    channel: String(channel || 'email').toLowerCase(),
    rawPayloadId: rawPayloadId ? String(rawPayloadId) : null,
    conversationId: conversationId ? String(conversationId) : null,
    mailroomMessageId: mailroomMessageId ? String(mailroomMessageId) : null,
    caseId: caseId ? String(caseId) : null,
    timestamp: new Date().toISOString(),
    data: data || {}
  };
}

module.exports = {
  createEventId,
  buildMailroomEventEnvelope
};
