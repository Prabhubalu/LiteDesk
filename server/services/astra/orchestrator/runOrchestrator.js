'use strict';

/**
 * runOrchestrator — Astra v2 turn pipeline (workforce Phase A).
 *
 *   classify → seat → tool(s) → grounded answer → LLM polish → suggestions
 *
 * Unknown intent → clarifier (never invent open deals).
 */

const crypto = require('crypto');
const toolRegistry = require('../tools/toolRegistry');
const agentRegistry = require('../agents/agentRegistry');
const modelRouter = require('../models/modelRouter');
const { buildAnswerMessages, PROMPT_VERSION } = require('../prompts/promptLibrary');
const { runWorkflowAgent } = require('../agents/workflowAgent');
const { recordTurn } = require('../governance/audit');
const { ensureBootstrapped } = require('../bootstrap');
const sessionMemory = require('../memory/sessionMemory');
const { buildUiBlocks } = require('../experience/buildUiBlocks');
const { wantsRecordBrief, buildRecordStatusBrief } = require('../experience/buildRecordStatusBrief');
const { synthesizePipelineNarrative } = require('../experience/coworkerSynthesis');
const {
  classifyIntent,
  classifyIntentDetailed,
  resolveAgentKey,
  extractTaskTitle,
  extractEventTitle,
  extractEventSchedule,
  extractCaseTitle,
} = require('./intentRegistry');
const {
  classifyIntentPrecise,
  INTENT_TOOL_ROUTE,
  scheduleFromLlmSlots,
  resolveEventTitle,
} = require('./intentLlmClassify');
const { resolveEventCreateSlots, isGarbageTitle } = require('./extractEventSlots');
const {
  refersToSameFocus,
  resolveTurnFocus,
} = require('../context/resolveTurnFocus');

const { buildEmailDraftTurn } = require('../experience/buildEmailDraftTurn');
const { runThinPlaybook } = require('./runThinPlaybook');
const { extractSearchTerm } = require('../tools/families');
const { buildProposalDetails } = require('../utils/findModuleCreateIssues');

function buildChitchatAnswer(query) {
  const q = String(query || '').toLowerCase();
  if (/\b(date|day)\b/.test(q)) {
    const now = new Date();
    const formatted = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `Today is ${formatted}.`;
  }
  if (/\btime\b/.test(q)) {
    return `It's ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
  }
  return "Hey — I'm Astra. Ask me about deals, tasks, events, cases, or people and I'll pull what's in Arivu.";
}

function buildClarifyTurn(query) {
  const answer = "I'm not sure what you need yet — pick one of these and I'll take it from there.";
  const suggestions = [
    'List my open deals',
    'Show overdue tasks',
    'Draft an email',
    'Create a task',
    'Book a meeting',
  ];
  return {
    answer,
    blocks: [{
      type: 'clarify',
      prompt: answer,
      query: String(query || ''),
      options: suggestions,
    }],
    suggestions,
  };
}

function confirmationToProposal(confirmation, kind, extras = {}) {
  if (!confirmation || confirmation.type !== 'confirm_action') return null;
  const payload = extras.payload || confirmation.payload || {};
  const moduleKey = confirmation.moduleKey
    || (kind === 'calendar.createEvent' ? 'events'
      : kind === 'crm.tasks.create' ? 'tasks'
        : kind === 'crm.deals.create' ? 'deals'
          : kind === 'crm.cases.create' ? 'cases'
            : kind === 'crm.people.create' ? 'people'
              : kind === 'crm.organizations.create' ? 'organizations'
                : null);
  const details = Array.isArray(extras.details) && extras.details.length
    ? extras.details
    : (Array.isArray(confirmation.details) && confirmation.details.length
      ? confirmation.details
      : buildProposalDetails(moduleKey, payload));
  return {
    id: crypto.randomUUID(),
    kind: kind || confirmation.toolName,
    label: extras.label || confirmation.summary,
    rationale: extras.rationale || confirmation.guidance || undefined,
    details,
    status: 'pending',
    summary: confirmation.summary,
    risk: confirmation.risk,
    toolName: confirmation.toolName,
    moduleKey: moduleKey || undefined,
    payload,
    fields: payload,
    confirmation,
  };
}

/** Shared UX for create proposals that may warn on duplicates/conflicts. */
function proposalsFromCreateToolResult(toolResult, toolName, title) {
  const warning = Boolean(toolResult?.createWarning || toolResult?.scheduleWarning);
  const proposal = confirmationToProposal(
    toolResult,
    toolName,
    warning
      ? {
        label: toolResult.summary || `Override and create "${title}" anyway`,
        rationale: toolResult.guidance
          || 'Creates a new record even though a similar or conflicting one already exists.',
        payload: { ...(toolResult?.payload || {}), override: true },
        details: toolResult.details,
      }
      : {
        details: toolResult.details,
      },
  );
  const conflictHits = [
    ...(toolResult?.conflicts || []),
    ...(toolResult?.duplicates || []),
  ].filter((h, i, arr) => h?.id && arr.findIndex((x) => x.id === h.id) === i);
  return { proposal, warning, conflictHits };
}

/** Serialize a tool result to a compact, fact-only block for the prompt. */
function serializeToolResult(intent, toolResult) {
  if (!toolResult) return '(none)';
  if (intent === 'crm_search' || intent === 'knowledge') {
    const hits = toolResult.hits || [];
    const lines = hits.slice(0, 15).map((h) => {
      const bits = [h.title];
      if (h.subtitle) bits.push(h.subtitle);
      if (h.amount != null && h.amount !== '') bits.push(`$${h.amount}`);
      if (h.status) bits.push(h.status);
      return `• ${bits.join(' — ')}`;
    });
    const entity = toolResult.entity || 'records';
    const count = toolResult.counts?.total ?? hits.length;
    const scope = toolResult.overdueOnly
      ? 'overdue'
      : toolResult.openOnly
        ? 'open'
        : 'matching';
    const header = toolResult.brief
      ? `Status brief for ${entity} (${count} focus record)`
      : `${count} ${scope} ${entity} (facts for narration — do not dump as a numbered inventory)`;

    const related = toolResult.related;
    const relatedLines = [];
    if (related) {
      const rec = related.record || {};
      if (rec.derivedStatus || rec.customerStatus || rec.status) {
        relatedLines.push(`Status: ${rec.derivedStatus || rec.customerStatus || rec.status}`);
      }
      if (rec.industry) relatedLines.push(`Industry: ${rec.industry}`);
      relatedLines.push(
        `Open deals: ${related.openDeals?.total ?? 0} (pipeline $${related.openDeals?.amount ?? 0})`,
      );
      relatedLines.push(`Open cases: ${related.openCases?.total ?? 0}`);
      relatedLines.push(
        `Open tasks: ${related.openTasks?.total ?? 0} (${related.openTasks?.overdue ?? 0} overdue)`,
      );
      relatedLines.push(`Linked people: ${related.people?.total ?? 0}`);
      for (const d of (related.openDeals?.items || []).slice(0, 5)) {
        relatedLines.push(`Deal: ${d.title}${d.amount != null ? ` · $${d.amount}` : ''}${d.subtitle ? ` · ${d.subtitle}` : ''}`);
      }
      for (const c of (related.openCases?.items || []).slice(0, 3)) {
        relatedLines.push(`Case: ${c.title}${c.subtitle ? ` · ${c.subtitle}` : ''}`);
      }
      for (const t of (related.openTasks?.items || []).slice(0, 3)) {
        relatedLines.push(`Task: ${t.title}${t.subtitle ? ` · ${t.subtitle}` : ''}`);
      }
    }

    return [header, ...lines, ...relatedLines].join('\n');
  }
  return JSON.stringify(toolResult).slice(0, 12000);
}

function formatHitLine(hit) {
  const bits = [hit.title];
  if (hit.subtitle) bits.push(hit.subtitle);
  if (hit.amount != null && hit.amount !== '') bits.push(`$${hit.amount}`);
  return `• ${bits.join(' · ')}`;
}

/** Human fallback when LLM polish is unavailable — never a DB dump. */
function buildContextualLead(intent, query, toolResult, baseLead) {
  const hits = toolResult?.hits || [];
  const total = toolResult?.counts?.total ?? hits.length;
  const entity = toolResult?.entity || 'records';
  const openOnly = Boolean(toolResult?.openOnly);
  const overdueOnly = Boolean(toolResult?.overdueOnly);
  if (!hits.length) return baseLead || "I couldn't find a match for that yet.";

  const qualifier = overdueOnly ? 'overdue ' : (openOnly ? 'open ' : '');
  const names = hits.slice(0, 3).map((h) => h.title).filter(Boolean);
  const wantsCount = /\b(how many|count|number of)\b/i.test(String(query || ''));

  if (wantsCount) {
    return `You have ${total} ${qualifier}${entity}.${names[0] ? ` Top of the list: ${names[0]}.` : ''} Want me to dig into any of them?`;
  }
  if (total === 1 && names[0]) {
    const sub = hits[0]?.subtitle ? ` — ${hits[0].subtitle}` : '';
    return `${names[0]}${sub}. I can dig into status, draft a follow-up, or pull related records next.`;
  }
  if (names.length) {
    const more = total > names.length ? ` (+${total - names.length} more)` : '';
    return `Here are your ${total} ${qualifier}${entity} worth attention: ${names.join(', ')}${more}. Say which one to open, update, or follow up on.`;
  }
  return baseLead || `Here's what I found across your ${entity}.`;
}

function looksLikeDbDump(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^(found \d+|here are \d+|showing \d+|results?:|entity=|total=|openOnly=)/im.test(t)) return true;
  if (/\bentity=\w+|openOnly=true|count=\d+/i.test(t)) return true;
  const numbered = t.match(/^\s*\d+\.\s+/gm) || [];
  if (numbered.length >= 4) return true;
  return false;
}

/** Deterministic lead text + claims. Visual facts go in UI blocks, not Markdown. */
function buildGroundedAnswer(intent, query, toolResult) {
  const { lead, blocks } = buildUiBlocks(intent, toolResult);

  if (intent === 'crm_search' || intent === 'knowledge') {
    const hits = toolResult?.hits || [];
    const total = toolResult?.counts?.total ?? hits.length;
    const entity = toolResult?.entity || (intent === 'knowledge' ? 'articles' : 'records');
    const claims = hits.length
      ? [{ type: 'count', entity, value: total }]
        .concat(hits.slice(0, 5).map((h) => ({ type: 'record', id: h.id, title: h.title })))
      : [];

    const contextual = buildContextualLead(intent, query, toolResult, lead);
    const draftFacts = hits.length
      ? [
        contextual,
        '',
        'Key facts for narration (do NOT reprint as a numbered database dump — UI cards show the list):',
        ...hits.slice(0, 5).map((h) => formatHitLine(h)),
        '',
        'Write a sensible contextual answer for the user.',
      ].join('\n')
      : contextual;

    return { draft: draftFacts, lead: contextual, blocks, claims };
  }

  return { draft: lead, lead, blocks, claims: [] };
}

/** Deterministic follow-up chips. */
function buildSuggestions(intent, query, toolResult) {
  const entity = toolResult?.entity || 'deals';
  const hits = toolResult?.hits || [];
  const first = hits[0];
  const suggestions = [];

  if (intent === 'crm_search') {
    if (entity === 'deals') {
      if (toolResult?.openOnly) {
        suggestions.push('Which of these need attention this week?');
        suggestions.push('Show won deals instead');
      } else {
        suggestions.push('Show only open deals');
      }
      if (first?.title) {
        suggestions.push(`Tell me more about ${first.title}`);
        suggestions.push(`Draft a follow-up for ${first.title}`);
      } else {
        suggestions.push('List my open deals');
      }
      suggestions.push('How many open deals do I have?');
    } else if (entity === 'cases') {
      suggestions.push('Show high-priority open cases');
      if (first?.title) suggestions.push(`Summarize ${first.title}`);
      suggestions.push('List open deals');
    } else if (entity === 'people') {
      suggestions.push('Show open deals for this contact');
      if (first?.title) suggestions.push(`What do we know about ${first.title}?`);
      suggestions.push('List open cases');
    } else if (entity === 'tasks') {
      suggestions.push('Show overdue tasks');
      suggestions.push('What tasks are due today?');
      if (first?.title) suggestions.push(`Open ${first.title}`);
      suggestions.push('List my open deals');
    } else if (entity === 'events') {
      suggestions.push('What events do I have today?');
      suggestions.push('Show upcoming meetings');
      if (first?.title) suggestions.push(`Open ${first.title}`);
      suggestions.push('List overdue tasks');
    }
  } else if (intent === 'knowledge') {
    suggestions.push('Show me related CRM records');
    suggestions.push('List my open deals');
  } else if (intent === 'clarify') {
    suggestions.push('List my open deals', 'Show overdue tasks', 'Draft an email', 'Create a task');
  } else {
    suggestions.push('List my open deals');
    suggestions.push('Show overdue tasks');
    suggestions.push('What events do I have today?');
  }

  const seen = new Set();
  return suggestions.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function mentionsAnyClaim(text, claims) {
  const lower = String(text || '').toLowerCase();
  return claims.some((c) => {
    if (c.type === 'count') return lower.includes(String(c.value));
    if (c.type === 'record' && c.title) return lower.includes(String(c.title).toLowerCase());
    return false;
  });
}

/**
 * LLM-first premium polish. Never truncates the model reply.
 * Falls back to lead only when empty or fact-breaking.
 */
async function polishCoworkerAnswer({
  llm,
  request,
  query,
  draft,
  lead,
  toolResults = '(none)',
  history = [],
  claims = [],
  brief = false,
  write = false,
  toolResult = null,
  intent = null,
}) {
  const safeLead = (!write && toolResult && (intent === 'crm_search' || intent === 'knowledge'))
    ? buildContextualLead(intent, query, toolResult, lead)
    : lead;

  try {
    const messages = buildAnswerMessages({
      query,
      groundedDraft: draft || safeLead,
      toolResults,
      history,
      brief,
      write,
    });
    const completion = await llm(messages, {
      ...request,
      temperature: write ? 0.35 : (brief ? 0.5 : 0.4),
      maxTokens: 1800,
    });
    const polished = String(completion?.text || '').replace(/\*\*/g, '').trim();
    if (!polished || looksLikeDbDump(polished)) {
      return { answer: safeLead, polishedUsed: false, usage: completion?.usage || {} };
    }
    const hitsExist = (claims || []).length > 0;
    const keepsFacts = !hitsExist || mentionsAnyClaim(polished, claims);
    if (!keepsFacts) {
      return { answer: safeLead, polishedUsed: false, usage: completion?.usage || {} };
    }
    return {
      answer: polished,
      polishedUsed: true,
      usage: completion.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  } catch (error) {
    return { answer: safeLead, polishedUsed: false, usage: {}, error };
  }
}

function resolveLlm(deps) {
  if (typeof deps.llm === 'function') return deps.llm;
  // Offline / unit tests: never call live providers when llmIntent is disabled.
  if (deps.llmIntent === false) {
    return async () => ({ text: '', usage: {} });
  }
  return async (messages, request) => modelRouter.complete(
    request.organizationId,
    'astra_v2_ask',
    {
      messages,
      temperature: Number.isFinite(request.temperature) ? request.temperature : 0.45,
      maxTokens: request.maxTokens || 1800,
      modelOverride: request.modelOverride,
    },
  );
}

function resolveConversationId(request) {
  const existing = String(request.conversationId || '').trim();
  if (existing) return existing;
  return crypto.randomUUID();
}

function agentAllowsTool(agent, toolName) {
  if (!agent || !Array.isArray(agent.tools) || agent.tools.length === 0) return true;
  return agent.tools.includes(toolName);
}

function updateFocusFromToolResult(memory, organizationId, conversationId, toolResult) {
  if (!organizationId || !toolResult?.hits?.length) return;
  const hit = toolResult.hits[0];
  const entity = toolResult.entity;
  if (!hit?.id || !entity) return;
  if (toolResult.brief || toolResult.searchTerm || toolResult.hits.length === 1) {
    memory.setFocus(organizationId, conversationId, {
      kind: entity,
      id: hit.id,
      name: hit.title,
      moduleKey: entity,
    });
  }
}

/**
 * @param {Object} request
 * @param {Object} [deps]
 */
async function runOrchestrator(request = {}, deps = {}) {
  ensureBootstrapped();
  const registry = deps.toolRegistry || toolRegistry;
  const agents = deps.agentRegistry || agentRegistry;
  const memory = deps.sessionMemory || sessionMemory;
  const started = Number.isFinite(deps.now) ? deps.now : Date.now();

  const query = String(request.query || '').trim();
  const llm = resolveLlm(deps);
  const conversationId = resolveConversationId(request);
  const priorHistory = Array.isArray(request.history) && request.history.length
    ? request.history
    : (request.organizationId ? memory.history(request.organizationId, conversationId) : []);
  const focus = (request.organizationId
    ? memory.getFocus(request.organizationId, conversationId)
    : null)
    || request.focus
    || null;

  // LLM for every query (history + focus for anaphora). Heuristic = fallback only.
  // Tests may set llmIntent:false to stay offline.
  const classification = await classifyIntentPrecise(query, request, {
    llm,
    llmIntent: deps.llmIntent,
    organizationId: request.organizationId,
    history: priorHistory,
    focus,
  });

  const intent = classification.intent;
  const agentKey = resolveAgentKey(classification, request, agents);
  const agent = agents.getAgent(agentKey);
  const expectedTool = classification.tool || INTENT_TOOL_ROUTE[intent] || null;

  const ctx = {
    organizationId: request.organizationId,
    userId: request.userId || null,
    surface: request.surface || 'chat',
    agentKey,
    focus,
    deps: {
      models: deps.models || {},
      vectorStore: deps.vectorStore || null,
    },
    toolRegistry: registry,
  };

  const baseMeta = {
    intent,
    agentKey,
    confidence: classification.confidence,
    conversationId,
    intentReason: classification.reason || null,
    intentSource: classification.intentSource || null,
    expectedTool,
  };

  async function finish(partial) {
    const answer = partial.answer || '';
    if (request.organizationId && query && !partial.skipMemory) {
      memory.append(request.organizationId, conversationId, { role: 'user', content: query });
      memory.append(request.organizationId, conversationId, { role: 'assistant', content: answer });
    }

    if (deps.audit !== false && request.organizationId) {
      await recordTurn({
        organizationId: request.organizationId,
        userId: request.userId,
        abilityKey: 'astra_v2_ask',
        status: 'success',
        model: partial.polishedUsed ? 'llm+grounded' : 'grounded',
        promptVersion: PROMPT_VERSION,
        usage: partial.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - started,
        metadata: {
          ...baseMeta,
          tool: partial.tool || null,
          claims: (partial.claims || []).length,
          polishedUsed: Boolean(partial.polishedUsed),
          reason: classification.reason,
        },
      });
    }

    return {
      intent,
      agentKey,
      confidence: classification.confidence,
      intentReason: classification.reason || null,
      intentSource: classification.intentSource || null,
      expectedTool,
      conversationId,
      focus: memory.getFocus?.(request.organizationId, conversationId) || focus,
      grounded: partial.grounded !== false,
      usage: partial.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      ...partial,
    };
  }

  if (intent === 'workflow') {
    const wf = await runWorkflowAgent({ workflow: request.workflow, steps: request.steps }, ctx);
    return finish({
      answer: wf.summary,
      blocks: [],
      suggestions: buildSuggestions(intent, query, null),
      workflow: wf,
      claims: [],
      tool: 'workflow.run',
    });
  }

  if (intent === 'playbook') {
    const playbookKey = classification.playbookKey || request.playbook || 'qualify-research-outreach';
    const pb = await runThinPlaybook({
      playbookKey,
      query,
      ctx: { ...ctx, conversationId },
      memory,
      conversationId,
      llm: resolveLlm(deps),
      history: priorHistory,
    });
    return finish({
      answer: pb.answer,
      blocks: pb.blocks || [],
      proposals: pb.proposals || [],
      actions: pb.proposals || [],
      suggestions: pb.suggestions || [],
      claims: pb.focus?.name ? [{ type: 'record', id: pb.focus.id || 'focus', title: pb.focus.name }] : [],
      tool: 'playbook.run',
      toolResult: { seats: pb.seats, scratchpad: pb.scratchpad, playbookKey: pb.playbookKey },
      seats: pb.seats,
      playbookKey: pb.playbookKey,
      agentKey: 'workflow',
    });
  }

  if (intent === 'clarify') {
    const turn = buildClarifyTurn(query);
    return finish({
      answer: turn.answer,
      blocks: turn.blocks,
      suggestions: turn.suggestions,
      claims: [],
      tool: null,
    });
  }

  if (intent === 'chitchat') {
    return finish({
      answer: buildChitchatAnswer(query),
      blocks: [],
      suggestions: buildSuggestions(intent, query, null),
      claims: [],
      tool: null,
    });
  }

  if (intent === 'case_create') {
    const toolName = 'crm.cases.create';
    const tool = registry.getTool(toolName);
    const title = classification.llmTitle || extractCaseTitle(query);
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const wantsOverride = /\b(override|create anyway|force it)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({ title, relatedTo, override: wantsOverride }, ctx)
      : null;
    const { proposal, warning, conflictHits } = proposalsFromCreateToolResult(toolResult, toolName, title);
    const lead = warning && toolResult?.guidance
      ? toolResult.guidance
      : `I can open a case titled "${title}". Confirm to create it.`;
    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'cases',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };
    const claims = [
      { type: 'record', id: 'draft-case', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishCoworkerAnswer({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({ title, duplicates: toolResult?.duplicates || [], warning }),
      history: priorHistory,
      claims,
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: warning
        ? ['Cancel — keep existing case', 'List open cases']
        : ['List open cases', 'Draft a reply'],
      claims,
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      createWarning: warning,
    });
  }

  if (intent === 'deal_update') {
    const toolName = 'crm.deals.update';
    const tool = registry.getTool(toolName);
    const dealId = focus?.kind === 'deals' ? focus.id : null;
    const wantsWon = /\bwon\b/i.test(query);
    const wantsLost = /\blost\b/i.test(query);
    const patch = {
      dealId,
      status: wantsWon ? 'Won' : wantsLost ? 'Lost' : undefined,
      stage: query.match(/\bstage\s+(?:to\s+)?([A-Za-z0-9 _-]{2,40})/i)?.[1]?.trim() || undefined,
    };
    const toolResult = tool ? await tool.run(patch, ctx) : null;
    const proposal = confirmationToProposal(toolResult, 'crm.deals.update');
    return finish({
      answer: dealId
        ? `I can update deal "${focus.name || dealId}". Confirm to apply the change.`
        : 'I can update a deal — set focus on a deal first (or name it), then confirm.',
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['List my open deals', 'Create a follow-up task'],
      claims: [],
      tool: toolName,
      toolResult,
    });
  }

  if (intent === 'quote_draft') {
    const toolName = 'quotes.draft';
    const tool = registry.getTool(toolName);
    const toolResult = tool
      ? await tool.run({
        dealId: focus?.kind === 'deals' ? focus.id : null,
        dealName: focus?.name || 'this deal',
      }, ctx)
      : null;
    const proposal = confirmationToProposal(toolResult, 'quotes.draft');
    return finish({
      answer: `I can draft a quote${focus?.name ? ` for ${focus.name}` : ''}. Confirm to continue.`,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['List my quotes', 'List open deals'],
      claims: [],
      tool: toolName,
      toolResult,
    });
  }

  if (intent === 'research') {
    const term = extractSearchTerm(query) || focus?.name;
    if (focus?.id) {
      const relTool = registry.getTool('relationships.context');
      const toolResult = relTool
        ? await relTool.run({ moduleKey: focus.moduleKey || focus.kind, recordId: focus.id }, ctx)
        : null;
      const related = toolResult?.related || [];
      const answer = related.length
        ? `Here's what I found around ${focus.name}: ${related.slice(0, 5).map((r) => r.title).join(', ')}.`
        : `I checked ${focus.name} — no linked records showed up yet.`;
      return finish({
        answer,
        blocks: [],
        suggestions: [`Draft an email about ${focus.name}`, 'Create a follow-up task'],
        claims: focus.name ? [{ type: 'record', id: focus.id, title: focus.name }] : [],
        tool: 'relationships.context',
        toolResult,
      });
    }
    if (term) {
      const searchTool = registry.getTool('search.crm');
      const toolResult = searchTool
        ? await searchTool.run({ query: `status of ${term}`, limit: 5 }, ctx)
        : null;
      return finish({
        answer: toolResult?.hits?.length
          ? `Research hit: ${toolResult.hits[0].title}. Ask me to dig into relationships next.`
          : `I couldn't find "${term}" to research yet.`,
        blocks: [],
        suggestions: ['Qualify this lead', 'List organizations'],
        claims: (toolResult?.hits || []).slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
        tool: 'search.crm',
        toolResult,
      });
    }
    return finish({
      answer: 'Who should I research? Name a company or person, or open a record first.',
      blocks: [],
      suggestions: ['List organizations', 'Show me people'],
      claims: [],
      tool: null,
    });
  }

  if (intent === 'meeting_prep') {
    const searchTool = registry.getTool('search.crm');
    const listBroad = /\b(today|these|all|upcoming|my meetings|my events)\b/i.test(query);
    const turnFocus = resolveTurnFocus({ focus, history: priorHistory, query });
    const focusedEvent = (focus?.kind === 'events' && (focus.name || focus.id))
      ? focus
      : (turnFocus?.kind === 'events' || refersToSameFocus(query) ? turnFocus : null);
    const useFocused = Boolean(
      focusedEvent?.name || focusedEvent?.id,
    ) && (refersToSameFocus(query) || (!listBroad && focusedEvent?.kind === 'events'));

    let toolResult = null;
    let hits = [];

    if (useFocused && focusedEvent) {
      if (focusedEvent.id && !String(focusedEvent.id).startsWith('pending:')) {
        hits = [{
          id: focusedEvent.id,
          title: focusedEvent.name || 'Meeting',
          subtitle: focusedEvent.startDateTime || '',
        }];
        if (searchTool && focusedEvent.name) {
          const found = await searchTool.run({
            query: focusedEvent.name,
            entity: 'events',
            limit: 5,
          }, ctx);
          const needle = String(focusedEvent.name).toLowerCase();
          const match = (found?.hits || []).find((h) => {
            const t = String(h.title || '').toLowerCase();
            return t === needle || t.includes(needle) || needle.includes(t);
          }) || (found?.hits || []).find((h) => String(h.id) === String(focusedEvent.id));
          if (match) hits = [match];
        }
      } else if (focusedEvent.name && searchTool) {
        const found = await searchTool.run({
          query: focusedEvent.name,
          entity: 'events',
          limit: 5,
        }, ctx);
        const needle = String(focusedEvent.name).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        hits = match
          ? [match]
          : [{ id: focusedEvent.id || 'focus-event', title: focusedEvent.name, subtitle: focusedEvent.startDateTime || '' }];
      } else if (focusedEvent.name) {
        hits = [{
          id: focusedEvent.id || 'focus-event',
          title: focusedEvent.name,
          subtitle: focusedEvent.startDateTime || '',
        }];
      }
      toolResult = {
        entity: 'events',
        hits,
        counts: { total: hits.length, returned: hits.length },
        focused: true,
      };
      if (request.organizationId && hits[0]) {
        memory.setFocus(request.organizationId, conversationId, {
          kind: 'events',
          moduleKey: 'events',
          id: hits[0].id,
          name: hits[0].title,
          startDateTime: focusedEvent.startDateTime,
        });
      }
    }

    if (!hits.length && searchTool) {
      toolResult = await searchTool.run({ query: 'list of events today', entity: 'events', limit: 10 }, ctx);
      if (!toolResult?.hits?.length) {
        toolResult = await searchTool.run({ query: 'list events', entity: 'events', limit: 10 }, ctx);
      }
      hits = toolResult?.hits || [];
    }

    const names = hits.slice(0, 4).map((h) => h.title).filter(Boolean);
    const todayLine = useFocused && names[0]
      ? `Let's prep for ${names[0]}.`
      : names.length
        ? `You've got ${hits.length} event${hits.length === 1 ? '' : 's'} to prep for${names.length ? ` — starting with ${names.slice(0, 2).join(' and ')}` : ''}.`
        : focus?.name
          ? `Let's prep for ${focus.name}.`
          : "I don't see upcoming events in Arivu yet — open one or ask me to list events.";

    const prepSteps = hits.length
      ? [
        todayLine,
        '',
        'Prep checklist:',
        useFocused
          ? '1. Confirm attendees, agenda, and goal for this meeting.'
          : '1. Open each event and confirm attendees + agenda.',
        '2. Skim related deals/org notes for talking points.',
        '3. Draft a short reminder or follow-up email if needed.',
        '4. Add a prep task if anything is still open.',
      ].join('\n')
      : todayLine;

    const { blocks } = hits.length
      ? buildUiBlocks('crm_search', {
        ...toolResult,
        hits,
        counts: { total: hits.length, returned: hits.length },
        entity: 'events',
      })
      : { blocks: [] };

    const suggestions = [];
    if (names[0]) suggestions.push(`Draft an email about ${names[0]}`);
    suggestions.push('Create a task to prep talking points');
    suggestions.push('What events do I have today?');
    if (focus?.name && focus.kind !== 'events') suggestions.push(`Research ${focus.name}`);

    const claims = hits.slice(0, 5).map((h) => ({ type: 'record', id: h.id, title: h.title }));
    const polish = await polishCoworkerAnswer({
      llm,
      request,
      query,
      draft: prepSteps,
      lead: prepSteps,
      toolResults: serializeToolResult('crm_search', toolResult),
      history: priorHistory,
      claims,
      brief: true,
      toolResult,
      intent: 'meeting_prep',
    });

    return finish({
      answer: polish.answer,
      blocks,
      proposals: [],
      suggestions: suggestions.slice(0, 4),
      claims,
      tool: 'search.crm',
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
    });
  }

  if (intent === 'task_create') {
    const toolName = 'crm.tasks.create';
    if (!agentAllowsTool(agent, toolName)) {
      return finish({
        answer: 'This seat cannot create tasks. Try asking from Astra coworker.',
        blocks: [],
        suggestions: ['Create a task to follow up'],
        claims: [],
        tool: toolName,
      });
    }
    const tool = registry.getTool(toolName);
    const title = resolveEventTitle(classification, extractTaskTitle(query));
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const wantsOverride = /\b(override|create anyway|force it)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({ title, relatedTo, override: wantsOverride }, ctx)
      : null;
    const { proposal, warning, conflictHits } = proposalsFromCreateToolResult(toolResult, toolName, title);
    const lead = warning && toolResult?.guidance
      ? toolResult.guidance
      : `I can create a task titled "${title}". Confirm to save it in Arivu.`;
    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'tasks',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };
    const claims = [
      { type: 'record', id: 'draft-task', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishCoworkerAnswer({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({
        title,
        relatedTo,
        duplicates: toolResult?.duplicates || [],
        warning,
      }),
      history: priorHistory,
      claims,
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: warning
        ? ['Cancel — keep existing task', 'List my open tasks']
        : ['List my open tasks', 'Show overdue tasks'],
      claims,
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      createWarning: warning,
    });
  }

  if (intent === 'calendar_create') {
    const toolName = 'calendar.createEvent';
    const tool = registry.getTool(toolName);

    const slots = await resolveEventCreateSlots({
      query,
      classification,
      llm: deps.llmIntent === false ? null : llm,
      organizationId: request.organizationId,
    });

    const title = isGarbageTitle(slots.title) ? 'Meeting' : slots.title;
    const schedule = scheduleFromLlmSlots({
      day: slots.day,
      time: slots.time,
      meridiem: slots.meridiem,
      durationMinutes: slots.durationMinutes,
    }) || extractEventSchedule(query);

    let relatedTo = focus?.id && focus?.kind === 'organizations'
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    let relatedContact = null;
    const searchTool = registry.getTool('search.crm');

    if (!relatedTo && slots.relatedName && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: slots.relatedName,
            entity: 'organizations',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('related_lookup_timeout')), 800);
          }),
        ]);
        const needle = String(slots.relatedName).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        if (match?.id) {
          relatedTo = {
            moduleKey: 'organizations',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    if (slots.contactName && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: slots.contactName,
            entity: 'people',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('contact_lookup_timeout')), 800);
          }),
        ]);
        const needle = String(slots.contactName).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        if (match?.id) {
          relatedContact = {
            moduleKey: 'people',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    // If user asked for related contact but didn't name one, pull a person linked via org search term
    if (!relatedContact && /\brelated\s+contact\b/i.test(query) && relatedTo?.name && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: relatedTo.name,
            entity: 'people',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('contact_lookup_timeout')), 800);
          }),
        ]);
        const match = (found?.hits || [])[0];
        if (match?.id) {
          relatedContact = {
            moduleKey: 'people',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    const description = slots.description
      || [
        slots.relatedName ? `Organization: ${slots.relatedName}` : null,
        relatedContact?.name ? `Contact: ${relatedContact.name}` : null,
      ].filter(Boolean).join('\n')
      || null;

    const wantsOverride = /\b(override|create anyway|schedule anyway|force it|book it anyway)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({
        title,
        description,
        relatedTo,
        relatedContact,
        startDateTime: schedule.startDateTime,
        endDateTime: schedule.endDateTime,
        durationMinutes: schedule.durationMinutes,
        override: wantsOverride,
      }, ctx)
      : null;

    const { proposal, warning: scheduleWarning, conflictHits } = proposalsFromCreateToolResult(
      toolResult,
      'calendar.createEvent',
      title,
    );

    if (request.organizationId && title) {
      memory.setFocus(request.organizationId, conversationId, {
        kind: 'events',
        moduleKey: 'events',
        id: `pending:${title}`,
        name: title,
        startDateTime: schedule.startDateTime || undefined,
        endDateTime: schedule.endDateTime || undefined,
      });
    }
    const when = schedule.startDateTime
      ? new Date(schedule.startDateTime).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      : 'the requested time';
    const relatedBit = relatedTo?.name ? ` with ${relatedTo.name}` : (slots.relatedName ? ` with ${slots.relatedName}` : '');
    const contactBit = relatedContact?.name
      ? ` Contact: ${relatedContact.name}.`
      : (slots.contactName ? ` Contact: ${slots.contactName}.` : '');
    const descBit = description ? ` Notes: ${description.split('\n')[0]}` : '';

    let lead;
    if (scheduleWarning && toolResult?.guidance) {
      lead = toolResult.guidance;
    } else {
      lead = `I can create "${title}"${relatedBit} for ${when} (${schedule.durationMinutes} min).${contactBit}${descBit} Confirm to save the event.`;
    }

    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'events',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };

    const claims = [
      { type: 'record', id: 'draft-event', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishCoworkerAnswer({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({
        title,
        description,
        when,
        durationMinutes: schedule.durationMinutes,
        relatedTo,
        relatedContact,
        startDateTime: schedule.startDateTime,
        slotSource: slots.source,
        conflicts: toolResult?.conflicts || [],
        duplicates: toolResult?.duplicates || [],
        scheduleWarning,
      }),
      history: priorHistory,
      claims,
      write: true,
    });

    const suggestions = scheduleWarning
      ? [
        'Cancel — keep my existing meeting',
        'What events do I have today?',
        conflictHits[0]?.title ? `Open ${conflictHits[0].title}` : 'Show upcoming meetings',
      ].filter(Boolean)
      : ['What events do I have today?', 'Create a follow-up task'];

    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: suggestions.slice(0, 4),
      claims,
      tool: toolName,
      toolResult,
      intentSource: classification.intentSource || null,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      scheduleWarning,
      createWarning: scheduleWarning,
      slotSource: slots.source,
    });
  }

  if (intent === 'activity_log') {
    const toolName = 'crm.activity.log';
    const tool = registry.getTool(toolName);
    const summary = query.replace(/^(please\s+)?/i, '').slice(0, 200);
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const toolResult = tool
      ? await tool.run({ summary, relatedTo, type: /\bcall\b/i.test(query) ? 'call' : 'note' }, ctx)
      : null;
    const proposal = confirmationToProposal(toolResult, 'crm.activity.log');
    return finish({
      answer: `Ready to log: "${summary}". Confirm to save the activity.`,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['Create a follow-up task', 'List my open deals'],
      claims: [],
      tool: toolName,
      toolResult,
    });
  }

  if (intent === 'email_draft') {
    const emailTurn = await buildEmailDraftTurn({
      query,
      history: priorHistory,
      llm,
      organizationId: request.organizationId,
      focus,
    });
    return finish({
      answer: emailTurn.answer,
      blocks: emailTurn.blocks,
      proposals: emailTurn.proposals,
      actions: emailTurn.proposals,
      suggestions: emailTurn.suggestions,
      claims: emailTurn.focus?.name
        ? [{ type: 'record', id: 'focus', title: emailTurn.focus.name }]
        : [],
      polishedUsed: true,
      tool: 'email.draft',
      toolResult: emailTurn.confirmation,
    });
  }

  const toolName = intent === 'knowledge' ? 'knowledge.search' : 'search.crm';
  if (!agentAllowsTool(agent, toolName)) {
    return finish({
      answer: `The ${agent?.title || agentKey} seat cannot run ${toolName}. Try a different ask or agent.`,
      blocks: [],
      suggestions: buildSuggestions('clarify', query, null),
      claims: [],
      tool: toolName,
    });
  }

  const tool = registry.getTool(toolName);
  let toolResult = null;
  if (tool) {
    toolResult = await tool.run(
      {
        query,
        entity: request.entity || classification.entityHint || null,
        limit: request.limit,
      },
      ctx,
    );
  }

  let briefMode = false;
  let coachMode = false;
  let draft;
  let lead;
  let blocks;
  let claims;
  let actionSuggestions = null;

  const hitCount = toolResult?.hits?.length || 0;
  const subjectHit = hitCount === 1
    ? toolResult.hits[0]
    : (toolResult?.searchTerm && hitCount > 0 ? toolResult.hits[0] : null);

  if (
    intent === 'crm_search'
    && wantsRecordBrief(query)
    && subjectHit
    && ['organizations', 'deals', 'people'].includes(toolResult.entity)
  ) {
    const brief = await buildRecordStatusBrief({
      entity: toolResult.entity,
      hit: subjectHit,
      organizationId: request.organizationId,
      deps: ctx.deps,
    });
    if (brief) {
      briefMode = true;
      draft = brief.draft;
      lead = brief.lead;
      blocks = brief.blocks;
      claims = brief.claims;
      actionSuggestions = brief.suggestions || null;
      toolResult = {
        ...toolResult,
        brief: true,
        related: brief.related,
        hits: [subjectHit],
        counts: { total: 1, returned: 1 },
      };
      updateFocusFromToolResult(memory, request.organizationId, conversationId, toolResult);
    }
  }

  if (
    !briefMode
    && intent === 'crm_search'
    && toolResult?.entity === 'deals'
    && Array.isArray(toolResult.hits)
    && toolResult.hits.length > 0
  ) {
    const coach = synthesizePipelineNarrative({
      hits: toolResult.hits,
      total: toolResult.counts?.total ?? toolResult.hits.length,
    });
    coachMode = true;
    draft = coach.draft;
    lead = coach.lead;
    actionSuggestions = coach.suggestions;
    const grounded = buildGroundedAnswer(intent, query, toolResult);
    blocks = grounded.blocks;
    claims = grounded.claims.concat(
      toolResult.hits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    );
    if (toolResult.hits.length === 1) {
      updateFocusFromToolResult(memory, request.organizationId, conversationId, toolResult);
    }
  }

  if (!briefMode && !coachMode) {
    ({ draft, lead, blocks, claims } = buildGroundedAnswer(intent, query, toolResult));
    if (intent === 'crm_search' && subjectHit) {
      updateFocusFromToolResult(memory, request.organizationId, conversationId, {
        ...toolResult,
        hits: [subjectHit],
      });
    }
  }

  let answer = lead;
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let polishedUsed = false;

  const polish = await polishCoworkerAnswer({
    llm,
    request,
    query,
    draft,
    lead,
    toolResults: serializeToolResult(intent, toolResult),
    history: priorHistory,
    claims,
    brief: briefMode || coachMode,
    toolResult,
    intent,
  });
  answer = polish.answer;
  polishedUsed = polish.polishedUsed;
  usage = polish.usage || usage;
  if (polish.error && deps.debug) {
    console.error('[astra.orchestrator] llm polish failed:', polish.error.message);
  }

  if (polishedUsed && looksLikeDbDump(answer) && lead) {
    answer = lead;
    polishedUsed = false;
  } else if (polishedUsed && /open deals:\s*0|total organizations|found \d+ (organization|deal)/i.test(answer) && lead) {
    answer = lead;
    polishedUsed = false;
  }

  const suggestions = Array.isArray(actionSuggestions) && actionSuggestions.length
    ? actionSuggestions.slice(0, 4)
    : buildSuggestions(intent, query, toolResult);

  return finish({
    answer,
    blocks,
    suggestions,
    toolResult,
    claims,
    grounded: !polishedUsed || claims.length > 0,
    polishedUsed,
    usage,
    tool: toolName,
  });
}

module.exports = {
  runOrchestrator,
  classifyIntent,
  classifyIntentDetailed,
  classifyIntentPrecise,
  buildGroundedAnswer,
  buildSuggestions,
  serializeToolResult,
  mentionsAnyClaim,
};
