const Case = require('../../models/Case');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText, redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const MAX_ACTIVITY_LINES = 20;
const MAX_ACTIVITY_CHARS = 4000;

function buildCaseContextText(caseDoc) {
  const lines = [
    `Case: ${caseDoc.caseId || caseDoc._id}`,
    `Title: ${caseDoc.title || ''}`,
    `Status: ${caseDoc.status || ''}`,
    `Priority: ${caseDoc.priority || ''}`,
    `Type: ${caseDoc.type || ''}`,
    `Channel: ${caseDoc.channel || ''}`,
    `Description: ${caseDoc.description || ''}`,
  ];

  const activities = Array.isArray(caseDoc.activities) ? caseDoc.activities.slice(-MAX_ACTIVITY_LINES) : [];
  if (activities.length) {
    lines.push('Recent activity:');
    for (const activity of activities) {
      const stamp = activity.createdAt ? new Date(activity.createdAt).toISOString() : '';
      const actor = activity.actorName || 'System';
      const body = String(activity.message || '').replace(/\s+/g, ' ').trim();
      lines.push(`- [${stamp}] (${activity.activityType || 'note'}) ${actor}: ${body}`);
    }
  }

  return redactText(lines.join('\n').slice(0, MAX_ACTIVITY_CHARS));
}

async function loadCaseForAi({ organizationId, caseId }) {
  const caseDoc = await Case.findOne({
    _id: caseId,
    organizationId,
    deletedAt: null,
  }).lean();

  if (!caseDoc) {
    throw new AiConfigurationError('Case not found', 'AI_CASE_NOT_FOUND');
  }
  return caseDoc;
}

async function runCaseAbility({
  organizationId,
  userId,
  abilityKey,
  caseId,
  systemPrompt,
  userPrompt,
  promptVersion = 'v0',
  temperature = 0.3,
  maxTokens = 600,
}) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey,
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const caseDoc = await loadCaseForAi({ organizationId, caseId });
    const context = buildCaseContextText(caseDoc);
    const config = await resolveAiRequestConfig({ organizationId, abilityKey });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    assertCreditsAvailable({
      keyMode: config.keyMode,
      creditsBalance: config.creditsBalance,
    });

    const adapter = getLlmAdapter(config.provider);
    const messages = redactMessages([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${userPrompt}\n\n---\nCase context:\n${context}`,
      },
    ]);

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages,
      temperature,
      maxTokens,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion,
      contextRefs: [{
        sourceType: 'case',
        sourceId: String(caseDoc._id),
        appKey: 'HELPDESK',
        moduleKey: 'cases',
      }],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      caseId: String(caseDoc._id),
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: error?.code?.includes('NOT') || error?.code?.includes('DISABLED') || error?.code?.includes('CONSENT') || error?.code?.includes('CREDITS') || error?.code?.includes('KEY')
        ? 'not_configured'
        : 'failed',
      promptVersion,
      contextRefs: caseId
        ? [{ sourceType: 'case', sourceId: String(caseId), appKey: 'HELPDESK', moduleKey: 'cases' }]
        : [],
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_ASSIST_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function summarizeCase({ organizationId, userId, caseId, forceRefresh = false }) {
  const { summarizeRecord } = require('./aiRecordSummaryService');
  const result = await summarizeRecord({
    organizationId,
    userId,
    sourceType: 'case',
    recordId: caseId,
    forceRefresh,
  });
  return {
    ...result,
    caseId: result.recordId,
  };
}

async function draftCaseReply({ organizationId, userId, caseId, tone = 'professional' }) {
  const safeTone = String(tone || 'professional').trim().toLowerCase() || 'professional';
  const systemPrompt = getPrompt('draft_reply_system');
  return runCaseAbility({
    organizationId,
    userId,
    abilityKey: 'draft_reply',
    caseId,
    systemPrompt: systemPrompt.text,
    userPrompt: `Draft a ${safeTone} customer reply for this case. The agent will review before sending.`,
    promptVersion: systemPrompt.version,
    temperature: 0.4,
    maxTokens: 700,
  });
}

module.exports = {
  summarizeCase,
  draftCaseReply,
  buildCaseContextText,
};
