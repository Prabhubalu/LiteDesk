'use strict';

/**
 * toolRegistry — the single catalog of callable Astra tools.
 *
 * A tool is a plain object:
 *   { name, family, risk, description, run(input, ctx) => Promise<result> }
 *
 * Registration is idempotent by name (last write wins) so bootstrap can run
 * more than once without throwing.
 */

const { normalizeRisk } = require('../governance/risk');

/** @type {Map<string, object>} */
const registry = new Map();

function registerTool(tool) {
  if (!tool || typeof tool.name !== 'string' || !tool.name) {
    throw new Error('registerTool: tool.name is required');
  }
  if (typeof tool.run !== 'function') {
    throw new Error(`registerTool: tool "${tool.name}" must define run()`);
  }
  registry.set(tool.name, {
    name: tool.name,
    family: tool.family || 'misc',
    risk: normalizeRisk(tool.risk),
    description: tool.description || '',
    inputSchema: tool.inputSchema || null,
    run: tool.run,
  });
  return registry.get(tool.name);
}

function getTool(name) {
  return registry.get(name) || null;
}

function hasTool(name) {
  return registry.has(name);
}

function listTools() {
  return Array.from(registry.values()).map((t) => ({
    name: t.name,
    family: t.family,
    risk: t.risk,
    description: t.description,
  }));
}

function listFamilies() {
  return Array.from(new Set(Array.from(registry.values()).map((t) => t.family)));
}

function clearRegistry() {
  registry.clear();
}

module.exports = {
  registerTool,
  getTool,
  hasTool,
  listTools,
  listFamilies,
  clearRegistry,
};
