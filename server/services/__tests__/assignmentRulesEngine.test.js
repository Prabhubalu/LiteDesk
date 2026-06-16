'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateClause,
  evaluateConditionGroup,
  normalizeMultiValue
} = require('../assignmentRulesEngine');

test('normalizeMultiValue parses JSON string arrays', () => {
  assert.deepEqual(normalizeMultiValue('["Customer","Partner"]'), ['Customer', 'Partner']);
  assert.deepEqual(normalizeMultiValue(['VIP']), ['VIP']);
});

test('equals matches overlapping multi-picklist tags', () => {
  const matched = evaluateClause(
    { field: 'tags', operator: 'equals', value: ['Customer', 'Partner'] },
    { tags: ['Customer', 'VIP'] }
  );
  assert.equal(matched, true);
});

test('in matches when record tags overlap condition values', () => {
  const matched = evaluateClause(
    { field: 'tags', operator: 'in', value: ['Customer', 'Partner'] },
    { tags: '["Customer","VIP"]' }
  );
  assert.equal(matched, true);
});

test('not_in rejects overlapping tags', () => {
  const matched = evaluateClause(
    { field: 'tags', operator: 'not_in', value: ['Customer'] },
    { tags: ['Customer'] }
  );
  assert.equal(matched, false);
});

test('priority picklist equals is case-insensitive', () => {
  const matched = evaluateClause(
    { field: 'priority', operator: 'equals', value: 'high' },
    { priority: 'High' }
  );
  assert.equal(matched, true);
});

test('exists treats empty tag arrays as missing', () => {
  assert.equal(evaluateClause({ field: 'tags', operator: 'exists', value: null }, { tags: [] }), false);
  assert.equal(evaluateClause({ field: 'tags', operator: 'exists', value: null }, { tags: ['VIP'] }), true);
});

test('evaluateConditionGroup respects combinator', () => {
  const allMatch = evaluateConditionGroup({
    combinator: 'all',
    clauses: [
      { field: 'priority', operator: 'equals', value: 'High' },
      { field: 'tags', operator: 'in', value: ['VIP'] }
    ]
  }, { priority: 'High', tags: ['VIP', 'Customer'] });
  assert.equal(allMatch, true);

  const anyMatch = evaluateConditionGroup({
    combinator: 'any',
    clauses: [
      { field: 'priority', operator: 'equals', value: 'Low' },
      { field: 'tags', operator: 'in', value: ['VIP'] }
    ]
  }, { priority: 'High', tags: ['VIP'] });
  assert.equal(anyMatch, true);
});
