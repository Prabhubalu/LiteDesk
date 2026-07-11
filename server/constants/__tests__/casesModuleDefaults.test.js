const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INITIAL_CASES_QUICK_CREATE,
  isInitialCaseRequiredField,
  isCasesFormExcludedField,
} = require('../casesModuleDefaults');

test('INITIAL_CASES_QUICK_CREATE matches canonical Cases quick create fields', () => {
  assert.deepEqual(INITIAL_CASES_QUICK_CREATE, [
    'title',
    'contactId',
    'organizationRefId',
    'caseType',
    'priority',
    'status',
    'assignedTo',
  ]);
});

test('contactId is an initial Cases required field', () => {
  assert.equal(isInitialCaseRequiredField('contactId'), true);
  assert.equal(isInitialCaseRequiredField('organizationRefId'), false);
});

test('server-managed case fields are form-excluded', () => {
  assert.equal(isCasesFormExcludedField('conversationCount'), true);
  assert.equal(isCasesFormExcludedField('aiSummary'), true);
  assert.equal(isCasesFormExcludedField('threadId'), true);
  assert.equal(isCasesFormExcludedField('title'), false);
});
