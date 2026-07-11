const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INITIAL_ORGANIZATION_QUICK_CREATE,
  INITIAL_ORGANIZATION_KEY_FIELDS,
} = require('../organizationModuleDefaults');

test('INITIAL_ORGANIZATION_QUICK_CREATE matches canonical Organization quick create fields', () => {
  assert.deepEqual(INITIAL_ORGANIZATION_QUICK_CREATE, [
    'name',
    'industry',
    'phone',
    'website',
    'assignedTo',
    'types',
  ]);
});

test('INITIAL_ORGANIZATION_KEY_FIELDS matches canonical Organization key fields', () => {
  assert.deepEqual(INITIAL_ORGANIZATION_KEY_FIELDS, [
    'types',
    'derivedStatus',
    'industry',
    'phone',
    'annualRevenue',
    'assignedTo',
  ]);
});
