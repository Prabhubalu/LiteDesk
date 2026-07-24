'use strict';

/**
 * Master Agent — propose/create tenant agents from CapIndex + plain English.
 */

const crypto = require('crypto');
const AstraTenantAgent = require('../../../models/AstraTenantAgent');
const { buildCapIndex, findCapability } = require('../tools/capIndex');
const modelRouter = require('../models/modelRouter');

const MATCH_THRESHOLD = 0.62;
const AUTO_CREATE_CONFIDENCE = 0.80;
const DUPLICATE_SIMILARITY = 0.88;
const MAX_RUNTIME_CREATES_PER_DAY = 2;

function slugifyKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `agent-${crypto.randomBytes(3).toString('hex')}`;
}

function serializePromptTemplate({ role, goal, tools, constraints, successCriteria, outputFormat }) {
  return [
    `Role: ${role || 'Specialist assistant'}`,
    `Goal: ${goal || ''}`,
    `Tools: ${(tools || []).join(', ')}`,
    `Constraints: ${constraints || 'Never invent CRM or knowledge facts. Cite sources. Confirm writes. Answer exactly what the user asked — list when they ask for a list, summary when they ask to summarize.'}`,
    `Success: ${successCriteria || 'User ask is answered directly with grounded tool results; answer shape matches the ask.'}`,
    `Output: ${outputFormat || 'Match the user ask first (list / count / brief / next steps). Premium coworker prose only when it helps that ask. Cite knowledge when used.'}`,
    'AnswerFidelity: Always satisfy the latest user message first. Do not substitute a canned pipeline essay, coaching pitch, or unrelated playbook when the user asked for something else.',
  ].join('\n');
}

function parsePromptTemplate(systemHint = '') {
  const text = String(systemHint || '');
  const get = (label) => {
    const re = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    role: get('Role'),
    goal: get('Goal'),
    tools: get('Tools').split(',').map((s) => s.trim()).filter(Boolean),
    constraints: get('Constraints'),
    successCriteria: get('Success'),
    outputFormat: get('Output'),
  };
}

function jaccard(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function phraseOverlap(a, b) {
  const ta = new Set(String(a || '').toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  const tb = new Set(String(b || '').toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  return jaccard([...ta], [...tb]);
}

function scoreAgentMatch(agent, query) {
  const q = String(query || '').toLowerCase();
  const hay = `${agent.title || ''} ${agent.description || ''} ${(agent.triggerPhrases || []).join(' ')} ${agent.systemHint || ''}`.toLowerCase();
  const phraseScore = phraseOverlap(q, hay);
  const toolBonus = (agent.toolAllowlist || []).length ? 0.05 : 0;
  return Math.min(1, phraseScore + toolBonus);
}

function pickToolsFromCapIndex(capIndex, hintText = '') {
  const lower = String(hintText || '').toLowerCase();
  const bindable = (capIndex.bindable || []).filter((c) => c.status === 'ready' || c.status === 'read_only');
  const picked = [];
  const push = (c) => {
    if (!c || picked.find((p) => p.id === c.id)) return;
    picked.push(c);
  };

  // Always allow module.search + knowledge when commercial terms appear
  for (const c of bindable) {
    const id = String(c.id || c.capabilityName || '');
    if (/invoice|payment|refund|quote|order|fulfill/.test(lower) && /invoices|payments|refunds|quotes|sales_orders/.test(id)) {
      push(c);
    }
    if (/case|ticket|support|helpdesk/.test(lower) && /cases|knowledge/.test(id)) push(c);
    if (/deal|pipeline|sales/.test(lower) && /deals|people|organizations/.test(id)) push(c);
    if (/article|faq|knowledge|doc|website|policy/.test(lower) && /knowledge/.test(id)) push(c);
    if (/email|outreach|reply/.test(lower) && /email\./.test(id)) push(c);
  }

  // Fallback core tools
  if (!picked.length) {
    for (const name of ['module.search', 'module.get', 'search.crm', 'knowledge.search', 'crm.record.get']) {
      const c = findCapability(capIndex, name) || bindable.find((b) => b.capabilityName === name || b.id === name);
      push(c);
    }
  }

  return picked.slice(0, 12);
}

function recipesFromCapabilities(caps) {
  return caps.map((c) => {
    if (c.bind) return c.bind;
    if (c.kind === 'module') {
      return { kind: 'module', op: c.op, moduleKey: c.moduleKey };
    }
    return {
      kind: 'action',
      capabilityName: c.capabilityName || c.id,
      audience: c.audience || undefined,
    };
  });
}

function toolNamesFromRecipes(recipes) {
  const names = [];
  for (const r of recipes || []) {
    if (r.kind === 'module') {
      names.push(`module.${r.op}`);
    } else if (r.kind === 'action' && r.capabilityName) {
      names.push(r.capabilityName);
    } else if (r.kind === 'webhook') {
      names.push('webhook.invoke');
    }
  }
  return [...new Set(names)];
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function compactCapMenu(capIndex, limit = 100) {
  const bindable = (capIndex.bindable || [])
    .filter((c) => c.status === 'ready' || c.status === 'read_only')
    .slice(0, limit);
  return bindable.map((c) => {
    const id = c.id || c.capabilityName;
    const op = c.op || (String(c.capabilityName || id || '').includes('.')
      ? String(c.capabilityName || id).split('.').pop()
      : undefined);
    const whenToUse = c.whenToUse
      || c.summary
      || c.description
      || (c.kind === 'module'
        ? `${op || 'use'} ${c.moduleKey || 'module'} records via fabric`
        : `Run ${c.capabilityName || id}`);
    return {
      id,
      kind: c.kind,
      title: c.title || id,
      risk: c.risk || 'read',
      moduleKey: c.moduleKey || undefined,
      op: op || undefined,
      capabilityName: c.capabilityName || undefined,
      audience: c.audience || undefined,
      whenToUse: String(whenToUse).slice(0, 160),
    };
  });
}

function resolveCapsFromIds(capIndex, ids = []) {
  const bindable = capIndex.bindable || [];
  const byId = new Map(bindable.map((c) => [c.id, c]));
  const byName = new Map(
    bindable
      .filter((c) => c.capabilityName)
      .map((c) => [c.capabilityName, c]),
  );
  const picked = [];
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id) continue;
    const cap = byId.get(id) || byName.get(id) || findCapability(capIndex, id);
    if (cap && (cap.status === 'ready' || cap.status === 'read_only')) {
      if (!picked.find((p) => p.id === cap.id)) picked.push(cap);
    }
  }
  return picked.slice(0, 14);
}

function heuristicProposal(capIndex, text) {
  const caps = pickToolsFromCapIndex(capIndex, text);
  const recipes = recipesFromCapabilities(caps);
  const tools = toolNamesFromRecipes(recipes);
  const titleGuess = text.length > 60 ? `${text.slice(0, 57)}…` : text;
  const role = /support|case|ticket/i.test(text)
    ? 'Support specialist'
    : /sales|deal|lead|pipeline/i.test(text)
      ? 'Sales specialist'
      : /customer|faq|bot|public/i.test(text)
        ? 'Customer FAQ assistant'
        : 'Specialist assistant';

  const template = {
    role,
    goal: text,
    tools,
    constraints: 'Never invent facts. Cite knowledge sources. Confirm all writes. Answer exactly what the user asked (list vs summary vs count). Public audience never sees internal docs.',
    successCriteria: 'User ask answered directly with grounded tool/knowledge results; shape matches the ask.',
    outputFormat: 'Match ask first: list→bullets, summarize→brief coaching, count→number. Cite knowledge when used.',
  };

  return {
    action: 'create',
    confidence: Math.min(0.9, 0.5 + caps.length * 0.03),
    candidateKey: slugifyKey(role === 'Support specialist' ? 'case-assist' : titleGuess),
    title: titleGuess,
    description: text.slice(0, 500),
    template,
    toolRecipes: recipes,
    tools,
    triggerPhrases: [],
    systemHint: serializePromptTemplate(template),
    autonomy: /send|write|update|create|assign|resolve/i.test(text) ? 'confirm' : 'assist',
    reason: 'Heuristic CapIndex proposal (LLM unavailable or invalid response).',
    authoredBy: 'heuristic',
  };
}

/**
 * LLM authors title/role/goal/tools/constraints from CapIndex menu.
 * Tools are validated against CapIndex — inventing tools is rejected.
 */
async function authorAgentWithLlm({ organizationId, instruction, capIndex }) {
  if (!organizationId) return null;
  const menu = compactCapMenu(capIndex);
  if (!menu.length) return null;

  const system = [
    'You design Astra specialist agents for a CRM workspace (Arivu).',
    'Return ONLY valid JSON (no markdown) with keys:',
    'title (max 6 words), description (1-2 sentences), role, goal, constraints, successCriteria, outputFormat,',
    'autonomy ("assist"|"confirm"), triggerPhrases (string[5-10] — real user phrasings), toolIds (string[] from menu ids only),',
    'confidence (0-1).',
    'Rules:',
    '- toolIds: pick 3–10 ids strictly from capabilityMenu[].id. Never invent tools.',
    '- Read capabilityMenu[].whenToUse / risk / moduleKey before choosing.',
    '- Prefer fabric reads: module.search + module.get for CRM list/get jobs; add domain actions only when needed.',
    '- Prefer read tools; include write/send tools only when the job requires mutation; then autonomy="confirm".',
    '- goal must state the user outcomes this agent serves.',
    '- outputFormat MUST tell the runtime how to answer: e.g. "If user asks for a list → bullet inventory; if summarize → short coaching; if count → number first."',
    '- constraints MUST include: never invent CRM/knowledge facts; cite knowledge; confirm writes; answer exactly what the user asked (do not force a fixed essay).',
    '- triggerPhrases: include list-style AND summary-style phrasings the agent should catch.',
    '- title should name the job (e.g. "Pipeline Summary Agent"), not "Master".',
  ].join('\n');

  const user = JSON.stringify({
    job: instruction,
    capabilityMenu: menu,
    designGoals: [
      'Users must never feel the agent ignored their ask.',
      'Tools must be sufficient to ground answers in live CRM/knowledge data.',
      'Specialist should beat generic Astra when the user ask matches triggerPhrases.',
    ],
  });

  const result = await modelRouter.complete(organizationId, 'astra_agent_author', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.25,
    maxTokens: 1200,
    auditMetadata: { source: 'master_propose' },
  });

  const parsed = extractJsonObject(result?.text || '');
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const toolIds = Array.isArray(parsed.toolIds)
    ? parsed.toolIds
    : (Array.isArray(parsed.tools) ? parsed.tools : []);
  let caps = resolveCapsFromIds(capIndex, toolIds);
  if (!caps.length) {
    caps = pickToolsFromCapIndex(capIndex, instruction);
  }
  // Ensure CRM/pipeline jobs always get fabric search (orchestrator prefers module.search)
  const needsCrm = /deal|pipeline|sales|crm|case|ticket|invoice|payment|people|contact|organiz/i.test(instruction);
  if (needsCrm) {
    for (const id of ['module.search', 'module.get', 'search.crm', 'crm.record.get', 'deals.search', 'cases.search']) {
      const extra = findCapability(capIndex, id)
        || (capIndex.bindable || []).find((c) => c.id === id || c.capabilityName === id);
      if (extra && !caps.find((c) => c.id === extra.id)) caps.push(extra);
    }
  }
  const recipes = recipesFromCapabilities(caps);
  let tools = toolNamesFromRecipes(recipes);
  if (needsCrm) {
    for (const name of ['module.search', 'module.get']) {
      if (!tools.includes(name)) tools.push(name);
    }
  }
  tools = [...new Set(tools)];
  if (!tools.length) return null;

  const title = String(parsed.title || '').trim().slice(0, 80)
    || String(instruction).slice(0, 57);
  const description = String(parsed.description || instruction).trim().slice(0, 500);
  const role = String(parsed.role || 'Specialist assistant').trim().slice(0, 120);
  const goal = String(parsed.goal || instruction).trim().slice(0, 800);
  const constraints = String(parsed.constraints || '').trim().slice(0, 800)
    || 'Never invent facts. Cite knowledge sources. Confirm all writes. Answer exactly what the user asked (list vs summary vs count).';
  const successCriteria = String(parsed.successCriteria || '').trim().slice(0, 500)
    || 'User ask answered directly with grounded tool/knowledge results; shape matches the ask.';
  const outputFormat = String(parsed.outputFormat || '').trim().slice(0, 500)
    || 'Match ask first: list→bullets, summarize→brief coaching, count→number. Cite knowledge when used.';
  const autonomy = String(parsed.autonomy || '').toLowerCase() === 'assist' ? 'assist' : 'confirm';
  const triggerPhrases = (Array.isArray(parsed.triggerPhrases) ? parsed.triggerPhrases : [])
    .map((p) => String(p || '').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 12);

  const template = {
    role,
    goal,
    tools,
    constraints,
    successCriteria,
    outputFormat,
  };

  const llmConfidence = Number(parsed.confidence);
  const confidence = Number.isFinite(llmConfidence)
    ? Math.min(0.98, Math.max(0.55, llmConfidence))
    : Math.min(0.95, 0.7 + tools.length * 0.02);

  return {
    action: 'create',
    confidence,
    candidateKey: slugifyKey(title),
    title,
    description,
    template,
    toolRecipes: recipes,
    tools,
    triggerPhrases,
    systemHint: serializePromptTemplate(template),
    autonomy: tools.some((t) => /\.(create|update|send|assign|resolve|fulfill|record|void)/.test(t))
      ? (autonomy === 'assist' ? 'confirm' : autonomy)
      : autonomy,
    reason: 'LLM-authored specialist from CapIndex capabilities.',
    authoredBy: 'llm',
    creditsDebited: result?.creditsDebited || null,
  };
}

async function proposeAgent({ organizationId, instruction, knowledgeSources = null } = {}) {
  const text = String(instruction || '').trim();
  if (!text) {
    const err = new Error('instruction is required');
    err.statusCode = 400;
    err.code = 'MASTER_INSTRUCTION_REQUIRED';
    throw err;
  }

  const capIndex = await buildCapIndex(organizationId, { knowledgeSources });
  const existing = await AstraTenantAgent.find({
    organizationId,
    enabled: true,
  }).lean();

  let best = null;
  let bestScore = 0;
  for (const ag of existing) {
    const score = scoreAgentMatch(ag, text);
    if (score > bestScore) {
      bestScore = score;
      best = ag;
    }
  }

  if (best && bestScore >= DUPLICATE_SIMILARITY) {
    return {
      action: 'merge',
      confidence: bestScore,
      existingKey: best.key,
      title: best.title,
      reason: 'Near-duplicate of an existing agent — update that agent instead of creating another.',
      capIndexSummary: capIndex.summary,
      authoredBy: 'heuristic',
    };
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    return {
      action: 'reuse',
      confidence: bestScore,
      existingKey: best.key,
      title: best.title,
      reason: 'An existing agent already covers this job.',
      capIndexSummary: capIndex.summary,
      authoredBy: 'heuristic',
    };
  }

  let proposal = null;
  try {
    proposal = await authorAgentWithLlm({
      organizationId,
      instruction: text,
      capIndex,
    });
  } catch (err) {
    console.warn('[masterAgentService] LLM author failed:', err?.message || err);
  }

  if (!proposal) {
    proposal = heuristicProposal(capIndex, text);
  }

  return {
    ...proposal,
    capIndexSummary: capIndex.summary,
    thresholds: {
      match: MATCH_THRESHOLD,
      autoCreate: AUTO_CREATE_CONFIDENCE,
      duplicate: DUPLICATE_SIMILARITY,
    },
  };
}

async function createAgentFromProposal({
  organizationId,
  userId,
  proposal,
  key: keyOverride = null,
} = {}) {
  if (!organizationId || !proposal) {
    const err = new Error('organizationId and proposal are required');
    err.statusCode = 400;
    throw err;
  }
  if (proposal.action === 'merge' || proposal.action === 'reuse') {
    return {
      reused: true,
      key: proposal.existingKey,
      action: proposal.action,
    };
  }

  const key = slugifyKey(keyOverride || proposal.candidateKey || proposal.title);
  const existing = await AstraTenantAgent.findOne({ organizationId, key }).lean();
  if (existing) {
    const err = new Error(`Agent key already exists: ${key}`);
    err.statusCode = 409;
    err.code = 'ASTRA_AGENT_EXISTS';
    throw err;
  }

  const tools = Array.isArray(proposal.tools) ? proposal.tools : toolNamesFromRecipes(proposal.toolRecipes);
  const doc = await AstraTenantAgent.create({
    organizationId,
    key,
    defaultKey: null,
    title: proposal.title || key,
    description: proposal.description || '',
    systemHint: proposal.systemHint || serializePromptTemplate(proposal.template || {}),
    autonomy: proposal.autonomy === 'confirm' ? 'confirm' : 'assist',
    toolAllowlist: tools,
    toolRecipes: proposal.toolRecipes || [],
    triggerPhrases: proposal.triggerPhrases || [],
    enabled: true,
    isCustomized: true,
    catalogVersion: 2,
    source: 'master',
    basePrompt: proposal.systemHint || '',
    basePromptVersion: 1,
    learnedProfile: {},
    createdBy: userId || null,
    updatedBy: userId || null,
  });

  try {
    const { upsertAgentEmbedding, findSimilarAgents } = require('./agentVectorMemory');
    const similars = await findSimilarAgents(organizationId, `${doc.title}\n${doc.description}`, { minScore: 0.88 });
    if (similars.length && similars[0].key !== doc.key) {
      // Near-duplicate detected after create — leave both but surface in response
      await upsertAgentEmbedding(organizationId, doc);
      return {
        created: true,
        key: doc.key,
        nearDuplicateOf: similars[0].key,
        agent: {
          key: doc.key,
          title: doc.title,
          tools: doc.toolAllowlist,
          systemHint: doc.systemHint,
        },
      };
    }
    await upsertAgentEmbedding(organizationId, doc);
  } catch {
    /* soft */
  }

  return {
    created: true,
    key: doc.key,
    agent: {
      key: doc.key,
      title: doc.title,
      tools: doc.toolAllowlist,
      systemHint: doc.systemHint,
    },
  };
}

async function countRuntimeCreatesToday(organizationId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return AstraTenantAgent.countDocuments({
    organizationId,
    source: 'runtime',
    createdAt: { $gte: start },
  });
}

async function proposeRuntimeAgent({ organizationId, query, mode = 'manual' } = {}) {
  const proposal = await proposeAgent({ organizationId, instruction: query });
  if (proposal.action !== 'create') return proposal;

  const creates = await countRuntimeCreatesToday(organizationId);
  if (creates >= MAX_RUNTIME_CREATES_PER_DAY) {
    return {
      ...proposal,
      action: 'ephemeral',
      reason: 'Daily runtime create quota reached — answer with ephemeral Astra.',
    };
  }

  if (mode === 'assisted' && proposal.confidence >= AUTO_CREATE_CONFIDENCE) {
    return { ...proposal, action: 'auto_create' };
  }
  return { ...proposal, action: 'suggest_create' };
}

module.exports = {
  MATCH_THRESHOLD,
  AUTO_CREATE_CONFIDENCE,
  DUPLICATE_SIMILARITY,
  MAX_RUNTIME_CREATES_PER_DAY,
  serializePromptTemplate,
  parsePromptTemplate,
  scoreAgentMatch,
  proposeAgent,
  createAgentFromProposal,
  proposeRuntimeAgent,
  slugifyKey,
  toolNamesFromRecipes,
  authorAgentWithLlm,
  heuristicProposal,
};
