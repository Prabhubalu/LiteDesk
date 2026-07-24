'use strict';

/**
 * builtinAgents — Platform default Astra seats (Mission Control + specialists).
 * Specs: ./defaultAgentCatalog.js + ./defaultAgents/*.md
 */

const {
  getBuiltinAgents,
  getSeedBuiltinAgents,
  MISSION_CONTROL_KEY,
  COWORKER_ALIAS,
  SPECIALIST_KEYS,
  assertNoCrmInCatalog,
} = require('./defaultAgentCatalog');

function registerBuiltinAgents(registry) {
  assertNoCrmInCatalog();
  const agents = getBuiltinAgents();
  for (const agent of agents) {
    registry.registerAgent(agent);
  }
  // Soft-alias: legacy "coworker" resolves to Mission Control profile
  const mc = agents.find((a) => a.name === MISSION_CONTROL_KEY);
  if (mc) {
    registry.registerAgent({
      ...mc,
      name: COWORKER_ALIAS,
      title: mc.title,
      description: mc.description,
    });
  }
  return registry.listAgents();
}

module.exports = {
  get BUILTIN_AGENTS() {
    return getBuiltinAgents();
  },
  get SEED_BUILTIN_AGENTS() {
    return getSeedBuiltinAgents();
  },
  MISSION_CONTROL_KEY,
  COWORKER_ALIAS,
  SPECIALIST_KEYS,
  registerBuiltinAgents,
};
