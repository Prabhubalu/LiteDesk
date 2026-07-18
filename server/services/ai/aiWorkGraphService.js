'use strict';

const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages, redactText } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');
const { buildWorkGraphContextPack } = require('./aiWorkGraphContextService');
const { parseJsonObject } = require('./aiMarketingService');
const {
  buildCacheKey,
  buildScopeKey,
  lookupResponseCache,
  writeResponseCache,
} = require('./aiResponseCacheService');

function formatActionableRecords(citations = []) {
  return (citations || [])
    .filter((c) => c?.sourceId && c?.sourceType)
    .slice(0, 24)
    .map((c) => {
      const email = c.email ? ` email=${c.email}` : '';
      return `[${c.index}] moduleKey=${c.sourceType} recordId=${c.sourceId} label=${c.excerpt || ''}${email}`;
    })
    .join('\n');
}

function isUsableEmail(value) {
  const email = String(value || '').trim();
  if (!email || email.includes('[') || email.includes(']')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveContactEmail(organizationId, moduleKey, recordId, citations = []) {
  const { loadDocument } = require('./aiWorkGraphContextService');
  const key = String(moduleKey || '').toLowerCase();
  const id = String(recordId || '').trim();

  if (key === 'people' && id) {
    const person = await loadDocument(organizationId, 'people', id);
    if (isUsableEmail(person?.email)) return String(person.email).trim();
  }

  if (key === 'deals' && id) {
    const deal = await loadDocument(organizationId, 'deals', id);
    const contactId = deal?.contactId || deal?.primaryContactId || deal?.personId;
    if (contactId) {
      const person = await loadDocument(organizationId, 'people', String(contactId));
      if (isUsableEmail(person?.email)) return String(person.email).trim();
    }
  }

  for (const cite of citations || []) {
    if (String(cite.sourceType || '').toLowerCase() !== 'people') continue;
    if (isUsableEmail(cite.email)) return String(cite.email).trim();
    if (!cite.sourceId) continue;
    const person = await loadDocument(organizationId, 'people', String(cite.sourceId));
    if (isUsableEmail(person?.email)) return String(person.email).trim();
  }

  return '';
}

async function enrichEmailActionsFromCrm(organizationId, actions = [], citations = []) {
  const next = [];
  for (const action of actions || []) {
    if (!action || action.kind !== 'send_email') {
      next.push(action);
      continue;
    }
    const email = { ...(action.email || {}) };
    if (!isUsableEmail(email.to)) {
      email.to = await resolveContactEmail(
        organizationId,
        action.moduleKey,
        action.recordId,
        citations,
      );
    }
    // Strip LLM placeholders accidentally left in body/subject
    email.subject = String(email.subject || '').replace(/\[EMAIL\]/gi, email.to || '').trim();
    email.body = String(email.body || '').replace(/\[EMAIL\]/gi, email.to || '').trim();
    next.push({ ...action, email });
  }
  return next;
}

const ACTION_KINDS = new Set([
  'send_email',
  'complete_task',
  'follow_up',
  'review_record',
  'update_status',
  'talk_to_agent',
  'manual',
  'create_record',
  'update_record',
]);

function looksLikeOpenOnlyLabel(label) {
  return /^open\b/i.test(String(label || '').trim());
}

function normalizeStructuredAnswer(raw, citations = [], options = {}) {
  const maxBullets = Number.isFinite(options.maxBullets) ? options.maxBullets : 4;
  const maxHeadline = Number.isFinite(options.maxHeadline) ? options.maxHeadline : 160;
  const maxActions = Number.isFinite(options.maxActions) ? options.maxActions : 3;
  const maxRationale = Number.isFinite(options.maxRationale) ? options.maxRationale : 160;
  const maxBulletLen = Number.isFinite(options.maxBulletLen) ? options.maxBulletLen : 400;
  const maxDetail = Number.isFinite(options.maxDetail) ? options.maxDetail : 0;
  const maxActionScan = Math.max(maxActions, 8);

  const allowed = new Map(
    (citations || [])
      .filter((c) => c?.sourceId && c?.sourceType)
      .map((c) => [`${String(c.sourceType).toLowerCase()}:${String(c.sourceId)}`, c]),
  );

  const headline = String(raw?.headline || '').trim().slice(0, maxHeadline);
  const bullets = Array.isArray(raw?.bullets)
    ? raw.bullets
      .map((b) => String(b || '').trim().slice(0, maxBulletLen))
      .filter(Boolean)
      .slice(0, maxBullets)
    : [];
  const detail = maxDetail > 0
    ? String(raw?.detail || raw?.analysis || '').trim().slice(0, maxDetail)
    : '';
  const clarifyingQuestions = Array.isArray(raw?.clarifyingQuestions)
    ? raw.clarifyingQuestions
      .map((q) => String(q || '').trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 6)
    : [];

  const actions = [];
  if (Array.isArray(raw?.actions)) {
    for (const row of raw.actions.slice(0, maxActionScan)) {
      if (actions.length >= maxActions) break;
      let kind = String(row?.kind || 'manual').trim();
      if (kind === 'open_record' || kind === 'none') kind = 'manual';
      if (!ACTION_KINDS.has(kind)) kind = 'manual';

      const label = String(row?.label || '').trim().slice(0, 120);
      if (!label || looksLikeOpenOnlyLabel(label)) continue;

      const action = {
        label,
        kind,
        priority: ['high', 'medium', 'low'].includes(row?.priority) ? row.priority : 'medium',
        rationale: String(row?.rationale || '').trim().slice(0, maxRationale),
        executeNow: Boolean(row?.executeNow),
      };

      if (kind === 'create_record' || kind === 'update_record') {
        const fieldsRaw = row?.fields && typeof row.fields === 'object' ? row.fields : {};
        const fields = {};
        for (const [fk, fv] of Object.entries(fieldsRaw)) {
          if (fv === undefined || typeof fv === 'object') continue;
          fields[String(fk).slice(0, 80)] = typeof fv === 'string' ? fv.slice(0, 2000) : fv;
        }
        if (Object.keys(fields).length) action.fields = fields;
        const mk = String(row?.moduleKey || '').trim().toLowerCase();
        if (mk) action.moduleKey = mk;
        if (kind === 'update_record') {
          const rid = String(row?.recordId || '').trim();
          if (rid) action.recordId = rid;
        }
        // Default: execute mutation actions unless explicitly false
        if (row?.executeNow === undefined) action.executeNow = true;
      }

      const emailRaw = row?.email && typeof row.email === 'object' ? row.email : null;
      if (emailRaw && (kind === 'send_email' || emailRaw.subject || emailRaw.body)) {
        let to = String(emailRaw.to || '').trim().slice(0, 200);
        if (!isUsableEmail(to)) to = '';
        const subject = String(emailRaw.subject || '').trim().slice(0, 200);
        const body = String(emailRaw.body || '').trim().slice(0, 4000);
        if (subject || body) {
          action.email = { to, subject, body };
          if (kind !== 'send_email') action.kind = 'send_email';
        }
      }

      if (kind === 'talk_to_agent' || action.kind === 'talk_to_agent') {
        actions.push({ ...action, kind: 'talk_to_agent' });
        continue;
      }

      const moduleKey = String(row?.moduleKey || '').trim().toLowerCase();
      const recordId = String(row?.recordId || '').trim();
      if (moduleKey && recordId && allowed.has(`${moduleKey}:${recordId}`)) {
        action.moduleKey = moduleKey;
        action.recordId = recordId;
        const cite = allowed.get(`${moduleKey}:${recordId}`);
        if (cite?.excerpt) action.targetLabel = String(cite.excerpt).slice(0, 80);
      }

      actions.push(action);
    }
  }

  const bodyFromStructured = [
    headline,
    ...bullets.map((b) => `• ${b}`),
    clarifyingQuestions.length
      ? `Questions:\n${clarifyingQuestions.map((q) => `? ${q}`).join('\n')}`
      : '',
    detail,
    ...actions.map((a) => `→ ${a.label}`),
  ].filter(Boolean).join('\n\n');

  return {
    headline,
    bullets,
    clarifyingQuestions,
    detail: detail || undefined,
    actions,
    visuals: Array.isArray(raw?.visuals)
      ? raw.visuals
        .filter((v) => v && typeof v === 'object' && Array.isArray(v.points) && v.points.length)
        .slice(0, 4)
        .map((v) => ({
          id: String(v.id || `viz_${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
          component: 'chart',
          chartType: ['pie', 'bar', 'line'].includes(String(v.chartType || ''))
            ? String(v.chartType)
            : 'pie',
          title: String(v.title || '').trim().slice(0, 120),
          metricLabel: String(v.metricLabel || 'value').slice(0, 40),
          points: v.points.slice(0, 40).map((p) => ({
            label: String(p?.label || '').trim().slice(0, 80),
            value: Number(p?.value) || 0,
          })).filter((p) => p.label),
        }))
        .filter((v) => v.points.length)
      : undefined,
    talkToAgent: Boolean(raw?.talkToAgent) || actions.some((a) => a.kind === 'talk_to_agent'),
    body: bodyFromStructured,
  };
}

/**
 * Legacy flatten helper (unit tests + offline shape).
 * Prefer buildWorkGraphContextPack for runtime Ask/Research.
 */
function flattenRecordContext(context, primaryDoc = null) {
  const citations = [];
  const lines = [];
  if (!context && !primaryDoc) return { text: '', citations };

  const moduleKey = context?.moduleKey
    || context?.record?.moduleKey
    || '';
  const recordId = context?.recordId
    || context?.record?.recordId
    || primaryDoc?._id
    || '';

  lines.push(`Record: ${moduleKey} ${recordId}`.trim());
  if (primaryDoc) {
    const name = primaryDoc.name
      || primaryDoc.title
      || [primaryDoc.first_name, primaryDoc.last_name].filter(Boolean).join(' ').trim()
      || primaryDoc.email
      || String(primaryDoc._id);
    lines.push(`Primary: ${name}`);
    citations.push({
      index: 1,
      sourceType: moduleKey || 'record',
      sourceId: String(primaryDoc._id),
      excerpt: String(name).slice(0, 200),
    });
  } else if (context?.primary?.name || context?.primary?.title) {
    lines.push(`Primary: ${context.primary.name || context.primary.title}`);
  }

  let index = citations.length + 1;
  const groups = Array.isArray(context?.relatedGroups)
    ? context.relatedGroups
    : Array.isArray(context?.relationships)
      ? context.relationships.map((rel) => ({
        moduleKey: rel.target?.moduleKey || rel.relationshipKey || rel.label,
        key: rel.relationshipKey || rel.label,
        records: rel.records || [],
      }))
      : [];

  for (const group of groups.slice(0, 12)) {
    const records = Array.isArray(group.records) ? group.records : [];
    for (const row of records.slice(0, 8)) {
      const label = row.label || row.name || row.title || row.caseId || row._id || 'record';
      citations.push({
        index,
        sourceType: group.moduleKey || group.key || 'related',
        sourceId: String(row._id || row.id || row.recordId || ''),
        excerpt: String(label).slice(0, 200),
      });
      lines.push(`[${index}] (${group.moduleKey || group.key}) ${label}`);
      index += 1;
    }
  }

  return { text: redactText(lines.join('\n').slice(0, 6000)), citations };
}

async function askWorkGraph({
  organizationId,
  userId,
  appKey = 'SALES',
  moduleKey,
  recordId,
  question,
}) {
  const startedAt = Date.now();
  const normalizedQuestion = String(question || '').trim();
  if (!normalizedQuestion) {
    throw new AiConfigurationError('question is required', 'AI_QUESTION_REQUIRED');
  }
  if (!moduleKey || !recordId) {
    throw new AiConfigurationError('moduleKey and recordId are required', 'AI_RECORD_REQUIRED');
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'work_graph_ask',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const pack = await buildWorkGraphContextPack({
      organizationId,
      appKey,
      moduleKey,
      recordId,
    });
    const { text, citations, found: packFound, updatedAt } = pack;

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'work_graph_ask' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    const systemPrompt = getPrompt('work_graph_ask_system');
    const cacheKey = buildCacheKey({
      moduleKey,
      recordId,
      question: normalizedQuestion,
      model: config.model,
      promptVersion: systemPrompt.version,
    });
    const scopeKey = buildScopeKey({
      moduleKey,
      recordId,
      model: config.model,
      promptVersion: systemPrompt.version,
    });
    const embedConfig = {
      embeddingProvider: config.embeddingProvider,
      embeddingApiKey: config.embeddingApiKey,
      apiKey: config.apiKey,
    };
    const cacheHit = await lookupResponseCache({
      organizationId,
      abilityKey: 'work_graph_ask',
      cacheKey,
      scopeKey,
      question: normalizedQuestion,
      recordUpdatedAt: updatedAt,
      embedConfig,
    });
    if (cacheHit.payload) {
      await writeAiAuditLog({
        ...auditBase,
        status: 'success',
        promptVersion: systemPrompt.version,
        contextRefs: [
          { sourceType: moduleKey, sourceId: String(recordId), appKey, moduleKey },
        ],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        creditsDebited: 0,
        latencyMs: Date.now() - startedAt,
        metadata: {
          cached: true,
          cacheHit: cacheHit.hit,
          similarity: cacheHit.similarity ?? null,
        },
      });
      return {
        ...cacheHit.payload,
        creditsDebited: 0,
        cached: true,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const actionable = formatActionableRecords(citations);
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: [
            `Question: ${normalizedQuestion}`,
            '',
            'Return JSON only for a scannable next-best-action card.',
            'bullets = current facts. actions = work to perform (verb phrases), NOT "Open record".',
            'Actionable records (optional targets for actions — use these moduleKey+recordId only):',
            actionable || '(none)',
            '',
            'CRM context:',
            text || '(empty)',
          ].join('\n'),
        },
      ], { preserveEmails: true }),
      temperature: 0.2,
      maxTokens: 800,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    const rawText = String(completion.text || '').trim();
    const parsed = parseJsonObject(rawText);
    const structured = parsed
      ? normalizeStructuredAnswer(parsed, citations)
      : {
        headline: '',
        bullets: [],
        actions: [],
        talkToAgent: false,
        body: rawText,
      };

    structured.actions = await enrichEmailActionsFromCrm(
      organizationId,
      structured.actions,
      citations,
    );
    structured.body = [
      structured.headline,
      ...(structured.bullets || []).map((b) => `• ${b}`),
      ...(structured.actions || []).map((a) => `→ ${a.label}`),
    ].filter(Boolean).join('\n') || structured.body;

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [
        { sourceType: moduleKey, sourceId: String(recordId), appKey, moduleKey },
        ...citations.slice(0, 40).map((c) => ({
          sourceType: c.sourceType,
          sourceId: c.sourceId,
          appKey,
          moduleKey: c.sourceType,
        })),
      ],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    const answer = structured.body || rawText;
    const result = {
      answer,
      structured: {
        headline: structured.headline,
        bullets: structured.bullets,
        actions: structured.actions,
        talkToAgent: structured.talkToAgent,
      },
      found: Boolean(packFound && answer),
      citations,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };

    await writeResponseCache({
      organizationId,
      abilityKey: 'work_graph_ask',
      cacheKey,
      scopeKey,
      moduleKey,
      recordId,
      recordUpdatedAt: updatedAt,
      question: normalizedQuestion,
      payload: { ...result, creditsDebited: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      embedConfig,
    });

    return result;
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_WORK_GRAPH_ASK_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function researchRecord({
  organizationId,
  userId,
  appKey = 'SALES',
  moduleKey,
  recordId,
}) {
  const startedAt = Date.now();
  if (!moduleKey || !recordId) {
    throw new AiConfigurationError('moduleKey and recordId are required', 'AI_RECORD_REQUIRED');
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'record_research',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const pack = await buildWorkGraphContextPack({
      organizationId,
      appKey,
      moduleKey,
      recordId,
    });
    const { text, citations, found: packFound, updatedAt } = pack;

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'record_research' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    const systemPrompt = getPrompt('record_research_system');
    const cacheKey = buildCacheKey({
      moduleKey,
      recordId,
      question: 'record_research',
      model: config.model,
      promptVersion: systemPrompt.version,
    });
    const cachedPayload = await readResponseCache({
      organizationId,
      abilityKey: 'record_research',
      cacheKey,
      recordUpdatedAt: updatedAt,
    });
    if (cachedPayload) {
      await writeAiAuditLog({
        ...auditBase,
        status: 'success',
        promptVersion: systemPrompt.version,
        contextRefs: [
          { sourceType: moduleKey, sourceId: String(recordId), appKey, moduleKey },
        ],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        creditsDebited: 0,
        latencyMs: Date.now() - startedAt,
        metadata: { cached: true },
      });
      return {
        ...cachedPayload,
        creditsDebited: 0,
        cached: true,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Research this ${moduleKey} record and produce a brief with citations.\n\n${text || '(empty)'}`,
        },
      ], { preserveEmails: true }),
      temperature: 0.2,
      maxTokens: 1000,
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
      promptVersion: systemPrompt.version,
      contextRefs: [
        { sourceType: moduleKey, sourceId: String(recordId), appKey, moduleKey },
        ...citations.slice(0, 40).map((c) => ({
          sourceType: c.sourceType,
          sourceId: c.sourceId,
          appKey,
          moduleKey: c.sourceType,
        })),
      ],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    const result = {
      answer: String(completion.text || '').trim(),
      found: Boolean(packFound),
      citations,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };

    await writeResponseCache({
      organizationId,
      abilityKey: 'record_research',
      cacheKey,
      moduleKey,
      recordId,
      recordUpdatedAt: updatedAt,
      question: 'record_research',
      payload: { ...result, creditsDebited: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    });

    return result;
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_RECORD_RESEARCH_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  askWorkGraph,
  researchRecord,
  flattenRecordContext,
  formatActionableRecords,
  normalizeStructuredAnswer,
  isUsableEmail,
  enrichEmailActionsFromCrm,
};
