const { buildNormalizedMessage } = require('./normalizedMessage');

function parserAddressToNormalized(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const address = value.trim();
    return address ? { address } : null;
  }
  if (typeof value === 'object') {
    const address = String(value.address || value.email || '').trim();
    if (!address) return null;
    return { address, name: value.name ? String(value.name).trim() : '' };
  }
  return null;
}

function parserAddressListToNormalized(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(parserAddressToNormalized).filter(Boolean);
  }
  const one = parserAddressToNormalized(value);
  return one ? [one] : [];
}

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
      to: parserAddressListToNormalized(msg.to || msg.toAddresses),
      cc: parserAddressListToNormalized(msg.cc || msg.ccAddresses),
      bcc: parserAddressListToNormalized(msg.bcc || msg.bccAddresses)
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
