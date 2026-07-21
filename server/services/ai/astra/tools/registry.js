'use strict';

const { ASTRA_TOOL_NAMES } = require('../orchestrator/pipelineTypes');

/** @type {Map<string, { name: string, description: string, inputSchema: object, execute: Function }>} */
const TOOLS = new Map();

function registerTool(def) {
  if (!def?.name || typeof def.execute !== 'function') {
    throw new Error('Tool requires name and execute');
  }
  TOOLS.set(def.name, {
    name: def.name,
    description: String(def.description || ''),
    inputSchema: def.inputSchema || { type: 'object', properties: {} },
    execute: def.execute,
  });
}

function getTool(name) {
  return TOOLS.get(String(name || '')) || null;
}

function listTools() {
  return Array.from(TOOLS.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

function isRegisteredTool(name) {
  return TOOLS.has(String(name || ''));
}

function assertKnownToolNames(names = []) {
  for (const name of names) {
    if (!ASTRA_TOOL_NAMES.includes(name) && !TOOLS.has(name)) {
      throw new Error(`Unknown Astra tool: ${name}`);
    }
  }
}

let loaded = false;

function ensureToolsLoaded() {
  if (loaded) return;
  loaded = true;
  // Lazy require to avoid circular deps at module load
  require('./searchAccounts');
  require('./searchDeals');
  require('./searchTickets');
  require('./searchActivities');
  require('./searchKnowledgeBase');
  require('./searchProductCatalog');
  require('./searchAutomations');
  require('./searchProcessGraphs');
  require('./searchPermissions');
  require('./searchBusinessRules');
  require('./searchApiMap');
}

module.exports = {
  registerTool,
  getTool,
  listTools,
  isRegisteredTool,
  assertKnownToolNames,
  ensureToolsLoaded,
};
