'use strict';

const { getTool, ensureToolsLoaded, isRegisteredTool } = require('../tools/registry');
const { writeAiAuditLog } = require('../../aiAuditLogService');

function validateToolInput(schema, input) {
  if (!schema || typeof schema !== 'object') return { ok: true };
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (input?.[key] === undefined || input?.[key] === null || input?.[key] === '') {
      return { ok: false, error: `Missing required input: ${key}` };
    }
  }
  return { ok: true };
}

/**
 * Execute an ExecutionPlan via registered tools (tenant-scoped).
 */
async function runToolPlan({
  plan,
  organizationId,
  userId,
  user = null,
  config = null,
  auditBase = null,
  onProgress = null,
} = {}) {
  ensureToolsLoaded();
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const results = [];
  const byStepId = new Map();

  for (const step of steps) {
    const stepId = String(step.id || step.tool || '');
    const toolName = String(step.tool || '');
    const optional = Boolean(step.optional);
    const started = Date.now();

    if (typeof onProgress === 'function') {
      try {
        onProgress({ step: 'retrieving', detail: toolName });
      } catch (_) { /* ignore */ }
    }

    if (!isRegisteredTool(toolName)) {
      const failed = {
        tool: toolName,
        stepId,
        ok: false,
        data: null,
        citations: [],
        error: `Unknown tool: ${toolName}`,
        latencyMs: Date.now() - started,
      };
      results.push(failed);
      byStepId.set(stepId, failed);
      if (!optional) break;
      continue;
    }

    const tool = getTool(toolName);
    const input = {
      ...(step.input && typeof step.input === 'object' ? step.input : {}),
      organizationId,
      userId,
      user,
      config,
    };

    const validation = validateToolInput(tool.inputSchema, input);
    if (!validation.ok) {
      const failed = {
        tool: toolName,
        stepId,
        ok: false,
        data: null,
        citations: [],
        error: validation.error,
        latencyMs: Date.now() - started,
      };
      results.push(failed);
      byStepId.set(stepId, failed);
      if (!optional) break;
      continue;
    }

    try {
      const data = await tool.execute(input);
      const citations = Array.isArray(data?.citations) ? data.citations : [];
      const ok = {
        tool: toolName,
        stepId,
        ok: true,
        data,
        citations,
        error: null,
        latencyMs: Date.now() - started,
      };
      results.push(ok);
      byStepId.set(stepId, ok);

      if (auditBase) {
        try {
          await writeAiAuditLog({
            ...auditBase,
            abilityKey: 'tenant_agent_tool',
            status: 'success',
            latencyMs: ok.latencyMs,
            metadata: {
              tool: toolName,
              stepId,
              citationCount: citations.length,
            },
          });
        } catch (_) { /* non-fatal */ }
      }
    } catch (err) {
      const failed = {
        tool: toolName,
        stepId,
        ok: false,
        data: null,
        citations: [],
        error: String(err?.message || err),
        latencyMs: Date.now() - started,
      };
      results.push(failed);
      byStepId.set(stepId, failed);

      if (auditBase) {
        try {
          await writeAiAuditLog({
            ...auditBase,
            abilityKey: 'tenant_agent_tool',
            status: 'failed',
            latencyMs: failed.latencyMs,
            errorCode: err?.code || 'AI_ASTRA_TOOL_FAILED',
            errorMessage: failed.error,
            metadata: { tool: toolName, stepId },
          });
        } catch (_) { /* non-fatal */ }
      }

      if (!optional) break;
    }
  }

  return { results, byStepId };
}

module.exports = {
  runToolPlan,
  validateToolInput,
};
