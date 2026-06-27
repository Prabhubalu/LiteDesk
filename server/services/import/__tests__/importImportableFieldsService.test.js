const test = require('node:test');
const assert = require('node:assert/strict');
const { getBaseFieldsForKey } = require('../../../controllers/moduleController');
const {
  mergeSavedFieldsWithBase,
  resolvePlatformAppKey,
  isImportableField,
} = require('../importImportableFieldsService');

test('resolvePlatformAppKey uses sales for deals and platform for core modules', () => {
  assert.equal(resolvePlatformAppKey('deals'), 'sales');
  assert.equal(resolvePlatformAppKey('organizations'), 'platform');
  assert.equal(resolvePlatformAppKey('people'), 'platform');
  assert.equal(resolvePlatformAppKey('tasks'), 'platform');
});

test('mergeSavedFieldsWithBase appends missing schema fields such as name', () => {
  const baseFields = getBaseFieldsForKey('organizations');
  const savedFields = [{ key: 'industry', label: 'Industry', dataType: 'Picklist' }];

  const merged = mergeSavedFieldsWithBase(baseFields, savedFields);
  const keys = merged.map((field) => field.key);

  assert.ok(keys.includes('name'), 'expected schema base field name to be merged in');
  assert.ok(keys.includes('industry'), 'expected saved override field to remain');
});

test('mergeSavedFieldsWithBase falls back to base fields when saved config is empty', () => {
  const baseFields = getBaseFieldsForKey('tasks');
  const merged = mergeSavedFieldsWithBase(baseFields, []);
  const keys = merged.map((field) => field.key);

  assert.ok(keys.includes('title'));
  assert.ok(keys.includes('status'));
});

test('isImportableField excludes tenant infrastructure fields from organization import', () => {
  assert.equal(isImportableField({ key: 'name' }, 'organizations'), true);
  assert.equal(isImportableField({ key: 'slug', isTenantField: true }, 'organizations'), false);
});
