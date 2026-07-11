const test = require('node:test');
const assert = require('node:assert/strict');
const { INITIAL_PEOPLE_QUICK_CREATE } = require('../peopleModuleDefaults');

test('INITIAL_PEOPLE_QUICK_CREATE matches canonical People quick create fields', () => {
  assert.deepEqual(INITIAL_PEOPLE_QUICK_CREATE, [
    'first_name',
    'last_name',
    'email',
    'mobile',
    'organization',
    'assignedTo',
  ]);
});
