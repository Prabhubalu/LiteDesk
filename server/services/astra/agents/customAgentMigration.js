'use strict';

/**
 * customAgentMigration — maps legacy tenant agents (AiTenantAgent) onto the v2
 * agent spec so tenant-authored agents survive the cutover. Pure functions; the
 * caller decides whether to persist or register the results.
 */

const { getTool } = require('../tools/toolRegistry');

/** Map a legacy tool/skill name to a v2 tool name where a clear equivalent exists. */
const LEGACY_TOOL_MAP = Object.freeze({
  search_deals: 'crm.deals',
  search_cases: 'crm.cases',
  search_people: 'crm.people',
  search_crm: 'search.crm',
  knowledge_base: 'knowledge.search',
  draft_email: 'email.draft',
  send_email: 'email.send',
  create_event: 'calendar.createEvent',
  run_report: 'reports.run',
});

/** Translate a list of legacy tool identifiers to known v2 tools. */
function mapLegacyTools(legacyTools = []) {
  const mapped = [];
  for (const raw of legacyTools) {
    const key = String(raw || '').trim().toLowerCase();
    const v2 = LEGACY_TOOL_MAP[key] || (getTool(key) ? key : null);
    if (v2 && !mapped.includes(v2)) mapped.push(v2);
  }
  return mapped;
}

/**
 * Convert a legacy AiTenantAgent document into a v2 agent spec.
 * @param {Object} legacyAgent
 * @returns {{ name, title, description, tools: string[], systemHint, autonomy, legacyId: string|null }}
 */
function migrateLegacyAgent(legacyAgent = {}) {
  const name = String(legacyAgent.slug || legacyAgent.key || legacyAgent.name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') || `legacy-agent-${legacyAgent._id || 'unknown'}`;

  const legacyTools = legacyAgent.tools
    || legacyAgent.enabledTools
    || legacyAgent.skills
    || [];

  const tools = mapLegacyTools(legacyTools);
  return {
    name,
    title: legacyAgent.name || name,
    description: legacyAgent.description || legacyAgent.purpose || '',
    tools: tools.length ? tools : ['search.crm'],
    systemHint: legacyAgent.instructions || legacyAgent.systemPrompt || '',
    autonomy: legacyAgent.autonomy || 'assist',
    legacyId: legacyAgent._id ? String(legacyAgent._id) : null,
  };
}

module.exports = {
  LEGACY_TOOL_MAP,
  mapLegacyTools,
  migrateLegacyAgent,
};
