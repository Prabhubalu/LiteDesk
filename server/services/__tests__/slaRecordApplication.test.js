'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateConditionGroup } = require('../../utils/slaConditionEvaluator');
const {
  triggerMatches,
  resolveTargetsForRecord
} = require('../sla/slaPolicyEngine');
const { syncCycleFromInstances, buildSlaContextFromCase } = require('../sla/slaCaseBridgeService');
const casesAdapter = require('../sla/adapters/casesSlaAdapter');

function matchPolicies(policies, record, event) {
  const recordData = casesAdapter.normalizeRecord(record);
  const matched = [];
  for (const policy of policies) {
    if (!evaluateConditionGroup(policy.entryCriteria, recordData)) continue;
    if (!triggerMatches(policy.trigger, recordData, event)) continue;
    matched.push({
      policy,
      targets: resolveTargetsForRecord(policy, recordData, casesAdapter)
    });
  }
  if (matched.length === 0) {
    const fallback = policies.find((p) => p.isDefault);
    if (fallback) {
      matched.push({
        policy: fallback,
        targets: resolveTargetsForRecord(fallback, recordData, casesAdapter)
      });
    }
  }
  return { recordData, matched };
}

describe('sla record application pipeline', () => {
  const defaultPolicy = {
    policyKey: 'default',
    name: 'Default SLA',
    isDefault: true,
    active: true,
    executionMode: 'first_match',
    entryCriteria: { combinator: 'all', clauses: [], groups: [] },
    trigger: { type: 'record_created' },
    targets: [
      { milestoneKey: 'first_response', priorityKey: 'Critical', durationMinutes: 60 },
      { milestoneKey: 'first_response', priorityKey: 'Medium', durationMinutes: 240 },
      { milestoneKey: 'resolution', priorityKey: 'Critical', durationMinutes: 480 },
      { milestoneKey: 'resolution', priorityKey: 'Medium', durationMinutes: 2880 }
    ]
  };

  const vipPolicy = {
    policyKey: 'vip',
    name: 'VIP SLA',
    isDefault: false,
    active: true,
    executionMode: 'first_match',
    entryCriteria: {
      combinator: 'all',
      clauses: [{ field: 'priority', operator: 'in', value: ['High', 'Critical'] }]
    },
    trigger: { type: 'record_created' },
    targets: [
      { milestoneKey: 'first_response', priorityKey: 'Critical', durationMinutes: 30 },
      { milestoneKey: 'resolution', priorityKey: 'Critical', durationMinutes: 240 }
    ]
  };

  it('matches custom policy by entry criteria for Critical cases', () => {
    const record = {
      status: 'New',
      priority: 'Critical',
      caseType: 'Support Ticket',
      channel: 'Internal'
    };
    const { matched } = matchPolicies([vipPolicy, defaultPolicy], record, { type: 'record_created' });
    assert.equal(matched[0].policy.policyKey, 'vip');
    assert.equal(matched[0].targets[0].durationMinutes, 30);
  });

  it('falls back to default policy when no custom policy matches', () => {
    const record = {
      status: 'New',
      priority: 'Medium',
      caseType: 'Support Ticket',
      channel: 'Internal'
    };
    const { matched } = matchPolicies([vipPolicy, defaultPolicy], record, { type: 'record_created' });
    assert.equal(matched[0].policy.policyKey, 'default');
    const fr = matched[0].targets.find((t) => t.milestoneKey === 'first_response');
    assert.equal(fr.durationMinutes, 240);
  });

  it('syncs generic instances onto legacy case cycle fields', () => {
    const startedAt = new Date('2026-06-16T09:00:00.000Z');
    const cycle = {
      cycleNo: 1,
      startedAt,
      status: 'running',
      policySnapshot: {}
    };
    const instances = [
      {
        milestoneKey: 'first_response',
        policyKey: 'default',
        targetAt: new Date('2026-06-16T10:00:00.000Z'),
        policySnapshot: { durationMinutes: 60, name: 'Default SLA' }
      },
      {
        milestoneKey: 'resolution',
        policyKey: 'default',
        targetAt: new Date('2026-06-17T09:00:00.000Z'),
        policySnapshot: { durationMinutes: 480 }
      }
    ];

    const synced = syncCycleFromInstances(cycle, instances);
    assert.equal(synced.responseTargetAt.toISOString(), instances[0].targetAt.toISOString());
    assert.equal(synced.resolutionTargetAt.toISOString(), instances[1].targetAt.toISOString());
    assert.equal(synced.policySnapshot.firstResponseMinutes, 60);
    assert.equal(synced.policySnapshot.resolutionMinutes, 480);
  });

  it('builds SLA context from case record', () => {
    const ctx = buildSlaContextFromCase({
      caseType: 'Incident',
      priority: 'High',
      channel: 'Email'
    });
    assert.equal(ctx.caseType, 'Incident');
    assert.equal(ctx.priority, 'High');
    assert.equal(ctx.channel, 'Email');
  });

  it('adapter pauses on waiting statuses', () => {
    assert.equal(casesAdapter.shouldPause({ status: 'Waiting for Customer' }), true);
    assert.equal(casesAdapter.shouldPause({ status: 'New' }), false);
  });
});
