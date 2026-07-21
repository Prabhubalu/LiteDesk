'use strict';

/**
 * Astra Coach — second-pass quality gate for record Summarize.
 * Heuristic fixes (always) + optional LLM polish (ASTRA_COACH_V1, default on).
 * Does not invent CRM facts; improves structure, tone, and Do-next clarity.
 */

const { getLlmAdapter } = require('./providerRegistry');
const { redactMessages } = require('./piiRedaction');
const { parseJsonObject } = require('./aiMarketingService');
const {
  normalizeStructuredAnswer,
  filterJunkAstraActions,
} = require('./aiWorkGraphService');

function isAstraCoachEnabled() {
  const raw = String(process.env.ASTRA_COACH_V1 ?? 'true').toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function isWeakSummarizeAnswer(structured = {}) {
  const headline = String(structured.headline || '').trim();
  const bullets = Array.isArray(structured.bullets) ? structured.bullets : [];
  const detail = String(structured.detail || '').trim();
  if (!headline || headline.length < 8) return true;
  if (/^need one or two details/i.test(headline)) return true;
  if (/^email\s*:/i.test(headline)) return true;
  if (/still needed:/i.test(bullets.join(' '))) return true;
  if (bullets.length < 2 && detail.length < 40) return true;
  if (/^(summary|summarize|overview)\b/i.test(headline) && detail.length < 40) return true;
  return false;
}

/**
 * Deterministic coach — no LLM. Fixes known hijacks and thin answers.
 */
function heuristicCoachSummarize(structured, {
  recordTitle = '',
  moduleKey = '',
  contextText = '',
} = {}) {
  if (!structured || typeof structured !== 'object') return structured;
  const title = String(recordTitle || '').trim() || 'this record';
  const mk = String(moduleKey || '').toLowerCase();
  const ctx = String(contextText || '');
  const next = { ...structured };

  let headline = String(next.headline || '').trim();
  let bullets = Array.isArray(next.bullets) ? [...next.bullets] : [];
  let detail = String(next.detail || '').trim();

  if (/^need one or two details/i.test(headline) || /still needed:/i.test(bullets.join('\n'))) {
    headline = '';
    bullets = bullets.filter((b) => !/still needed:|pulled the rest from your crm/i.test(String(b)));
  }
  if (/^email\s*:/i.test(headline) || /quick refresh on your quote/i.test(headline)) {
    headline = '';
  }
  if (/^hi[, ]/i.test(detail) || /quick refresh on your quote/i.test(detail)) {
    detail = '';
  }

  const inNegotiation = /\bnegotiation\b/i.test(ctx + bullets.join(' '));
  const hasExpiredQuote = /\bexpired\s+quote\b/i.test(ctx + bullets.join(' '));

  if (!headline || headline.length < 10) {
    if (mk === 'deals' && inNegotiation) {
      headline = `${title}: in Negotiation — clear the path to close`;
    } else if (hasExpiredQuote) {
      headline = `${title}: expired quote needs a decisive follow-up`;
    } else {
      headline = `${title}: what matters now`;
    }
  }

  if (bullets.length < 2) {
    const recovered = [];
    if (mk === 'deals' && inNegotiation) {
      recovered.push('Deal is in Negotiation — lock terms or a decision date this week.');
    }
    if (hasExpiredQuote) {
      recovered.push('An expired quote is still attached — refresh or withdraw before momentum dies.');
    }
    if (/\bclose\s*date\b/i.test(ctx)) {
      recovered.push('Confirm the close date still matches buyer timing.');
    }
    if (!recovered.length) {
      recovered.push(`Lead with the open risk on ${title}, then one concrete next move.`);
    }
    bullets = [...recovered, ...bullets].slice(0, 16);
  }

  if (detail.length < 40) {
    detail = mk === 'deals'
      ? `${title} needs a clear close path: name the blocker, then pick one move (buyer call, quote refresh, or stage update with a reason). Keep the summary about momentum — not field labels.`
      : `Focus on situation and risk for ${title}, then one concrete ask. Skip restating fields staff can already see.`;
  }

  let actions = Array.isArray(next.actions) ? [...next.actions] : [];
  actions = actions.filter((a) => {
    if (!a) return false;
    if (a.kind === 'create_record' && String(a.moduleKey || '').toLowerCase() === 'events') return false;
    if (/^create\s+events?$/i.test(String(a.label || ''))) return false;
    return true;
  });
  actions = filterJunkAstraActions(actions, { max: 8 });

  next.headline = headline.slice(0, 320);
  next.bullets = bullets.slice(0, 16);
  next.detail = detail.slice(0, 16000);
  next.actions = actions;
  next.suggestionMode = true;
  if (!Array.isArray(next.clarifyingQuestions) || next.clarifyingQuestions.length < 2) {
    next.clarifyingQuestions = [
      mk === 'deals' ? `What is blocking ${title} from closing?` : `What should I do next with ${title}?`,
      hasExpiredQuote ? 'Help me reopen the expired quote' : `Draft a buyer email for ${title}`,
      `Suggest next best actions for ${title}`,
    ].slice(0, 3);
  }
  next.coached = true;
  return next;
}

function formatMemoryPrefsForCoach(memory = {}) {
  const bits = [];
  if (memory.preferCoachingSummary !== false) bits.push('Prefer coaching insight over field dumps');
  if (memory.preferSummaryNotEmail !== false) bits.push('Never replace the summary with an email body');
  if (memory.preferOpenFirst !== false) bits.push('Prefer open pipeline momentum');
  if (Array.isArray(memory.dismissedFingerprints) && memory.dismissedFingerprints.length) {
    bits.push(`Avoid dismissed actions: ${memory.dismissedFingerprints.slice(-5).join(', ')}`);
  }
  return bits.length ? bits.map((b) => `- ${b}`).join('\n') : '- Prefer human, specific coaching';
}

/**
 * Optional LLM coach — tight JSON rewrite when heuristic still weak or always when enabled.
 */
async function llmCoachSummarize({
  structured,
  question = '',
  contextText = '',
  recordTitle = '',
  moduleKey = '',
  config = null,
  redactOpts = {},
  userMemory = null,
} = {}) {
  if (!config?.apiKey || !config?.provider || !config?.model) {
    return { structured, usage: null, llm: false };
  }
  const adapter = getLlmAdapter(config.provider);
  if (!adapter?.complete) return { structured, usage: null, llm: false };

  const draft = {
    headline: structured.headline,
    bullets: structured.bullets,
    detail: structured.detail,
    actions: (structured.actions || []).slice(0, 8).map((a) => ({
      label: a.label,
      kind: a.kind,
      moduleKey: a.moduleKey,
      recordId: a.recordId,
      priority: a.priority,
      rationale: a.rationale,
    })),
    clarifyingQuestions: structured.clarifyingQuestions || [],
  };

  const messages = [
    {
      role: 'system',
      content: [
        'You are Astra Coach. Improve a CRM record SUMMARY for sales staff.',
        'Return JSON only:',
        '{"headline":"string","bullets":["string"],"detail":"string",',
        '"clarifyingQuestions":["string"],',
        '"actions":[{"label":"string","kind":"send_email|follow_up|manual|complete_task|update_record","moduleKey":"string","recordId":"string","priority":"high|medium|low","rationale":"string"}]}',
        'Rules:',
        '- Keep CRM facts from the draft/context. Never invent amounts, emails, or stages.',
        '- headline = one insight (not "Summary", not "Email:", not "Need details").',
        '- bullets = 3–8 situation/risk/momentum lines. No field dumps (email:, owner:). Finish each line.',
        '- detail = complete coaching brief (finish every sentence; do not truncate mid-thought).',
        '- actions = 2–6 verb-first Do-next items. No create events. No "Open Generative Canvas".',
        '- clarifyingQuestions = 2–3 suggestion chips, not blocking field asks.',
        '- Prefer summary first; email is an action, never the whole answer.',
        '- Include at least one practical AI assist (questions / call opener / talking points) — not CRM clicks only.',
        formatMemoryPrefsForCoach(userMemory),
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Ask: ${String(question || '').slice(0, 400)}`,
        `Record: ${recordTitle || moduleKey}`,
        '',
        'Draft JSON:',
        JSON.stringify(draft),
        '',
        'CRM context (excerpt):',
        String(contextText || '').slice(0, 12000),
      ].join('\n'),
    },
  ];

  try {
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages(messages, redactOpts),
      temperature: 0.2,
      maxTokens: 5000,
      providerOptions: config.providerOptions,
    });
    const parsed = parseJsonObject(String(completion?.text || completion?.content || ''));
    if (!parsed || typeof parsed !== 'object') {
      return { structured, usage: completion?.usage || null, llm: false };
    }
    const normalized = normalizeStructuredAnswer(parsed, [], {
      maxBullets: 16,
      maxHeadline: 320,
      maxActions: 8,
      maxRationale: 400,
      maxBulletLen: 800,
      maxDetail: 16000,
    });
    const merged = {
      ...structured,
      headline: normalized.headline || structured.headline,
      bullets: normalized.bullets?.length ? normalized.bullets : structured.bullets,
      detail: normalized.detail || structured.detail,
      clarifyingQuestions: normalized.clarifyingQuestions?.length
        ? normalized.clarifyingQuestions
        : structured.clarifyingQuestions,
      actions: normalized.actions?.length
        ? filterJunkAstraActions(normalized.actions, { max: 8 })
        : structured.actions,
      suggestionMode: true,
      coached: true,
      coachLlm: true,
    };
    return { structured: merged, usage: completion?.usage || null, llm: true };
  } catch (err) {
    console.warn('[AstraCoach] LLM coach failed:', err?.message || err);
    return { structured, usage: null, llm: false };
  }
}

/**
 * Full coach pipeline for record summarize.
 */
async function coachRecordSummarizeAnswer({
  structured,
  question = '',
  contextText = '',
  recordTitle = '',
  moduleKey = '',
  config = null,
  redactOpts = {},
  userMemory = null,
  forceLlm = false,
} = {}) {
  let next = heuristicCoachSummarize(structured, { recordTitle, moduleKey, contextText });
  let usage = null;
  let llm = false;

  const alwaysLlm = String(process.env.ASTRA_COACH_LLM || 'weak').toLowerCase();
  const shouldLlm = isAstraCoachEnabled() && (
    alwaysLlm === 'always'
    || alwaysLlm === 'true'
    || forceLlm
    || ((alwaysLlm === 'weak' || alwaysLlm === 'auto') && isWeakSummarizeAnswer(next))
  );

  if (shouldLlm) {
    const coached = await llmCoachSummarize({
      structured: next,
      question,
      contextText,
      recordTitle,
      moduleKey,
      config,
      redactOpts,
      userMemory,
    });
    next = coached.structured;
    usage = coached.usage;
    llm = coached.llm;
    // Re-run heuristic to kill any residual hijacks from LLM
    next = heuristicCoachSummarize(next, { recordTitle, moduleKey, contextText });
    if (llm) next.coachLlm = true;
  }

  return { structured: next, usage, llm, enabled: isAstraCoachEnabled() };
}

function formatMemoryPrefsForPrompt(memory = {}) {
  if (!memory || typeof memory !== 'object') return '';
  const lines = ['User Astra prefs (honor these):'];
  if (memory.preferCoachingSummary !== false) {
    lines.push('- Prefer coaching summaries: insight + risk + next move (not field dumps).');
  }
  if (memory.preferSummaryNotEmail !== false) {
    lines.push('- Never replace a summarize answer with an email body; email is a Do-next action only.');
  }
  if (Array.isArray(memory.dismissedFingerprints) && memory.dismissedFingerprints.length) {
    lines.push(`- Do not re-suggest dismissed actions: ${memory.dismissedFingerprints.slice(-8).join('; ')}`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

module.exports = {
  isAstraCoachEnabled,
  isWeakSummarizeAnswer,
  heuristicCoachSummarize,
  llmCoachSummarize,
  coachRecordSummarizeAnswer,
  formatMemoryPrefsForPrompt,
  formatMemoryPrefsForCoach,
};
