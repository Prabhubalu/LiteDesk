'use strict';

/**
 * agentRegistry — catalog of Astra agents.
 *
 * An agent is a named capability profile:
 *   { name, title, description, tools: string[], systemHint, autonomy }
 *
 * Agents do not execute directly; the orchestrator uses an agent's tool
 * allow-list and system hint to shape a turn. Registration is idempotent.
 */

/** @type {Map<string, object>} */
const registry = new Map();

function registerAgent(agent) {
  if (!agent || typeof agent.name !== 'string' || !agent.name) {
    throw new Error('registerAgent: agent.name is required');
  }
  registry.set(agent.name, {
    name: agent.name,
    title: agent.title || agent.name,
    description: agent.description || '',
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    systemHint: agent.systemHint || '',
    autonomy: agent.autonomy || 'assist',
  });
  return registry.get(agent.name);
}

function getAgent(name) {
  return registry.get(name) || null;
}

function hasAgent(name) {
  return registry.has(name);
}

function listAgents() {
  return Array.from(registry.values());
}

function clearRegistry() {
  registry.clear();
}

module.exports = {
  registerAgent,
  getAgent,
  hasAgent,
  listAgents,
  clearRegistry,
};
