'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateConditionGroup } = require('../../utils/slaConditionEvaluator');
const { triggerMatches, resolveTargetsForRecord } = require('../sla/slaPolicyEngine');
const { mapLegacyPolicy, mapDefaultSlaPolicy, DEFAULT_SLA_POLICY_KEY } = require('../sla/slaPolicyMigrationService');

describe('slaConditionEvaluator', () => {
  it('evaluates nested AND/OR groups', () => {
    const data = { priority: 'Critical', caseType: 'Incident', channel: 'Email' };
    const group = {
      combinator: 'all',
      clauses: [{ field: 'priority', operator: 'equals', value: 'Critical' }],
      groups: [{
        combinator: 'any',
        clauses: [
          { field: 'caseType', operator: 'equals', value: 'Incident' },
          { field: 'caseType', operator: 'equals', value: 'Problem' }
        ]
      }]
    };
    assert.equal(evaluateConditionGroup(group, data), true);
  });

  it('supports in operator', () => {
    const data = { priority: 'High' };
    const group = {
      combinator: 'all',
      clauses: [{ field: 'priority', operator: 'in', value: ['High', 'Critical'] }]
    };
    assert.equal(evaluateConditionGroup(group, data), true);
  });
});

describe('slaPolicyEngine triggers', () => {
  it('matches field_change trigger', () => {
    const trigger = { type: 'field_change', field: 'status', toValue: 'Open' };
    const record = { status: 'Open' };
    const event = { type: 'field_change', field: 'status', fromValue: 'New', toValue: 'Open' };
    assert.equal(triggerMatches(trigger, record, event), true);
  });
});

describe('slaPolicyMigrationService', () => {
  it('maps legacy helpdesk policy to generic shape', () => {
    const mapped = mapLegacyPolicy({
      key: 'vip',
      name: 'VIP',
      enabled: true,
      caseTypes: ['Incident'],
      priorities: ['High', 'Critical'],
      priorityTargets: {
        High: { firstResponseMinutes: 60, resolutionMinutes: 480 }
      }
    }, { standardTargets: {}, defaultPolicyKey: null, businessHours: null });

    assert.equal(mapped.scope.moduleKey, 'cases');
    assert.equal(mapped.entryCriteria.clauses.length, 2);
    assert.equal(mapped.targets.length, 2);
    assert.equal(mapped.targets[0].milestoneKey, 'first_response');
  });

  it('maps default SLA policy with isDefault when no custom default key', () => {
    const mapped = mapDefaultSlaPolicy({
      slaPriorityTargets: {
        High: { firstResponseMinutes: 60, resolutionMinutes: 480 }
      },
      defaultSlaPolicyKey: null,
      businessHours: { enabled: true },
      notifications: { notifyOnSlaWarning: true, notifyOnSlaBreach: true }
    });
    assert.equal(mapped.policyKey, DEFAULT_SLA_POLICY_KEY);
    assert.equal(mapped.isDefault, true);
    assert.equal(mapped.targets.length, 2);
  });
});

describe('resolveTargetsForRecord', () => {
  it('picks priority-specific targets', () => {
    const policy = {
      targets: [
        { milestoneKey: 'first_response', priorityKey: 'Low', durationMinutes: 480 },
        { milestoneKey: 'first_response', priorityKey: 'Critical', durationMinutes: 60 }
      ]
    };
    const adapter = { priorityDimension: 'priority' };
    const targets = resolveTargetsForRecord(policy, { priority: 'Critical' }, adapter);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].durationMinutes, 60);
  });
});
