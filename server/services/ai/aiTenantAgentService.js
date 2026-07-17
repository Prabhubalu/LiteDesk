'use strict';

/**
 * Tenant Agentic AI — CRUD + intent routing + propose-only ask.
 * Arivu Assistant picks a specialist agent from the user question + page context.
 */

const crypto = require('crypto');
const AiTenantAgent = require('../../models/AiTenantAgent');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages } = require('./piiRedaction');
const { AiConfigurationError } = require('./errors');
const { buildWorkGraphContextPack } = require('./aiWorkGraphContextService');
const {
  normalizeStructuredAnswer,
  enrichEmailActionsFromCrm,
  formatActionableRecords,
} = require('./aiWorkGraphService');
const { parseJsonObject } = require('./aiMarketingService');
const {
  buildCacheKey,
  buildScopeKey,
  lookupResponseCache,
  writeResponseCache,
} = require('./aiResponseCacheService');

function shortHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

function isThinStructuredAnswer(structured, agentName) {
  const bullets = structured?.bullets || [];
  const actions = structured?.actions || [];
  if (bullets.length > 0 || actions.length > 0) {
    return false;
  }
  const headline = String(structured?.headline || '').trim().toLowerCase();
  const name = String(agentName || '').trim().toLowerCase();
  const body = String(structured?.body || '').trim();
  const bodyLower = body.toLowerCase();
  // Title-only cards that just echo the agent name are not usable answers.
  if (headline && name && headline === name) return true;
  if (!body) return true;
  if (bodyLower === name) return true;
  // Unparsed / truncated JSON dumped into body — treat as thin so we don't show raw JSON.
  if (/^\s*[\{\[]/.test(body) && !bullets.length && !actions.length) return true;
  if (bodyLower === headline && body.length < 48) return true;
  return body.length < 24;
}

function isUsableAgentPayload(payload, agentName) {
  if (!payload || typeof payload !== 'object') return false;
  const structured = payload.structured && typeof payload.structured === 'object'
    ? payload.structured
    : {
      headline: '',
      bullets: [],
      actions: [],
      body: String(payload.answer || ''),
    };
  const withBody = {
    ...structured,
    body: structured.body || String(payload.answer || ''),
  };
  return !isThinStructuredAnswer(withBody, agentName || payload.agent?.name || '');
}

function proseBulletsFromRaw(rawText, jsonFragment = '') {
  let prose = String(rawText || '').trim();
  if (jsonFragment) prose = prose.replace(jsonFragment, '').trim();
  prose = prose.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const lines = prose
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length) return lines.slice(0, 4);
  if (prose.length > 24) return [prose.slice(0, 500)];
  return [];
}

function rebuildStructuredBody(structured) {
  structured.body = [
    structured.headline,
    ...(structured.bullets || []).map((b) => `• ${b}`),
    ...(structured.actions || []).map((a) => `→ ${a.label}`),
  ].filter(Boolean).join('\n') || structured.body;
  return structured;
}

function buildContextFallbackStructured(agentName, contextText, citations = []) {
  const facts = String(contextText || '')
    .split('\n')
    .map((line) => line.replace(/^[#=\-\s]+/, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 180)
    .filter((line) => !/^CRM page context/i.test(line))
    .filter((line) => !/^===/.test(line))
    .slice(0, 4);

  const primary = citations?.[0]?.excerpt
    ? String(citations[0].excerpt).trim().slice(0, 80)
    : '';

  const structured = {
    headline: primary
      ? `${agentName}: ${primary}`
      : `${agentName}: current record snapshot`,
    bullets: facts.length
      ? facts
      : ['Not enough structured facts were returned by the model. Review the record fields on this page.'],
    actions: [],
    talkToAgent: false,
    body: '',
  };
  rebuildStructuredBody(structured);
  return structured;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now',
  'old', 'see', 'way', 'who', 'did', 'let', 'say', 'she', 'too', 'use', 'what', 'when',
  'where', 'which', 'with', 'this', 'that', 'from', 'have', 'will', 'your', 'about',
  'into', 'more', 'some', 'them', 'than', 'then', 'agent', 'please', 'help', 'me',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function normalizePhrases(phrases) {
  if (!Array.isArray(phrases)) return [];
  return phrases
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((p) => p.slice(0, 80));
}

function normalizeModuleKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return [...new Set(
    keys
      .map((k) => String(k || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12),
  )];
}

function sanitizeAgentInput(body = {}) {
  const name = String(body.name || '').trim().slice(0, 80);
  const description = String(body.description || '').trim().slice(0, 400);
  const systemPrompt = String(body.systemPrompt || '').trim().slice(0, 6000);
  const triggerPhrases = normalizePhrases(body.triggerPhrases);
  const moduleKeys = normalizeModuleKeys(body.moduleKeys);
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  if (!name) throw new AiConfigurationError('name is required', 'AI_AGENT_NAME_REQUIRED');
  if (!systemPrompt) throw new AiConfigurationError('systemPrompt is required', 'AI_AGENT_PROMPT_REQUIRED');

  return {
    name,
    description,
    systemPrompt,
    triggerPhrases,
    moduleKeys,
    enabled,
  };
}

function toPublicAgent(doc) {
  if (!doc) return null;
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(row._id),
    name: row.name,
    description: row.description || '',
    systemPrompt: row.systemPrompt,
    triggerPhrases: Array.isArray(row.triggerPhrases) ? row.triggerPhrases : [],
    moduleKeys: Array.isArray(row.moduleKeys) ? row.moduleKeys : [],
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listTenantAgents(organizationId, { includeDisabled = true } = {}) {
  const query = { organizationId };
  if (!includeDisabled) query.enabled = true;
  const rows = await AiTenantAgent.find(query).sort({ updatedAt: -1 }).lean();
  return rows.map(toPublicAgent);
}

async function createTenantAgent({ organizationId, userId, body }) {
  const input = sanitizeAgentInput(body);
  try {
    const doc = await AiTenantAgent.create({
      organizationId,
      ...input,
      createdBy: userId || null,
      updatedBy: userId || null,
    });
    return toPublicAgent(doc);
  } catch (err) {
    if (err?.code === 11000) {
      throw new AiConfigurationError('An agent with this name already exists', 'AI_AGENT_NAME_EXISTS');
    }
    throw err;
  }
}

async function updateTenantAgent({ organizationId, userId, agentId, body }) {
  const existing = await AiTenantAgent.findOne({ _id: agentId, organizationId });
  if (!existing) {
    throw new AiConfigurationError('Agent not found', 'AI_AGENT_NOT_FOUND');
  }
  const input = sanitizeAgentInput({
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    systemPrompt: body.systemPrompt ?? existing.systemPrompt,
    triggerPhrases: body.triggerPhrases ?? existing.triggerPhrases,
    moduleKeys: body.moduleKeys ?? existing.moduleKeys,
    enabled: body.enabled ?? existing.enabled,
  });
  Object.assign(existing, input, { updatedBy: userId || null });
  try {
    await existing.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new AiConfigurationError('An agent with this name already exists', 'AI_AGENT_NAME_EXISTS');
    }
    throw err;
  }
  return toPublicAgent(existing);
}

async function deleteTenantAgent({ organizationId, agentId }) {
  const result = await AiTenantAgent.deleteOne({ _id: agentId, organizationId });
  if (!result.deletedCount) {
    throw new AiConfigurationError('Agent not found', 'AI_AGENT_NOT_FOUND');
  }
  return { deleted: true };
}

/**
 * Score agents for a user question. Higher is better.
 */
function scoreAgentForQuestion(agent, question, pageModuleKey = '') {
  const q = String(question || '').toLowerCase().trim();
  const qTokens = new Set(tokenize(q));
  let score = 0;

  const agentName = String(agent.name || '').trim().toLowerCase();
  if (agentName) {
    if (q === agentName) score += 40;
    else if (q.includes(agentName) || agentName.includes(q)) score += 24;
  }

  const moduleKeys = Array.isArray(agent.moduleKeys) ? agent.moduleKeys : [];
  if (pageModuleKey && moduleKeys.includes(String(pageModuleKey).toLowerCase())) {
    score += 8;
  }

  for (const phrase of agent.triggerPhrases || []) {
    const p = String(phrase || '').trim().toLowerCase();
    if (!p) continue;
    if (q.includes(p) || p.includes(q)) {
      score += Math.min(18, 6 + p.length);
      continue;
    }
    // Unordered token overlap: "deal analyze" matches "analyze deal"
    const phraseTokens = tokenize(p);
    if (!phraseTokens.length) continue;
    const hit = phraseTokens.filter((token) => qTokens.has(token)).length;
    if (hit === phraseTokens.length) score += 14;
    else if (hit > 0 && hit / phraseTokens.length >= 0.6) score += 8;
  }

  const nameTokens = tokenize(agent.name);
  const descTokens = tokenize(agent.description);
  for (const token of [...nameTokens, ...descTokens]) {
    if (qTokens.has(token)) score += 2;
  }

  // Prefer more specific agents when phrases exist.
  if ((agent.triggerPhrases || []).length) score += 1;

  return score;
}

async function routeTenantAgent({
  organizationId,
  question,
  moduleKey = '',
  minScore = 8,
}) {
  const agents = await listTenantAgents(organizationId, { includeDisabled: false });
  if (!agents.length) return null;

  let best = null;
  let bestScore = 0;
  for (const agent of agents) {
    const score = scoreAgentForQuestion(agent, question, moduleKey);
    if (score > bestScore) {
      best = agent;
      bestScore = score;
    }
  }

  if (!best || bestScore < minScore) return null;
  return { agent: best, score: bestScore };
}

async function runTenantAgentAsk({
  organizationId,
  userId,
  agentId,
  question,
  appKey = 'SALES',
  moduleKey = '',
  recordId = '',
}) {
  const startedAt = Date.now();
  const normalizedQuestion = String(question || '').trim();
  if (!normalizedQuestion) {
    throw new AiConfigurationError('question is required', 'AI_QUESTION_REQUIRED');
  }

  const agent = await AiTenantAgent.findOne({
    _id: agentId,
    organizationId,
    enabled: true,
  }).lean();
  if (!agent) {
    throw new AiConfigurationError('Agent not found or disabled', 'AI_AGENT_NOT_FOUND');
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'tenant_agent',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    let contextText = '';
    let citations = [];
    let recordUpdatedAt = null;
    if (moduleKey && recordId) {
      const pack = await buildWorkGraphContextPack({
        organizationId,
        appKey,
        moduleKey,
        recordId,
      });
      contextText = pack.text || '';
      citations = pack.citations || [];
      recordUpdatedAt = pack.updatedAt || null;
    }

    const config = await resolveAiRequestConfig({
      organizationId,
      abilityKey: 'tenant_agent',
    });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    const agentPromptVersion = [
      'tenant_agent_v3',
      String(agent.updatedAt || agent._id || ''),
      shortHash(String(agent.systemPrompt || '')),
    ].join(':');
    const cacheKey = buildCacheKey({
      moduleKey,
      recordId,
      question: normalizedQuestion,
      model: config.model,
      promptVersion: agentPromptVersion,
      agentId: String(agent._id),
    });
    const scopeKey = buildScopeKey({
      moduleKey,
      recordId,
      model: config.model,
      promptVersion: agentPromptVersion,
      agentId: String(agent._id),
    });
    const embedConfig = {
      embeddingProvider: config.embeddingProvider,
      embeddingApiKey: config.embeddingApiKey,
      apiKey: config.apiKey,
    };
    const cacheHit = await lookupResponseCache({
      organizationId,
      abilityKey: 'tenant_agent',
      cacheKey,
      scopeKey,
      question: normalizedQuestion,
      recordUpdatedAt,
      embedConfig,
    });
    if (cacheHit.payload && isUsableAgentPayload(cacheHit.payload, agent.name)) {
      await writeAiAuditLog({
        ...auditBase,
        status: 'success',
        promptVersion: 'tenant_agent_v3',
        contextRefs: [
          { sourceType: 'tenant_agent', sourceId: String(agent._id), appKey, moduleKey },
        ],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        creditsDebited: 0,
        latencyMs: Date.now() - startedAt,
        metadata: {
          agentId: String(agent._id),
          agentName: agent.name,
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

    async function completeAgentMessages(userExtra = '') {
      return adapter.complete({
        apiKey: config.apiKey,
        model: config.model,
        messages: redactMessages([
          {
            role: 'system',
            content: [
              String(agent.systemPrompt || '').trim(),
              '',
              'Always respond with JSON only:',
              '{"headline":"string","bullets":["string"],"actions":[{"label":"string","kind":"send_email|complete_task|follow_up|review_record|update_status|talk_to_agent|manual","moduleKey":"string","recordId":"string","priority":"high|medium|low","rationale":"string","email":{"to":"string","subject":"string","body":"string"}}],"talkToAgent":false}',
              'headline must be a short insight about the record — NEVER repeat the agent name alone.',
              'You MUST include at least 2 and at most 4 bullets with concrete facts from the CRM context when context is present.',
              'Include at most 3 actions. Keep rationale under 20 words. Keep email body under 80 words.',
              'Propose-only. Never claim you updated CRM records or sent messages. Never invent IDs, emails, amounts, or statuses.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Agent: ${agent.name}`,
              `Question: ${normalizedQuestion}`,
              'If the question is only the agent name or a short intent, still run your full specialist analysis on the CRM context.',
              userExtra,
              '',
              'Actionable records (optional targets — use these IDs only):',
              actionable || '(none)',
              '',
              'CRM context:',
              contextText || '(no record context on this page)',
            ].filter(Boolean).join('\n'),
          },
        ], { preserveEmails: true }),
        temperature: 0.2,
        maxTokens: 1400,
        providerOptions: config.providerOptions,
      });
    }

    function parseAgentCompletion(completionText) {
      const rawText = String(completionText || '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
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

      if (isThinStructuredAnswer(structured, agent.name)) {
        const bullets = proseBulletsFromRaw(rawText, jsonMatch?.[0] || '');
        if (bullets.length) {
          structured.bullets = bullets;
          if (!structured.headline || structured.headline.toLowerCase() === String(agent.name).toLowerCase()) {
            structured.headline = bullets[0].slice(0, 120);
          }
          rebuildStructuredBody(structured);
        }
      }
      return { rawText, structured };
    }

    let completion = await completeAgentMessages();
    const usage = completion.usage || {};
    let { rawText, structured } = parseAgentCompletion(completion.text);

    // No second LLM call — if the model returns title-only, build bullets from CRM context.
    if (isThinStructuredAnswer(structured, agent.name)) {
      structured = buildContextFallbackStructured(agent.name, contextText, citations);
      rawText = structured.body;
    }

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage,
    });

    structured.actions = await enrichEmailActionsFromCrm(
      organizationId,
      structured.actions,
      citations,
    );
    rebuildStructuredBody(structured);

    const usable = !isThinStructuredAnswer(structured, agent.name);

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: 'tenant_agent_v3',
      contextRefs: [
        { sourceType: 'tenant_agent', sourceId: String(agent._id), appKey, moduleKey },
        ...citations.slice(0, 30).map((c) => ({
          sourceType: c.sourceType,
          sourceId: c.sourceId,
          appKey,
          moduleKey: c.sourceType,
        })),
      ],
      usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
      metadata: {
        agentId: String(agent._id),
        agentName: agent.name,
        cached: false,
        thin: !usable,
      },
    });

    const result = {
      answer: structured.body || rawText,
      structured: {
        headline: structured.headline,
        bullets: structured.bullets,
        actions: structured.actions,
        talkToAgent: structured.talkToAgent,
      },
      agent: {
        _id: String(agent._id),
        name: agent.name,
      },
      found: usable,
      citations,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage,
    };

    if (usable) {
      await writeResponseCache({
        organizationId,
        abilityKey: 'tenant_agent',
        cacheKey,
        scopeKey,
        moduleKey,
        recordId,
        agentId: String(agent._id),
        recordUpdatedAt,
        question: normalizedQuestion,
        payload: {
          ...result,
          creditsDebited: 0,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
        provider: config.provider,
        model: config.model,
        keyMode: config.keyMode,
        embedConfig,
      });
    }

    return result;
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_TENANT_AGENT_FAILED',
      errorMessage: error.message,
      metadata: {
        agentId: String(agent._id),
        agentName: agent.name,
      },
    });
    throw error;
  }
}

/**
 * Suggest routing trigger phrases from agent name / description / system prompt.
 * Uses the org LLM (same Arivu AI spine) — propose-only, no CRM writes.
 */
async function suggestTenantAgentTriggers({
  organizationId,
  userId,
  name = '',
  description = '',
  systemPrompt = '',
  moduleKeys = [],
}) {
  const startedAt = Date.now();
  const agentName = String(name || '').trim().slice(0, 80);
  const agentDescription = String(description || '').trim().slice(0, 400);
  const agentPrompt = String(systemPrompt || '').trim().slice(0, 6000);
  const modules = normalizeModuleKeys(moduleKeys);

  if (!agentName && !agentPrompt) {
    throw new AiConfigurationError(
      'name or systemPrompt is required to suggest triggers',
      'AI_AGENT_TRIGGER_INPUT_REQUIRED',
    );
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'tenant_agent_triggers',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({
      organizationId,
      abilityKey: 'tenant_agent_triggers',
    });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        {
          role: 'system',
          content: [
            'You help configure Arivu Assistant specialist agents.',
            'Given an agent name, description, system prompt, and optional module affinity,',
            'propose short natural-language trigger phrases that a staff user might type',
            'when they want this specialist agent to handle the question.',
            'Return JSON only: {"triggerPhrases":["..."]}',
            'Rules:',
            '- 4 to 8 phrases',
            '- Each phrase 2–6 words',
            '- Lowercase preferred',
            '- No duplicates',
            '- No CRM field inventing',
            '- Prefer actionable intent phrases (e.g. "analyze deal", "win probability")',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Name: ${agentName || '(none)'}`,
            `Description: ${agentDescription || '(none)'}`,
            `Modules: ${modules.length ? modules.join(', ') : '(any)'}`,
            'System prompt:',
            agentPrompt || '(none)',
          ].join('\n'),
        },
      ]),
      temperature: 0.3,
      maxTokens: 250,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    const parsed = parseJsonObject(String(completion.text || ''));
    const triggerPhrases = normalizePhrases(
      Array.isArray(parsed?.triggerPhrases) ? parsed.triggerPhrases : [],
    );

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: 'tenant_agent_triggers_v1',
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
      metadata: {
        phraseCount: triggerPhrases.length,
        agentName: agentName || null,
      },
    });

    return {
      triggerPhrases,
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
      errorCode: error.code || 'AI_TENANT_AGENT_TRIGGERS_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  listTenantAgents,
  createTenantAgent,
  updateTenantAgent,
  deleteTenantAgent,
  routeTenantAgent,
  runTenantAgentAsk,
  suggestTenantAgentTriggers,
  scoreAgentForQuestion,
  toPublicAgent,
};
