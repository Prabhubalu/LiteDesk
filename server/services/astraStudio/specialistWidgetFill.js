'use strict';

/**
 * Fill Living Canvas widgets via Mission Control specialist seats.
 * Never use surface: 'astra-studio' here — that would recurse into canvas tools.
 */

const tenantCatalog = require('../astra/agents/tenantCatalogService');

const CONCURRENCY = 3;
const BODY_MAX = 4000;
const STUDIO_FILL_SURFACE = 'service';

/** @type {Record<string, string>} */
const TYPE_SPECIALIST = {
  'ai.risk': 'deal-intelligence',
  'ai.insights': 'relationship-intelligence',
  'ai.summary': 'meeting-intelligence',
  'ai.recommendations': 'deal-intelligence',
  'ai.nba': 'workday-orchestrator',
  'content.checklist': 'task-activity',
  'content.rich_text': 'summary',
  'content.table': 'summary',
  'viz.relationship_graph': 'relationship-intelligence',
};

/**
 * @param {{ type?: string, config?: { title?: string } }} widget
 * @returns {string}
 */
function resolveSpecialistForWidget(widget) {
  const type = String(widget?.type || '');
  const title = String(widget?.config?.title || '').toLowerCase();
  if (TYPE_SPECIALIST[type]) return TYPE_SPECIALIST[type];
  if (type.includes('risk') || type.includes('objection')) return 'deal-intelligence';
  if (type.includes('insight') || title.includes('stakeholder')) return 'relationship-intelligence';
  if (type.includes('recommend') || title.includes('talking')) return 'deal-intelligence';
  if (type.includes('summary') || title.includes('agenda')) return 'meeting-intelligence';
  if (type.includes('nba')) return 'workday-orchestrator';
  if (type === 'content.checklist' || title.includes('action') || title.includes('question')) {
    return 'task-activity';
  }
  if (type.startsWith('ai.')) return 'summary';
  return 'summary';
}

/**
 * Distinct panel intent — drives query + fallback so widgets do not clone each other.
 * @param {{ type?: string, config?: { title?: string } }} widget
 * @returns {string}
 */
function panelKind(widget) {
  const type = String(widget?.type || '');
  const title = String(widget?.config?.title || '').toLowerCase();
  if (type.includes('risk') || /risk|objection/i.test(title)) return 'risk';
  if (/buying\s*signal|signal/i.test(title)) return 'buying_signals';
  if (
    /stakeholder|decision\s*maker/i.test(title)
    || type === 'viz.relationship_graph'
  ) {
    return 'stakeholders';
  }
  if (/competitor/i.test(title) || type === 'content.table') return 'competitors';
  if (/win\s*strateg/i.test(title)) return 'win_strategy';
  if (type.includes('recommend') || /talking/i.test(title)) return 'talking';
  if (/agenda/i.test(title)) return 'agenda';
  if (type.includes('summary')) return 'summary';
  if (/health|insight/i.test(title) || type.includes('insight')) return 'insights';
  if (type === 'content.checklist' || /action|question|task/i.test(title)) return 'checklist';
  if (type.includes('nba')) return 'nba';
  return 'generic';
}

/**
 * @param {Array<{ moduleKey?: string, recordId?: string, recordName?: string }>} focus
 */
function primaryFocus(focus = []) {
  const list = Array.isArray(focus) ? focus : [];
  const order = ['people', 'organizations', 'deals', 'cases', 'quotes'];
  const ranked = [...list].sort((a, b) => {
    const ai = order.indexOf(String(a.moduleKey || '').toLowerCase());
    const bi = order.indexOf(String(b.moduleKey || '').toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const hit = ranked[0];
  if (!hit?.recordId) return null;
  return {
    moduleKey: hit.moduleKey,
    id: hit.recordId,
    recordId: hit.recordId,
    name: hit.recordName,
  };
}

const PARTY_MODULES = new Set(['people', 'organizations', 'deals', 'person', 'contact', 'organization', 'org', 'deal']);

function hasPartyFocus(focus = []) {
  return (Array.isArray(focus) ? focus : []).some((f) => {
    const mk = String(f?.moduleKey || '').toLowerCase();
    return PARTY_MODULES.has(mk) && f?.recordId;
  });
}

function extractNamedParty(prompt = '') {
  const text = String(prompt || '').trim();
  const quoted = text.match(/['"“”]([^'"“”]{2,80})['"“”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const withFor = text.match(
    /\b(?:with|for|about|regarding)\s+([A-Za-z][A-Za-z0-9 .,&'_-]{1,60}?)(?:\s+(?:deal|meeting|case|account|org(?:anization)?|tomorrow|today|next)\b|[?.!]|$)/i,
  );
  if (withFor?.[1]) return withFor[1].trim().replace(/[?.!,]+$/, '');
  return '';
}

function focusLabel(focus = [], prompt = '') {
  const ordered = [...(Array.isArray(focus) ? focus : [])];
  const deal = ordered.find((f) => /deal/i.test(String(f.moduleKey || '')));
  if (deal?.recordName) return String(deal.recordName);
  const person = ordered.find((f) => /people|person|contact/i.test(String(f.moduleKey || '')));
  if (person?.recordName) return String(person.recordName);
  const org = ordered.find((f) => /org|account/i.test(String(f.moduleKey || '')));
  if (org?.recordName) return String(org.recordName);
  if (ordered[0]?.recordName) return String(ordered[0].recordName);
  const named = extractNamedParty(prompt);
  if (named) return named;
  return 'this opportunity';
}

function sanitizeUserAsk(prompt = '') {
  return String(prompt || '')
    .replace(/\b(prepare|prep|meeting\s+prep|living\s+canvas|war\s*room|customer\s*360)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function isWarRoom(canvasType = '') {
  return /war_room|opportunity/i.test(String(canvasType || ''));
}

function isMeetingCanvas(canvasType = '') {
  return /meeting/i.test(String(canvasType || '')) || !canvasType;
}

/**
 * @param {{ type?: string, config?: { title?: string } }} widget
 * @param {string} prompt
 * @param {Array} focus
 * @param {string} situationText
 * @param {string} [canvasType]
 */
function buildSpecialistQuery(widget, prompt, focus, situationText = '', canvasType = '', productName = '') {
  const kind = panelKind(widget);
  const title = String(widget?.config?.title || widget?.type || 'panel');
  let policy = null;
  try {
    policy = require('./hydratePolicy').getHydratePolicy(canvasType);
  } catch {
    policy = null;
  }
  const mode = policy?.specialistMode || (isOrgScopedFill(canvasType, policy) ? 'org' : 'party');
  const allowNoParty = Boolean(policy?.fillWithoutParty) || mode === 'org' || mode === 'abstract';
  const noParty = !hasPartyFocus(focus) && allowNoParty;
  const brand = String(productName || '').trim();
  const subject = noParty
    ? (mode === 'abstract'
      ? (brand || 'this workspace')
      : (brand || 'the organization'))
    : focusLabel(focus, prompt);
  const userAsk = sanitizeUserAsk(prompt);
  const war = isWarRoom(canvasType);
  const ground = noParty && mode === 'org'
    ? `Ground every line on the ORGANIZATION pipeline snapshot in the SITUATION BRIEF (open deals, stages, won/lost). `
      + `This is NOT a single-deal board — do not invent a primary-contact opportunity workspace. `
      + `Do not invent deals or amounts. If a figure is missing, omit it. `
    : noParty && mode === 'abstract'
      ? `Ground on the USER ASK and SITUATION BRIEF. Do not invent CRM records or dollar amounts. `
      : `Ground every line on ${subject} only. `
        + `Use the SITUATION BRIEF below as source of truth (related deals, activity, emails). `
        + `Do not invent unrelated events or accounts. `
        + `Never cite ReportsE2E, fixture, or seed calendar events. `
        + `Do not narrate tools, briefs, or missing data — if unknown, omit that bullet. `
        + `Do not copy the same generic meeting dump into this panel. `;
  const brief = String(situationText || '').trim()
    ? `\n\nSITUATION BRIEF:\n${String(situationText).slice(0, 3500)}`
    : '';
  const ask = userAsk ? `User ask: ${userAsk}` : '';
  const modeNote = noParty && mode === 'org'
    ? `This is an organization-wide executive report for ${subject}. `
    : noParty && mode === 'abstract'
      ? `This is a ${canvasType || 'workspace'} board for ${subject}. `
      : war
        ? `This is an opportunity war room for ${subject}, not a meeting-prep board. Never write "Situation for Your Meeting" or a meeting agenda. `
        : isMeetingCanvas(canvasType)
          ? `This is meeting preparation for ${subject}. `
          : `Workspace focus: ${subject}. `;

  const productLabel = brand || 'our product';
  const orgScoped = noParty && mode === 'org';

  /** @type {Record<string, string>} */
  const prompts = {
    risk: orgScoped
      ? `List 3–6 organization pipeline risks for ${subject} (stalled deals, expired quotes, concentration, overdue work). ${modeNote}${ground}Reply as "Risk: detail" bullets only. No preamble. ${ask}`
      : war
        ? `List 3–6 concrete deal risks or objections for ${subject} (pricing, competitor, champion gap, legal, timing). ${modeNote}${ground}Reply as "Risk: detail" bullets only. No preamble. ${ask}`
        : `For ${subject}, list 3–6 concrete risks or blockers for an upcoming meeting. ${ground}Reply as short "Label: detail" bullets only. No preamble. ${ask}`,
    buying_signals:
      `List 3–6 buying signals or anti-signals for ${subject} `
      + `(engagement, urgency, budget hints, champion strength, quote status). `
      + `${modeNote}${ground}`
      + `Reply as "Signal: detail" bullets only. No stakeholders dump, no meeting agenda. No preamble. ${ask}`,
    stakeholders:
      `Map stakeholders for ${subject}: name + buying role `
      + `(economic buyer, champion, technical, legal, blocker) when known from CRM. `
      + `${modeNote}${ground}`
      + `Reply as "Name: Role — one fact" bullets only. Skip unknown people. No preamble. ${ask}`,
    competitors:
      `Write a competitor matrix for selling ${productLabel} (tenant organization / our product) into this opportunity (${subject}). `
      + `Competitors = alternatives to ${productLabel} that a customer like this might buy — not competitors of the account's current tool. `
      + `${modeNote}${ground}`
      + `Prefer the WEB COMPETITOR RESEARCH section in the brief when present (public web findings with sources). `
      + `Use exactly this structure (headings on their own lines, no bullets on headings):\n`
      + `Current Situation\n`
      + `<1–2 short prose sentences: why ${productLabel} vs alternatives for this customer>\n`
      + `Key Competitors\n`
      + `<3–5 "Competitor: Name — note" bullets — real product names only (e.g. Salesforce, HubSpot), never article titles or "Web:" rows>\n`
      + `Optionally end with a Sources heading and "Source: label — https://..." lines (keep full URLs). `
      + `Do not invent competitor brands. Do not treat listicle titles ("Alternatives In 2026", "10 Best CRM…") as competitor names. `
      + `If ${productLabel} is not yet live, still compare to products that solve the same job for this customer. `
      + `Do not dump stakeholders, quotes, or email cadence into Current Situation. No preamble. ${ask}`,
    win_strategy:
      `Give 3–6 win-strategy moves for ${subject} (proof points, champion plan, next commercial step). `
      + `${modeNote}${ground}`
      + `Reply as "Move: detail" bullets only. No placeholder tokens like [Items] or [quotes]. No preamble. ${ask}`,
    talking:
      `For ${subject}, give 3–6 talking points. ${modeNote}${ground}`
      + `Reply as short "Theme: point" bullets only. No preamble. ${ask}`,
    agenda:
      `Build a concise meeting agenda for a meeting with ${subject}. ${ground}`
      + `Reply as 3–6 short bullets. No preamble. ${ask}`,
    summary:
      orgScoped
        ? `Write a concise executive summary of ${subject}'s organization pipeline and revenue for leadership ("${title}"). ${modeNote}${ground}`
          + `Cover open pipeline, stage mix, and what needs attention. 3–5 short bullets. No preamble. ${ask}`
        : `Write a concise executive summary for ${subject} focused on "${title}". ${modeNote}${ground}`
          + `3–5 short bullets. No preamble. ${ask}`,
    insights:
      `List 3–6 CRM-grounded insights about ${subject} for "${title}". ${modeNote}${ground}`
      + `Reply as "Insight: detail" bullets. No meeting agenda. No preamble. ${ask}`,
    checklist: war
      ? `Propose 3–6 open tasks to advance ${subject}. ${modeNote}${ground}Short action bullets only. No preamble. ${ask}`
      : `For the meeting with ${subject}, propose 3–6 checklist questions or actions. ${ground}Short bullets only. No preamble. ${ask}`,
    nba:
      `For ${subject}, list 3–5 next best actions. ${modeNote}${ground}Short bullets only. No preamble. ${ask}`,
    generic:
      `Summarize useful points about ${subject} for panel "${title}" only. ${modeNote}${ground}`
      + `Short bullets specific to this panel. No preamble. ${ask}`,
  };

  return (prompts[kind] || prompts.generic) + brief;
}

/**
 * Strip Mongo objectIds / module:id refs / placeholder tokens from panel text.
 * Models often echo situation-brief plumbing into user-facing bullets.
 */
function scrubInternalIds(text = '') {
  return String(text || '')
    .replace(
      /\b(?:people|organizations?|orgs?|deals?|quotes?|cases?|tasks?|events?|items?|contacts?|accounts?):[a-f0-9]{24}\b/gi,
      '',
    )
    .replace(/\bid\s*[=:]\s*[a-f0-9]{24}\b/gi, '')
    .replace(/\b[a-f0-9]{24}\b/gi, '')
    .replace(/\[\s*(items?|quotes?|deals?|people|tasks?|events?|cases?)\s*\]/gi, '')
    .replace(/^[\s·•\-–—|:]+/, '')
    .replace(/[\s·•\-–—|:]+$/g, '')
    .replace(/\s*[·•\-–—|:]\s*(?=\s*[·•\-–—|:])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

/**
 * Normalize specialist answer into canvas bullet body.
 * @param {string} answer
 * @param {string} [kind]
 * @returns {string}
 */
function normalizeAnswerToBody(answer, kind = '') {
  let text = scrubInternalIds(String(answer || '').trim());
  if (!text) return '';
  if (
    /\bno runner yet\b/i.test(text)
    || /\bran\s+\d+\s+seats\b/i.test(text)
    || /\bHandoffs:\s*/i.test(text)
    || /\bStudio\s*[·•\-]\s*(Meeting|Opportunity|Customer)/i.test(text)
  ) {
    return '';
  }
  if (
    /\bSITUATION BRIEF\b/i.test(text)
    || /\bTOOL RESULTS?\b/i.test(text)
    || /\bI need the (contact|person|name)\b/i.test(text)
    || /\bno contact record\b/i.test(text)
    || /\bReportsE2E\b/i.test(text)
    || /\bRELATED RECORDS:\s*\(none loaded\)/i.test(text)
    || /\bFOCUS:\s*\[people\]/i.test(text)
  ) {
    return '';
  }
  text = text.replace(/^```(?:markdown|md|text)?\s*/i, '').replace(/```$/i, '').trim();

  // Strip meeting-prep sections that leak into war-room / signal panels
  if (kind === 'buying_signals' || kind === 'risk' || kind === 'win_strategy' || kind === 'competitors') {
    text = text
      .replace(/Situation for Your Meeting:[\s\S]*?(?=\n(?:Next move|Signal|Risk|Move|Competitor|Name):|$)/gi, '')
      .replace(/^Stakeholders?\s*&?\s*Buying Roles[^\n]*\n?/gim, '')
      .trim();
  }

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sectionHeadingRe =
    /^(current\s+situation|key\s+risks?|risks?(?:\s*&\s*objections?)?|win\s+strategy|next\s+steps?|action\s+items?|talking\s+points?|buying\s+signals?|competitors?(?:\s+matrix)?|overview|summary|background|context|stakeholders?|decision\s+makers?|objections?|opportunities?|strengths?|weaknesses?|threats?|recommendations?|agenda|focus|notes?|open\s+questions?|blockers?)$/i;

  const cleaned = lines
    .filter((l) => !/^(here(?:'s| is)|sure[,.]|i(?:'| a)m|based on)\b/i.test(l))
    .filter((l) => !/\bReportsE2E\b/i.test(l))
    .filter((l) => !/\b(SITUATION BRIEF|TOOL RESULTS?|RELATED RECORDS|FOCUS DETAIL|SITUATION SIGNALS)\b/i.test(l))
    .filter((l) => !/\(none loaded\)/i.test(l))
    .filter((l) => !/^FOCUS:\s*\[/i.test(l))
    .filter((l) => !/^Situation for Your Meeting\b/i.test(l))
    .filter((l) => !/^\[[^\]]+\]$/.test(l.replace(/^[-*•]\s+/, '').trim()))
    .map((l) => {
      const md = l.match(/^#{1,6}\s+(.+)$/);
      if (md) return scrubInternalIds(md[1].trim().replace(/[:：]\s*$/, ''));

      const hadBullet = /^[-*•]\s+/.test(l) || /^\d+[.)]\s+/.test(l);
      const stripped = scrubInternalIds(
        l
          .replace(/^[-*•]\s+/, '')
          .replace(/^\d+[.)]\s+/, '')
          .replace(/^\*\*(.+?)\*\*$/, '$1')
          .trim(),
      );
      if (!stripped) return '';
      // Drop lines that were only an id / empty after scrub
      if (/^[·•\-–—|:.\s]*$/.test(stripped)) return '';

      const headingCandidate = stripped.replace(/[:：]\s*$/, '').trim();
      if (sectionHeadingRe.test(headingCandidate) || (/[:：]\s*$/.test(stripped) && stripped.length <= 56)) {
        return headingCandidate;
      }
      // Long prose stays unbulleted so the client can render paragraphs
      if (!hadBullet && stripped.length >= 120) return stripped;
      return `• ${stripped}`;
    })
    .filter(Boolean)
    .slice(0, 10);
  return cleaned.join('\n').slice(0, BODY_MAX);
}

/**
 * @param {string} body
 * @returns {Array<{ id: string, label: string, done: boolean }>}
 */
function bodyToChecklistItems(body) {
  return String(body || '')
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-\d.)]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((label, i) => ({ id: String(i + 1), label, done: false }));
}

function isOrgScopedFill(canvasType = '', policy = null) {
  if (policy?.fillWithoutParty || policy?.specialistMode === 'org' || policy?.specialistMode === 'abstract') {
    return true;
  }
  try {
    return require('./orgExecutiveBrief').isOrgScopedCanvas(canvasType, '');
  } catch {
    return /executive_report|quarterly_business_review|strategy_workspace|brainstorming|workflow_design/i.test(
      String(canvasType || ''),
    );
  }
}

/**
 * @returns {Promise<{ id: string, body: string, agentKey: string, grounded: boolean } | null>}
 */
async function fillWidgetWithSpecialist({
  organizationId,
  userId,
  widget,
  prompt,
  focus,
  canvasId,
  agentRegistry,
  situationText = '',
  canvasType = '',
  productName = '',
  policy = null,
}) {
  if (!organizationId || !widget?.id) return null;
  const agentKey = resolveSpecialistForWidget(widget);
  const orgScoped = isOrgScopedFill(canvasType, policy);
  if (!hasPartyFocus(focus) && !orgScoped) {
    return null;
  }
  const kind = panelKind(widget);
  const query = buildSpecialistQuery(widget, prompt, focus, situationText, canvasType, productName);
  const focusObj = primaryFocus(focus) || (orgScoped
    ? { moduleKey: 'organizations', name: productName || 'organization' }
    : null);

  try {
    const { runOrchestrator } = require('../astra/orchestrator/runOrchestrator');
    const deps = agentRegistry ? { agentRegistry } : {};
    const result = await runOrchestrator(
      {
        organizationId,
        userId,
        query,
        agent: agentKey,
        surface: STUDIO_FILL_SURFACE,
        focus: focusObj,
        conversationId: `studio-fill:${canvasId || 'na'}:${widget.id}`,
        flags: { canvasSituation: true, studioFill: true, forcePolish: true },
      },
      deps,
    );
    const body = normalizeAnswerToBody(result?.answer || '', kind);
    if (!body) return null;
    return {
      id: String(widget.id),
      body,
      agentKey,
      grounded: Boolean(result?.grounded || situationText),
    };
  } catch (err) {
    console.warn(
      `[specialistWidgetFill] ${agentKey} failed for ${widget.id}:`,
      err?.message || err,
    );
    return null;
  }
}

async function mapPool(items, limit, mapper) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await mapper(items[i], i);
    }
  }
  const n = Math.min(limit, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * @param {Array} widgets
 * @param {{ organizationId: string, userId: string, prompt?: string, focus?: Array, canvasId?: string, situationText?: string, canvasType?: string }} ctx
 * @returns {Promise<Array<{ id: string, body: string, agentKey?: string, grounded?: boolean }>>}
 */
async function fillWidgetsWithSpecialists(widgets, ctx) {
  const list = Array.isArray(widgets) ? widgets.filter((w) => w?.id) : [];
  if (!list.length || !ctx?.organizationId) return [];

  let agentRegistry = null;
  try {
    agentRegistry = await tenantCatalog.resolveAgentRegistryForOrg(ctx.organizationId);
  } catch (err) {
    console.warn('[specialistWidgetFill] registry resolve failed:', err?.message || err);
  }

  let productName = String(ctx.productName || '').trim();
  if (!productName) {
    try {
      productName = await require('./competitorWebResearch').resolveTenantProductBrand(ctx.organizationId);
    } catch {
      productName = '';
    }
  }

  const rows = await mapPool(list, CONCURRENCY, async (widget) => {
    const filled = await fillWidgetWithSpecialist({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      widget,
      prompt: ctx.prompt || '',
      focus: ctx.focus || [],
      canvasId: ctx.canvasId,
      agentRegistry,
      situationText: ctx.situationText || '',
      canvasType: ctx.canvasType || '',
      productName,
      policy: ctx.policy || null,
    });
    return filled;
  });

  return rows.filter(Boolean);
}

module.exports = {
  TYPE_SPECIALIST,
  resolveSpecialistForWidget,
  panelKind,
  buildSpecialistQuery,
  normalizeAnswerToBody,
  bodyToChecklistItems,
  fillWidgetWithSpecialist,
  fillWidgetsWithSpecialists,
  STUDIO_FILL_SURFACE,
  hasPartyFocus,
  scrubInternalIds,
};
