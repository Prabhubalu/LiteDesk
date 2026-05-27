/**
 * Threading signal evaluators — return a match descriptor or null.
 * Strategy order and enablement come from tenant policy config.
 */

function normalizeSubject(value) {
  return String(value || '')
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi, '')
    .trim()
    .toLowerCase();
}

function getFromAddress(message) {
  const from = message?.participants?.from;
  if (!from) return '';
  if (typeof from === 'string') return from.toLowerCase().trim();
  return String(from.address || from.email || '').toLowerCase().trim();
}

function matchByMessageId(message, candidates) {
  const mid = String(message.externalMessageId || message.metadata?.messageId || '').trim();
  if (!mid) return null;
  const hit = (candidates.messages || []).find(
    (m) => String(m.externalMessageId || m.messageId || '') === mid
  );
  if (!hit) return null;
  return { conversationId: hit.conversationId, caseId: hit.caseId, messageId: hit.messageId };
}

function matchByInReplyTo(message, candidates) {
  const irt = String(message.inReplyTo || '').trim();
  if (!irt) return null;
  const hit = (candidates.messages || []).find(
    (m) => String(m.externalMessageId || m.messageId || '') === irt
  );
  if (!hit) return null;
  return { conversationId: hit.conversationId, caseId: hit.caseId, messageId: hit.messageId };
}

function matchByReferences(message, candidates) {
  const refs = String(message.references || '').trim();
  if (!refs) return null;
  const tokens = refs.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const hit = (candidates.messages || []).find(
      (m) => String(m.externalMessageId || m.messageId || '') === token
    );
    if (hit) {
      return { conversationId: hit.conversationId, caseId: hit.caseId, messageId: hit.messageId };
    }
  }
  return null;
}

function matchByProviderThread(message, candidates) {
  const tid = String(message.threadId || message.metadata?.providerThreadId || '').trim();
  if (!tid) return null;
  const conv = (candidates.conversations || []).find(
    (c) => String(c.externalThreadId || c.threadId || '') === tid
  );
  if (!conv) return null;
  return { conversationId: conv.id || conv._id, caseId: conv.primaryCaseId || null };
}

function matchBySenderSubject(message, candidates, params = {}) {
  const from = getFromAddress(message);
  const subject = params.stripReFwd !== false
    ? normalizeSubject(message.subject)
    : String(message.subject || '').trim().toLowerCase();
  if (!from || !subject) return null;
  const conv = (candidates.conversations || []).find((c) => {
    const cFrom = String(c.lastFromAddress || '').toLowerCase().trim();
    const cSub = normalizeSubject(c.lastSubject || '');
    return cFrom === from && cSub === subject;
  });
  if (!conv) return null;
  return { conversationId: conv.id || conv._id, caseId: conv.primaryCaseId || null };
}

const EVALUATORS = {
  message_id: matchByMessageId,
  in_reply_to: matchByInReplyTo,
  references: matchByReferences,
  provider_thread_id: matchByProviderThread,
  sender_subject: matchBySenderSubject
};

function evaluateThreadingSignal(signal, message, candidates, params) {
  const fn = EVALUATORS[signal];
  if (!fn) return null;
  return fn(message, candidates, params);
}

module.exports = {
  evaluateThreadingSignal,
  EVALUATORS,
  normalizeSubject
};
