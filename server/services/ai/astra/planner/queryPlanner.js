'use strict';

/**
 * Deterministic Query Planner for Astra pipeline intents.
 * Emits only registered tool names.
 */

const AUTOMATION_RE = /\b(automation|automations|workflow|workflows|business\s+flow)\b/i;
const PROCESS_RE = /\b(process\s+graph|process\s+designer|processes|process\b|approval\s+gate|node\s+graph)\b/i;
const PERMISSION_RE = /\b(permission|permissions|role|roles|profile|profiles|sharing\s+rule|sharing|access\s+control|rbac|can\s+view|can\s+edit)\b/i;
const BUSINESS_RULE_RE = /\b(sla|escalation|assignment\s+rule|business\s+rule|policy|policies|assignment)\b/i;
const API_RE = /\b(api|apis|endpoint|endpoints|route|routes|rest)\b/i;

function productKnowledgeSteps(question) {
  const q = question || 'product help';
  const steps = [
    {
      id: 'catalog1',
      tool: 'SearchProductCatalog',
      input: { query: q, includeApis: !API_RE.test(q) },
      optional: false,
    },
    {
      id: 'kb1',
      tool: 'SearchKnowledgeBase',
      input: { query: q, topK: 5 },
      optional: true,
    },
  ];

  // Domain tools — always optional so empty config does not hard-fail the plan
  if (AUTOMATION_RE.test(q) || !q) {
    // default product expertise also peeks automations lightly when broad
  }
  if (AUTOMATION_RE.test(q)) {
    steps.push({
      id: 'auto1',
      tool: 'SearchAutomations',
      input: { query: q, limit: 12 },
      optional: true,
    });
  }
  if (PROCESS_RE.test(q)) {
    steps.push({
      id: 'proc1',
      tool: 'SearchProcessGraphs',
      input: { query: q, limit: 12 },
      optional: true,
    });
  }
  if (PERMISSION_RE.test(q)) {
    steps.push({
      id: 'perm1',
      tool: 'SearchPermissions',
      input: { query: q, limit: 15 },
      optional: true,
    });
  }
  if (BUSINESS_RULE_RE.test(q)) {
    steps.push({
      id: 'rules1',
      tool: 'SearchBusinessRules',
      input: { query: q, limit: 12 },
      optional: true,
    });
  }
  if (API_RE.test(q)) {
    steps.push({
      id: 'api1',
      tool: 'SearchApiMap',
      input: { query: q, limit: 40 },
      optional: true,
    });
  }

  return steps;
}

function productHowToSteps(question) {
  const q = question || 'product help';
  const convertDealQuote = /\bconvert\b/i.test(q) && /\bdeal/i.test(q) && /\bquote/i.test(q);
  const wantsRequired = /\brequired\s+fields?\b/i.test(q)
    || /\bwhich\s+fields\b/i.test(q)
    || convertDealQuote;
  const moduleKeys = [];
  if (convertDealQuote || /\bdeal|\bopportunit/i.test(q)) moduleKeys.push('deals');
  if (convertDealQuote || /\bquote/i.test(q)) moduleKeys.push('quotes');
  if (/\bcase|\bticket/i.test(q)) moduleKeys.push('cases');

  const steps = [
    {
      id: 'catalog1',
      tool: 'SearchProductCatalog',
      input: {
        query: q,
        moduleKey: moduleKeys[0] || '',
        ...(moduleKeys.length ? { moduleKeys } : {}),
        preferRequired: wantsRequired,
        includeApis: false,
      },
      optional: false,
    },
    {
      id: 'kb1',
      tool: 'SearchKnowledgeBase',
      input: {
        query: convertDealQuote
          ? 'convert deal to quote required fields steps'
          : q,
        topK: 5,
      },
      optional: true,
    },
  ];

  // Convert flows often involve process/automation config
  if (convertDealQuote || PROCESS_RE.test(q)) {
    steps.push({
      id: 'proc1',
      tool: 'SearchProcessGraphs',
      input: { query: convertDealQuote ? 'deal to quote' : q, limit: 8 },
      optional: true,
    });
  }

  return steps;
}

function customerHealthSteps({
  account = '',
  question = '',
  filters = {},
  proactiveScan = false,
} = {}) {
  const q = account || question || 'account';

  // Portfolio scan: open tickets + late-stage deals + activities (no single account)
  if (proactiveScan && !account) {
    return {
      steps: [
        {
          id: 'ticket1',
          tool: 'SearchTickets',
          input: { query: 'open', limit: 12, filters: { status: 'open' } },
          optional: false,
        },
        {
          id: 'deal1',
          tool: 'SearchDeals',
          input: {
            query: 'open negotiation proposal',
            limit: 12,
            filters: { status: 'open' },
          },
          optional: true,
        },
        {
          id: 'act1',
          tool: 'SearchActivities',
          input: { query: 'overdue', limit: 8 },
          optional: true,
        },
        {
          id: 'kb1',
          tool: 'SearchKnowledgeBase',
          input: { query: 'customer churn risk retention playbook', topK: 3 },
          optional: true,
        },
      ],
      success_criteria: [
        'scan_open_tickets_and_deals',
        'flag_at_risk_patterns',
        'no_invented_metrics',
      ],
    };
  }

  const ticketFilters = { ...filters };
  if (!ticketFilters.status && !ticketFilters.stage) {
    ticketFilters.status = 'open';
  }
  return {
    steps: [
      {
        id: 'acct1',
        tool: 'SearchAccounts',
        input: { query: q, limit: 5 },
        optional: false,
      },
      {
        id: 'ticket1',
        tool: 'SearchTickets',
        input: { query: q, limit: 10, filters: ticketFilters },
        dependsOn: ['acct1'],
        optional: true,
      },
      {
        id: 'deal1',
        tool: 'SearchDeals',
        input: { query: q, limit: 10, filters },
        dependsOn: ['acct1'],
        optional: true,
      },
      {
        id: 'act1',
        tool: 'SearchActivities',
        input: { query: q, limit: 8 },
        dependsOn: ['acct1'],
        optional: true,
      },
      {
        id: 'kb1',
        tool: 'SearchKnowledgeBase',
        input: {
          query: `customer health retention risk ${account || q}`.trim(),
          topK: 3,
        },
        dependsOn: ['acct1'],
        optional: true,
      },
    ],
    success_criteria: [
      'account_resolved',
      'evidence_from_tickets_deals_or_activities',
      'no_invented_metrics',
    ],
  };
}

/**
 * Broad ProductExpertise asks: pull core catalog + relevant domain tools.
 * If the question is generic ("how does the product work"), include a light sweep.
 */
function productExpertiseSteps(question) {
  const q = question || 'product help';
  const steps = productKnowledgeSteps(q);

  const hasDomain = steps.some((s) => [
    'SearchAutomations',
    'SearchProcessGraphs',
    'SearchPermissions',
    'SearchBusinessRules',
    'SearchApiMap',
  ].includes(s.tool));

  if (!hasDomain) {
    // Broad expertise: include all domain tools as optional sweep
    steps.push(
      { id: 'auto1', tool: 'SearchAutomations', input: { query: q, limit: 8 }, optional: true },
      { id: 'proc1', tool: 'SearchProcessGraphs', input: { query: q, limit: 8 }, optional: true },
      { id: 'perm1', tool: 'SearchPermissions', input: { query: q, limit: 10 }, optional: true },
      { id: 'rules1', tool: 'SearchBusinessRules', input: { query: q, limit: 8 }, optional: true },
      { id: 'api1', tool: 'SearchApiMap', input: { query: q, limit: 25 }, optional: true },
    );
  }
  return steps;
}

function planQuery({ intentResult, memory = {} } = {}) {
  if (!intentResult || intentResult.deferToLegacy) {
    return { steps: [], clarifyOnly: false, clarifying_question: null, deferToLegacy: true };
  }

  if (intentResult.needs_clarification && intentResult.clarifying_question) {
    return {
      steps: [],
      clarifyOnly: true,
      clarifying_question: intentResult.clarifying_question,
    };
  }

  const account = String(
    intentResult.accountHint
    || intentResult.filters?.account
    || memory.accountHint
    || memory.currentAccount
    || ''
  ).trim();
  const filters = { ...(intentResult.filters || {}), ...(memory.filters || {}) };
  const question = String(memory.effectiveQuestion || '').trim();

  if (intentResult.intent === 'ProductHowTo') {
    return {
      steps: productHowToSteps(question || intentResult.understanding || 'product help'),
      clarifyOnly: false,
      clarifying_question: null,
      success_criteria: ['required_fields_from_catalog', 'no_invented_fields'],
    };
  }

  if (intentResult.intent === 'ProductExpertise') {
    return {
      steps: productExpertiseSteps(question || intentResult.understanding || 'product help'),
      clarifyOnly: false,
      clarifying_question: null,
    };
  }

  if (intentResult.intent === 'CustomerHealthAnalysis') {
    const health = customerHealthSteps({
      account,
      question,
      filters,
      proactiveScan: intentResult.proactiveScan === true
        || /\b(accounts?|customers?)\s+at\s+risk\b/i.test(question),
    });
    return {
      steps: health.steps,
      clarifyOnly: false,
      clarifying_question: null,
      success_criteria: health.success_criteria,
    };
  }

  if (intentResult.intent === 'CrmListFilter') {
    const mod = intentResult.moduleKey || memory.lastModuleKey || 'deals';
    const q = account || question || mod;
    const dealFilters = { ...filters };
    if (filters.amountGte != null) {
      dealFilters.amountGte = filters.amountGte;
    }
    const primaryTool = mod === 'cases' || mod === 'tickets'
      ? 'SearchTickets'
      : (mod === 'tasks' ? 'SearchActivities' : 'SearchDeals');
    return {
      steps: [
        {
          id: 'primary1',
          tool: primaryTool,
          input: {
            query: q,
            limit: 10,
            filters: dealFilters,
            ...(primaryTool === 'SearchActivities' ? {} : {}),
          },
          optional: false,
        },
      ],
      clarifyOnly: false,
      clarifying_question: null,
    };
  }

  return { steps: [], clarifyOnly: false, clarifying_question: null, deferToLegacy: true };
}

module.exports = {
  planQuery,
  productKnowledgeSteps,
  productHowToSteps,
  productExpertiseSteps,
  customerHealthSteps,
  AUTOMATION_RE,
  PROCESS_RE,
  PERMISSION_RE,
  BUSINESS_RULE_RE,
  API_RE,
};
