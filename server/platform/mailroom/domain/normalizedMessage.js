/**
 * Universal normalized message (Mailroom canonical shape).
 * All connectors map inbound payloads into this structure before policy evaluation.
 */

function emptyParticipants() {
  return { from: null, to: [], cc: [], bcc: [] };
}

/**
 * @param {object} input
 * @returns {object}
 */
function buildNormalizedMessage(input = {}) {
  const participants = input.participants && typeof input.participants === 'object'
    ? input.participants
    : emptyParticipants();

  return {
    messageId: input.messageId || null,
    channel: String(input.channel || 'email').toLowerCase(),
    conversationId: input.conversationId || null,
    externalMessageId: input.externalMessageId || input.messageId || null,
    threadId: input.threadId || null,
    direction: input.direction === 'outbound' ? 'outbound' : 'inbound',
    subject: String(input.subject || '').trim(),
    body: String(input.body || '').trim(),
    htmlBody: input.htmlBody != null ? String(input.htmlBody) : null,
    participants: {
      from: participants.from || null,
      to: Array.isArray(participants.to) ? participants.to : [],
      cc: Array.isArray(participants.cc) ? participants.cc : [],
      bcc: Array.isArray(participants.bcc) ? participants.bcc : []
    },
    inReplyTo: input.inReplyTo || null,
    references: input.references || null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

module.exports = {
  buildNormalizedMessage,
  emptyParticipants
};
