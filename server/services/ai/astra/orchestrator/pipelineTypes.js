'use strict';

/**
 * Shared contracts for the Astra pipeline (Intent → Plan → Retrieve → Context → Reason → Respond).
 */

const ASTRA_PIPELINE_INTENTS = Object.freeze([
  'ProductHowTo',
  'ProductExpertise',
  'CustomerHealthAnalysis',
  'CrmListFilter',
]);

const ASTRA_TOOL_NAMES = Object.freeze([
  'SearchAccounts',
  'SearchDeals',
  'SearchTickets',
  'SearchActivities',
  'SearchKnowledgeBase',
  'SearchProductCatalog',
  'SearchAutomations',
  'SearchProcessGraphs',
  'SearchPermissions',
  'SearchBusinessRules',
  'SearchApiMap',
]);

/**
 * @typedef {Object} IntentResult
 * @property {string} intent
 * @property {string[]} entities
 * @property {Record<string, string>} filters
 * @property {{ from?: string, to?: string }|null} dateRange
 * @property {string[]} required_information
 * @property {boolean} needs_clarification
 * @property {string|null} clarifying_question
 * @property {string} route_hint
 * @property {string} [understanding]
 * @property {string} [accountHint]
 */

/**
 * @typedef {Object} PlanStep
 * @property {string} id
 * @property {string} tool
 * @property {Record<string, unknown>} input
 * @property {string[]} [dependsOn]
 * @property {boolean} [optional]
 */

/**
 * @typedef {Object} ExecutionPlan
 * @property {PlanStep[]} steps
 * @property {boolean} [clarifyOnly]
 * @property {string|null} [clarifying_question]
 */

/**
 * @typedef {Object} ToolCitation
 * @property {number} [index]
 * @property {string} sourceType
 * @property {string} sourceId
 * @property {string} [excerpt]
 * @property {number} [score]
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} tool
 * @property {string} stepId
 * @property {boolean} ok
 * @property {unknown} data
 * @property {ToolCitation[]} citations
 * @property {string|null} [error]
 * @property {number} [latencyMs]
 */

/**
 * @typedef {Object} ContextPack
 * @property {string} question
 * @property {string} contextText
 * @property {ToolCitation[]} citations
 * @property {string[]} missingInformation
 * @property {Record<string, unknown>} memory
 */

/**
 * @typedef {Object} ReasoningResult
 * @property {string} summary
 * @property {string[]} keyFindings
 * @property {string[]} evidence
 * @property {string[]} recommendations
 * @property {string[]} nextSteps
 * @property {string[]} risks
 * @property {string[]} missingInformation
 * @property {string[]} unsupportedClaims
 * @property {Array<Record<string, unknown>>} [actions]
 */

function isPipelineV2Enabled() {
  const raw = String(process.env.ASTRA_PIPELINE_V2 || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function emptyIntentResult(overrides = {}) {
  return {
    intent: 'CrmListFilter',
    entities: [],
    filters: {},
    dateRange: null,
    required_information: [],
    needs_clarification: false,
    clarifying_question: null,
    route_hint: 'crm_data',
    understanding: '',
    accountHint: '',
    ...overrides,
  };
}

module.exports = {
  ASTRA_PIPELINE_INTENTS,
  ASTRA_TOOL_NAMES,
  isPipelineV2Enabled,
  emptyIntentResult,
};
