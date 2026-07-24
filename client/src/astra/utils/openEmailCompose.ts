/** Dispatches the same event GenericRecordContent / DealRecordPage already listen for. */
export const ARIVU_OPEN_EMAIL_COMPOSE = 'arivu:open-email-compose';

export type EmailComposeDraft = {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
};

export type EmailComposeRelatedTo = {
  moduleKey: string;
  recordId: string;
};

export type OpenEmailComposeDetail = EmailComposeDraft & {
  relatedTo?: EmailComposeRelatedTo | null;
};

type ProposalLike = {
  kind?: string;
  toolName?: string;
  moduleKey?: string;
  recordId?: string;
  fields?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

function pickEmail(raw: unknown): string {
  const s = String(raw || '').trim();
  return s.includes('@') ? s : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function isEmailSendProposal(proposal: ProposalLike | null | undefined): boolean {
  const kind = String(proposal?.kind || proposal?.toolName || '').toLowerCase();
  return kind === 'email.send';
}

export function relatedToFromEmailProposal(
  proposal: ProposalLike,
  fallback?: { moduleKey?: string; recordId?: string } | null,
): EmailComposeRelatedTo | null {
  const fields = asRecord(proposal.fields);
  const payload = asRecord(proposal.payload);
  const nested = asRecord(fields?.relatedTo) || asRecord(payload?.relatedTo);
  const moduleKey = String(
    proposal.moduleKey
      || nested?.moduleKey
      || fields?.moduleKey
      || payload?.moduleKey
      || fallback?.moduleKey
      || '',
  ).trim();
  const recordId = String(
    proposal.recordId
      || nested?.recordId
      || nested?.id
      || fields?.recordId
      || payload?.recordId
      || fallback?.recordId
      || '',
  ).trim();
  if (!moduleKey || !recordId) return null;
  return { moduleKey, recordId };
}

export function draftFromEmailProposal(proposal: ProposalLike): EmailComposeDraft {
  const fields = asRecord(proposal.fields) || {};
  const payload = asRecord(proposal.payload) || {};
  const src = { ...payload, ...fields };
  return {
    to: pickEmail(src.to),
    subject: String(src.subject || '').trim(),
    body: String(src.body || src.htmlBody || src.text || '').trim(),
    ...(String(src.cc || '').trim() ? { cc: String(src.cc).trim() } : {}),
    ...(String(src.bcc || '').trim() ? { bcc: String(src.bcc).trim() } : {}),
  };
}

/** Open EmailComposeDrawer via window event. Page `initial-to` fills To when draft.to is empty. */
export function openEmailComposeFromAstra(
  proposal: ProposalLike,
  options?: { relatedTo?: { moduleKey?: string; recordId?: string } | null },
): OpenEmailComposeDetail {
  const draft = draftFromEmailProposal(proposal);
  const relatedTo = relatedToFromEmailProposal(proposal, options?.relatedTo || null);
  const detail: OpenEmailComposeDetail = { ...draft, relatedTo };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ARIVU_OPEN_EMAIL_COMPOSE, { detail }));
  }
  return detail;
}
