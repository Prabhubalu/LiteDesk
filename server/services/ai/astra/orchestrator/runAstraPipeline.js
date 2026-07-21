'use strict';

const { isPipelineV2Enabled, ASTRA_PIPELINE_INTENTS } = require('./pipelineTypes');
const { isMvpPipelineIntent } = require('../intent/intentAnalyzer');
const { buildPreciseIntent, buildPrecisePlan, fetchPlannerCatalogSlice } = require('../planner/preciseIntentPlanner');
const { runToolPlan } = require('../retrieval/toolRunner');
const { buildContextPack } = require('../retrieval/contextBuilder');
const { runReasoning } = require('../reasoning/reasoningEngine');
const { generateResponse } = require('../response/responseGenerator');
const {
  buildConversationMemory,
  withLastIntent,
  withTurnOutcome,
} = require('../memory/conversationMemory');
const { assertCreditsAvailable, debitCredits } = require('../../aiCreditService');
const { writeAiAuditLog } = require('../../aiAuditLogService');

/**
 * Astra Ultimate pipeline (Phase 1 MVP intents).
 * Returns null when the ask should fall through to the legacy runTenantAgentAsk path.
 */
async function runAstraPipeline({
  organizationId,
  userId,
  user = null,
  agent,
  question,
  history = [],
  config,
  redactOpts = {},
  auditBase = null,
  appKey = 'SALES',
  moduleKey = '',
  recordId = '',
  onProgress = null,
  routeIntent = null,
} = {}) {
  if (!isPipelineV2Enabled()) {
    return null;
  }

  const emit = (step, detail = '') => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress({ step, detail: detail || undefined, at: Date.now() });
    } catch (_) { /* ignore */ }
  };

  const startedAt = Date.now();
  const normalizedQuestion = String(question || '').trim();
  if (!normalizedQuestion) return null;

  emit('intent');
  let memory = buildConversationMemory({ question: normalizedQuestion, history });
  if (moduleKey) {
    memory = {
      ...memory,
      lastModuleKey: memory.lastModuleKey || String(moduleKey).trim().toLowerCase(),
      lastRecordId: memory.lastRecordId || String(recordId || '').trim() || null,
    };
  }
  const precise = buildPreciseIntent({
    question: memory.effectiveQuestion || normalizedQuestion,
    memory,
    routeIntent,
  });
  const intentResult = precise.ok && precise.intent
    ? {
      intent: precise.intent.intent,
      entities: precise.intent.entities,
      filters: Object.fromEntries(
        (precise.intent.filters || [])
          .filter((f) => f.operator === 'is')
          .map((f) => [f.fieldKey, f.value]),
      ),
      dateRange: precise.intent.dateRange,
      required_information: precise.intent.required_information,
      needs_clarification: precise.intent.needs_clarification,
      clarifying_question: precise.intent.clarifying_question,
      route_hint: precise.intent.route_hint,
      understanding: precise.intent.understanding,
      accountHint: precise.intent.accountHint,
      deferToLegacy: precise.intent.deferToLegacy,
      confidence: precise.intent.confidence,
      proactiveScan: precise.intent.proactiveScan === true,
      moduleKey: precise.intent.moduleKey || memory.lastModuleKey || null,
    }
    : null;

  // CRM list/chart → legacy runCrmDataAsk (deterministic overlay lives there).
  if (
    !intentResult
    || intentResult.deferToLegacy
    || ['CrmDataList', 'CrmDataChart', 'DeferLegacy'].includes(intentResult.intent)
    || (!ASTRA_PIPELINE_INTENTS.includes(intentResult.intent) && intentResult.intent !== 'Clarify')
  ) {
    return null;
  }

  if (!isMvpPipelineIntent(intentResult) && intentResult.intent !== 'Clarify') {
    return null;
  }

  memory = withLastIntent(memory, intentResult.intent);
  memory = withTurnOutcome(memory, {
    intent: intentResult.intent,
    moduleKey: intentResult.moduleKey || memory.lastModuleKey || '',
    question: normalizedQuestion,
  });
  const pipelineTrace = {
    intent: intentResult,
    preciseFilters: precise.intent?.filters || [],
    planSteps: [],
    toolLatencies: [],
    missingInformation: [],
  };

  emit('planning');
  // Optional catalog slice for product intents (retrieval-before-plan context).
  if (['ProductHowTo', 'ProductExpertise'].includes(intentResult.intent)) {
    try {
      await fetchPlannerCatalogSlice({
        organizationId,
        user,
        question: normalizedQuestion,
      });
    } catch (_) { /* non-fatal */ }
  }

  const planValidated = buildPrecisePlan({
    intent: precise.intent,
    question: memory.effectiveQuestion || normalizedQuestion,
    memory: { ...memory, effectiveQuestion: normalizedQuestion },
  });
  const plan = planValidated.plan || { steps: [], deferToLegacy: true };

  if (plan.deferToLegacy) {
    return null;
  }

  if (plan.clarifyOnly && plan.clarifying_question) {
    const response = generateResponse({
      reasoning: null,
      citations: [],
      clarifyingQuestion: plan.clarifying_question,
    });
    if (auditBase) {
      await writeAiAuditLog({
        ...auditBase,
        status: 'success',
        promptVersion: 'astra_pipeline_v1',
        latencyMs: Date.now() - startedAt,
        metadata: {
          pipeline: 'v2',
          clarifyOnly: true,
          intent: intentResult.intent,
          agentId: agent?._id ? String(agent._id) : null,
        },
      });
    }
    return {
      ...response,
      agent: agent
        ? {
          _id: String(agent._id),
          name: agent.name,
          autoCreated: Boolean(agent.autoCreated),
        }
        : undefined,
      mutationsApplied: [],
      mutationErrors: [],
      meta: {
        provider: config?.provider,
        model: config?.model,
        keyMode: config?.keyMode,
        abilityKey: 'tenant_agent',
        pipeline: 'v2',
        intent: intentResult.intent,
      },
      pipelineTrace: { ...pipelineTrace, clarifyOnly: true },
    };
  }

  pipelineTrace.planSteps = (plan.steps || []).map((s) => ({ id: s.id, tool: s.tool, optional: Boolean(s.optional) }));

  assertCreditsAvailable({
    keyMode: config.keyMode,
    creditsBalance: config.creditsBalance,
  });

  emit('retrieving');
  const { results: toolResults } = await runToolPlan({
    plan,
    organizationId,
    userId,
    user,
    config,
    auditBase,
    onProgress,
  });
  pipelineTrace.toolLatencies = toolResults.map((r) => ({
    tool: r.tool,
    stepId: r.stepId,
    ok: r.ok,
    latencyMs: r.latencyMs,
    error: r.error || null,
  }));

  emit('gathering_context');
  const contextPack = buildContextPack({
    question: normalizedQuestion,
    intentResult,
    memory,
    toolResults,
  });
  pipelineTrace.missingInformation = contextPack.missingInformation;

  // Never answer "no deals" from weak keyword search when CRM analytics should handle it.
  // Fall through to legacy runCrmDataAsk / hybrid path.
  if (intentResult.intent === 'CrmListFilter') {
    const dealResult = toolResults.find((r) => r.tool === 'SearchDeals');
    const dealCount = dealResult?.data?.records?.length || 0;
    if (!dealCount) {
      return null;
    }
  }

  emit('reasoning');
  const reasoning = await runReasoning({
    contextPack,
    config,
    redactOpts,
  });

  emit('responding');
  const response = generateResponse({
    reasoning,
    citations: contextPack.citations,
  });

  const creditsDebited = await debitCredits({
    organizationId,
    keyMode: config.keyMode,
    usage: reasoning.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  });

  if (auditBase) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: 'astra_pipeline_v1',
      contextRefs: [
        { sourceType: 'tenant_agent', sourceId: agent?._id ? String(agent._id) : 'pipeline', appKey, moduleKey },
        ...contextPack.citations.slice(0, 12),
      ],
      usage: reasoning.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      creditsDebited,
      latencyMs: Date.now() - startedAt,
      metadata: {
        pipeline: 'v2',
        intent: intentResult.intent,
        agentId: agent?._id ? String(agent._id) : null,
        agentName: agent?.name || null,
        pipelineTrace,
      },
    });
  }

  return {
    ...response,
    agent: agent
      ? {
        _id: String(agent._id),
        name: agent.name,
        autoCreated: Boolean(agent.autoCreated),
      }
      : undefined,
    mutationsApplied: [],
    mutationErrors: [],
    meta: {
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      abilityKey: 'tenant_agent',
      pipeline: 'v2',
      intent: intentResult.intent,
      creditsDebited,
    },
    pipelineTrace,
  };
}

module.exports = {
  runAstraPipeline,
};
