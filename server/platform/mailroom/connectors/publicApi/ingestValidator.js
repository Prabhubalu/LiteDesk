function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function toStr(v) {
  return v == null ? '' : String(v);
}

function trimOrNull(v) {
  const s = toStr(v).trim();
  return s ? s : null;
}

function sanitizeEmailAddress(input) {
  if (input == null) return null;
  if (typeof input === 'string') return trimOrNull(input);
  if (isPlainObject(input)) {
    const addr = trimOrNull(input.address || input.email);
    if (!addr) return null;
    const name = trimOrNull(input.name);
    return name ? { address: addr, name } : { address: addr };
  }
  return null;
}

function sanitizeAddressList(input) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  for (const v of arr) {
    const a = sanitizeEmailAddress(v);
    if (a) out.push(a);
  }
  return out;
}

function sanitizeParticipants(input) {
  const p = isPlainObject(input) ? input : {};
  return {
    from: sanitizeEmailAddress(p.from),
    to: sanitizeAddressList(p.to),
    cc: sanitizeAddressList(p.cc),
    bcc: sanitizeAddressList(p.bcc)
  };
}

function sanitizeMetadata(input, { allowKeys = [] } = {}) {
  const raw = isPlainObject(input) ? input : {};
  const allow = new Set(allowKeys.map((k) => String(k)));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allow.has(k)) continue;
    // Keep metadata JSON-friendly; drop functions/big objects.
    if (v == null) { out[k] = v; continue; }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v) || isPlainObject(v)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Canonical inbound message envelope for API/Portal/Chat connectors.
 * Throws Error with `.statusCode=400` when invalid.
 */
function validateAndNormalizeIngestMessage(input, {
  defaultChannel = 'api',
  metadataAllowKeys = []
} = {}) {
  const raw = isPlainObject(input) ? input : {};

  const channel = trimOrNull(raw.channel) || defaultChannel;
  let externalMessageId = trimOrNull(raw.externalMessageId || raw.messageId);
  const conversationId = trimOrNull(raw.conversationId);
  const threadId = trimOrNull(raw.threadId);
  const metadata = sanitizeMetadata(raw.metadata, { allowKeys: metadataAllowKeys });
  const portalCaseId = trimOrNull(metadata.caseId || metadata.linkedCaseId);

  const participants = sanitizeParticipants(raw.participants);
  const subject = toStr(raw.subject).trim();
  const body = toStr(raw.body).trim();
  const htmlBody = raw.htmlBody != null ? String(raw.htmlBody) : null;

  const channelLower = String(channel).toLowerCase();
  const isPortalChannel = channelLower === 'portal' || channelLower.startsWith('portal_');
  if (!externalMessageId && isPortalChannel) {
    externalMessageId = `portal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const errors = [];
  if (!channel) errors.push('message.channel is required');
  if (!externalMessageId) errors.push('message.externalMessageId is required (idempotency key)');
  if (!participants.from) errors.push('message.participants.from is required');
  if (!subject && !body && !htmlBody) errors.push('message must include subject, body, or htmlBody');
  if (!conversationId && !threadId && !(isPortalChannel && portalCaseId)) {
    errors.push('message must include conversationId or threadId');
  }

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.statusCode = 400;
    err.validationErrors = errors;
    throw err;
  }

  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const normalizedAttachments = attachments
    .map((a) => (isPlainObject(a) ? { attachmentId: trimOrNull(a.attachmentId) } : null))
    .filter(Boolean)
    .filter((a) => a.attachmentId);

  return {
    channel: String(channel).toLowerCase(),
    externalMessageId,
    conversationId,
    threadId,
    inReplyTo: trimOrNull(raw.inReplyTo),
    references: raw.references != null ? String(raw.references).trim() : null,
    direction: 'inbound',
    subject,
    body,
    htmlBody,
    participants,
    receivedAt: raw.receivedAt || new Date(),
    attachments: normalizedAttachments,
    metadata
  };
}

module.exports = {
  validateAndNormalizeIngestMessage,
  sanitizeMetadata
};

