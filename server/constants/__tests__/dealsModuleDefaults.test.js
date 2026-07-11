const test = require('node:test');
const assert = require('node:assert/strict');
const { INITIAL_DEALS_QUICK_CREATE } = require('../dealsModuleDefaults');

test('INITIAL_DEALS_QUICK_CREATE matches canonical Deals quick create fields', () => {
  assert.deepEqual(INITIAL_DEALS_QUICK_CREATE, [
    'name',
    'accountId',
    'pipeline',
    'stage',
    'expectedCloseDate',
    'amount',
    'assignedTo',
  ]);
});
