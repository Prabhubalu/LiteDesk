'use strict';

/**
 * legacyMap — maps legacy ai/ concepts to their Astra v2 equivalents.
 * Used by cutover + migration so we can trace every legacy surface to its
 * replacement before deleting server/services/ai/.
 */

/** Legacy ability/endpoint → v2 tool or orchestrator entrypoint. */
const ABILITY_TO_V2 = Object.freeze({
  ask: 'orchestrator:crm_search',
  askKnowledge: 'tool:knowledge.search',
  askWorkGraph: 'orchestrator:crm_search',
  tenant_agent: 'orchestrator:agent',
  astra_synthesize_agent: 'orchestrator:agent',
  astra_mutation: 'tool:email.send|calendar.createEvent',
  summarize: 'orchestrator:crm_search',
  next_best_action: 'autonomous:nextBestActions',
});

/** Legacy service file → v2 module owning that responsibility. */
const SERVICE_TO_V2 = Object.freeze({
  'aiTenantAgentService.js': 'astra/orchestrator/runOrchestrator.js',
  'aiAstraCrmAnswerService.js': 'astra/orchestrator/runOrchestrator.js',
  'aiAstraIntentCapabilities.js': 'astra/orchestrator/runOrchestrator.js (classifyIntent)',
  'aiAstraNextBestActionService.js': 'astra/autonomous/autonomousService.js',
  'aiAstraSkillsRegistry.js': 'astra/tools/toolRegistry.js',
  'aiAstraSuperAgentsCatalog.js': 'astra/agents/builtinAgents.js',
  'aiUserMemoryService.js': 'astra/memory/personalMemoryService.js',
  'providerRegistry.js': 'reused by astra/models/modelRouter.js',
  'aiSettingsResolver.js': 'reused by astra/models/modelRouter.js',
  'piiRedaction.js': 'reused by astra/governance/pii.js',
  'aiCreditService.js': 'reused by astra/governance/credits.js',
  'aiAuditLogService.js': 'reused by astra/governance/audit.js',
});

function resolveV2Ability(legacyAbility) {
  return ABILITY_TO_V2[String(legacyAbility || '')] || null;
}

module.exports = {
  ABILITY_TO_V2,
  SERVICE_TO_V2,
  resolveV2Ability,
};
