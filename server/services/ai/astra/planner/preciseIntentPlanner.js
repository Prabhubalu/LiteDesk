'use strict';

/**
 * Precise Intent + Plan builder:
 * 1) Deterministic overlay (won/lost/amount/open) from detectFilters
 * 2) Optional catalog slice (retrieval-before-plan)
 * 3) validateIntent / validatePlan
 *
 * LLM proposals are merged underneath the overlay (overlay wins).
 */

const {
  validateIntent,
  validatePlan,
  mergeFilterOverlay,
  filterTreeToIntentFilters,
} = require('../contracts/intentPlanSchemas');
const { analyzeIntent, isMvpPipelineIntent } = require('../intent/intentAnalyzer');
const { planQuery } = require('../planner/queryPlanner');

function detectModuleKeyQuick(question = '') {
  const q = String(question || '').toLowerCase();
  if (/\bdeals?\b|\bpipeline\b|\bwon\b|\blost\b/.test(q)) return 'deals';
  if (/\btasks?\b/.test(q)) return 'tasks';
  if (/\bcases?\b|\btickets?\b/.test(q)) return 'cases';
  if (/\bquotes?\b/.test(q)) return 'quotes';
  if (/\bevents?\b|\bmeetings?\b/.test(q)) return 'events';
  if (/\bpeople\b|\bcontacts?\b/.test(q)) return 'people';
  if (/\borganizations?\b|\baccounts?\b/.test(q)) return 'organizations';
  return null;
}

/**
 * Build deterministic filter overlay from NL (CRM correctness safety net).
 */
function buildDeterministicFilterOverlay(question = '', moduleKey = '') {
  try {
    const {
      detectFilters,
      isWonDealAsk,
      isLostDealAsk,
    } = require('../../aiAstraReportBuilderService');
    const mod = moduleKey || detectModuleKeyQuick(question) || 'deals';
    const { filterTree, filterNotes } = detectFilters(question, mod);
    const filters = filterTreeToIntentFilters(filterTree);
    return {
      moduleKey: mod,
      filters,
      filterNotes: filterNotes || [],
      isWon: isWonDealAsk(question),
      isLost: isLostDealAsk(question),
    };
  } catch {
    return { moduleKey: moduleKey || null, filters: [], filterNotes: [], isWon: false, isLost: false };
  }
}

/**
 * Map pipeline / CRM ask into canonical IntentResult + optional LLM raw merge.
 */
function buildPreciseIntent({
  question = '',
  memory = {},
  routeIntent = null,
  llmIntent = null,
} = {}) {
  const q = String(question || '').trim();
  const overlay = buildDeterministicFilterOverlay(q);
  const pipelineIntent = analyzeIntent({ question: q, memory, routeIntent });

  let seed = {};
  if (pipelineIntent?.deferToLegacy) {
    if (pipelineIntent.route_hint === 'crm_data') {
      const wantChart = /\b(pie|bar|donut|line)\s*charts?\b/i.test(q)
        || /\bby\s+stage\b/i.test(q);
      seed = {
        intent: wantChart ? 'CrmDataChart' : 'CrmDataList',
        moduleKey: overlay.moduleKey || detectModuleKeyQuick(q) || 'deals',
        filters: [],
        outputs: wantChart ? ['table', 'chart'] : ['table'],
        required_tools: ['RunCrmDataAsk'],
        understanding: pipelineIntent.understanding || routeIntent?.understanding || '',
        accountHint: pipelineIntent.accountHint || '',
        confidence: overlay.filters.length ? 0.92 : 0.7,
        route_hint: 'crm_data',
      };
    } else {
      seed = {
        intent: 'DeferLegacy',
        deferToLegacy: true,
        understanding: pipelineIntent.understanding || 'defer',
        confidence: 0.5,
        route_hint: pipelineIntent.route_hint || 'legacy',
      };
    }
  } else if (isMvpPipelineIntent(pipelineIntent)) {
    seed = {
      intent: pipelineIntent.intent,
      moduleKey: pipelineIntent.moduleKey || null,
      filters: Object.entries(pipelineIntent.filters || {}).map(([fieldKey, value]) => ({
        fieldKey,
        operator: 'is',
        value,
        confidence: 0.8,
      })),
      outputs: ['answer'],
      required_information: pipelineIntent.required_information || [],
      required_tools: [],
      understanding: pipelineIntent.understanding || '',
      accountHint: pipelineIntent.accountHint || '',
      needs_clarification: pipelineIntent.needs_clarification,
      clarifying_question: pipelineIntent.clarifying_question,
      confidence: pipelineIntent.needs_clarification ? 0.4 : 0.85,
      route_hint: pipelineIntent.route_hint || '',
      proactiveScan: pipelineIntent.proactiveScan === true,
    };
  } else {
    seed = {
      intent: 'DeferLegacy',
      deferToLegacy: true,
      understanding: pipelineIntent?.understanding || 'defer',
      confidence: 0.5,
      route_hint: 'legacy',
    };
  }

  // Merge LLM proposal under deterministic seed
  if (llmIntent && typeof llmIntent === 'object') {
    seed = {
      ...seed,
      ...llmIntent,
      intent: seed.intent === 'DeferLegacy' ? (llmIntent.intent || seed.intent) : seed.intent,
      moduleKey: seed.moduleKey || llmIntent.moduleKey || null,
      understanding: llmIntent.understanding || seed.understanding,
      filters: Array.isArray(llmIntent.filters) && llmIntent.filters.length
        ? llmIntent.filters
        : seed.filters,
    };
  }

  const validated = validateIntent(seed, { enforceConfidenceClarify: false });
  if (!validated.intent) {
    return { ok: false, intent: null, overlay, errors: validated.errors };
  }

  // Overlay wins on CRM filters
  if (overlay.filters.length && ['CrmDataList', 'CrmDataChart'].includes(validated.intent.intent)) {
    validated.intent.filters = mergeFilterOverlay(validated.intent.filters, overlay.filters);
    validated.intent.moduleKey = validated.intent.moduleKey || overlay.moduleKey;
    validated.intent.confidence = Math.max(validated.intent.confidence, 0.9);
  }

  // Confidence → clarify: CRM ask without module and without any filters is unsafe.
  if (
    ['CrmDataList', 'CrmDataChart'].includes(validated.intent.intent)
    && !validated.intent.needs_clarification
    && !validated.intent.moduleKey
    && !(validated.intent.filters || []).length
  ) {
    validated.intent.needs_clarification = true;
    validated.intent.clarifying_question = validated.intent.clarifying_question
      || 'Which CRM module should I query (deals, tasks, cases, …) and any filters?';
    validated.intent.confidence = Math.min(validated.intent.confidence, 0.4);
    validated.intent.intent = 'Clarify';
  }

  // Route-level clarify from deterministic router
  if (routeIntent?.route === 'clarify' && routeIntent.clarifyingQuestion) {
    validated.intent.needs_clarification = true;
    validated.intent.clarifying_question = routeIntent.clarifyingQuestion;
    validated.intent.intent = 'Clarify';
    validated.intent.deferToLegacy = false;
    validated.intent.confidence = Math.min(validated.intent.confidence, 0.35);
  }

  return {
    ok: true,
    intent: validated.intent,
    overlay,
    errors: validated.errors,
  };
}

/**
 * Build ExecutionPlan from precise intent (tools allowlisted).
 */
function buildPrecisePlan({ intent, question = '', memory = {} } = {}) {
  if (!intent) {
    return validatePlan({ deferToLegacy: true, steps: [] });
  }
  if (intent.needs_clarification && intent.clarifying_question) {
    return validatePlan({
      clarifyOnly: true,
      clarifying_question: intent.clarifying_question,
      steps: [],
    });
  }
  if (intent.deferToLegacy || intent.intent === 'DeferLegacy') {
    return validatePlan({ deferToLegacy: true, steps: [] });
  }

  if (intent.intent === 'CrmDataList' || intent.intent === 'CrmDataChart') {
    return validatePlan({
      steps: [{
        id: 'crm1',
        tool: 'RunCrmDataAsk',
        input: {
          question,
          moduleKey: intent.moduleKey || 'deals',
          filters: intent.filters,
          wantList: intent.intent === 'CrmDataList' || (intent.outputs || []).includes('table'),
          wantChart: intent.intent === 'CrmDataChart' || (intent.outputs || []).includes('chart'),
          headlineHint: intent.intent === 'CrmDataList' && intent.filters.some((f) => f.fieldKey === 'status' && f.value === 'Won')
            ? 'Won deals'
            : undefined,
        },
        optional: false,
      }],
      success_criteria: ['rows_match_filters', 'no_invented_metrics'],
    }, { extraTools: ['RunCrmDataAsk'] });
  }

  // Product / health / sticky list → existing deterministic planner
  const pipelineShape = {
    intent: intent.intent,
    moduleKey: intent.moduleKey || memory.lastModuleKey || null,
    filters: Object.fromEntries(
      (intent.filters || [])
        .filter((f) => f.operator === 'is')
        .map((f) => [f.fieldKey, f.value]),
    ),
    accountHint: intent.accountHint,
    required_information: intent.required_information,
    needs_clarification: intent.needs_clarification,
    clarifying_question: intent.clarifying_question,
    understanding: intent.understanding,
    route_hint: intent.route_hint,
    proactiveScan: intent.proactiveScan === true,
  };
  const planned = planQuery({
    intentResult: pipelineShape,
    memory: { ...memory, effectiveQuestion: question },
  });
  return validatePlan(planned);
}

/**
 * Optional catalog slice for planner prompts (retrieval-before-plan).
 */
async function fetchPlannerCatalogSlice({
  organizationId,
  user = null,
  question = '',
  moduleKey = '',
} = {}) {
  if (!organizationId) {
    return { catalogText: '', fields: [], modules: [] };
  }
  try {
    const { executeSearchProductCatalog } = require('../tools/searchProductCatalog');
    const result = await executeSearchProductCatalog({
      organizationId,
      user,
      query: question,
      moduleKey: moduleKey || detectModuleKeyQuick(question) || '',
      includeApis: false,
      maxModules: 8,
      maxFields: 24,
    });
    return {
      catalogText: String(result.catalogText || '').slice(0, 4000),
      fields: result.fields || [],
      modules: result.modules || [],
      apps: result.apps || [],
    };
  } catch (err) {
    return { catalogText: '', fields: [], modules: [], error: String(err?.message || err) };
  }
}

/**
 * Apply precise intent overlay onto a CRM QueryPlan (from proposeQueryPlanWithLlm).
 */
function applyOverlayToQueryPlan(plan, question = '') {
  const precise = buildPreciseIntent({ question });
  if (!precise.ok || !precise.intent) return plan;

  const intent = precise.intent;
  if (!['CrmDataList', 'CrmDataChart'].includes(intent.intent)) return plan;

  const next = {
    ...(plan && typeof plan === 'object' ? plan : {}),
    moduleKey: intent.moduleKey || plan?.moduleKey || 'deals',
    wantList: intent.intent === 'CrmDataList' || plan?.wantList === true,
    wantChart: intent.intent === 'CrmDataChart' || plan?.wantChart === true,
    filters: Array.isArray(intent.filters) && intent.filters.length
      ? intent.filters.map((f) => ({
        fieldKey: f.fieldKey,
        operator: f.operator === 'is_any_of' ? 'is_any_of' : f.operator,
        value: f.value,
      }))
      : (plan?.filters || []),
  };

  if (precise.overlay?.isWon) {
    next.headlineHint = 'Won deals';
    next.wantList = true;
    next.reportType = 'tabular';
    next.groupField = '';
  } else if (precise.overlay?.isLost) {
    next.headlineHint = 'Lost deals';
    next.wantList = true;
    next.reportType = 'tabular';
    next.groupField = '';
  }

  return next;
}

module.exports = {
  detectModuleKeyQuick,
  buildDeterministicFilterOverlay,
  buildPreciseIntent,
  buildPrecisePlan,
  fetchPlannerCatalogSlice,
  applyOverlayToQueryPlan,
};
