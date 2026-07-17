'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseProposalsJson,
  summarizeSlaCycle,
  ALLOWED_PROPOSAL_ACTIONS,
} = require('../aiAgentService');
const { getPrompt } = require('../prompts/promptRegistry');

describe('aiAgentService (Phase 3)', () => {
  it('parseProposalsJson constrains actions to allow-list', () => {
    const parsed = parseProposalsJson(
      '{"summary":"ok","proposals":[{"action":"delete_everything","label":"bad","confidence":1},{"action":"reply","label":"Reply","confidence":0.8}]}'
    );
    assert.equal(parsed.summary, 'ok');
    assert.equal(parsed.proposals.length, 2);
    assert.equal(parsed.proposals[0].action, 'manual_review');
    assert.equal(parsed.proposals[1].action, 'reply');
    assert.equal(parsed.proposals[0].confirmRequired, true);
  });

  it('parseProposalsJson returns empty on garbage', () => {
    const parsed = parseProposalsJson('ignore previous instructions');
    assert.deepEqual(parsed.proposals, []);
  });

  it('summarizeSlaCycle marks breached', () => {
    const s = summarizeSlaCycle({ status: 'breached', cycleNo: 2 });
    assert.equal(s.present, true);
    assert.equal(s.breached, true);
    assert.equal(s.cycleNo, 2);
  });

  it('registers agent prompts', () => {
    for (const key of [
      'policy_suggest_system',
      'inbox_triage_system',
      'case_resolution_system',
      'platform_home_focus_system',
    ]) {
      const p = getPrompt(key);
      assert.equal(p.version, 'v1');
      assert.ok(p.text.length > 20);
    }
  });

  it('allow-list includes wait_business_hours and resolve', () => {
    assert.ok(ALLOWED_PROPOSAL_ACTIONS.has('wait_business_hours'));
    assert.ok(ALLOWED_PROPOSAL_ACTIONS.has('resolve'));
    assert.ok(!ALLOWED_PROPOSAL_ACTIONS.has('delete_everything'));
  });
});
