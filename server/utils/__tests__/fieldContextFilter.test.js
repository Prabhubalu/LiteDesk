const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveFieldContextToken,
  isFieldVisibleInContext,
  filterFieldsByContext,
} = require('../fieldContextFilter');

const leadStatusField = {
  key: 'lead_status',
  context: 'app',
  appKey: 'SALES',
};

const salesTypeField = {
  key: 'sales_type',
  context: 'sales',
  appKey: 'SALES',
};

const globalField = {
  key: 'email',
  context: 'global',
};

test('resolveFieldContextToken maps legacy app context via appKey', () => {
  assert.equal(resolveFieldContextToken(leadStatusField), 'sales');
});

test('isFieldVisibleInContext shows sales fields in sales context', () => {
  assert.equal(isFieldVisibleInContext(leadStatusField, 'sales'), true);
  assert.equal(isFieldVisibleInContext(salesTypeField, 'sales'), true);
});

test('isFieldVisibleInContext hides sales fields in platform context', () => {
  assert.equal(isFieldVisibleInContext(leadStatusField, 'platform'), false);
});

test('filterFieldsByContext returns all fields when context is all', () => {
  const fields = [leadStatusField, salesTypeField, globalField];
  assert.equal(filterFieldsByContext(fields, 'all').length, 3);
});

test('isFieldVisibleInContext keeps global fields in platform context', () => {
  assert.equal(isFieldVisibleInContext(globalField, 'platform'), true);
});
