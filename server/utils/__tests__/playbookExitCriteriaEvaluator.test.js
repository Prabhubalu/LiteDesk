'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePlaybookExitCondition,
  evaluatePlaybookExitConditions,
  evaluateCustomPlaybookExitCriteria
} = require('../playbookExitCriteriaEvaluator');

test('evaluatePlaybookExitCondition supports numeric and string operators', () => {
  const deal = { amount: 15000, status: 'Open', name: 'Enterprise Deal' };

  assert.equal(
    evaluatePlaybookExitCondition({ field: 'amount', operator: 'gte', value: 10000 }, deal),
    true
  );
  assert.equal(
    evaluatePlaybookExitCondition({ field: 'status', operator: 'equals', value: 'open' }, deal),
    true
  );
  assert.equal(
    evaluatePlaybookExitCondition({ field: 'name', operator: 'contains', value: 'enterprise' }, deal),
    true
  );
});

test('evaluateCustomPlaybookExitCriteria requires conditions and completed required actions', () => {
  const deal = { amount: 25000 };
  const actions = [
    { actionKey: 'a', status: 'completed', required: true },
    { actionKey: 'b', status: 'pending', required: false }
  ];

  assert.equal(
    evaluateCustomPlaybookExitCriteria(actions, {
      type: 'custom',
      conditions: [{ field: 'amount', operator: 'gte', value: 20000 }]
    }, deal).met,
    true
  );

  assert.equal(
    evaluateCustomPlaybookExitCriteria(actions, {
      type: 'custom',
      conditions: [{ field: 'amount', operator: 'gte', value: 30000 }]
    }, deal).met,
    false
  );

  assert.equal(
    evaluateCustomPlaybookExitCriteria(
      [{ actionKey: 'a', status: 'pending', required: true }],
      { type: 'custom', conditions: [{ field: 'amount', operator: 'gte', value: 20000 }] },
      deal
    ).met,
    false
  );

  assert.equal(
    evaluateCustomPlaybookExitCriteria(actions, { type: 'custom', conditions: [] }, deal).met,
    false
  );
});
