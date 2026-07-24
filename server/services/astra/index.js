'use strict';

/**
 * Astra v2 — public service surface.
 *
 * Layered architecture (see docs/ASTRA_V2_ARCHITECTURE.md):
 *   Context → Orchestrator → Agents → Tools → Models
 * with cross-cutting Governance (risk/audit/credits/pii/confirm) and Memory.
 *
 * Product = Arivu (the CRM). Platform = Astra (the AI layer).
 */

const flags = require('./flags');
const bootstrap = require('./bootstrap');
const modelRouter = require('./models/modelRouter');
const { runOrchestrator } = require('./orchestrator/runOrchestrator');
const toolRegistry = require('./tools/toolRegistry');
const agentRegistry = require('./agents/agentRegistry');
const tenantCatalogService = require('./agents/tenantCatalogService');
const { planCrmSearch } = require('./tools/families');
const autonomousService = require('./autonomous/autonomousService');
const personalMemoryService = require('./memory/personalMemoryService');
const orgMemoryService = require('./memory/orgMemoryService');
const sessionMemory = require('./memory/sessionMemory');
const { assembleContext } = require('./context/contextEngine');
const cutover = require('./compat/cutover');
const goldenIntent = require('./eval/goldenIntent');

module.exports = {
  flags,
  bootstrap,
  bootstrapAstra: bootstrap.bootstrapAstra,
  ensureBootstrapped: bootstrap.ensureBootstrapped,
  modelRouter,
  runOrchestrator,
  toolRegistry,
  agentRegistry,
  tenantCatalogService,
  planCrmSearch,
  autonomousService,
  personalMemoryService,
  orgMemoryService,
  sessionMemory,
  assembleContext,
  cutover,
  goldenIntent,
};
