'use strict';

/**
 * Multi-step agent loop: plan → execute → observe → reflect (max 3 tool steps).
 */

const MAX_STEPS = 3;

function observeToolResult(toolName, result) {
  if (!result) {
    return { ok: false, empty: true, error: true, note: 'No tool result' };
  }
  if (result.needsConfirmation || result.confirmationRequired || result.confirmToken) {
    return { ok: true, empty: false, needsConfirm: true, note: 'Confirmation required' };
  }
  if (result.unsupported || result.refuse) {
    return { ok: false, empty: true, note: result.guidance || 'Unsupported / refuse' };
  }
  if (result.ok === false && !result.hits) {
    return { ok: false, empty: true, error: true, note: result.guidance || 'Tool failed' };
  }
  const hits = result.hits || result.records || [];
  const empty = Array.isArray(hits) && hits.length === 0 && result.counts?.total === 0;
  if (empty || result.weak) {
    return { ok: true, empty: true, weak: Boolean(result.weak), note: result.guidance || 'Empty or weak hits' };
  }
  return { ok: true, empty: false, note: result.guidance || 'ok' };
}

function reflectNextTool({ intent, query, lastTool, observation, tried }) {
  if (observation.needsConfirm) return null;
  if (!observation.empty && observation.ok) return null;

  const lower = String(query || '').toLowerCase();
  const candidates = [];

  if (intent === 'knowledge' || /article|faq|policy|how do|knowledge/.test(lower)) {
    candidates.push('knowledge.search', 'module.search');
  }
  if (/invoice|payment|refund|quote|order/.test(lower)) {
    candidates.push('module.search', 'search.crm');
  }
  candidates.push('search.crm', 'module.search', 'knowledge.search', 'crm.record.get');

  for (const name of candidates) {
    if (name === lastTool) continue;
    if (tried.has(name)) continue;
    return name;
  }
  return null;
}

function moduleKeyFromQuery(query) {
  const lower = String(query || '').toLowerCase();
  if (/\binvoices?\b/.test(lower)) return 'invoices';
  if (/\bpayments?\b/.test(lower)) return 'payments';
  if (/\brefunds?\b/.test(lower)) return 'refunds';
  if (/\bcases?\b|\btickets?\b/.test(lower)) return 'cases';
  if (/\bdeals?\b|\bpipeline\b/.test(lower)) return 'deals';
  if (/\bpeople\b|\bcontacts?\b|\bleads?\b/.test(lower)) return 'people';
  return null;
}

/**
 * @returns {Promise<{ toolName: string, toolResult: object, steps: object[] }>}
 */
async function runAgentToolLoop({
  registry,
  ctx,
  agent,
  intent,
  query,
  initialToolName,
  agentAllowsTool,
}) {
  const tried = new Set();
  const steps = [];
  let toolName = initialToolName;
  let toolResult = null;
  let retries = 0;

  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (!toolName || typeof agentAllowsTool === 'function' && !agentAllowsTool(agent, toolName)) {
      break;
    }
    const tool = registry.getTool(toolName);
    if (!tool || typeof tool.run !== 'function') {
      steps.push({ toolName, observe: { ok: false, note: 'Tool missing' } });
      break;
    }

    tried.add(toolName);
    const input = { query };
    if (toolName.startsWith('module.')) {
      input.moduleKey = moduleKeyFromQuery(query) || 'deals';
    }
    if (toolName === 'knowledge.search') {
      input.audience = 'internal';
    }

    try {
      toolResult = await tool.run(input, ctx);
    } catch (err) {
      if (retries < 1) {
        retries += 1;
        i -= 1; // retry same tool once
        steps.push({ toolName, observe: { ok: false, error: true, note: err?.message || 'transient', retry: true } });
        continue;
      }
      toolResult = { ok: false, guidance: err?.message || 'Tool error' };
    }

    // Normalize fabric results to CRM shape (entity) so polish/coach paths work
    if (toolResult && !toolResult.entity && toolResult.moduleKey) {
      toolResult = { ...toolResult, entity: toolResult.moduleKey };
    }
    if (toolResult && !toolResult.entity && toolName.startsWith('module.') && input.moduleKey) {
      toolResult = { ...toolResult, entity: input.moduleKey, moduleKey: input.moduleKey };
    }

    const observation = observeToolResult(toolName, toolResult);
    steps.push({ toolName, observe: observation, resultSummary: toolResult?.guidance || null });

    if (observation.needsConfirm || (observation.ok && !observation.empty)) {
      break;
    }

    const next = reflectNextTool({ intent, query, lastTool: toolName, observation, tried });
    if (!next) break;
    toolName = next;
  }

  return { toolName: steps[steps.length - 1]?.toolName || initialToolName, toolResult, steps };
}

module.exports = {
  MAX_STEPS,
  observeToolResult,
  reflectNextTool,
  runAgentToolLoop,
};
