const test = require('node:test');
const assert = require('node:assert/strict');
const { splitMultiPicklistRawValue } = require('../importPicklistOptionService');

test('splitMultiPicklistRawValue splits comma-separated values', () => {
  assert.deepEqual(splitMultiPicklistRawValue('A, B ,C'), ['A', 'B', 'C']);
});

test('splitMultiPicklistRawValue preserves array input', () => {
  assert.deepEqual(splitMultiPicklistRawValue(['One', ' Two ']), ['One', 'Two']);
});
