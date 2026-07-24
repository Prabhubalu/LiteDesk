'use strict';

/**
 * LLM agent seat picker — ranks short agent cards for the ask + focus.
 * Lexical resolveAgentKey remains the offline / failure fallback.
 */

const { resolveAgentKey } = require('./intentRegistry');
const { formatFocus } = require('./intentLlmClassify');

const MIN_CONFIDENCE = 0.45;
const MAX_AGENTS_IN_PROMPT = 24;
const DESC_MAX = 140;

function buildAgentCards(agents) {
  const list = typeof agents?.listAgents === 'function' ? agents.listAgents() : [];
  return list
    .filter((a) => a?.name && a.name !== 'clarifier')
    .slice(0, MAX_AGENTS_IN_PROMPT)
    .map((a) => ({
      key: a.name,
      title: String(a.title || a.name).slice(0, 80),
      description: String(a.description || '').replace(/\s+/g, ' ').trim().slice(0, DESC_MAX),
    }));
}

function parseAgentPickJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(body.slice(start, end + 1));
    const agentKey = String(obj?.agentKey || obj?.agent || '').trim();
    if (!agentKey) return null;
    const confidence = Number(obj?.confidence);
    return {
      agentKey,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
      reason: String(obj?.reason || '').slice(0, 200) || null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   query: string,
 *   request?: object,
 *   classification?: object,
 *   agents: object,
 *   focus?: object|null,
 *   llm?: function,
 *   llmIntent?: boolean,
 *   organizationId?: string|null,
 * }} args
 * @returns {Promise<{ agentKey: string, source: 'explicit'|'llm'|'heuristic', reason?: string|null, confidence?: number }>}
 */
async function pickAgentWithLlm(args = {}) {
  const {
    query,
    request = {},
    classification = {},
    agents,
    focus = null,
    llm,
    llmIntent,
    organizationId = null,
  } = args;

  const requested = String(request.agent || '').trim();
  if (requested && requested !== 'auto') {
    if (!agents || agents.hasAgent?.(requested)) {
      return { agentKey: requested, source: 'explicit', confidence: 1, reason: 'request.agent' };
    }
  }

  const fallbackKey = resolveAgentKey(classification, { ...request, query }, agents);
  const useLlm = llmIntent !== false && typeof llm === 'function';
  const cards = buildAgentCards(agents);

  // Nothing meaningful to choose among.
  if (!useLlm || cards.length <= 1) {
    return { agentKey: fallbackKey, source: 'heuristic', confidence: 0, reason: 'llm_skipped' };
  }

  const allowKeys = cards.map((c) => c.key);
  const messages = [
    {
      role: 'system',
      content: [
        'You route Arivu Astra turns to the best specialist agent.',
        'Pick exactly ONE agentKey from ALLOWED_AGENTS for this USER ask and FOCUS.',
        'Rules:',
        '1) Prefer the specialist whose job matches the ask (e.g. deal summary → deal summarizer, not pipeline overview).',
        '2) When FOCUS is a single CRM record, prefer record-scoped agents over portfolio/pipeline agents.',
        '3) Use coworker only when no specialist clearly fits.',
        '4) Never invent an agentKey outside ALLOWED_AGENTS.',
        'Return ONLY JSON: {"agentKey":"...","confidence":0.0,"reason":"short"}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `USER: ${String(query || '').trim()}`,
        `FOCUS: ${formatFocus(focus)}`,
        `INTENT_HINT: ${classification?.intent || 'unknown'}`,
        'ALLOWED_AGENTS:',
        JSON.stringify(cards),
        'Respond with JSON only.',
      ].join('\n'),
    },
  ];

  try {
    const completion = await llm(messages, {
      organizationId: organizationId || request.organizationId || null,
      temperature: 0,
      maxTokens: 120,
    });
    const picked = parseAgentPickJson(completion?.text);
    if (
      picked
      && allowKeys.includes(picked.agentKey)
      && picked.confidence >= MIN_CONFIDENCE
    ) {
      return {
        agentKey: picked.agentKey,
        source: 'llm',
        confidence: picked.confidence,
        reason: picked.reason,
      };
    }
  } catch {
    // fall through
  }

  return {
    agentKey: fallbackKey,
    source: 'heuristic',
    confidence: 0,
    reason: 'llm_fallback',
  };
}

module.exports = {
  pickAgentWithLlm,
  parseAgentPickJson,
  buildAgentCards,
  MIN_CONFIDENCE,
};
