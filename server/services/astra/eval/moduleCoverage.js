'use strict';

/**
 * moduleCoverage — OOTB CI: every registry module must map to Astra tools + Platform seats.
 * Fails closed when a module has no search/tool coverage or its app has no agent.
 */

const { listModules } = require('../tools/moduleCatalog');
const toolRegistry = require('../tools/toolRegistry');
const agentRegistry = require('../agents/agentRegistry');
const { ensureBootstrapped } = require('../bootstrap');
const { SPECIALIST_KEYS, MISSION_CONTROL_KEY } = require('../agents/defaultAgentCatalog');

/** moduleKey → dedicated tool names (search.crm also covers ready modules). */
const MODULE_TOOLS = {
  people: ['search.crm', 'crm.people', 'crm.people.create', 'crm.record.get'],
  organizations: ['search.crm', 'crm.organizations.create', 'crm.record.get'],
  deals: ['search.crm', 'crm.deals', 'crm.deals.create', 'crm.deals.update', 'crm.record.get'],
  quotes: ['search.crm', 'quotes.draft'],
  sales_orders: ['search.crm'],
  tasks: ['search.crm', 'crm.tasks', 'crm.tasks.create'],
  events: ['search.crm', 'crm.events', 'calendar.createEvent'],
  documents: ['search.crm', 'documents.search'],
  items: ['search.crm'],
  forms: ['search.crm'],
  templates: ['documents.search', 'search.crm'],
  imports: ['search.crm'],
  inventory: ['inventory.stock.get', 'search.crm'],
  cases: ['search.crm', 'crm.cases', 'crm.cases.create'],
  articles: ['knowledge.search', 'search.crm'],
  campaigns: ['campaigns.search', 'search.crm'],
  blog: ['documents.search', 'search.crm'],
  audiences: ['audiences.search', 'search.crm'],
  segments: ['audiences.search', 'search.crm'],
  assets: ['documents.search', 'search.crm'],
  responses: ['search.crm'],
};

/** appKey → required Platform default agent names */
const APP_AGENTS = {
  sales: ['deal-intelligence', 'forecast-pipeline', 'record-creation', 'email'],
  helpdesk: ['case-intelligence', 'knowledge-intelligence'],
  marketing: ['email', 'conversation-intelligence', 'search'],
  inventory: ['search', 'data-quality'],
  audit: ['process-intelligence', 'data-quality', 'analytics-decision'],
  portal: ['knowledge-intelligence'],
  control_plane: ['integration-intelligence'],
  platform: [
    MISSION_CONTROL_KEY,
    'summary',
    'search',
    'task-activity',
    'workday-orchestrator',
    'relationship-intelligence',
    'customer-360',
  ],
};

/**
 * @returns {{ ok: boolean, missingTools: object[], missingAgents: object[], modules: number, agents: number, tools: number }}
 */
function checkModuleCoverage() {
  ensureBootstrapped();
  const modules = listModules();
  const missingTools = [];
  const missingAgents = [];

  for (const mod of modules) {
    const required = MODULE_TOOLS[mod.moduleKey] || ['search.crm'];
    const present = required.filter((t) => toolRegistry.hasTool(t));
    if (present.length === 0) {
      missingTools.push({ moduleKey: mod.moduleKey, required });
    }
  }

  for (const [appKey, agents] of Object.entries(APP_AGENTS)) {
    for (const name of agents) {
      if (!agentRegistry.hasAgent(name)) {
        missingAgents.push({ appKey, agent: name });
      }
    }
  }

  // Full Platform default catalog must be present
  for (const name of [MISSION_CONTROL_KEY, ...SPECIALIST_KEYS]) {
    if (!agentRegistry.hasAgent(name)) {
      missingAgents.push({ appKey: 'platform_defaults', agent: name });
    }
  }

  return {
    ok: missingTools.length === 0 && missingAgents.length === 0,
    missingTools,
    missingAgents,
    modules: modules.length,
    agents: agentRegistry.listAgents().length,
    tools: toolRegistry.listTools().length,
  };
}

module.exports = {
  checkModuleCoverage,
  MODULE_TOOLS,
  APP_AGENTS,
};
