'use strict';

/**
 * Email draft turn — grounded coworker email from user intent + chat context.
 */

const crypto = require('crypto');
const { buildConfirmation } = require('../governance/confirmAction');
const { RISK } = require('../governance/risk');

const EMAIL_INTENT = /\b((draft|write|compose|prepare)\b[\s\S]{0,40}\b(email|e-mail|mail|message)\b|\b(email|e-mail|mail)\b[\s\S]{0,40}\b(draft|write|compose|to)\b|\bsend\b[\s\S]{0,20}\b(email|e-mail|mail)\b)/i;

function isEmailDraftIntent(query) {
  return EMAIL_INTENT.test(String(query || ''));
}

function parseEmailHints(query) {
  const q = String(query || '').trim();
  const toMatch = q.match(/\bto\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z][A-Za-z0-9 ._-]{1,60})/i);
  const saying = q.match(/\b(?:saying|that says|about|regarding)\s+["']?(.+?)["']?\s*$/i);
  return {
    toHint: toMatch?.[1]?.trim() || null,
    bodyHint: saying?.[1]?.trim().replace(/[?.!]+$/, '') || null,
  };
}

/**
 * Pull a focus deal / org name from recent conversation for multi-turn continuity.
 */
function resolveFocusFromHistory(history = []) {
  const blob = [...history]
    .reverse()
    .map((h) => String(h?.content || ''))
    .join('\n');

  const focusDeal = blob.match(/\b(?:focus is|near-term focus is|deal(?: that's)? closest[^.]*is)\s+([A-Za-z0-9][^(\n]{2,80}?)(?:\s*[—(]|$)/i);
  if (focusDeal?.[1]) {
    return { kind: 'deal', name: focusDeal[1].trim().replace(/[.,;:]+$/, '') };
  }

  const namedDeal = blob.match(/\b((?:[A-Za-z0-9][\w .-]{0,40})?Deal[\w .-]{0,40})/);
  if (namedDeal?.[1]) {
    return { kind: 'deal', name: namedDeal[1].trim() };
  }

  const orgStatus = blob.match(/\b(?:how\s+\w+\s+looks|status of|quiet right now[^.]*\b)?\b([A-Z][A-Za-z0-9 &._-]{2,60})\s+(?:looks quiet|currently)/i);
  if (orgStatus?.[1]) {
    return { kind: 'organization', name: orgStatus[1].trim() };
  }

  return null;
}

function fallbackDraft({ bodyHint, focus, toHint }) {
  const about = focus?.name || 'our work together';
  const subject = focus?.kind === 'deal'
    ? `Quick catch-up on ${focus.name}`
    : focus?.kind === 'organization'
      ? `Catching up — ${focus.name}`
      : 'Quick catch-up';

  const opener = bodyHint
    ? bodyHint.charAt(0).toUpperCase() + bodyHint.slice(1)
    : "Let's catch up";

  const body = [
    'Hi,',
    '',
    `${opener}${/[.!?]$/.test(opener) ? '' : '.'}`,
    '',
    focus?.name
      ? `Wanted to reconnect on ${focus.name} and align on next steps when you have 15–20 minutes.`
      : 'Wanted to reconnect and align on next steps when you have 15–20 minutes.',
    '',
    'Are you free later this week for a quick call?',
    '',
    'Thanks,',
    'Astra draft (review before sending)',
  ].join('\n');

  return {
    to: toHint && toHint.includes('@') ? toHint : '',
    subject,
    body,
  };
}

/**
 * @returns {Promise<{
 *   answer: string,
 *   blocks: object[],
 *   proposals: object[],
 *   suggestions: string[],
 *   draft: object,
 * }>}
 */
async function buildEmailDraftTurn({
  query,
  history = [],
  llm = null,
  organizationId = null,
  focus: focusInput = null,
} = {}) {
  const hints = parseEmailHints(query);
  const focus = focusInput?.name
    ? { kind: focusInput.kind || focusInput.moduleKey || 'record', name: focusInput.name }
    : resolveFocusFromHistory(history);
  let draft = fallbackDraft({
    bodyHint: hints.bodyHint || "Let's catch up",
    focus,
    toHint: hints.toHint,
  });

  if (typeof llm === 'function') {
    try {
      const messages = [
        {
          role: 'system',
          content: [
            'You are Astra drafting a short professional email for a CRM user.',
            'Return ONLY valid JSON: {"to":"","subject":"","body":""}.',
            'Keep body to 6–10 lines, warm and direct. No Markdown.',
            'If recipient email is unknown, leave to empty and address as Hi,',
            'Ground any deal/org name only from CONTEXT.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `USER REQUEST: ${query}`,
            `CONTEXT FOCUS: ${focus ? `${focus.kind}=${focus.name}` : '(none)'}`,
            `TO HINT: ${hints.toHint || '(none)'}`,
            `SAYING HINT: ${hints.bodyHint || '(none)'}`,
            'JSON only.',
          ].join('\n'),
        },
      ];
      const completion = await llm(messages, {
        organizationId,
        temperature: 0.5,
        maxTokens: 500,
      });
      const text = String(completion?.text || '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        draft = {
          to: String(parsed.to || draft.to || '').trim(),
          subject: String(parsed.subject || draft.subject).trim(),
          body: String(parsed.body || draft.body).trim(),
        };
      }
    } catch {
      /* keep fallback draft */
    }
  }

  const focusLine = focus?.name
    ? `I grounded this on **${focus.name}** from our conversation`
    : 'I drafted this from your catch-up ask';

  const answer = [
    `Sure — here's a catch-up email draft${focus?.name ? ` tied to ${focus.name}` : ''}.`,
    '',
    draft.to ? `To: ${draft.to}` : 'To: (add recipient — I don’t have an email on file yet)',
    `Subject: ${draft.subject}`,
    '',
    draft.body,
    '',
    'Review it, tweak if needed, then confirm to send. Astra won’t send without your OK.',
  ].join('\n').replace(/\*\*/g, '');

  const proposal = {
    id: `email-${crypto.randomUUID()}`,
    kind: 'email.send',
    toolName: 'email.send',
    label: draft.to ? `Send email to ${draft.to}` : 'Send this email (add recipient first)',
    summary: draft.to ? `Send email to ${draft.to}` : 'Send this email (add recipient first)',
    rationale: focusLine.replace(/\*\*/g, ''),
    fields: { ...draft, confirmed: false },
    payload: { ...draft, confirmed: false },
  };

  // Also expose confirm_action shape for clients that read toolResult
  const confirmation = buildConfirmation({
    toolName: 'email.send',
    risk: RISK.WRITE,
    summary: proposal.label,
    payload: proposal.payload,
  });

  const suggestions = [
    focus?.name ? `Tell me more about ${focus.name}` : 'List my open deals',
    'Make the email shorter',
    'Make the tone more formal',
    draft.to ? 'Send it' : 'Find a contact email for this',
  ].filter(Boolean).slice(0, 4);

  return {
    answer,
    blocks: [],
    proposals: [proposal],
    suggestions,
    draft,
    confirmation,
    focus,
  };
}

module.exports = {
  isEmailDraftIntent,
  parseEmailHints,
  resolveFocusFromHistory,
  buildEmailDraftTurn,
  EMAIL_INTENT,
};
