'use strict';

/**
 * Structured canvas intent — type alone is not enough.
 * Scope + entity + goals drive brief selection and hydrate policy.
 */

const { CANVAS_TYPES } = require('./constants');
const { inferCanvasType } = require('../astra/tools/canvasTools');

const TYPE_SET = new Set(CANVAS_TYPES);

/** @typedef {'org'|'party'|'account'|'deal'|'case'|'project'|'abstract'} CanvasScope */

/**
 * @typedef {object} CanvasIntent
 * @property {string} canvasType
 * @property {CanvasScope} scope
 * @property {string} entityHint
 * @property {string[]} preferredModules
 * @property {'week'|'month'|'quarter'|'year'|'all'|null} timeRange
 * @property {string[]} goals
 * @property {boolean} requirePartyFocus
 * @property {number} confidence
 * @property {'llm'|'heuristic'|'hint'} source
 * @property {string} prompt
 */

const SCOPE_BY_TYPE = Object.freeze({
  meeting_preparation: 'party',
  opportunity_war_room: 'deal',
  customer_360: 'account',
  executive_report: 'org',
  account_planning: 'account',
  quarterly_business_review: 'account',
  customer_success_plan: 'account',
  renewal_workspace: 'account',
  support_investigation: 'case',
  project_workspace: 'project',
  workflow_design: 'abstract',
  brainstorming: 'abstract',
  strategy_workspace: 'org',
  blank: 'abstract',
});

const MODULES_BY_SCOPE = Object.freeze({
  org: [],
  party: ['people', 'organizations', 'deals'],
  account: ['organizations', 'deals', 'people'],
  deal: ['deals', 'people', 'organizations'],
  case: ['cases', 'people', 'organizations'],
  project: ['projects', 'tasks', 'organizations'],
  abstract: [],
});

const INTENT_SYSTEM = [
  'Extract Astra Living Canvas intent as compact JSON only (no markdown).',
  'Keys: canvasType, scope, entityHint, timeRange, goals.',
  `canvasType one of: ${CANVAS_TYPES.filter((t) => t !== 'blank').join(', ')} (or blank).`,
  'scope one of: org, party, account, deal, case, project, abstract.',
  'entityHint: named person/deal/account/case from the ask, else "".',
  'timeRange: week|month|quarter|year|all|null.',
  'goals: short strings like summary,pipeline,risks,stakeholders,agenda,renewal,cases.',
  'Rules:',
  '- executive / board / org pipeline / revenue report → canvasType executive_report, scope org, entityHint "".',
  '- war room / deal health → opportunity_war_room, scope deal.',
  '- meeting prep with a person → meeting_preparation, scope party.',
  '- QBR / account plan / renewal / success plan → account scope when an account is named, else account with empty hint.',
  '- support / root cause → support_investigation, scope case.',
  '- brainstorm / SWOT / sticky → brainstorming, scope abstract.',
  '- workflow / automation diagram → workflow_design, scope abstract.',
].join('\n');

function normalizeType(raw = '') {
  const text = String(raw || '').trim().toLowerCase().replace(/['"`]/g, '');
  if (TYPE_SET.has(text)) return text;
  const token = text.match(
    /\b(meeting_preparation|executive_report|customer_360|opportunity_war_room|account_planning|quarterly_business_review|customer_success_plan|renewal_workspace|support_investigation|project_workspace|workflow_design|brainstorming|strategy_workspace|blank)\b/,
  );
  return token?.[1] && TYPE_SET.has(token[1]) ? token[1] : '';
}

function normalizeScope(raw = '', canvasType = '') {
  const s = String(raw || '').trim().toLowerCase();
  if (['org', 'party', 'account', 'deal', 'case', 'project', 'abstract'].includes(s)) return s;
  return SCOPE_BY_TYPE[canvasType] || 'abstract';
}

function normalizeTimeRange(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['week', 'month', 'quarter', 'year', 'all'].includes(t)) return t;
  return null;
}

function extractEntityHintHeuristic(prompt = '') {
  const text = String(prompt || '').trim();
  const quoted = text.match(/['"“”]([^'"“”]{2,80})['"“”]/);
  if (quoted?.[1]) return quoted[1].trim();
  // Skip org-wide phrasing
  if (/\b(this\s+quarter|organization|org(?:-|\s+)wide|pipeline\s+and\s+revenue|board\s+report)\b/i.test(text)
    && !/\b(?:for|of|with)\s+['"“]/.test(text)
    && !/\bcustomer\s*360\b/i.test(text)) {
    return '';
  }
  const withFor = text.match(
    /\b(?:with|for|of|about|regarding)\s+([A-Za-z][A-Za-z0-9 .,&'_-]{1,60}?)(?:\s+(?:deal|meeting|case|account|org(?:anization)?|tomorrow|today|next|pipeline|revenue|quarter)\b|[?.!]|$)/i,
  );
  if (withFor?.[1]) {
    const hint = withFor[1].trim().replace(/[?.!,]+$/, '');
    if (/^(this|the|our|my)\b/i.test(hint)) return '';
    return hint;
  }
  return '';
}

function goalsFromPrompt(prompt = '', canvasType = '') {
  const q = String(prompt || '').toLowerCase();
  const goals = new Set();
  if (/summar|overview|executive/i.test(q)) goals.add('summary');
  if (/pipeline|revenue|forecast|funnel/i.test(q)) goals.add('pipeline');
  if (/risk|objection|blocker/i.test(q)) goals.add('risks');
  if (/stakeholder|buyer|decision/i.test(q)) goals.add('stakeholders');
  if (/agenda|meeting/i.test(q)) goals.add('agenda');
  if (/renewal/i.test(q)) goals.add('renewal');
  if (/case|ticket|support/i.test(q)) goals.add('cases');
  if (/recommend|next\s+step|action/i.test(q)) goals.add('recommendations');
  if (/competitor/i.test(q)) goals.add('competitors');
  // Defaults by type
  const defaults = {
    executive_report: ['summary', 'pipeline', 'risks', 'recommendations'],
    opportunity_war_room: ['summary', 'risks', 'stakeholders', 'competitors', 'recommendations'],
    meeting_preparation: ['agenda', 'stakeholders', 'risks', 'recommendations'],
    customer_360: ['summary', 'stakeholders', 'pipeline', 'risks'],
    account_planning: ['summary', 'stakeholders', 'recommendations', 'risks'],
    quarterly_business_review: ['summary', 'pipeline', 'risks', 'recommendations'],
    customer_success_plan: ['summary', 'recommendations', 'risks'],
    renewal_workspace: ['renewal', 'risks', 'recommendations', 'summary'],
    support_investigation: ['cases', 'risks', 'summary', 'recommendations'],
    project_workspace: ['summary', 'recommendations'],
    strategy_workspace: ['summary', 'pipeline', 'recommendations'],
    workflow_design: ['summary'],
    brainstorming: ['summary'],
  };
  for (const g of defaults[canvasType] || ['summary']) goals.add(g);
  return [...goals].slice(0, 8);
}

/**
 * Fast heuristic intent (no LLM).
 * @returns {CanvasIntent}
 */
function inferCanvasIntentHeuristic({ prompt = '', hintType = '' } = {}) {
  const text = String(prompt || '').trim();
  let canvasType = normalizeType(hintType) || inferCanvasType(text);
  if (!canvasType) canvasType = 'blank';

  // Org-wide executive overrides deal-ish heuristics
  if (/\b(executive\s+report|board\s+report|org(?:-|\s+)wide|this\s+quarter.{0,40}(pipeline|revenue)|pipeline\s+and\s+revenue)\b/i.test(text)
    && !/\bfor\s+['"“][^'"“”]+['"“”].*\bdeal\b/i.test(text)) {
    canvasType = 'executive_report';
  }

  const scope = normalizeScope(SCOPE_BY_TYPE[canvasType], canvasType);
  const entityHint = scope === 'org' || scope === 'abstract'
    ? ''
    : extractEntityHintHeuristic(text);
  const requirePartyFocus = ['party', 'deal', 'account', 'case', 'project'].includes(scope)
    && scope !== 'org';

  return {
    canvasType,
    scope,
    entityHint,
    preferredModules: [...(MODULES_BY_SCOPE[scope] || [])],
    timeRange: /\bthis\s+week\b/i.test(text)
      ? 'week'
      : /\bthis\s+month\b/i.test(text)
        ? 'month'
        : /\b(this\s+)?quarter|q[1-4]\b/i.test(text)
          ? 'quarter'
          : /\bthis\s+year\b/i.test(text)
            ? 'year'
            : null,
    goals: goalsFromPrompt(text, canvasType),
    requirePartyFocus: Boolean(requirePartyFocus && scope !== 'abstract'),
    confidence: canvasType === 'blank' ? 0.4 : 0.72,
    source: 'heuristic',
    prompt: text,
  };
}

function parseIntentJson(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Resolve full canvas intent (LLM when available, else heuristic).
 * @returns {Promise<CanvasIntent>}
 */
async function resolveCanvasIntent({
  organizationId = '',
  prompt = '',
  hintType = '',
  existingType = '',
} = {}) {
  const heuristic = inferCanvasIntentHeuristic({
    prompt,
    hintType: hintType || existingType,
  });

  if (!String(prompt || '').trim() || !organizationId) {
    return heuristic;
  }

  try {
    const modelRouter = require('../astra/models/modelRouter');
    if (typeof modelRouter.complete !== 'function') return heuristic;

    const completion = await modelRouter.complete(organizationId, 'astra_v2_ask', {
      messages: [
        { role: 'system', content: INTENT_SYSTEM },
        {
          role: 'user',
          content:
            `User ask:\n${String(prompt).slice(0, 700)}\n\n`
            + `Heuristic JSON:\n${JSON.stringify(heuristic)}\n`
            + (hintType ? `Client hint type: ${hintType}\n` : '')
            + 'Return JSON only.',
        },
      ],
      temperature: 0,
      maxTokens: 220,
      skipAudit: true,
    });

    const parsed = parseIntentJson(completion?.text || '');
    if (!parsed || typeof parsed !== 'object') return heuristic;

    const canvasType = normalizeType(parsed.canvasType) || heuristic.canvasType;
    const scope = normalizeScope(parsed.scope, canvasType);
    const entityHint = scope === 'org' || scope === 'abstract'
      ? ''
      : String(parsed.entityHint || heuristic.entityHint || '').trim().slice(0, 80);

    return {
      canvasType,
      scope,
      entityHint,
      preferredModules: MODULES_BY_SCOPE[scope]
        ? [...MODULES_BY_SCOPE[scope]]
        : heuristic.preferredModules,
      timeRange: normalizeTimeRange(parsed.timeRange) || heuristic.timeRange,
      goals: Array.isArray(parsed.goals) && parsed.goals.length
        ? parsed.goals.map(String).slice(0, 8)
        : heuristic.goals,
      requirePartyFocus: ['party', 'deal', 'account', 'case', 'project'].includes(scope),
      confidence: 0.9,
      source: 'llm',
      prompt: String(prompt || '').trim(),
    };
  } catch (err) {
    console.warn('[canvasIntent] LLM failed, using heuristic:', err?.message || err);
    return heuristic;
  }
}

module.exports = {
  SCOPE_BY_TYPE,
  MODULES_BY_SCOPE,
  INTENT_SYSTEM,
  inferCanvasIntentHeuristic,
  resolveCanvasIntent,
  normalizeType,
  normalizeScope,
  extractEntityHintHeuristic,
  goalsFromPrompt,
};
