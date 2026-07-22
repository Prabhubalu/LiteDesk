'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  proposalFingerprint,
  inferTrigger,
  isAutopilotEnabled,
} = require('../astraAutopilotService');

describe('astraAutopilotService', () => {
  it('builds stable fingerprints for navigable and create actions', () => {
    const follow = proposalFingerprint({
      kind: 'follow_up',
      moduleKey: 'deals',
      recordId: '507f1f77bcf86cd799439011',
    }, 'stale_deal');
    assert.equal(follow, 'follow_up:deals:507f1f77bcf86cd799439011:stale_deal');

    const create = proposalFingerprint({
      kind: 'create_record',
      moduleKey: 'tasks',
      fields: { relatedTo: { type: 'deal', id: '507f1f77bcf86cd799439011' } },
    }, 'stale_deal');
    assert.equal(create, 'create_record:tasks:507f1f77bcf86cd799439011:stale_deal');
  });

  it('infers trigger from action kind/rationale', () => {
    assert.equal(inferTrigger({
      kind: 'complete_task',
      rationale: 'Overdue by 2 days',
    }), 'attention_overdue');
    assert.equal(inferTrigger({
      kind: 'review_record',
      rationale: 'SLA breached',
    }), 'case_sla');
    assert.equal(inferTrigger({
      kind: 'follow_up',
      rationale: 'No activity for 18 days',
    }), 'stale_deal');
  });

  it('reads ASTRA_AUTOPILOT_V1 flag', () => {
    const prev = process.env.ASTRA_AUTOPILOT_V1;
    process.env.ASTRA_AUTOPILOT_V1 = 'true';
    assert.equal(isAutopilotEnabled(), true);
    process.env.ASTRA_AUTOPILOT_V1 = 'false';
    assert.equal(isAutopilotEnabled(), false);
    if (prev === undefined) delete process.env.ASTRA_AUTOPILOT_V1;
    else process.env.ASTRA_AUTOPILOT_V1 = prev;
  });
});
