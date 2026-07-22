'use strict';

/**
 * workflowAgent — runs an ordered list of tool steps as one unit.
 *
 * Each step: { tool: string, input?: object }. Steps run sequentially; a
 * failing step is captured (ok:false) and does not abort the remaining steps
 * unless `stopOnError` is set. Write/destructive tools that return a
 * confirm_action contract halt the workflow and surface the contract.
 */

const toolRegistry = require('../tools/toolRegistry');
const { needsConfirmation } = require('../governance/confirmAction');

/**
 * @param {{ workflow?: string, steps?: Array<{tool: string, input?: object}>, stopOnError?: boolean }} plan
 * @param {object} ctx  orchestration context ({ organizationId, userId, deps })
 */
async function runWorkflowAgent(plan = {}, ctx = {}) {
  const registry = ctx.toolRegistry || toolRegistry;
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const results = [];

  for (const step of steps) {
    const tool = registry.getTool(step.tool);
    if (!tool) {
      results.push({ tool: step.tool, ok: false, error: 'UNKNOWN_TOOL' });
      if (plan.stopOnError) break;
      continue;
    }

    const input = step.input || {};
    if (needsConfirmation(tool, input)) {
      const contract = await tool.run(input, ctx);
      results.push({ tool: step.tool, ok: false, awaitingConfirmation: true, result: contract });
      break;
    }

    try {
      const result = await tool.run(input, ctx);
      results.push({ tool: step.tool, ok: true, result });
    } catch (error) {
      results.push({ tool: step.tool, ok: false, error: error.message });
      if (plan.stopOnError) break;
    }
  }

  const ranCount = results.filter((r) => r.ok).length;
  return {
    workflow: plan.workflow || 'ad-hoc',
    steps: results,
    summary: `Ran ${ranCount}/${steps.length} steps.`,
    completed: results.every((r) => r.ok),
  };
}

module.exports = { runWorkflowAgent };
