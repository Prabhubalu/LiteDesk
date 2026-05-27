const { buildNormalizedMessage } = require('./normalizedMessage');

function mapParsedMimeToNormalized(parsedMessage = {}) {
  return buildNormalizedMessage({
    channel: 'email',
    direction: 'inbound',
    externalMessageId: parsedMessage.messageId || null,
    threadId: parsedMessage.providerThreadId || null,
    subject: parsedMessage.subject,
    body: parsedMessage.text || parsedMessage.body || '',
    htmlBody: parsedMessage.html || null,
    inReplyTo: parsedMessage.inReplyTo || null,
    references: Array.isArray(parsedMessage.references)
      ? parsedMessage.references.join(' ')
      : parsedMessage.references || null,
    participants: {
      from: parsedMessage.fromAddress
        ? { address: parsedMessage.fromAddress, name: parsedMessage.fromDisplayName || '' }
        : null,
      to: (parsedMessage.toAddresses || []).map((a) => ({ address: a })),
      cc: (parsedMessage.ccAddresses || []).map((a) => ({ address: a })),
      bcc: (parsedMessage.bccAddresses || []).map((a) => ({ address: a }))
    },
    receivedAt: parsedMessage.receivedAt || new Date(),
    metadata: {
      rawSize: parsedMessage.rawSize || null,
      attachmentCount: Array.isArray(parsedMessage.attachments)
        ? parsedMessage.attachments.length
        : 0
    }
  });
}

function mapParserApiMessageToNormalized(msg = {}, eventDoc = {}) {
  const fromAddr =
    typeof msg.from === 'string'
      ? msg.from
      : msg.from?.address || msg.fromAddress || '';

  return buildNormalizedMessage({
    channel: 'email',
    direction: 'inbound',
    externalMessageId: msg.messageId ? String(msg.messageId) : null,
    threadId: eventDoc.parserThreadId || msg.threadId || null,
    subject: msg.subject,
    body: String(msg.textBody || msg.body || msg.htmlBody || '').trim(),
    htmlBody: msg.htmlBody || null,
    inReplyTo: msg.inReplyTo || null,
    references: msg.references || null,
    participants: {
      from: fromAddr ? { address: fromAddr } : null,
      to: [],
      cc: []
    },
    receivedAt: eventDoc.receivedAt || msg.receivedAt || new Date(),
    metadata: {
      parserMessageId: eventDoc.parserMessageId,
      provider: 'arivu-inbound-parser'
    }
  });
}

module.exports = {
  mapParsedMimeToNormalized,
  mapParserApiMessageToNormalized
};
