'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeAggregateMetric,
  compareAggregateMetric
} = require('../marketingAudienceAggregateEvaluator');

test('computeAggregateMetric supports count sum and avg', () => {
  const records = [{ amount: 100 }, { amount: 200 }, { amount: 300 }];
  assert.equal(computeAggregateMetric('count', records, 'amount'), 3);
  assert.equal(computeAggregateMetric('sum', records, 'amount'), 600);
  assert.equal(computeAggregateMetric('avg', records, 'amount'), 200);
});

test('compareAggregateMetric evaluates numeric thresholds', () => {
  assert.equal(compareAggregateMetric(3, 'gte', 2), true);
  assert.equal(compareAggregateMetric(1, 'gt', 2), false);
  assert.equal(compareAggregateMetric(5, 'between', [4, 6]), true);
  assert.equal(compareAggregateMetric(5, 'eq', 5), true);
});
