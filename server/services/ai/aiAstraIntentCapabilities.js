'use strict';

/**
 * Astra intent → capability registry (configure once, reuse forever).
 * Regex detectors remain as fallback; LLM RouteIntent is the primary
 * understand-step for ANY customer ask (not only charts/lists).
 */

const {
  isAttentionWorkQuestion,
  isCalendarScheduleQuestion,
  isContentCreationQuestion,
} = require('./aiWorkGraphContextService');
const {
  isCanvasCrmQuestion,
  isArivuCanvasQuestion,
} = require('./aiArivuCanvasService');
const {
  isReportBuilderQuestion,
  isCreateWidgetQuestion,
  isProductHowToAsk,
  isAmbiguousCrmAsk,
  isCrmDataAsk,
  wantsRecordLevelChart,
  isWonDealAsk,
  isLostDealAsk,
} = require('./aiAstraReportBuilderService');

/** @typedef {{ id: string, detect: (q: string) => boolean, promptRules: string[], preferredActions: string[], suppressCrmTaskCreate?: boolean, suppressWrites?: boolean }} AstraIntentCapability */

const ASTRA_ROUTES = Object.freeze([
  'crm_data',
  'report_builder',
  'report_widget',
  'web_research',
  'email',
  'meeting_prep',
  'attention_work',
  'calendar',
  'canvas_crm',
  'canvas_presentation',
  'content_creation',
  'general',
  'clarify',
]);

/** @type {AstraIntentCapability[]} */
const ASTRA_INTENT_CAPABILITIES = [
  {
    id: 'report_widget',
    detect: isCreateWidgetQuestion,
    promptRules: [
      'WIDGET INTENT: user wants an Analytics widget from an existing report (not a new report draft).',
      'Create/pin a real AnalyticsWidget bound to the prior report. Prefer open_widget / open_dashboard.',
    ],
    preferredActions: ['open_widget', 'open_dashboard', 'open_report'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'report_builder',
    detect: isReportBuilderQuestion,
    promptRules: [
      'REPORT BUILDER INTENT: user wants a real Analytics report (create/build/save/share/schedule report), not a one-off chart glance.',
      'Do NOT open Arivu Canvas. Prefer open_report_builder / open_report / publish_report actions.',
      'The system creates an AnalyticsReport with inferred filters, joins, formulas, visibility, and schedule when named in the ask.',
    ],
    preferredActions: ['open_report_builder', 'open_report', 'publish_report', 'export_report', 'pin_report_to_dashboard'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'attention_work',
    detect: isAttentionWorkQuestion,
    promptRules: [
      'ATTENTION INTENT: answer due today / overdue ONLY from the ATTENTION section when present.',
    ],
    preferredActions: ['complete_task', 'follow_up', 'review_record'],
  },
  {
    id: 'calendar_schedule',
    detect: isCalendarScheduleQuestion,
    promptRules: [
      'CALENDAR INTENT: answer meetings/events today and next meeting ONLY from CALENDAR MEETINGS when present. Never pick a past start as next.',
    ],
    preferredActions: ['review_record', 'follow_up', 'open_canvas'],
  },
  {
    id: 'arivu_canvas_crm',
    detect: isCanvasCrmQuestion,
    promptRules: [
      'ARIVU CANVAS (CRM) — Salesforce Generative Canvas style: open a live workspace with real CRM cards (stakeholders, opportunity analysis, meeting notes, conversation recap, KPIs).',
      'Do NOT answer with placeholder text about what the canvas will do. Emit action kind=open_canvas with fields.mode=crm.',
      'Do NOT create a task / prep notes record unless explicitly asked.',
    ],
    preferredActions: ['open_canvas', 'review_record', 'follow_up'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
  {
    id: 'content_creation',
    detect: isContentCreationQuestion,
    promptRules: [
      'CONTENT ASK: If the user says "give me the content" / "the content" / Content Studio without asking for a deck, do NOT invent a deals pipeline or CRM report.',
      'Prefer action kind=open_content_studio. Ask at most one clarifying question (which document/topic) if the target is unclear.',
      'ARIVU CANVAS (PRESENTATION): Only when they want a deck/slides — open Generative Canvas in presentation mode with a real slide outline.',
      'ALWAYS emit a complete slide outline in detail (numbered slides + bullets) when building a deck. Never ask clarifying questions when meeting/contact is already known for a deck.',
      'Never put "awaiting your input", "Full slide outline ready", or meta product text into the answer — open_canvas instead for decks.',
      'Emit action kind=open_canvas with fields.mode=presentation, fields.title, fields.outline only for deck/slides asks.',
      'Do NOT dump pipeline charts, deal stage tables, or CRM aggregates for a content ask.',
      'Only create_record tasks if they explicitly ask for a task/reminder.',
    ],
    preferredActions: ['open_content_studio', 'open_canvas', 'talk_to_agent', 'manual'],
    suppressCrmTaskCreate: true,
    suppressWrites: true,
  },
];

function detectAstraIntentCapabilities(question = '') {
  const q = String(question || '');
  return ASTRA_INTENT_CAPABILITIES.filter((cap) => {
    try {
      return Boolean(cap.detect(q));
    } catch {
      return false;
    }
  });
}

function formatIntentCapabilityPromptRules(question = '') {
  return detectAstraIntentCapabilities(question).flatMap((cap) => cap.promptRules);
}

function intentSuppressesCrmWrites(question = '') {
  return detectAstraIntentCapabilities(question).some((cap) => cap.suppressWrites || cap.suppressCrmTaskCreate);
}

/**
 * Deterministic route overrides — win over sticky LLM routing.
 * skipLlm=true → caller should not call proposeAstraRouteIntent.
 */
function resolveDeterministicRouteIntent(question = '') {
  const q = String(question || '').trim();
  if (!q) return null;

  if (isProductHowToAsk(q)) {
    return {
      route: 'general',
      needsCrmData: false,
      needsWeb: false,
      understanding: 'Product how-to / documentation question',
      goal: 'Explain steps and required fields from product catalog/KB',
      outputs: ['answer'],
      constraints: ['use_product_catalog_and_kb', 'do_not_list_crm_records'],
      clarifyingQuestion: '',
      deterministic: true,
      skipLlm: true,
      source: 'product_howto',
    };
  }

  if (isAmbiguousCrmAsk(q)) {
    return {
      route: 'clarify',
      needsCrmData: false,
      needsWeb: false,
      understanding: 'Ask is too vague to query CRM safely',
      goal: 'Clarify module and filters before querying',
      outputs: [],
      constraints: ['do_not_invent_important_list'],
      clarifyingQuestion:
        'Which records matter — e.g. open deals, Won deals, amount above a threshold, or a specific account?',
      deterministic: true,
      skipLlm: true,
      source: 'ambiguous',
    };
  }

  const won = isWonDealAsk(q);
  const lost = isLostDealAsk(q);
  const recordChart = wantsRecordLevelChart(q);
  const crm = isCrmDataAsk(q) || won || lost;

  if (crm) {
    const constraints = ['preserve_amount_filters', 'never_invent_metrics'];
    if (recordChart) {
      constraints.push('chart_by_record', 'no_stage_group_by');
    }
    if (won) constraints.push('won_outcome_filter');
    if (lost) constraints.push('lost_outcome_filter');
    const wantChart = recordChart
      || /\b(pie|bar|donut|line)\s*charts?\b/i.test(q)
      || /\bas\s+a\s+(pie|bar|donut|line)\b/i.test(q);
    return {
      route: 'crm_data',
      needsCrmData: true,
      needsWeb: false,
      understanding: won
        ? 'List Won deals with outcome filters'
        : (lost ? 'List Lost deals with outcome filters' : 'CRM list/chart with live analytics filters'),
      goal: wantChart ? 'table + chart from live CRM' : 'live CRM table',
      outputs: wantChart ? ['table', 'chart'] : ['table'],
      constraints,
      clarifyingQuestion: '',
      deterministic: true,
      skipLlm: false,
      forceNeedsCrmData: true,
      source: 'crm_data_override',
    };
  }

  // Stalled / likely-to-close without isCrmDataAsk verb still force CRM diagnostic path
  if (
    (/\b(stalled|stuck)\b/i.test(q) && /\bdeals?\b/i.test(q))
    || /\blikely\s+to\s+(get\s+)?clos/i.test(q)
  ) {
    return {
      route: 'crm_data',
      needsCrmData: true,
      needsWeb: false,
      understanding: /\blikely\s+to\s+(get\s+)?clos/i.test(q)
        ? 'Open late-stage deals most likely to close (exclude Won/Lost)'
        : 'Stalled/stuck deals — list late-stage open deals with coaching',
      goal: 'table + next steps',
      outputs: ['table', 'answer'],
      constraints: ['closing_stage_list', 'status_open_only', 'never_invent_metrics'],
      clarifyingQuestion: '',
      deterministic: true,
      skipLlm: false,
      forceNeedsCrmData: true,
      source: /\blikely\s+to\s+(get\s+)?clos/i.test(q) ? 'likely_to_close' : 'stalled_deals',
    };
  }

  return null;
}

/**
 * Merge LLM route under deterministic overrides (deterministic wins on route/CRM flags).
 */
function mergeRouteIntentWithDeterministic(llmIntent = null, deterministic = null) {
  if (!deterministic) {
    return llmIntent ? validateAstraRouteIntent(llmIntent) : null;
  }
  if (deterministic.skipLlm || !llmIntent) {
    return validateAstraRouteIntent(deterministic);
  }
  return validateAstraRouteIntent({
    understanding: llmIntent.understanding || deterministic.understanding,
    goal: llmIntent.goal || deterministic.goal,
    route: deterministic.route || llmIntent.route,
    needsCrmData: deterministic.forceNeedsCrmData === true
      ? true
      : (deterministic.needsCrmData === true ? true : llmIntent.needsCrmData),
    needsWeb: deterministic.needsWeb === true ? true : (llmIntent.needsWeb === true),
    outputs: (Array.isArray(deterministic.outputs) && deterministic.outputs.length)
      ? deterministic.outputs
      : llmIntent.outputs,
    constraints: [...new Set([
      ...(Array.isArray(deterministic.constraints) ? deterministic.constraints : []),
      ...(Array.isArray(llmIntent.constraints) ? llmIntent.constraints : []),
    ])].slice(0, 12),
    clarifyingQuestion: deterministic.clarifyingQuestion || llmIntent.clarifyingQuestion || '',
  });
}

/**
 * Validate LLM RouteIntent for any customer ask.
 */
function validateAstraRouteIntent(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  let route = String(raw.route || raw.intent || '').toLowerCase().trim().replace(/\s+/g, '_');
  const aliases = {
    data: 'crm_data',
    crm: 'crm_data',
    list: 'crm_data',
    chart: 'crm_data',
    report: 'report_builder',
    research: 'web_research',
    web: 'web_research',
    mail: 'email',
    meeting: 'meeting_prep',
    prep: 'meeting_prep',
    canvas: 'canvas_crm',
    presentation: 'canvas_presentation',
    deck: 'canvas_presentation',
    content: 'content_creation',
    help: 'general',
    other: 'general',
  };
  if (aliases[route]) route = aliases[route];
  if (!ASTRA_ROUTES.includes(route)) route = 'general';

  const outputs = Array.isArray(raw.outputs)
    ? raw.outputs.map((o) => String(o || '').toLowerCase().trim()).filter(Boolean).slice(0, 6)
    : [];
  const constraints = Array.isArray(raw.constraints)
    ? raw.constraints.map((c) => String(c || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    route,
    understanding: String(raw.understanding || '').trim().slice(0, 400),
    goal: String(raw.goal || '').trim().slice(0, 240),
    constraints,
    needsCrmData: raw.needsCrmData === true || route === 'crm_data' || route === 'report_builder',
    needsWeb: raw.needsWeb === true || route === 'web_research',
    outputs,
    clarifyingQuestion: String(raw.clarifyingQuestion || '').trim().slice(0, 200),
  };
}

/**
 * LLM understand-step for ANY Astra ask — returns a route + plan.
 * Regex detectors remain fallback when this returns null.
 */
async function proposeAstraRouteIntent({
  question = '',
  history = [],
  pageContext = '',
  config = null,
  redactOpts = {},
} = {}) {
  if (!config?.apiKey || !config?.provider || !config?.model) return null;
  try {
    const { getLlmAdapter } = require('./providerRegistry');
    const { redactMessages } = require('./piiRedaction');
    const { parseJsonObject } = require('./aiMarketingService');
    const adapter = getLlmAdapter(config.provider);
    if (!adapter?.complete) return null;

    const prior = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-6)
      .map((m) => `${m.role}: ${String(m.content || m.body || '').slice(0, 240)}`)
      .join('\n');

    const system = [
      'You are Astra\'s intent router for a CRM product (LiteDesk).',
      'Read the customer ask carefully (any topic — not only charts/lists).',
      'Return JSON only:',
      '{"understanding":"what they want in 1-2 sentences",'
      + '"goal":"success criteria",'
      + '"route":"crm_data|report_builder|report_widget|web_research|email|meeting_prep|attention_work|calendar|canvas_crm|canvas_presentation|content_creation|general|clarify",'
      + '"needsCrmData":true|false,"needsWeb":true|false,'
      + '"outputs":["table","chart","email_draft","answer","canvas","actions"],'
      + '"constraints":["preserve amount filters","do not invent stage group-by"],'
      + '"clarifyingQuestion":""}',
      'Route guide:',
      '- crm_data: list/filter/count/chart of CRM records (deals, tasks, cases, …)',
      '- report_builder: create/save/edit a real Analytics report',
      '- web_research: company/website/public info outside CRM (CEO, founder, leadership, market)',
      '- email: draft/compose/send email',
      '- meeting_prep: prepare for a meeting / talking points',
      '- attention_work / calendar: overdue work or schedule',
      '- canvas_crm / canvas_presentation: open live canvas or slide deck',
      '- content_creation: Content Studio / document content',
      '- general: advice, how-to, product help, anything else',
      '- clarify: only if blocked without one essential fact',
      'Never invent CRM metrics. Prefer crm_data when they want live lists/charts.',
      'CRITICAL: how-to / "how do I convert a deal to a quote" / required fields → route general (product help). NOT crm_data.',
      'CRITICAL: vague "important ones" / "the key ones" without filters → route clarify.',
      'CRITICAL: "Who is the CEO/founder?" → route web_research. Never name a CRM contact as CEO unless Job Title explicitly says so.',
      'CRITICAL: "detail analysis of \'Vtiger CRM\' Organization" / named company overview → web_research. Do NOT route crm_data or chart all organizations by industry.',
      'CRITICAL: "which deals in closure / why not closed / expedite closure" → crm_data with outputs table+answer (list late-stage deals + coaching). Do NOT return only a Pipeline by Stage chart.',
      'For list+chart: "not by stage" / "by record" → chart individual records (never stage rollup).',
      'For list+chart without "by stage", constraint: chart individual records.',
    ].join('\n');

    const userParts = [
      pageContext ? `Page context: ${String(pageContext).slice(0, 200)}` : '',
      prior ? `Recent chat:\n${prior}` : '',
      `Ask:\n${String(question || '').slice(0, 2000)}`,
    ].filter(Boolean);

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: system },
        { role: 'user', content: userParts.join('\n\n') },
      ], redactOpts),
      temperature: 0,
      maxTokens: 700,
      providerOptions: config.providerOptions,
    });
    const text = String(completion?.text || completion?.content || '');
    return validateAstraRouteIntent(parseJsonObject(text));
  } catch {
    return null;
  }
}

/** Prompt rules derived from LLM route (works for every ask type). */
function formatRouteIntentPromptRules(routeIntent = null) {
  if (!routeIntent?.route) return [];
  const rules = [
    `ROUTE INTENT (${routeIntent.route}): ${routeIntent.understanding || routeIntent.goal || 'Follow the customer ask precisely.'}`,
  ];
  if (routeIntent.goal) rules.push(`Success criteria: ${routeIntent.goal}`);
  if (routeIntent.constraints?.length) {
    rules.push(`Constraints: ${routeIntent.constraints.join('; ')}`);
  }
  if (routeIntent.outputs?.length) {
    rules.push(`Expected outputs: ${routeIntent.outputs.join(', ')}`);
  }
  if (routeIntent.route === 'crm_data') {
    rules.push('Do not invent stage/status groupings unless the user asked for that breakdown.');
    rules.push('Amounts/counts must come from live CRM context or tools — never fabricate.');
    rules.push('If they ask which deals / why not closed / how to expedite: list the matching deals and give concrete next steps — never answer with only a pipeline chart.');
  }
  if (routeIntent.route === 'email') {
    rules.push('Produce a ready-to-send email draft; do not pivot into CRM charts.');
  }
  if (routeIntent.route === 'web_research') {
    rules.push('Use web research results when present; do not invent company facts.');
    rules.push('Never promote a CRM contact/person to CEO/founder/executive unless their Job Title field explicitly says so.');
    rules.push('Never answer only "not listed". Use EXTRACTED CONTACT FACTS, then labeled general knowledge if needed.');
    rules.push('Emit a detailed research_brief visual (Overview, Leadership, Products, Market, Contact, Sources) — not a tiny snippet.');
    rules.push('Prefer LLM-EXTRACTED RESEARCH BRIEF in context when present; expand into presentable sections.');
  }
  if (routeIntent.route === 'general') {
    rules.push('If the ask is about a company executive role, prefer public/web facts — CRM contacts are not company leadership by default.');
    rules.push('Product how-to: use live catalog/KB; do not dump a CRM deal list.');
  }
  if (routeIntent.constraints?.includes('chart_by_record')) {
    rules.push('Chart matching records individually — never roll up by stage unless explicitly asked.');
  }
  if (routeIntent.constraints?.includes('won_outcome_filter')) {
    rules.push('Won deals require status=Won OR stage Closed Won/Won filters.');
  }
  return rules;
}

module.exports = {
  ASTRA_ROUTES,
  ASTRA_INTENT_CAPABILITIES,
  detectAstraIntentCapabilities,
  formatIntentCapabilityPromptRules,
  intentSuppressesCrmWrites,
  isArivuCanvasQuestion,
  validateAstraRouteIntent,
  resolveDeterministicRouteIntent,
  mergeRouteIntentWithDeterministic,
  proposeAstraRouteIntent,
  formatRouteIntentPromptRules,
};
