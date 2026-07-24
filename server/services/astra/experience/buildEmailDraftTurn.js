'use strict';

/**
 * Email draft turn — grounded coworker email from user intent + CRM focus/related context.
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
  const saying = q.match(/\b(?:saying|that says|about|regarding|re)\s+["']?(.+?)["']?\s*$/i);
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

function formatRelatedLine(row) {
  const mk = String(row.moduleKey || row.kind || 'record');
  const title = String(row.title || row.name || '').trim() || 'Untitled';
  const bits = [`[${mk}] ${title}`];
  if (row.subtitle) bits.push(String(row.subtitle));
  if (row.status) bits.push(`status=${row.status}`);
  if (row.quoteNumber || row.number) bits.push(`#${row.quoteNumber || row.number}`);
  return bits.join(' · ');
}

/**
 * Score related records against the user ask (expired quote, sample deal, etc.).
 */
function pickTopicFromRelated(query, related = []) {
  const q = String(query || '').toLowerCase();
  const rows = Array.isArray(related) ? related : [];
  if (!rows.length) return null;

  const wantsQuote = /\bquotes?\b/.test(q);
  const wantsDeal = /\bdeals?\b|\bpipeline\b|\bopportunit/.test(q);
  const wantsCase = /\bcases?\b|\btickets?\b/.test(q);
  const wantsExpired = /\bexpired\b|\bexpir/.test(q);

  // Prefer the matching module family when the ask names it.
  let pool = rows;
  if (wantsQuote) {
    const quotes = rows.filter((r) => String(r.moduleKey || '').toLowerCase().includes('quote'));
    if (quotes.length) pool = quotes;
  } else if (wantsDeal) {
    const deals = rows.filter((r) => String(r.moduleKey || '').toLowerCase() === 'deals');
    if (deals.length) pool = deals;
  } else if (wantsCase) {
    const cases = rows.filter((r) => String(r.moduleKey || '').toLowerCase() === 'cases');
    if (cases.length) pool = cases;
  }

  const scored = pool.map((r) => {
    const mk = String(r.moduleKey || '').toLowerCase();
    const title = String(r.title || r.name || '').toLowerCase();
    const status = String(r.status || '').toLowerCase();
    const subtitle = String(r.subtitle || '').toLowerCase();
    const blob = `${title} ${status} ${subtitle}`;
    let score = 0;

    if (mk.includes('quote')) score += 4;
    if (mk === 'deals') score += 2;
    if (wantsExpired && /expir/.test(blob)) score += 10;
    if (wantsExpired && mk.includes('quote') && /expir/.test(status)) score += 8;

    const hintWords = q
      .replace(/\b(draft|write|compose|prepare|send|an|a|the|email|e-mail|mail|message|regarding|about|to|for|with|this|contact|person|expired|quote|quotes|deal|deals)\b/gi, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3);
    for (const w of hintWords) {
      if (blob.includes(w)) score += 2;
    }

    return { row: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0]) return scored[0].row;
  return null;
}

function greetingFirstName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const skip = new Set(['mr', 'mrs', 'ms', 'dr', 'miss']);
  while (parts.length) {
    const token = parts[0].toLowerCase().replace(/\./g, '');
    if (skip.has(token)) {
      parts.shift();
      continue;
    }
    break;
  }
  return parts[0] || String(fullName || '').trim() || '';
}

function fallbackDraft({ bodyHint, focus, toHint, topic, related = [] }) {
  const person = focus?.name || 'there';
  const first = greetingFirstName(person) || 'there';
  const topicTitle = topic?.title || topic?.name || null;
  const topicStatus = topic?.status || null;
  const topicNumber = topic?.quoteNumber || topic?.number || null;
  const topicModule = String(topic?.moduleKey || '').toLowerCase();
  const vagueHint = !bodyHint || /^(the\s+)?(expired\s+)?quote\.?$/i.test(String(bodyHint).trim());

  let subject = 'Quick catch-up';
  if (topicTitle && topicModule.includes('quote')) {
    subject = topicStatus && /expir/i.test(String(topicStatus))
      ? `Expired quote${topicNumber ? ` ${topicNumber}` : ''}: ${topicTitle}`
      : `Regarding quote${topicNumber ? ` ${topicNumber}` : ''}: ${topicTitle}`;
  } else if (topicTitle && topicModule === 'deals') {
    subject = `Following up on ${topicTitle}`;
  } else if (focus?.kind === 'deals' || focus?.moduleKey === 'deals') {
    subject = `Quick catch-up on ${focus.name}`;
  } else if (focus?.name) {
    subject = `Following up — ${focus.name}`;
  }

  let opener;
  if (topicTitle && topicModule.includes('quote')) {
    opener = topicStatus && /expir/i.test(String(topicStatus))
      ? `I wanted to follow up on the expired quote${topicNumber ? ` (${topicNumber})` : ''} for ${topicTitle}`
      : `I wanted to follow up on quote${topicNumber ? ` ${topicNumber}` : ''} — ${topicTitle}`;
  } else if (!vagueHint && bodyHint) {
    opener = bodyHint.charAt(0).toUpperCase() + bodyHint.slice(1);
  } else {
    opener = 'I wanted to reconnect';
  }

  const relatedDeals = related.filter((r) => String(r.moduleKey || '').toLowerCase() === 'deals').slice(0, 2);
  const relatedLine = relatedDeals.length
    ? `This also ties to ${relatedDeals.map((d) => d.title).join(' and ')}.`
    : '';

  const body = [
    `Hi ${first},`,
    '',
    `${opener}${/[.!?]$/.test(opener) ? '' : '.'}`,
    '',
    relatedLine || null,
    relatedLine ? '' : null,
    'Happy to hop on a quick call this week to align on next steps — does that work for you?',
    '',
    'Thanks,',
    'Astra draft (review before sending)',
  ].filter((line) => line != null).join('\n').replace(/\n{3,}/g, '\n\n');

  return {
    to: toHint && toHint.includes('@') ? toHint : '',
    subject,
    body,
  };
}

function enrichRelatedWithQuoteDetails(related, quoteDocsById) {
  if (!quoteDocsById || !related?.length) return related;
  return related.map((r) => {
    if (!String(r.moduleKey || '').toLowerCase().includes('quote')) return r;
    const doc = quoteDocsById.get(String(r.id));
    if (!doc) return r;
    return {
      ...r,
      title: doc.name || doc.title || r.title,
      status: doc.status || r.status,
      quoteNumber: doc.quoteNumber || doc.number || null,
      subtitle: [doc.quoteNumber || doc.number, doc.status].filter(Boolean).join(' · ') || r.subtitle,
    };
  });
}

async function loadQuoteDetails(related, organizationId, deps = {}) {
  const quoteIds = (related || [])
    .filter((r) => String(r.moduleKey || '').toLowerCase().includes('quote') && r.id)
    .map((r) => String(r.id))
    .slice(0, 5);
  if (!quoteIds.length || !organizationId) return new Map();

  try {
    const Quote = deps?.models?.Quote || require('../../../models/Quote');
    const rows = await Quote.find({
      _id: { $in: quoteIds },
      organizationId,
      deletedAt: null,
    })
      .select('name title status quoteNumber number')
      .lean();
    const map = new Map();
    for (const row of rows || []) {
      map.set(String(row._id), row);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadFocusRecipient(focus, organizationId, deps = {}) {
  const moduleKey = String(focus?.moduleKey || focus?.kind || '').toLowerCase();
  const id = String(focus?.id || focus?.recordId || '').trim();
  if (!id || !organizationId) return { email: null, title: focus?.name || null };

  if (moduleKey === 'people') {
    try {
      const People = deps?.models?.People || require('../../../models/People');
      const row = await People.findOne({ _id: id, organizationId, deletedAt: null })
        .select('email first_name last_name')
        .lean();
      if (row) {
        const title = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || focus?.name;
        return { email: row.email || null, title };
      }
    } catch {
      /* ignore */
    }
  }
  return { email: null, title: focus?.name || null };
}

async function loadRelatedContext({ focus, organizationId, toolRegistry, deps = {} }) {
  const moduleKey = String(focus?.moduleKey || focus?.kind || '').trim();
  const recordId = String(focus?.id || focus?.recordId || '').trim();
  if (!moduleKey || !recordId) {
    return { related: [], recipientEmail: null, focusName: focus?.name || null };
  }

  const ctx = {
    organizationId,
    deps,
    toolRegistry,
  };

  const recipient = await loadFocusRecipient(focus, organizationId, deps);
  let related = [];
  const relTool = toolRegistry?.getTool?.('relationships.context');
  if (relTool) {
    const rel = await relTool.run({ moduleKey, recordId }, ctx);
    related = Array.isArray(rel?.related) ? rel.related : [];
  }

  const quoteMap = await loadQuoteDetails(related, organizationId, deps);
  related = enrichRelatedWithQuoteDetails(related, quoteMap);

  return {
    related,
    recipientEmail: recipient.email,
    focusName: recipient.title || focus?.name || null,
  };
}

function buildContextualSuggestions({ focus, topic, related = [], draft }) {
  const name = focus?.name || null;
  const suggestions = [];
  if (topic?.title) {
    suggestions.push(`What is the status of ${topic.title}?`);
  }
  const deal = related.find((r) => String(r.moduleKey || '').toLowerCase() === 'deals');
  if (deal?.title) suggestions.push(`Summarize ${deal.title}`);
  if (name) suggestions.push(`What is the next best action for ${name}?`);
  suggestions.push('Make the email shorter');
  suggestions.push('Make the tone more formal');
  if (!draft?.to) suggestions.push(name ? `Find an email for ${name}` : 'Find a contact email for this');
  else suggestions.push('Send it');
  return [...new Set(suggestions)].filter(Boolean).slice(0, 4);
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
  toolRegistry = null,
  deps = {},
  situation = null,
} = {}) {
  const hints = parseEmailHints(query);
  const historyFocus = resolveFocusFromHistory(history);
  let focus = focusInput?.id || focusInput?.name
    ? {
      kind: focusInput.kind || focusInput.moduleKey || 'record',
      moduleKey: focusInput.moduleKey || focusInput.kind || undefined,
      id: focusInput.id || focusInput.recordId || undefined,
      name: focusInput.name || undefined,
    }
    : historyFocus;

  const grounding = situation?.ok
    ? {
      related: situation.related || [],
      recipientEmail: null,
      focusName: situation.focus?.title || focus?.name || null,
    }
    : await loadRelatedContext({
      focus,
      organizationId,
      toolRegistry,
      deps,
    });

  // Always try recipient email from focus person.
  if (!grounding.recipientEmail && focus?.id) {
    const recipient = await loadFocusRecipient(focus, organizationId, deps);
    grounding.recipientEmail = recipient.email;
    if (recipient.title) grounding.focusName = recipient.title;
  }

  if (focus && grounding.focusName) {
    focus = { ...focus, name: grounding.focusName };
  }

  // Prefer situation-related (richer) when available.
  if (situation?.ok && Array.isArray(situation.related) && situation.related.length) {
    grounding.related = situation.related;
  }

  const topic = pickTopicFromRelated(query, grounding.related);
  const toHint = hints.toHint || grounding.recipientEmail || null;

  let draft = fallbackDraft({
    bodyHint: hints.bodyHint,
    focus,
    toHint,
    topic,
    related: grounding.related,
  });
  if (toHint && toHint.includes('@')) {
    draft.to = toHint;
  }

  const relatedLines = grounding.related.slice(0, 12).map(formatRelatedLine);
  const topicLine = topic
    ? formatRelatedLine(topic)
    : '(none — write a general follow-up only if needed)';
  const situationBlock = situation?.llmText
    ? `\nSITUATION:\n${situation.llmText}`
    : '';

  if (typeof llm === 'function') {
    try {
      const messages = [
        {
          role: 'system',
          content: [
            'You are Astra drafting a short professional CRM email.',
            'Return ONLY valid JSON: {"to":"","subject":"","body":""}.',
            'Ground the email in RELATED RECORDS, TOPIC, and SITUATION — never invent quote numbers, deal names, or statuses.',
            'If the user mentions an expired quote, write specifically about that quote (title + number/status when provided).',
            'Use recent activity/emails in SITUATION when relevant (e.g. continue a thread).',
            'Address the contact by first name when FOCUS is a person. Keep body to 6–10 lines, warm and direct. No Markdown.',
            'If recipient email is unknown, leave to empty.',
            'Subject must be specific to the topic (not a generic "Quick catch-up" when a quote/deal is in TOPIC).',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `USER REQUEST: ${query}`,
            `FOCUS: ${focus ? `${focus.moduleKey || focus.kind}=${focus.name || ''}${focus.id ? ` id=${focus.id}` : ''}` : '(none)'}`,
            `TOPIC (primary grounding): ${topicLine}`,
            'RELATED RECORDS:',
            relatedLines.length ? relatedLines.map((l) => `- ${l}`).join('\n') : '- (none loaded)',
            situationBlock,
            `TO HINT: ${toHint || '(none)'}`,
            `SAYING HINT: ${hints.bodyHint || '(none)'}`,
            'JSON only.',
          ].join('\n'),
        },
      ];
      const completion = await llm(messages, {
        organizationId,
        temperature: 0.45,
        maxTokens: 700,
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

  if (!draft.to && toHint && String(toHint).includes('@')) {
    draft.to = String(toHint).trim();
  }

  const groundedOn = topic?.title
    ? `${topic.title}${topic.quoteNumber ? ` (${topic.quoteNumber})` : ''}`
    : focus?.name || null;

  const answer = [
    groundedOn
      ? `Sure — here's an email draft grounded on ${groundedOn}${focus?.name && topic?.title ? ` for ${focus.name}` : ''}.`
      : 'Sure — here\'s an email draft.',
    '',
    draft.to ? `To: ${draft.to}` : 'To: (add recipient — I don’t have an email on file yet)',
    `Subject: ${draft.subject}`,
    '',
    draft.body,
    '',
    'Review it, tweak if needed, then confirm to send. Astra won’t send without your OK.',
  ].join('\n');

  const proposal = {
    id: `email-${crypto.randomUUID()}`,
    kind: 'email.send',
    toolName: 'email.send',
    label: draft.to ? `Send email to ${draft.to}` : 'Send this email (add recipient first)',
    summary: draft.to ? `Send email to ${draft.to}` : 'Send this email (add recipient first)',
    rationale: groundedOn
      ? `Grounded on ${groundedOn} and related CRM situation`
      : 'Drafted from your ask',
    fields: { ...draft, confirmed: false },
    payload: { ...draft, confirmed: false },
  };

  const confirmation = buildConfirmation({
    toolName: 'email.send',
    risk: RISK.WRITE,
    summary: proposal.label,
    payload: proposal.payload,
  });

  const suggestions = [
    ...buildContextualSuggestions({
      focus,
      topic,
      related: grounding.related,
      draft,
    }).map((prompt) => ({ label: String(prompt).slice(0, 48), prompt })),
    ...(situation?.suggestionCards || []).map((c) => ({ label: c.title, prompt: c.prompt })),
  ];

  return {
    answer,
    blocks: [],
    proposals: [proposal],
    suggestions: [...new Map(suggestions.map((s) => [s.prompt, s])).values()].slice(0, 4),
    draft,
    confirmation,
    focus,
    topic,
    related: grounding.related,
  };
}

module.exports = {
  isEmailDraftIntent,
  parseEmailHints,
  resolveFocusFromHistory,
  pickTopicFromRelated,
  buildEmailDraftTurn,
  EMAIL_INTENT,
};
