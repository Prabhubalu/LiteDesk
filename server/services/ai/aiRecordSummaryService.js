const Case = require('../../models/Case');
const Deal = require('../../models/Deal');
const People = require('../../models/People');
const AiRecordSummary = require('../../models/AiRecordSummary');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText, redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const MAX_CONTEXT_CHARS = 4000;
const MAX_ACTIVITY_LINES = 15;

const RECORD_META = {
  case: {
    appKey: 'HELPDESK',
    moduleKey: 'cases',
    label: 'case',
    systemPromptKey: 'summarize_case_system',
    userPromptKey: 'summarize_case_user',
  },
  deal: {
    appKey: 'SALES',
    moduleKey: 'deals',
    label: 'deal',
    systemPromptKey: 'summarize_deal_system',
    userPromptKey: 'summarize_deal_user',
  },
  people: {
    appKey: 'SALES',
    moduleKey: 'people',
    label: 'person',
    systemPromptKey: 'summarize_people_system',
    userPromptKey: 'summarize_people_user',
  },
};

function isCacheFresh(recordUpdatedAt, cachedUpdatedAt) {
  if (!recordUpdatedAt || !cachedUpdatedAt) return false;
  return new Date(recordUpdatedAt).getTime() === new Date(cachedUpdatedAt).getTime();
}

function formatActivityLines(entries, mapFn) {
  const lines = [];
  for (const entry of (entries || []).slice(-MAX_ACTIVITY_LINES)) {
    const line = mapFn(entry);
    if (line) lines.push(line);
  }
  return lines;
}

function buildDealContextText(deal) {
  const lines = [
    `Deal: ${deal.name || deal._id}`,
    `Stage: ${deal.stage || ''}`,
    `Status: ${deal.status || ''}`,
    `Amount: ${deal.amount ?? ''} ${deal.currency || ''}`.trim(),
    `Probability: ${deal.probability ?? ''}%`,
    `Expected close: ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString() : ''}`,
    `Pipeline: ${deal.pipeline || ''}`,
    `Description: ${deal.description || ''}`,
  ];

  if (Array.isArray(deal.stageHistory) && deal.stageHistory.length) {
    lines.push('Recent stage history:');
    lines.push(...formatActivityLines(deal.stageHistory, (row) => {
      const stamp = row.changedAt || row.timestamp || row.createdAt;
      return `- [${stamp ? new Date(stamp).toISOString() : ''}] ${row.stageName || row.stage || row.stageKey || ''}`;
    }));
  }

  if (Array.isArray(deal.activityLogs) && deal.activityLogs.length) {
    lines.push('Recent activity:');
    lines.push(...formatActivityLines(deal.activityLogs, (row) => {
      const stamp = row.timestamp || row.createdAt;
      const body = String(row.message || row.action || '').replace(/\s+/g, ' ').trim();
      return `- [${stamp ? new Date(stamp).toISOString() : ''}] ${row.user || 'System'}: ${body}`;
    }));
  }

  return redactText(lines.join('\n').slice(0, MAX_CONTEXT_CHARS));
}

function buildPeopleContextText(person) {
  const sales = person.participations?.SALES || {};
  const assignee = person.assignedTo
    ? [person.assignedTo.firstName, person.assignedTo.lastName].filter(Boolean).join(' ').trim()
      || person.assignedTo.email
      || String(person.assignedTo._id || person.assignedTo)
    : '';
  const leadOwner = person.lead_owner
    ? [person.lead_owner.firstName, person.lead_owner.lastName].filter(Boolean).join(' ').trim()
      || person.lead_owner.email
      || String(person.lead_owner._id || person.lead_owner)
    : '';
  const lines = [
    `Person: ${[person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person._id}`,
    `Email: ${person.email || ''}`,
    `Phone: ${person.phone || person.mobile || ''}`,
    `Assigned to (owner / who is handling this contact): ${assignee}`,
    `Lead owner: ${leadOwner}`,
    `Tags: ${(person.tags || []).join(', ')}`,
    `Do not contact: ${person.do_not_contact ? 'yes' : 'no'}`,
    `Sales role: ${sales.role || ''}`,
    `Lead status: ${sales.lead_status || ''}`,
    `Contact status: ${sales.contact_status || ''}`,
  ];

  const description = person.descriptionVersions?.length
    ? person.descriptionVersions[person.descriptionVersions.length - 1]?.content
    : '';
  if (description) lines.push(`Description: ${description}`);

  if (Array.isArray(person.activityLogs) && person.activityLogs.length) {
    lines.push('Recent activity:');
    lines.push(...formatActivityLines(person.activityLogs, (row) => {
      const stamp = row.timestamp || row.createdAt;
      const body = String(row.message || row.action || '').replace(/\s+/g, ' ').trim();
      return `- [${stamp ? new Date(stamp).toISOString() : ''}] ${row.user || 'System'}: ${body}`;
    }));
  }

  return redactText(lines.join('\n').slice(0, MAX_CONTEXT_CHARS));
}

async function loadRecord({ sourceType, organizationId, recordId }) {
  if (sourceType === 'case') {
    const doc = await Case.findOne({ _id: recordId, organizationId, deletedAt: null }).lean();
    if (!doc) throw new AiConfigurationError('Case not found', 'AI_CASE_NOT_FOUND');
    const { buildCaseContextText } = require('./aiAssistService');
    return {
      doc,
      context: buildCaseContextText(doc),
      updatedAt: doc.updatedAt,
    };
  }

  if (sourceType === 'deal') {
    const doc = await Deal.findOne({ _id: recordId, organizationId, deletedAt: null }).lean();
    if (!doc) throw new AiConfigurationError('Deal not found', 'AI_DEAL_NOT_FOUND');
    return {
      doc,
      context: buildDealContextText(doc),
      updatedAt: doc.updatedAt,
    };
  }

  if (sourceType === 'people') {
    const doc = await People.findOne({ _id: recordId, organizationId, deletedAt: null })
      .populate('assignedTo', 'firstName lastName email username')
      .populate('lead_owner', 'firstName lastName email username')
      .lean();
    if (!doc) throw new AiConfigurationError('Person not found', 'AI_PEOPLE_NOT_FOUND');
    return {
      doc,
      context: buildPeopleContextText(doc),
      updatedAt: doc.updatedAt,
    };
  }

  throw new AiConfigurationError('Unsupported record type', 'AI_RECORD_TYPE_INVALID');
}

async function readCache({ organizationId, sourceType, sourceId, recordUpdatedAt }) {
  const cached = await AiRecordSummary.findOne({
    organizationId,
    sourceType,
    sourceId: String(sourceId),
  }).lean();

  if (!cached) return null;
  if (!isCacheFresh(recordUpdatedAt, cached.recordUpdatedAt)) return null;
  return cached;
}

async function writeCache({
  organizationId,
  sourceType,
  sourceId,
  recordUpdatedAt,
  text,
  provider,
  model,
  keyMode,
}) {
  await AiRecordSummary.findOneAndUpdate(
    {
      organizationId,
      sourceType,
      sourceId: String(sourceId),
    },
    {
      $set: {
        organizationId,
        sourceType,
        sourceId: String(sourceId),
        recordUpdatedAt,
        text,
        provider,
        model,
        keyMode,
      },
    },
    { upsert: true, new: true }
  );
}

async function summarizeRecord({
  organizationId,
  userId,
  sourceType,
  recordId,
  forceRefresh = false,
}) {
  const normalizedType = String(sourceType || '').trim().toLowerCase();
  const meta = RECORD_META[normalizedType];
  if (!meta) {
    throw new AiConfigurationError('Unsupported record type', 'AI_RECORD_TYPE_INVALID');
  }

  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'summarize',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const { doc, context, updatedAt } = await loadRecord({
      sourceType: normalizedType,
      organizationId,
      recordId,
    });

    if (!forceRefresh) {
      const cached = await readCache({
        organizationId,
        sourceType: normalizedType,
        sourceId: recordId,
        recordUpdatedAt: updatedAt,
      });
      if (cached) {
        return {
          text: cached.text,
          provider: cached.provider,
          model: cached.model,
          keyMode: cached.keyMode,
          creditsDebited: 0,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          cached: true,
          sourceType: normalizedType,
          recordId: String(doc._id),
          recordUpdatedAt: updatedAt,
        };
      }
    }

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'summarize' });
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

    const systemPrompt = getPrompt(meta.systemPromptKey);
    const userPrompt = getPrompt(meta.userPromptKey);

    const adapter = getLlmAdapter(config.provider);
    const messages = redactMessages([
      { role: 'system', content: systemPrompt.text },
      {
        role: 'user',
        content: `${userPrompt.text}\n\n---\n${meta.label} context:\n${context}`,
      },
    ]);

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages,
      temperature: 0.2,
      maxTokens: 500,
      providerOptions: config.providerOptions,
    });

    const text = String(completion.text || '').trim();
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeCache({
      organizationId,
      sourceType: normalizedType,
      sourceId: recordId,
      recordUpdatedAt: updatedAt,
      text,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [{
        sourceType: normalizedType,
        sourceId: String(doc._id),
        appKey: meta.appKey,
        moduleKey: meta.moduleKey,
      }],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
      metadata: { cached: false },
    });

    return {
      text,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      cached: false,
      sourceType: normalizedType,
      recordId: String(doc._id),
      recordUpdatedAt: updatedAt,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: error?.code?.includes('NOT') || error?.code?.includes('DISABLED') || error?.code?.includes('CONSENT') || error?.code?.includes('CREDITS') || error?.code?.includes('KEY')
        ? 'not_configured'
        : 'failed',
      contextRefs: recordId
        ? [{
          sourceType: normalizedType,
          sourceId: String(recordId),
          appKey: meta?.appKey,
          moduleKey: meta?.moduleKey,
        }]
        : [],
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_SUMMARIZE_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  summarizeRecord,
  isCacheFresh,
  buildDealContextText,
  buildPeopleContextText,
  RECORD_META,
};
