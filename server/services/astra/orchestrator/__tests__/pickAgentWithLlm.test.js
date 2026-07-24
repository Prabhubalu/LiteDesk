'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickAgentWithLlm } = require('../pickAgentWithLlm');
const { registerBuiltinAgents } = require('../../agents/builtinAgents');
const agentRegistry = require('../../agents/agentRegistry');

describe('pickAgentWithLlm — Mission Control entry', () => {
  it('defaults to mission-control', async () => {
    agentRegistry.clearRegistry();
    registerBuiltinAgents(agentRegistry);
    const pick = await pickAgentWithLlm({
      query: 'summarize this deal',
      agents: agentRegistry,
      classification: { intent: 'crm_search', agentKey: 'coworker' },
    });
    assert.equal(pick.agentKey, 'mission-control');
    assert.equal(pick.source, 'mission_control');
  });

  it('honors explicit request.agent', async () => {
    agentRegistry.clearRegistry();
    registerBuiltinAgents(agentRegistry);
    const pick = await pickAgentWithLlm({
      query: 'pipeline',
      request: { agent: 'forecast-pipeline' },
      agents: agentRegistry,
      classification: { intent: 'crm_search' },
    });
    assert.equal(pick.agentKey, 'forecast-pipeline');
    assert.equal(pick.source, 'explicit');
  });
});
