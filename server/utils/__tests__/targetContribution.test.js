'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluateFilter, shouldCredit } = require('../../services/targets/contributionEvaluator');

describe('targetContribution', () => {
  it('evaluateFilter equals', () => {
    assert.strictEqual(evaluateFilter({ field: 'stage', operator: 'equals', value: 'Won' }, { stage: 'Won' }), true);
    assert.strictEqual(evaluateFilter({ field: 'stage', operator: 'equals', value: 'Won' }, { stage: 'Lost' }), false);
  });

  it('shouldCredit on stage transition to won', () => {
    const rule = {
      metricKind: 'count',
      filters: [{ field: 'stage', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.stage.changed' },
      rule,
      { stage: 'Proposal' },
      { stage: 'Won', amount: 1000 }
    );
    assert.strictEqual(result.direction, 'credit');
    assert.strictEqual(result.amount, 1);
  });

  it('shouldCredit reversal when un-won', () => {
    const rule = {
      metricKind: 'currency',
      metricField: 'amount',
      filters: [{ field: 'stage', operator: 'equals', value: 'Won' }],
      weight: 1
    };
    const result = shouldCredit(
      { eventType: 'deal.stage.changed' },
      rule,
      { stage: 'Won', amount: 500 },
      { stage: 'Lost', amount: 500 }
    );
    assert.strictEqual(result.direction, 'debit');
    assert.strictEqual(result.amount, 500);
  });
});
