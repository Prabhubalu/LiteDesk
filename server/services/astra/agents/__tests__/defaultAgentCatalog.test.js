'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  getBuiltinAgents,
  getSeedBuiltinAgents,
  SPECIALIST_KEYS,
  MISSION_CONTROL_KEY,
  assertNoCrmInCatalog,
  PROMPT_DIR,
  CATALOG_META,
} = require('../defaultAgentCatalog');
const { registerBuiltinAgents } = require('../builtinAgents');
const agentRegistry = require('../agentRegistry');
const {
  planSpecialists,
  isMissionControlKey,
} = require('../../orchestrator/missionControl');
const { pickAgentWithLlm } = require('../../orchestrator/pickAgentWithLlm');

const REQUIRED_SECTIONS = [
  'Goal',
  'Responsibilities',
  'Permissions',
  'Confirmation Rules',
  'Success Criteria',
];

describe('defaultAgentCatalog', () => {
  it('ships Mission Control + 19 specialists (20 total)', () => {
    const agents = getBuiltinAgents();
    assert.equal(agents.length, 20);
    assert.equal(getSeedBuiltinAgents().length, 20);
    assert.equal(SPECIALIST_KEYS.length, 19);
    assert.ok(agents.some((a) => a.name === MISSION_CONTROL_KEY));
    assert.ok(!agents.some((a) => /strategic.?advisor/i.test(a.name)));
  });

  it('bans CRM in titles, descriptions, and prompts', () => {
    assert.equal(assertNoCrmInCatalog(), true);
    for (const a of getBuiltinAgents()) {
      assert.doesNotMatch(`${a.title}\n${a.description}\n${a.systemHint}`, /\bCRM\b/i);
    }
  });

  it('prompt files include required PDF sections', () => {
    for (const meta of CATALOG_META) {
      const text = fs.readFileSync(path.join(PROMPT_DIR, `${meta.name}.md`), 'utf8');
      for (const section of REQUIRED_SECTIONS) {
        assert.match(text, new RegExp(`##\\s+${section}\\b`), `${meta.name} missing ${section}`);
      }
      assert.doesNotMatch(text, /\bCRM\b/);
      assert.doesNotMatch(text, /Strategic Advisor/);
    }
  });

  it('registers builtins and coworker alias to Mission Control', () => {
    agentRegistry.clearRegistry();
    registerBuiltinAgents(agentRegistry);
    assert.ok(agentRegistry.hasAgent('mission-control'));
    assert.ok(agentRegistry.hasAgent('summary'));
    assert.ok(agentRegistry.hasAgent('coworker'));
    assert.equal(agentRegistry.getAgent('coworker').title, 'Astra Mission Control');
  });

  it('Mission Control plans multi-specialist meeting prep', () => {
    agentRegistry.clearRegistry();
    registerBuiltinAgents(agentRegistry);
    const plan = planSpecialists({
      query: 'Prepare me for tomorrow\'s renewal meeting',
      intent: 'meeting_prep',
      agents: agentRegistry,
    });
    assert.ok(plan.specialists.length >= 3);
    assert.ok(plan.specialists.includes('meeting-intelligence') || plan.specialists.includes('customer-360'));
  });

  it('Ask defaults to Mission Control unless explicit agent', async () => {
    agentRegistry.clearRegistry();
    registerBuiltinAgents(agentRegistry);
    const auto = await pickAgentWithLlm({
      query: 'show open deals',
      agents: agentRegistry,
      classification: { intent: 'crm_search' },
    });
    assert.equal(auto.agentKey, 'mission-control');
    assert.equal(auto.source, 'mission_control');

    const explicit = await pickAgentWithLlm({
      query: 'show open deals',
      request: { agent: 'search' },
      agents: agentRegistry,
      classification: { intent: 'crm_search' },
    });
    assert.equal(explicit.agentKey, 'search');
    assert.equal(explicit.source, 'explicit');
  });

  it('read-only specialists use assist autonomy; writers use confirm', () => {
    const byName = Object.fromEntries(getBuiltinAgents().map((a) => [a.name, a]));
    assert.equal(byName.summary.autonomy, 'assist');
    assert.equal(byName['deal-intelligence'].autonomy, 'assist');
    assert.equal(byName['record-creation'].autonomy, 'confirm');
    assert.equal(byName.email.autonomy, 'confirm');
    assert.ok(byName.email.tools.includes('email.draft'));
    assert.ok(byName['mission-control'].tools.includes('agent.handoff'));
    assert.ok(!byName['mission-control'].tools.includes('module.create'));
  });

  it('isMissionControlKey recognizes alias', () => {
    assert.equal(isMissionControlKey('mission-control'), true);
    assert.equal(isMissionControlKey('coworker'), true);
    assert.equal(isMissionControlKey('summary'), false);
  });
});
