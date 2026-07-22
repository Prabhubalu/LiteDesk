'use strict';

/**
 * bootstrap — register all tools + agents exactly once per process.
 * Idempotent: safe to call from server start, the controller, and tests.
 */

const toolRegistry = require('./tools/toolRegistry');
const agentRegistry = require('./agents/agentRegistry');
const { registerFamilies } = require('./tools/families');
const { registerBuiltinAgents } = require('./agents/builtinAgents');

let bootstrapped = false;

/** Register everything. Returns a summary of what is registered. */
function bootstrapAstra() {
  registerFamilies(toolRegistry);
  registerBuiltinAgents(agentRegistry);
  bootstrapped = true;
  return {
    tools: toolRegistry.listTools(),
    agents: agentRegistry.listAgents(),
  };
}

/** Lazy guard used by the orchestrator so a cold path still works. */
function ensureBootstrapped() {
  if (!bootstrapped || !toolRegistry.hasTool('search.crm')) {
    bootstrapAstra();
  }
}

/** Test helper: force a clean re-bootstrap. */
function resetForTests() {
  bootstrapped = false;
  toolRegistry.clearRegistry();
  agentRegistry.clearRegistry();
}

module.exports = {
  bootstrapAstra,
  ensureBootstrapped,
  resetForTests,
  isBootstrapped: () => bootstrapped,
};
