'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluateFilter, shouldCredit, isDealWonState } = require('../../services/targets/contributionEvaluator');

describe('targetContribution', () => {
  it('evaluateFilter equals', () => {
    assert.strictEqual(evaluateFilter({ field: 'stage', operator: 'equals', value: 'Won' }, { stage: 'Won' }), true);
    assert.strictEqual(evaluateFilter({ field: 'stage', operator: 'equals', value: 'Won' }, { stage: 'Lost' }), false);
  });

  it('isDealWonState accepts lowercase won and Closed Won stage', () => {
    assert.strictEqual(isDealWonState({ status: 'won', amount: 5000 }), true);
    assert.strictEqual(isDealWonState({ stage: 'Closed Won', amount: 5000 }), true);
    assert.strictEqual(isDealWonState({ status: 'Open', stage: 'Proposal' }), false);
  });

  it('shouldCredit deal.deal.won event with currency amount', () => {
    const rule = {
      moduleKey: 'deals',
      metricKind: 'currency',
      metricField: 'amount',
      filters: [{ field: 'status', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.deal.won' },
      rule,
      { stage: 'Proposal' },
      { status: 'won', amount: 5000 }
    );
    assert.strictEqual(result.direction, 'credit');
    assert.strictEqual(result.amount, 5000);
  });

  it('shouldCredit on status transition to won', () => {
    const rule = {
      moduleKey: 'deals',
      metricKind: 'count',
      filters: [{ field: 'status', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.deal.won' },
      rule,
      { status: 'Open', amount: 1000 },
      { status: 'Won', amount: 1000 }
    );
    assert.strictEqual(result.direction, 'credit');
    assert.strictEqual(result.amount, 1);
  });

  it('shouldCredit legacy stage filter when status is won', () => {
    const rule = {
      moduleKey: 'deals',
      metricKind: 'currency',
      metricField: 'amount',
      filters: [{ field: 'stage', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.deal.won' },
      rule,
      { status: 'Open', stage: 'Proposal', amount: 500 },
      { status: 'Won', stage: 'Closed Won', amount: 500 }
    );
    assert.strictEqual(result.direction, 'credit');
    assert.strictEqual(result.amount, 500);
  });

  it('shouldCredit reversal when un-won', () => {
    const rule = {
      moduleKey: 'deals',
      metricKind: 'currency',
      metricField: 'amount',
      filters: [{ field: 'status', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.updated' },
      rule,
      { status: 'Won', amount: 500 },
      { status: 'Lost', amount: 500 }
    );
    assert.strictEqual(result.direction, 'debit');
    assert.strictEqual(result.amount, 500);
  });

  it('does not debit won deals on spurious filter mismatch', () => {
    const rule = {
      moduleKey: 'deals',
      metricKind: 'currency',
      metricField: 'amount',
      filters: [{ field: 'status', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.updated' },
      rule,
      { stage: 'Closed Won', amount: 5000 },
      { stage: 'Closed Won', status: 'won', amount: 5000 }
    );
    assert.strictEqual(result, null);
  });

  it('shouldCredit completed tasks with lowercase status', () => {
    const rule = {
      moduleKey: 'tasks',
      metricKind: 'count',
      filters: [{ field: 'status', operator: 'equals', value: 'completed' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'task.status.changed' },
      rule,
      { status: 'in_progress' },
      { status: 'completed' }
    );
    assert.strictEqual(result.direction, 'credit');
    assert.strictEqual(result.amount, 1);
  });
});
