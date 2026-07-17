'use strict';

/**
 * Phase 4 Audit narrative + remediation agent.
 * Propose-only: drafts finding narrative and corrective-action suggestions.
 * Never writes FormResponse, never assigns owners, never approves/rejects.
 * Every suggested questionId must be in the failed-question allow-list.
 */

const mongoose = require('mongoose');
const FormResponse = require('../../models/FormResponse');
const Form = require('../../models/Form');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText, redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const MAX_FAILED = 40;
const MAX_ACTIONS = 20;

function buildQuestionLabelMap(form) {
  const map = new Map();
  const sections = Array.isArray(form?.sections) ? form.sections : [];
  for (const section of sections) {
    const collect = (questions) => {
      for (const q of questions || []) {
        const id = String(q?.questionId || q?._id || q?.id || '').trim();
        if (!id) continue;
        map.set(id, String(q?.questionText || q?.label || q?.text || id).slice(0, 240));
      }
    };
    collect(section?.questions);
    for (const sub of section?.subsections || []) {
      collect(sub?.questions);
    }
  }
  return map;
}

function buildFailedAllowList(response, labelMap) {
  const details = Array.isArray(response?.responseDetails) ? response.responseDetails : [];
  const out = [];
  for (const detail of details) {
    if (detail.passFail !== 'Fail') continue;
    const questionId = String(detail.questionId || '').trim();
    if (!questionId) continue;
    out.push({
      questionId,
      questionText: labelMap.get(questionId) || `Question ${questionId}`,
      answer: redactText(JSON.stringify(detail.answer ?? '')).slice(0, 200),
      score: detail.score != null ? Number(detail.score) : null,
      sectionId: detail.sectionId ? String(detail.sectionId) : null,
    });
    if (out.length >= MAX_FAILED) break;
  }
  return out;
}

function summarizeExistingActions(response) {
  return (Array.isArray(response?.correctiveActions) ? response.correctiveActions : [])
    .slice(0, MAX_ACTIONS)
    .map((a) => ({
      questionId: String(a.questionId || ''),
      auditorFinding: String(a.auditorFinding || '').slice(0, 200),
      status: a.managerAction?.status || 'open',
    }));
}

/**
 * Parse LLM JSON and constrain remediation actions to failed questionIds.
 */
function parseAuditNarrativeJson(text, failedAllowList) {
  const allowed = new Set(failedAllowList.map((f) => f.questionId));
  const byId = new Map(failedAllowList.map((f) => [f.questionId, f]));
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { narrative: '', remediationActions: [], overallRisk: null };
  }
  try {
    const parsed = JSON.parse(match[0]);
    const rows = Array.isArray(parsed?.remediationActions) ? parsed.remediationActions : [];
    const seen = new Set();
    const remediationActions = [];
    for (const row of rows) {
      const questionId = String(row?.questionId || '').trim();
      if (!questionId || !allowed.has(questionId) || seen.has(questionId)) continue;
      seen.add(questionId);
      const failed = byId.get(questionId);
      remediationActions.push({
        questionId,
        questionText: failed?.questionText || questionId,
        auditorFinding: String(row?.auditorFinding || '').slice(0, 500),
        suggestedAction: String(row?.suggestedAction || '').slice(0, 500),
        priority: ['high', 'medium', 'low'].includes(String(row?.priority || '').toLowerCase())
          ? String(row.priority).toLowerCase()
          : 'medium',
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
        confirmRequired: true,
      });
      if (remediationActions.length >= MAX_ACTIONS) break;
    }
    const risk = String(parsed?.overallRisk || '').toLowerCase();
    return {
      narrative: String(parsed?.narrative || '').slice(0, 4000),
      remediationActions,
      overallRisk: ['high', 'medium', 'low'].includes(risk) ? risk : null,
    };
  } catch {
    return { narrative: '', remediationActions: [], overallRisk: null };
  }
}

async function draftAuditNarrative({ organizationId, userId, responseId }) {
  const startedAt = Date.now();
  const id = String(responseId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AiConfigurationError('responseId is required', 'AI_AUDIT_RESPONSE_ID_REQUIRED');
  }

  const response = await FormResponse.findOne({ _id: id, organizationId }).lean();
  if (!response) {
    const err = new AiConfigurationError('Form response not found', 'AI_AUDIT_RESPONSE_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }

  let form = null;
  if (response.formId) {
    form = await Form.findOne({ _id: response.formId, organizationId }).lean();
  }
  const labelMap = buildQuestionLabelMap(form);
  const failedAllowList = buildFailedAllowList(response, labelMap);
  const existingActions = summarizeExistingActions(response);

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'audit_narrative',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'audit_narrative' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('audit_narrative_system');
    const adapter = getLlmAdapter(config.provider);
    const kpis = response.kpis || {};
    const userContent = [
      `Form: ${String(form?.name || response.formId || 'unknown').slice(0, 120)}`,
      `Response ID: ${String(response.responseId || response._id)}`,
      `Execution status: ${response.executionStatus || 'n/a'}`,
      `Review status: ${response.reviewStatus || 'n/a'}`,
      `Compliance: ${kpis.compliancePercentage ?? 'n/a'}% · Final score: ${kpis.finalScore ?? 'n/a'}`,
      `Failed questions (${failedAllowList.length}):\n${JSON.stringify(failedAllowList)}`,
      `Existing corrective actions:\n${JSON.stringify(existingActions)}`,
      'Return JSON only: {"narrative":"...","overallRisk":"high|medium|low","remediationActions":[{"questionId":"...","auditorFinding":"...","suggestedAction":"...","priority":"high|medium|low","confidence":0-1}]}.',
      'Only use questionIds from the failed list. Do not invent failures. Propose-only — never claim actions were assigned or approved.',
    ].join('\n');

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        { role: 'user', content: userContent },
      ]),
      temperature: 0.2,
      maxTokens: 1200,
      providerOptions: config.providerOptions,
    });

    const parsed = parseAuditNarrativeJson(completion.text, failedAllowList);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [
        {
          sourceType: 'form_response',
          sourceId: String(response._id),
          moduleKey: 'responses',
        },
      ],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      narrative: parsed.narrative,
      overallRisk: parsed.overallRisk,
      remediationActions: parsed.remediationActions,
      failedQuestionCount: failedAllowList.length,
      confirmRequired: true,
      autoApply: false,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_AUDIT_NARRATIVE_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  draftAuditNarrative,
  parseAuditNarrativeJson,
  buildFailedAllowList,
  buildQuestionLabelMap,
};
