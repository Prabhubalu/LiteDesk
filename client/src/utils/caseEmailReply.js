/** True when the case channel is Email (case-insensitive). */
export function isEmailChannelCase(caseRecord) {
  return String(caseRecord?.channel || '').trim().toLowerCase() === 'email';
}

function isValidEmail(value) {
  const s = String(value || '').trim();
  return s.includes('@') && s.length > 3;
}

/** Extract email from `Name <user@example.com>` or bare address. */
export function extractEmailFromActorName(actorName) {
  const raw = String(actorName || '').trim();
  if (!raw) return '';
  const angle = raw.match(/<([^>]+)>/);
  if (angle?.[1] && isValidEmail(angle[1])) return angle[1].trim();
  if (isValidEmail(raw)) return raw;
  return '';
}

function emailFromContactRef(contact) {
  if (!contact) return '';
  if (typeof contact === 'string') return '';
  return String(contact.email || '').trim();
}

function resolveFromEmailThreads(emailThreads = []) {
  const threads = Array.isArray(emailThreads) ? emailThreads : [];
  if (!threads.length) return '';

  const latest = threads[0];
  const messages = Array.isArray(latest?.messages) ? [...latest.messages] : [];
  if (!messages.length) return '';

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (String(m?.direction || '').toLowerCase() === 'inbound' && isValidEmail(m?.fromAddress)) {
      return String(m.fromAddress).trim();
    }
  }
  for (const m of messages) {
    if (String(m?.direction || '').toLowerCase() === 'inbound' && isValidEmail(m?.fromAddress)) {
      return String(m.fromAddress).trim();
    }
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const toList = Array.isArray(m?.toAddresses) ? m.toAddresses : [];
    const addr = toList.find((a) => isValidEmail(a));
    if (addr) return String(addr).trim();
  }
  return '';
}

function resolveFromActivities(activities = []) {
  const list = Array.isArray(activities) ? activities : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const a = list[i];
    const type = String(a?.activityType || '').trim();
    if (type !== 'email_received' && type !== 'channel_message_received') continue;
    const fromMeta = String(a?.metadata?.fromAddress || '').trim();
    if (isValidEmail(fromMeta)) return fromMeta;
    const fromActor = extractEmailFromActorName(a?.actorName);
    if (fromActor) return fromActor;
  }
  return '';
}

/**
 * Best-effort customer To: for case email reply (contact → requester → thread → timeline).
 */
export function resolveCaseReplyToEmail({
  caseRecord = null,
  contactEmail = '',
  emailThreads = [],
  activities = null
} = {}) {
  const explicit = String(contactEmail || '').trim();
  if (isValidEmail(explicit)) return explicit;

  const fromContact = emailFromContactRef(caseRecord?.contactId);
  if (isValidEmail(fromContact)) return fromContact;

  const requester = String(caseRecord?.requesterEmail || '').trim();
  if (isValidEmail(requester)) return requester;

  const fromThread = resolveFromEmailThreads(emailThreads);
  if (fromThread) return fromThread;

  const fromActs = resolveFromActivities(
    activities ?? (Array.isArray(caseRecord?.activities) ? caseRecord.activities : [])
  );
  if (fromActs) return fromActs;

  return '';
}

function replySubject(base) {
  const subj = String(base || '').trim();
  if (!subj) return 'Re: (no subject)';
  return /^re:\s*/i.test(subj) ? subj : `Re: ${subj}`;
}

function forwardSubject(base) {
  const subj = String(base || '').trim();
  if (!subj) return 'Fwd: (no subject)';
  return /^fwd:\s*/i.test(subj) ? subj : `Fwd: ${subj}`;
}

function uniqueEmails(list = []) {
  return [...new Set(list.map((e) => String(e || '').trim().toLowerCase()).filter(isValidEmail))];
}

/**
 * Default compose fields for inline case email reply (threading + subject).
 */
export function buildCaseEmailReplyDraft({ caseRecord, contactEmail, emailThreads = [] }) {
  const title = String(caseRecord?.title || '').trim();
  let subject = title ? replySubject(title) : '';
  let parentCommunicationId = null;

  const threads = Array.isArray(emailThreads) ? emailThreads : [];
  if (threads.length) {
    const latest = threads[0];
    if (latest?.subject) {
      subject = replySubject(latest.subject);
    }
    const messages = Array.isArray(latest?.messages) ? latest.messages : [];
    const last = messages[messages.length - 1];
    if (last?._id) {
      parentCommunicationId = String(last._id);
    }
  }

  const to = resolveCaseReplyToEmail({ caseRecord, contactEmail, emailThreads });

  return {
    to,
    subject,
    body: '',
    cc: '',
    bcc: '',
    ...(parentCommunicationId ? { parentCommunicationId } : {})
  };
}

/**
 * Compose defaults when replying from a specific timeline message.
 */
export function buildCaseEmailReplyFromMessage(
  message,
  { caseRecord = null, contactEmail = '', emailThreads = [], replyAll = false, forward = false } = {}
) {
  const base = buildCaseEmailReplyDraft({ caseRecord, contactEmail, emailThreads });
  const subjectBase = String(message?.subject || base.subject || '').trim();
  const inbound = String(message?.direction || '').toLowerCase() === 'inbound';
  const msgId = message?._id ? String(message._id) : null;

  if (forward) {
    return {
      to: '',
      cc: '',
      bcc: '',
      subject: forwardSubject(subjectBase),
      body: '',
      parentCommunicationId: null
    };
  }

  const fallbackTo = resolveCaseReplyToEmail({ caseRecord, contactEmail, emailThreads });
  let to = inbound
    ? String(message?.fromAddress || fallbackTo || '').trim()
    : (Array.isArray(message?.toAddresses) ? message.toAddresses[0] : '') || fallbackTo;

  let cc = '';
  if (replyAll) {
    const pool = uniqueEmails([
      ...(inbound ? [message?.fromAddress] : []),
      ...(Array.isArray(message?.toAddresses) ? message.toAddresses : []),
      ...(Array.isArray(message?.ccAddresses) ? message.ccAddresses : [])
    ]);
    const toNorm = String(to || '').trim().toLowerCase();
    const ccList = pool.filter((e) => e !== toNorm);
    if (ccList.length) cc = ccList.join(', ');
  }

  return {
    to: String(to || '').trim(),
    cc,
    bcc: '',
    subject: replySubject(subjectBase),
    body: '',
    ...(msgId ? { parentCommunicationId: msgId } : {})
  };
}

/** Strip HTML tags for empty-body checks. */
export function htmlBodyHasText(html) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return text.length > 0;
}
