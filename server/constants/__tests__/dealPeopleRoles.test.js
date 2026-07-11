const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultDealPersonRole,
  isDealPersonRole,
  normalizeDealPersonRole,
} = require('../dealPeopleRoles');

test('recognizes system deal person roles', () => {
  assert.equal(isDealPersonRole('decision_maker'), true);
  assert.equal(isDealPersonRole('Champion'), true);
  assert.equal(isDealPersonRole('primary_contact'), false);
});

test('migrates legacy primary_contact to decision_maker', () => {
  assert.equal(normalizeDealPersonRole('primary_contact'), 'decision_maker');
  assert.equal(normalizeDealPersonRole('nope'), 'other');
});

test('defaults first person to decision_maker and later to influencer', () => {
  assert.equal(defaultDealPersonRole(false), 'decision_maker');
  assert.equal(defaultDealPersonRole(true), 'influencer');
});
