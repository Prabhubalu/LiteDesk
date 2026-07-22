'use strict';

/**
 * Canonical Astra Intent + ExecutionPlan contracts.
 * LLM output must pass validateIntent / validatePlan before execution.
 */

const { ASTRA_TOOL_NAMES } = require('../orchestrator/pipelineTypes');

const ASTRA_INTENT_KINDS = Object.freeze([
  'CrmDataList',
  'CrmDataChart',
  'ProductHowTo',
  'ProductExpertise',
  'CustomerHealthAnalysis',
  'CrmListFilter',
  'Clarify',
  'DeferLegacy',
]);

const ALLOWED_FILTER_OPS = Object.freeze([
  'is', 'is_not', 'is_any_of', 'gt', 'gte', 'lt', 'lte', 'contains',
]);

const ALLOWED_MODULES = Object.freeze([
  'deals', 'tasks', 'cases', 'quotes', 'events', 'people', 'organizations', 'items',
]);

const CONFIDENCE_CLARIFY_THRESHOLD = 0.45;

/**
 * @typedef {Object} IntentFilter
 * @property {string} fieldKey
 * @property {string} operator
 * @property {unknown} value
 * @property {number} [confidence]
 */

/**
 * Normalize and validate IntentResult. Returns { ok, intent, errors }.
 */
function validateIntent(raw = {}, options = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, intent: null, errors: ['intent must be an object'] };
  }

  let kind = String(raw.intent || raw.kind || '').trim();
  const aliases = {
    crm_data: 'CrmDataList',
    crm_list: 'CrmDataList',
    crm_chart: 'CrmDataChart',
    product_howto: 'ProductHowTo',
    product_expertise: 'ProductExpertise',
    health: 'CustomerHealthAnalysis',
    clarify: 'Clarify',
    legacy: 'DeferLegacy',
    __defer__: 'DeferLegacy',
  };
  if (aliases[kind.toLowerCase()]) kind = aliases[kind.toLowerCase()];
  if (!ASTRA_INTENT_KINDS.includes(kind)) {
    errors.push(`unknown intent: ${kind || '(empty)'}`);
    kind = 'DeferLegacy';
  }

  let moduleKey = raw.moduleKey != null ? String(raw.moduleKey).toLowerCase().trim() : null;
  if (moduleKey === '' || moduleKey === 'null' || moduleKey === 'none') moduleKey = null;
  if (moduleKey && !ALLOWED_MODULES.includes(moduleKey)) {
    errors.push(`unknown moduleKey: ${moduleKey}`);
    moduleKey = null;
  }

  const filters = [];
  const rawFilters = Array.isArray(raw.filters) ? raw.filters : [];
  // Also accept object map { status: 'Won' } from older IntentResult shape
  if (!rawFilters.length && raw.filters && typeof raw.filters === 'object' && !Array.isArray(raw.filters)) {
    for (const [fieldKey, value] of Object.entries(raw.filters)) {
      if (value == null || value === '') continue;
      filters.push({
        fieldKey: String(fieldKey).slice(0, 60),
        operator: 'is',
        value: String(value).slice(0, 120),
        confidence: 0.7,
      });
    }
  }
  for (const f of rawFilters.slice(0, 12)) {
    if (!f || typeof f !== 'object') continue;
    const fieldKey = String(f.fieldKey || f.field || '').trim().slice(0, 60);
    let operator = String(f.operator || 'is').trim().toLowerCase();
    if (!fieldKey) continue;
    if (!ALLOWED_FILTER_OPS.includes(operator)) {
      errors.push(`invalid operator: ${operator}`);
      continue;
    }
    let value = f.value;
    if (value == null || value === '') continue;
    if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        errors.push(`numeric filter required for ${fieldKey}`);
        continue;
      }
      value = n;
    } else if (operator === 'is_any_of') {
      value = Array.isArray(value)
        ? value.map((v) => String(v).slice(0, 120)).filter(Boolean).slice(0, 12)
        : [String(value).slice(0, 120)];
      if (!value.length) continue;
    } else {
      value = String(value).slice(0, 120);
    }
    const confidence = Number.isFinite(Number(f.confidence))
      ? Math.max(0, Math.min(1, Number(f.confidence)))
      : 0.8;
    filters.push({ fieldKey, operator, value, confidence });
  }

  const outputs = Array.isArray(raw.outputs)
    ? raw.outputs.map((o) => String(o || '').toLowerCase()).filter(Boolean).slice(0, 6)
    : [];
  const required_tools = Array.isArray(raw.required_tools)
    ? raw.required_tools.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  const required_information = Array.isArray(raw.required_information)
    ? raw.required_information.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
    : [];

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = filters.length ? 0.75 : 0.55;
  confidence = Math.max(0, Math.min(1, confidence));

  let needs_clarification = raw.needs_clarification === true;
  let clarifying_question = raw.clarifying_question
    ? String(raw.clarifying_question).trim().slice(0, 200)
    : null;
  if (kind === 'Clarify') {
    needs_clarification = true;
    if (!clarifying_question) clarifying_question = 'Could you clarify what you need?';
  }
  if (
    options.enforceConfidenceClarify !== false
    && confidence < CONFIDENCE_CLARIFY_THRESHOLD
    && kind !== 'DeferLegacy'
    && !needs_clarification
  ) {
    needs_clarification = true;
    clarifying_question = clarifying_question || 'Could you clarify the module or filters?';
  }

  const intent = {
    intent: kind,
    moduleKey,
    entities: Array.isArray(raw.entities)
      ? raw.entities.map((e) => String(e || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    filters,
    dateRange: raw.dateRange && typeof raw.dateRange === 'object' ? raw.dateRange : null,
    outputs,
    required_tools,
    required_information,
    needs_clarification,
    clarifying_question,
    route_hint: String(raw.route_hint || '').slice(0, 40),
    understanding: String(raw.understanding || '').trim().slice(0, 400),
    accountHint: String(raw.accountHint || '').trim().slice(0, 120),
    confidence,
    deferToLegacy: kind === 'DeferLegacy' || raw.deferToLegacy === true,
    proactiveScan: raw.proactiveScan === true,
  };

  return { ok: errors.length === 0, intent, errors };
}

/**
 * Validate ExecutionPlan — tools must be registered / allowlisted.
 */
function validatePlan(raw = {}, options = {}) {
  const errors = [];
  const allow = new Set([
    ...ASTRA_TOOL_NAMES,
    'RunCrmDataAsk',
    'ExecuteQueryPlan',
    ...(Array.isArray(options.extraTools) ? options.extraTools : []),
  ]);

  if (!raw || typeof raw !== 'object') {
    return { ok: false, plan: null, errors: ['plan must be an object'] };
  }
  if (raw.clarifyOnly && raw.clarifying_question) {
    return {
      ok: true,
      plan: {
        steps: [],
        clarifyOnly: true,
        clarifying_question: String(raw.clarifying_question).slice(0, 200),
        success_criteria: [],
      },
      errors: [],
    };
  }

  const steps = [];
  for (const step of Array.isArray(raw.steps) ? raw.steps.slice(0, 16) : []) {
    if (!step || typeof step !== 'object') continue;
    const tool = String(step.tool || '').trim();
    if (!tool) continue;
    if (!allow.has(tool)) {
      errors.push(`unknown tool: ${tool}`);
      continue;
    }
    steps.push({
      id: String(step.id || tool).slice(0, 40),
      tool,
      input: step.input && typeof step.input === 'object' ? step.input : {},
      dependsOn: Array.isArray(step.dependsOn)
        ? step.dependsOn.map((d) => String(d)).slice(0, 6)
        : [],
      optional: Boolean(step.optional),
    });
  }

  if (!steps.length && !raw.deferToLegacy) {
    errors.push('plan has no executable steps');
  }

  const plan = {
    steps,
    clarifyOnly: false,
    clarifying_question: null,
    deferToLegacy: Boolean(raw.deferToLegacy),
    success_criteria: Array.isArray(raw.success_criteria)
      ? raw.success_criteria.map((s) => String(s).slice(0, 80)).slice(0, 8)
      : ['no_invented_metrics', 'rows_match_filters'],
  };

  return { ok: errors.length === 0 && (steps.length > 0 || plan.deferToLegacy), plan, errors };
}

/**
 * Merge deterministic overlay filters into intent filters.
 * Overlay wins on same fieldKey (CRM correctness > LLM guess).
 */
function mergeFilterOverlay(intentFilters = [], overlayFilters = []) {
  const byKey = new Map();
  for (const f of intentFilters || []) {
    if (!f?.fieldKey) continue;
    byKey.set(`${f.fieldKey}:${f.operator}`, { ...f, confidence: f.confidence ?? 0.7 });
  }
  for (const f of overlayFilters || []) {
    if (!f?.fieldKey) continue;
    // Overlay replaces any operators on the same field for outcome fields
    if (['status', 'stage', 'amount'].includes(f.fieldKey)) {
      for (const key of [...byKey.keys()]) {
        if (key.startsWith(`${f.fieldKey}:`)) byKey.delete(key);
      }
    }
    byKey.set(`${f.fieldKey}:${f.operator}`, {
      ...f,
      confidence: Math.max(0.95, Number(f.confidence) || 0.95),
    });
  }
  return [...byKey.values()];
}

/**
 * Convert detectFilters-style filterTree children into IntentFilter[].
 */
function filterTreeToIntentFilters(filterTree) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (!n) continue;
      if (n.logic && Array.isArray(n.children)) {
        // Flatten OR groups as is_any_of when same field, else keep first OR branch tools handle
        const stageValues = [];
        const statusValues = [];
        for (const c of n.children) {
          if (c?.fieldKey === 'stage' && c.operator === 'is') stageValues.push(c.value);
          else if (c?.fieldKey === 'stage' && c.operator === 'is_any_of' && Array.isArray(c.value)) {
            stageValues.push(...c.value);
          } else if (c?.fieldKey === 'status' && c.operator === 'is') statusValues.push(c.value);
          else walk([c]);
        }
        if (statusValues.length) {
          out.push({
            fieldKey: 'status',
            operator: statusValues.length > 1 ? 'is_any_of' : 'is',
            value: statusValues.length > 1 ? statusValues : statusValues[0],
            confidence: 0.98,
          });
        }
        if (stageValues.length) {
          out.push({
            fieldKey: 'stage',
            operator: 'is_any_of',
            value: [...new Set(stageValues.map(String))],
            confidence: 0.98,
          });
        }
        continue;
      }
      if (n.fieldKey && n.operator) {
        out.push({
          fieldKey: String(n.fieldKey),
          operator: String(n.operator),
          value: n.value,
          confidence: 0.98,
        });
      }
    }
  };
  walk(filterTree?.children || []);
  return out;
}

module.exports = {
  ASTRA_INTENT_KINDS,
  ALLOWED_FILTER_OPS,
  ALLOWED_MODULES,
  CONFIDENCE_CLARIFY_THRESHOLD,
  validateIntent,
  validatePlan,
  mergeFilterOverlay,
  filterTreeToIntentFilters,
};
